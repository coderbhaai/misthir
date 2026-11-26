import Coupon from "lib/models/coupon/Coupon";
import CouponUsageLog from "lib/models/coupon/CouponUsageLog";
import CouponUser from "lib/models/coupon/CouponUser";
import CartCoupon, { CartCouponDoc } from 'lib/models/coupon/CartCoupon';
import Cart from "lib/models/ecom/Cart";
import CouponTarget from "lib/models/coupon/CouponTarget";
import ProductProductmeta from "lib/models/product/ProductProductmeta";
import { Types } from "mongoose";
import CartSkuDiscount from "lib/models/ecom/CartSkuDiscount";
import { extractId } from "./dataService";
import { cartCheck, getPopulatedCartQuery } from "./ecomService";

export async function validateCoupon(coupon_code: string, user_id?: string) {
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

function isCouponActive(validity: unknown, now: Date): boolean {
  if (!validity) return true;
  const expiry = new Date(validity as string | Date);
  if (Number.isNaN(expiry.getTime())) return true;
  return expiry.getTime() >= now.getTime();
}

async function getRevisedSkuLineAmount(item: any, skuDiscountDoc: any, itemSellerId: string, now: Date): Promise<number> {
  const sku = item.sku_id;
  const quantity = Number(item.quantity ?? 0);
  if (!sku || quantity <= 0) return 0;

  const basePrice = Number(sku.price ?? item.price ?? 0);
  const salePrice = Number(sku.sale ?? item.sale ?? 0);
  const unitPrice = salePrice > 0 && salePrice < basePrice ? salePrice : basePrice;
  const baseLineTotal = unitPrice * quantity;

  if (!skuDiscountDoc || !isCouponActive(skuDiscountDoc.seller_discount_validity, now)) {
    return Math.max(0, baseLineTotal);
  }

  const discountSellerId = await extractId(skuDiscountDoc.seller_id);
  if (discountSellerId && itemSellerId && discountSellerId !== itemSellerId) {
    return Math.max(0, baseLineTotal);
  }

  const rawDiscount = Number(skuDiscountDoc.seller_discount ?? 0);
  if (!rawDiscount || rawDiscount <= 0) {
    return Math.max(0, baseLineTotal);
  }

  const discountAmount =
    skuDiscountDoc.discount_type === "percent"
      ? (baseLineTotal * rawDiscount) / 100
      : rawDiscount;

  return Math.max(0, Number((baseLineTotal - Math.min(baseLineTotal, discountAmount)).toFixed(2)));
}

export async function handleApplyCoupon(cart_id: string) {
  const cart: any = await getPopulatedCartQuery(cart_id);
  if (!cart) return { success: false, message: "Cart not found" };

  const coupon_code = cart?.cartCoupon?.coupon_code;
  if( !coupon_code ){ return { success: false, message: "Coupon not found" }; }

  const userId = cart.user_id?.toString();
  const { valid, message, coupon } = await validateCoupon(coupon_code, userId);
  if (!valid || !coupon) { await remove_coupon(cart_id); return { success: false, message }; }

  const coupon_seller_id = await extractId(coupon?.seller_id);
  const targets = await CouponTarget.find({ coupon_id: coupon._id }).lean();
  const hasTargets = targets.length > 0;
  const targetSkus = new Set(targets.filter((t) => t.module === "Sku").map((t) => t.module_id.toString()));
  const targetProducts = new Set(targets.filter((t) => t.module === "Product").map((t) => t.module_id.toString()));
  const targetBrands = new Set(targets.filter((t) => t.module === "ProductBrand").map((t) => t.module_id.toString()));
  const targetTypes = new Set(targets.filter((t) => t.module === "ProductType").map((t) => t.module_id.toString()));

  let productTypeMap = new Set<string>();
  if (targetTypes.size > 0) {
      const allProductIds = cart.cartSkus.map((item: any) => item.product_id?._id || item.product_id);
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
  let totalEligibleAmount = 0;

  for (const item of cart.cartSkus) {
    const sku = item.sku_id;
    const quantity = item.quantity ?? 0;
    if (!sku || quantity <= 0) continue;

    const product = item.product_id;
    const productId = product?._id?.toString() || product?.toString();
    const skuId = sku._id?.toString();
    const itemSellerId =
    await extractId(item.seller_id) || await extractId(product?.seller_id);
    
    if (coupon_seller_id && itemSellerId !== coupon_seller_id) { continue; }

    if (hasTargets) {
      let isEligible = false;

      const productBrandIds = product?.brands?.map( (b: any) => b.productBrand_id?._id?.toString() || b.productBrand_id?.toString() ) || [];
      const matchesBrand = productBrandIds.some((bId: string) => targetBrands.has(bId));

      if (skuId && targetSkus.has(skuId)) {
          isEligible = true;
      } else if (productId && targetProducts.has(productId)) {
          isEligible = true;
      } else if (targetBrands.size > 0 && matchesBrand) {
          isEligible = true;
      } else if (productId && productTypeMap.has(productId)) {
          isEligible = true;
      }

      if (!isEligible) continue;
    }

    const skuDiscountDoc = discountByCartSkuId.get(await extractId(item._id));
    const revisedLineAmount = getRevisedSkuLineAmount(item, skuDiscountDoc, itemSellerId, now);

    totalEligibleAmount += await revisedLineAmount;
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

  let discount_amount = coupon.discount_type === "Percent Based" ? (totalEligibleAmount * (coupon.discount || 0)) / 100 : coupon.discount || 0;
  discount_amount = Number(Math.min(totalEligibleAmount, discount_amount).toFixed(2));
  let admin_coupon_discount = coupon.coupon_by === "Seller" ? 0 : discount_amount;
  let seller_coupon_discount = coupon.coupon_by === "Seller" ? discount_amount : 0;

  await upsertCartCoupon(cart_id, { coupon_id: coupon._id, admin_coupon_discount, seller_coupon_discount, coupon_code, }); 

  if (userId) {
      await CouponUsageLog.create({
        coupon_id: coupon._id,
        user_id: userId,
        module: "Cart",
        module_id: cart._id,
        discount_applied: discount_amount,
      });
  }

  return { success: true, message: "Coupon Applied Successfully" };
}