import Coupon from "lib/models/coupon/Coupon";
import CouponUsageLog from "lib/models/coupon/CouponUsageLog";
import CouponUser from "lib/models/coupon/CouponUser";
import CartCoupon, { CartCouponDoc } from 'lib/models/coupon/CartCoupon';
import CouponTarget from "lib/models/coupon/CouponTarget";
import ProductProductmeta from "lib/models/product/ProductProductmeta";
import { Types } from "mongoose";
import CartSkuDiscount from "lib/models/ecom/CartSkuDiscount";
import { extractId } from "./dataService";
import { cartCheck, getPopulatedCartQuery, isValidUntil } from "./ecomService";
import CartCharges from "lib/models/ecom/CartCharges";
import { logError } from "./errorService";

export async function validateCoupon(coupon_code: string, user_id?: string) {
  try{
    const coupon = await Coupon.findOne({ coupon_code, status: true }).populate("seller_id").exec();
    if (!coupon) return { valid: false, message: "Invalid or inactive coupon code" };
  
    const now = new Date();
    if (now < new Date(coupon.valid_from) || now > new Date(coupon.valid_to)) { return { valid: false, message: "Coupon has expired or is not yet active" }; }
    
    if (user_id) {
      if (coupon.usage_type === "Single Usage") {
        const priorUsageCount = await CouponUsageLog.countDocuments({ coupon_id: coupon._id, user_id });
        if (priorUsageCount > 0) { return { valid: false, message: "This single-usage coupon has already been used by you." }; }
      }
  
      if (coupon.usage_type === "Specific Users") {
        const isAllowed = await CouponUser.findOne({ coupon_id: coupon._id, user_id });
        if (!isAllowed) { return { valid: false, message: "You are not authorized to use this coupon." }; }
      }
    } else if (coupon.usage_type === "Single Usage" || coupon.usage_type === "Specific Users") {
      return { valid: false, message: "Please login to use this coupon." };
    }
  
    return { valid: true, message: "Coupon is valid", coupon };
  } catch (error) { 
    await logError(error, { function: "validateCoupon", payload: { coupon_code, user_id } });
    return { valid: false, message: "Internal Server Error", coupon: null };
  }
}

export async function remove_coupon(cart_id: string) {
  await CartCoupon.deleteOne({ cart_id });
  await cartCheck(cart_id);
}

export async function upsertCartCoupon( cart_id: string | Types.ObjectId, data: Partial<CartCouponDoc>): Promise<CartCouponDoc> {
  let cartCoupon = await CartCoupon.findOne({ cart_id });

  if (!cartCoupon) {
    cartCoupon = new CartCoupon({ cart_id, ...data });
  } else {
    Object.assign(cartCoupon, data);
  }

  return await cartCoupon.save();
}

function getSkuUnitPriceLocal(item: any): number {
  const price = Number(item?.price ?? 0);
  const sale = Number(item?.sale ?? 0);
  return sale > 0 && sale < price ? sale : price;
}

async function getSkuSellerDiscountAmount(
  skuDiscountDoc: any,
  unitPrice: number,
  qty: number,
  baseLineAmount: number,
  now: Date
): Promise<number> {
  if (!skuDiscountDoc || unitPrice <= 0 || qty <= 0 || baseLineAmount <= 0) return 0;

  const isActive = await isValidUntil(skuDiscountDoc.seller_discount_validity, now);
  if (!isActive) return 0;

  const rate = Number(skuDiscountDoc.seller_discount ?? 0);
  if (rate <= 0) return 0;

  const discountType: "flat" | "percent" =
    skuDiscountDoc.discount_type === "percent" ? "percent" : "flat";
  const rawPerUnit =
    discountType === "percent" ? (unitPrice * Math.min(rate, 100)) / 100 : rate;
  const perUnitDiscount = Math.min(unitPrice, Math.max(0, rawPerUnit));

  return Number(Math.min(baseLineAmount, perUnitDiscount * qty).toFixed(2));
}

async function getTotalCartAdminDiscount(
  cart_id: string,
  postSellerCartSubtotal: number,
  now: Date
): Promise<number> {
  if (postSellerCartSubtotal <= 0) return 0;

  const charges: any = await CartCharges.findOne({ cart_id }).lean();
  if (!charges) return 0;

  const isActive = await isValidUntil(charges.admin_discount_validity, now);
  if (!isActive) return 0;

  const rate = Number(charges.admin_discount ?? 0);
  if (rate <= 0) return 0;

  const adminType: "flat" | "percent" =
    charges.admin_discount_type === "percent" ? "percent" : "flat";
  const rawAdminDiscount =
    adminType === "percent"
      ? (postSellerCartSubtotal * Math.min(rate, 100)) / 100
      : rate;

  return Number(
    Math.min(postSellerCartSubtotal, Math.max(0, rawAdminDiscount)).toFixed(2)
  );
}

export async function handleApplyCoupon(
  cart_id: string,
  overrideCouponCode?: string,
  options: { logUsage?: boolean } = {}
) {
  try {
    const cart: any = await getPopulatedCartQuery(cart_id);
    if (!cart) return { success: false, message: "Cart not found" };

    let coupon_code = overrideCouponCode?.trim() || cart?.cartCoupon?.coupon_code;
    if (!coupon_code) {
      const existingCouponDoc: any = await CartCoupon.findOne({ cart_id }).lean();
      coupon_code = existingCouponDoc?.coupon_code;
    }

    if (!coupon_code) {
      return { success: false, message: "Coupon not found" };
    }

    const userId = cart.user_id?.toString();
    const { valid, message, coupon } = await validateCoupon(coupon_code, userId);
    if (!valid || !coupon) {
      await remove_coupon(cart_id);
      return { success: false, message };
    }

    const coupon_seller_id = await extractId(coupon?.seller_id);
    const targets = await CouponTarget.find({ coupon_id: coupon._id }).lean();
    const hasTargets = targets.length > 0;

    const targetSkus = new Set(
      targets.filter((t) => t.module === "Sku").map((t) => t.module_id.toString())
    );
    const targetProducts = new Set(
      targets.filter((t) => t.module === "Product").map((t) => t.module_id.toString())
    );
    const targetBrands = new Set(
      targets.filter((t) => t.module === "ProductBrand").map((t) => t.module_id.toString())
    );
    const targetTypes = new Set(
      targets.filter((t) => t.module === "ProductType").map((t) => t.module_id.toString())
    );

    const productTypeMap = new Set<string>();
    if (targetTypes.size > 0) {
      const allProductIds = (cart.cartSkus || []).map(
        (item: any) => item.product_id?._id || item.product_id
      );
      const metas = await ProductProductmeta.find({
        product_id: { $in: allProductIds },
        productmeta_id: { $in: Array.from(targetTypes) },
      }).lean();
      metas.forEach((m) => productTypeMap.add(m.product_id.toString()));
    }

    const skuDiscountDocs = await CartSkuDiscount.find({ cart_id }).lean();
    const discountByCartSkuId = new Map<string, any>();
    for (const doc of skuDiscountDocs) {
      discountByCartSkuId.set(await extractId(doc.cart_sku_id), doc);
    }

    const now = new Date();
    const preparedLines: Array<{
      quantity: number;
      postSellerAmount: number;
      eligibleForCoupon: boolean;
    }> = [];

    let postSellerCartSubtotal = 0;
    let totalCartUnits = 0;

    for (const item of cart.cartSkus || []) {
      const sku = item.sku_id;
      const quantity = Number(item.quantity ?? 0);
      if (!sku || quantity <= 0) continue;

      const product = item.product_id;
      const productId = product?._id?.toString() || product?.toString();
      const skuId = sku._id?.toString();
      const itemSellerId =
        (await extractId(item.seller_id)) || (await extractId(product?.seller_id));

      const unitPrice = getSkuUnitPriceLocal(item);
      const baseLineAmount = Number((unitPrice * quantity).toFixed(2));
      const cartSkuKey = await extractId(item._id);
      const skuDiscountDoc = discountByCartSkuId.get(cartSkuKey);

      const sellerDisc = await getSkuSellerDiscountAmount(
        skuDiscountDoc,
        unitPrice,
        quantity,
        baseLineAmount,
        now
      );
      const postSellerAmount = Number(
        Math.max(0, baseLineAmount - sellerDisc).toFixed(2)
      );

      postSellerCartSubtotal = Number(
        (postSellerCartSubtotal + postSellerAmount).toFixed(2)
      );
      totalCartUnits += quantity;

      let eligibleForCoupon = true;
      if (coupon_seller_id && itemSellerId !== coupon_seller_id) {
        eligibleForCoupon = false;
      }

      if (eligibleForCoupon && hasTargets) {
        let matchesTarget = false;
        const productBrandIds =
          product?.brands?.map(
            (b: any) =>
              b.productBrand_id?._id?.toString() || b.productBrand_id?.toString()
          ) || [];
        const matchesBrand = productBrandIds.some((bId: string) =>
          targetBrands.has(bId)
        );

        if (skuId && targetSkus.has(skuId)) {
          matchesTarget = true;
        } else if (productId && targetProducts.has(productId)) {
          matchesTarget = true;
        } else if (targetBrands.size > 0 && matchesBrand) {
          matchesTarget = true;
        } else if (productId && productTypeMap.has(productId)) {
          matchesTarget = true;
        }

        eligibleForCoupon = matchesTarget;
      }

      preparedLines.push({
        quantity,
        postSellerAmount,
        eligibleForCoupon,
      });
    }

    const totalAdminDiscount = await getTotalCartAdminDiscount(
      cart_id,
      postSellerCartSubtotal,
      now
    );

    const adminPerUnit = totalCartUnits > 0 ? totalAdminDiscount / totalCartUnits : 0;
    let remainingAdminPool = totalAdminDiscount;
    let totalEligibleAmount = 0;

    for (let i = 0; i < preparedLines.length; i++) {
      const line = preparedLines[i];
      if (line.postSellerAmount <= 0 || totalAdminDiscount <= 0) {
        if (line.eligibleForCoupon) {
          totalEligibleAmount += line.postSellerAmount;
        }
        continue;
      }

      const isLast = i === preparedLines.length - 1;
      const rawShare = isLast
        ? remainingAdminPool
        : adminPerUnit * line.quantity;

      const allocatedAdminDiscount = Number(
        Math.min(line.postSellerAmount, remainingAdminPool, Math.max(0, rawShare)).toFixed(2)
      );

      remainingAdminPool = Number(
        Math.max(0, remainingAdminPool - allocatedAdminDiscount).toFixed(2)
      );

      const netLineAmount = Number(
        Math.max(0, line.postSellerAmount - allocatedAdminDiscount).toFixed(2)
      );

      if (line.eligibleForCoupon) {
        totalEligibleAmount += netLineAmount;
      }
    }

    totalEligibleAmount = Number(totalEligibleAmount.toFixed(2));

    if (coupon.sales && totalEligibleAmount < coupon.sales) {
      await remove_coupon(cart_id);
      const sellerName = coupon?.seller_id?.name;

      const message = coupon?.seller_id
        ? `To apply this coupon, your eligible purchases from **${sellerName}** must reach at least ₹${coupon.sales}. Current eligible amount is ₹${totalEligibleAmount}.`
        : `Minimum eligible order amount must be ₹${coupon.sales} to apply this coupon. Current eligible amount is ₹${totalEligibleAmount}.`;

      return { success: false, message };
    }

    if (totalEligibleAmount <= 0) {
      await remove_coupon(cart_id);
      return { success: false, message: "No eligible items in cart for this coupon." };
    }

    let discount_amount =
      coupon.discount_type === "Percent Based"
        ? (totalEligibleAmount * (coupon.discount || 0)) / 100
        : coupon.discount || 0;
    discount_amount = Number(Math.min(totalEligibleAmount, discount_amount).toFixed(2));
    const admin_coupon_discount = coupon.coupon_by === "Seller" ? 0 : discount_amount;
    const seller_coupon_discount = coupon.coupon_by === "Seller" ? discount_amount : 0;

    await upsertCartCoupon(cart_id, {
      coupon_id: coupon._id,
      admin_coupon_discount,
      seller_coupon_discount,
      coupon_code,
    });

    if (options.logUsage && userId) {
      await CouponUsageLog.create({
        coupon_id: coupon._id,
        user_id: userId,
        module: "Cart",
        module_id: cart._id,
        discount_applied: discount_amount,
      });
    }

    return { success: true, message: "Coupon Applied Successfully" };
  } catch (error) {
    await logError(error, { function: "handleApplyCoupon", payload: { cart_id } });
    return { success: false, message: "Failed to apply coupon" };
  }
}