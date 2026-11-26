import Sku from "lib/models/product/Sku";
import SkuDetail from "lib/models/product/SkuDetail";
import mongoose, { Types } from "mongoose";
import { getProp, isDateValid, pivotEntry } from "./dataService";
import { logError } from "./errorService";
import SkuProductFeature from "lib/models/product/SkuProductFeature";
import { NextApiRequest } from "next";
import { getUserIdFromToken } from "./authService";
import User from "lib/models/spatie/User";
import OrderConsent from "lib/models/ecom/OrderConsent";
import OrderOrderConsent from "lib/models/ecom/OrderOrderConsent";
import { applySalesAndGetUpsells } from "pages/api/ecom/sales";
import Cart from "lib/models/ecom/Cart";
import CartCharges from "lib/models/ecom/CartCharges";
import { setCookie } from "hooks/CookieHook";
import CartSku, { CartSkuDoc } from "lib/models/ecom/CartSku";
import CartSkuDetail from "lib/models/ecom/CartSkuDetail";
import CartSkuDiscount from "lib/models/ecom/CartSkuDiscount";
import { handleApplyCoupon, syncCartCouponSuggestions } from "./couponService";

export interface SellerResolveResult {
  sellerId: string | null;
  error?: { status: number; message: string };
}

export async function create_cart(req: any, res: any) {
  try {
    const data = req.body;
    const user_id = await getUserIdFromToken(req);
    let payable_amount = 0;
    
    const newEntry = new Cart({
      user_id: user_id,
      billing_address_id: data.billing_address_id,
      shipping_address_id: data.shipping_address_id,
      paymode: "cod",
      weight: data.weight,
      total: data.total,
      payable_amount: payable_amount,
      user_remarks: data.user_remarks,
    });

    const savedCart = await newEntry.save();
    const cartId = savedCart._id.toString();
    setCookie(res, 'cartId', cartId);
    return cartId;
  } catch (error) { return await logError(error, { function: "create_cart", payload: req.body }); }
}

export async function update_cart(req: any, cart_id: string): Promise<{ status: boolean; message: string; upsell_message?: string }> {
  try {
    const data = req.body;
    const sku = await Sku.findOne({ _id: data.sku_id }).populate({ path: 'product_id', populate: { path: 'seller_id' } }).exec();
    if (!sku) { return { status: false, message: 'SKU not found' }; }
    if (!sku.product_id){ return { status: false, message: 'SKU does not have a linked product' }; }
    if (!cart_id || !mongoose.Types.ObjectId.isValid(cart_id)) { return { status: false, message: 'Invalid cart_id' }; }

    const cart: any = await getPopulatedCartQuery(cart_id);
    if (!cart) { return { status: false, message: 'Cart not found' }; }

    const flavor_id = data.flavor_id || null;
    const color_id = data.color_id || null;

    let cartSkus = await CartSku.find({ cart_id, sku_id: data.sku_id }).populate('details').exec();

    let cartSku = cartSkus.find(item => {
      const details = (item as any).details || [];
      const itemFlavor = details.find((d: any) => d.module_id.toString() === flavor_id)?.module_id?.toString() || null;
      const itemColor = details.find((d: any) => d.module_id.toString() === color_id)?.module_id?.toString() || null;
      
      return itemFlavor === flavor_id && itemColor === color_id;
    });

    let message = "";

    if (cartSku) {
      if (data.action === 'add_to_cart') {
        cartSku.quantity += data.quantity || 1;
      } else if (data.action === 'remove_from_cart') {
        cartSku.quantity -= 1;
      }

      if (cartSku.quantity <= 0) {
        await cartSku.remove();
        message = 'Cart SKU entry removed as quantity became 0';
      } else {
        await cartSku.save();
        message = "Cart Updated";
      }
    } else {
      if (data.action === 'add_to_cart') {
        const product = sku.product_id as any;
        const newCartSku = new CartSku({
          cart_id,
          sku_id: data.sku_id,
          quantity: data.quantity || 1,
          product_id: product._id,
          seller_id: product.seller_id?._id,
          price: sku?.price,
          sale: sku?.price,
        });
        const savedCartSku = await newCartSku.save();

        const detailPromises = [];
        const module = 'ProductFeature';

        if (flavor_id) {
          detailPromises.push(CartSkuDetail.create({ cart_id, cart_sku_id: savedCartSku._id, module, module_id: flavor_id }));
        }

        if (color_id) {
          detailPromises.push(CartSkuDetail.create({ cart_id, cart_sku_id: savedCartSku._id, module, module_id: color_id }));
        }

        await Promise.all(detailPromises);
        message = "Cart Entry Created";
      } else {
        return { status: false, message: 'Cannot remove from cart; entry does not exist' };
      }
    }

    await cartCheck(cart_id);
    return { status: true, message };
  } catch (error) { 
    await logError(error, { function: "update_cart", payload: req.body }); 
    return { status: false, message: "Error updating cart" }; 
  }
}

export async function getSellerIdFromToken(req: NextApiRequest): Promise<SellerResolveResult> {
  try {
    let tokenSellerId: string | null = null;

    const userId = await getUserIdFromToken(req);
    if (userId) {
      const user = await User.findOne({ _id: userId, status: true })
        .populate({
          path: "rolesAttached",
          populate: { path: "role_id", model: "SpatieRole", select: "name" },
        })
        .lean<any>()
        .exec();

      if (user) {
        const roleNames: string[] =
          user.rolesAttached?.map((r: any) => r?.role_id?.name).filter(Boolean) || [];

        if (roleNames.includes("Seller")) {
          tokenSellerId = user._id.toString();
        }

        // if (roleNames.includes("Staff")) {
        //   const staffLink = await SellerStaff.findOne({ user_id: user._id, status: true })
        //     .select("seller_id")
        //     .lean<any>();
        //   tokenSellerId = staffLink?.seller_id ? staffLink.seller_id.toString() : null;
        // }
      }
    }

    if (!tokenSellerId) {
      return { sellerId: null };
    }

    if (!mongoose.Types.ObjectId.isValid(tokenSellerId)) {
      return { sellerId: null, error: { status: 400, message: "Invalid seller ID." } };
    }

    const rawParamSellerId =
      (req.query?.seller_id as string | undefined) ??
      (req.body?.seller_id as string | undefined);

    if (rawParamSellerId && !mongoose.Types.ObjectId.isValid(rawParamSellerId)) {
      return { sellerId: null, error: { status: 400, message: "Invalid seller ID." } };
    }

    if (rawParamSellerId && tokenSellerId !== String(rawParamSellerId)) {
      return { sellerId: null, error: { status: 403, message: "Access denied." } };
    }

    return { sellerId: tokenSellerId };
  } catch (error) {
    await logError(error, { function: "getSellerIdFromToken", payload: req.body });
    return { sellerId: null };
  }
}

export async function getLinkedProductIds(model: mongoose.Model<any>, field: string, values: string[]): Promise<mongoose.Types.ObjectId[]> {
  if (!values?.length) return [];
  const ids = values.map(id => new mongoose.Types.ObjectId(id));

  const links = await model.find({ [field]: { $in: ids } }).select("product_id");
  return links.map(l => l.product_id);
}

interface UpsertSkuInput {
  _id?: string;
  product_id: string | Types.ObjectId;
  name: string;
  item_code?: string;
  unit?: string;
  price_per_unit?: number;
  price: number;
  inventory: number;
  status?: boolean;
  displayOrder?: number;
  adminApproval?: boolean;
  eggless_id?: string;
  sugarfree_id?: string;
  gluttenfree_id?: string;
  weight?: number;
  length?: number;
  width?: number;
  height?: number;
  preparationTime?: number;
  flavors?: string[];
  colors?: string[];
}

export async function upsertSku(data: UpsertSkuInput) {
  try {
    const extractId = (val: any) => (typeof val === 'object' && val !== null ? val._id : val);

    const egglessId = extractId(data.eggless_id);
    const sugarfreeId = extractId(data.sugarfree_id);
    const gluttenfreeId = extractId(data.gluttenfree_id);
    const flavorIds = Array.isArray(data.flavors) ? data.flavors.map(extractId) : [];
    const colorIds = Array.isArray(data.colors) ? data.colors.map(extractId) : [];
    
    let sku;
    const isValidId = data._id && mongoose.isValidObjectId(data._id);

    if (isValidId) {
      const queryId = new mongoose.Types.ObjectId(data._id);

      sku = await Sku.findOneAndUpdate({ _id: queryId }, {
          product_id: data.product_id,
          name: data.name,
          item_code: data.item_code,
          unit: data.unit,
          price_per_unit: data.price_per_unit,
          price: data.price,
          inventory: data.inventory,
          status: data.status ?? true,
          displayOrder: data.displayOrder ?? 0,
          adminApproval: data.adminApproval ?? true,
          eggless_id: egglessId,
          sugarfree_id: sugarfreeId,
          gluttenfree_id: gluttenfreeId,
          updatedAt: new Date(),
        }, { new: true });
        
      if (!sku) {
        sku = new Sku({
          product_id: data.product_id,
          name: data.name,
          item_code: data.item_code,
          unit: data.unit,
          price_per_unit: data.price_per_unit,
          price: data.price,
          inventory: data.inventory,
          status: data.status ?? true,
          displayOrder: data.displayOrder ?? 0,
          adminApproval: data.adminApproval ?? true,
          eggless_id: egglessId,
          sugarfree_id: sugarfreeId,
          gluttenfree_id: gluttenfreeId,
        });
        await sku.save();
      }
    } else {
      sku = new Sku({
        product_id: data.product_id,
        name: data.name,
        item_code: data.item_code,
        unit: data.unit,
        price_per_unit: data.price_per_unit,
        price: data.price,
        inventory: data.inventory,
        status: data.status ?? true,
        displayOrder: data.displayOrder ?? 0,
        adminApproval: data.adminApproval ?? true,
        eggless_id: egglessId,
        sugarfree_id: sugarfreeId,
        gluttenfree_id: gluttenfreeId,
      });
      await sku.save();
    }
    
    await SkuDetail.findOneAndUpdate({ sku_id: sku._id }, {
        weight: data.weight ?? 0,
        length: data.length ?? 0,
        width: data.width ?? 0,
        height: data.height ?? 0,
        preparationTime: data.preparationTime ?? 0,
        updatedAt: new Date(),
      }, { upsert: true, new: true });
      
    const featureIds = [ ...flavorIds, ...colorIds ];
    await pivotEntry(SkuProductFeature, sku._id, featureIds, "sku_id", "productFeature_id");
  
    return sku;
  } catch (error) { 
    await logError(error, { function: "upsertSku", payload: { data } }); 
  }
}

interface CartConsentProps {
  user_id?: string | Types.ObjectId;
  email?: string;
  phone?: string;
  city_id?: string | Types.ObjectId;
  state_id?: string | Types.ObjectId;
  country_id?: string | Types.ObjectId;
  emailConsent?: boolean;
  phoneConsent?: boolean;
}

export async function handleConsent(order_id: Types.ObjectId | string, cartConsent?: CartConsentProps) {
  try{

    if (!cartConsent) { return; }
  
    const { email, phone, user_id, city_id, state_id, country_id, emailConsent, phoneConsent } = cartConsent;
    let orderConsentId: Types.ObjectId;
    let emailDuplicateFlag = false;
    let phoneDuplicateFlag = false;
    
    const [existingByEmail, existingByPhone] = await Promise.all([
      email ? OrderConsent.findOne({ email }) : null,
      phone ? OrderConsent.findOne({ phone }) : null,
    ]);
  
    if (existingByEmail && existingByPhone) {
      orderConsentId = existingByEmail._id;
      emailDuplicateFlag = true;
      phoneDuplicateFlag = true;
    } else if (existingByEmail) {
      orderConsentId = existingByEmail._id;
      emailDuplicateFlag = true;
      phoneDuplicateFlag = false;
    } else if (existingByPhone) {
      orderConsentId = existingByPhone._id;
      emailDuplicateFlag = false;
      phoneDuplicateFlag = true;
    } else {
      const newConsent = await new OrderConsent({
        user_id,
        email,
        phone,
        city_id,
        state_id,
        country_id,
        emailConsent,
        phoneConsent,
        email_duplicate: false,
        phone_duplicate: false,
      }).save();
  
      orderConsentId = newConsent._id;
      await new OrderOrderConsent({ order_id, orderConsent_id: orderConsentId }).save();
    }
  
    if (emailDuplicateFlag || phoneDuplicateFlag) {
      await OrderConsent.updateOne({ _id: orderConsentId }, { 
          $set: { 
            email_duplicate: emailDuplicateFlag, 
            phone_duplicate: phoneDuplicateFlag 
          }});
    }
  } catch (error) { return await logError(error, { function: "handleConsent", payload: { order_id, cartConsent } }); }
}

export async function upsertCartCharges(cart_id: string, data: Partial<typeof CartCharges.prototype>) {
  let cartCharges = await CartCharges.findOne({ cart_id });

  if (!cartCharges) {
    cartCharges = new CartCharges({ cart_id, ...data });
  } else {
    Object.assign(cartCharges, data);
  }

  return await cartCharges.save();
}

export async function computeExpiry(validityValue: number, unit: string): Promise<Date | null> {
  try{
    const numericValue = Number(validityValue);
    if (!numericValue || numericValue <= 0 || !unit) return null;
  
    const now = new Date();
    if (unit === "hours") {
      return new Date(now.getTime() + numericValue * 60 * 60 * 1000);
    }
    if (unit === "days") {
      return new Date(now.getTime() + numericValue * 24 * 60 * 60 * 1000);
    }
    return null;
  } catch (error) { await logError(error, { function: "computeExpiry", payload: { validityValue, unit } }); return null; }
}

// CART CALUCLAUTIONS
  export async function cartCheck(cart_id: string) {
  await syncCartDiscountsAndCharges(cart_id);
  await handleApplyCoupon(cart_id, undefined, { logUsage: false });
  await syncCartCouponSuggestions(cart_id);
  await recalculateCart(cart_id);
}

  export async function syncCartDiscountsAndCharges(cart_id: string | any) {
    try {
      if (!cart_id) return { charges: null, totalSellerDiscount: 0 };

      const now = new Date();
      const cartDoc: any = await getPopulatedCartQuery(cart_id);
      if (!cartDoc) return { charges: null, totalSellerDiscount: 0 };

      const cartSkus: any[] = getProp<any>(cartDoc, "cartSkus", []);
      let rawSubtotal = 0;
      let totalSellerDiscount = 0;

      for (const item of cartSkus) {
        const qty = Number(getProp<any>(item, "quantity", 0));
        const unitPrice = Number(getSkuUnitPrice(item) || 0);
        const maxLineTotal = unitPrice > 0 && qty > 0 ? unitPrice * qty : 0;
        rawSubtotal += maxLineTotal;

        const discDoc: any = getProp<any>(item, "discount", null);
        if (!discDoc) continue;

        const discId = getProp<any>(discDoc, "_id", null);
        const rate = Number(getProp<any>(discDoc, "seller_discount", 0));
        const rawType = getProp<any>(discDoc, "discount_type", "flat");
        const discountType: "flat" | "percent" = rawType === "percent" ? "percent" : "flat";
        const isActive = await isValidUntil(
          getProp<any>(discDoc, "seller_discount_validity", null),
          now
        );

        if (qty <= 0 || !isActive || rate <= 0 || maxLineTotal <= 0) {
          if (discId) await deleteCartSkuDiscount(discId);
          continue;
        }

        const rawSkuDiscount =
          discountType === "percent"
            ? (maxLineTotal * Math.min(rate, 100)) / 100
            : Math.min(rate, unitPrice) * qty;

        totalSellerDiscount += roundMoney(Math.min(maxLineTotal, Math.max(0, rawSkuDiscount)));
      }

      rawSubtotal = roundMoney(rawSubtotal);
      totalSellerDiscount = roundMoney(totalSellerDiscount);

      const existingCharges: any = getProp<any>(cartDoc, "cartCharges", {});
      const isAdminValid = await isValidUntil(existingCharges.admin_discount_validity, now);
      const adminRate = isAdminValid ? Number(existingCharges.admin_discount || 0) : 0;
      const adminType: "flat" | "percent" =
        existingCharges.admin_discount_type === "percent" ? "percent" : "flat";

      const eligibleForAdmin = Math.max(0, rawSubtotal - totalSellerDiscount);
      const rawAdminDiscount =
        adminRate > 0 && eligibleForAdmin > 0
          ? adminType === "percent"
            ? (eligibleForAdmin * Math.min(adminRate, 100)) / 100
            : adminRate
          : 0;

      const totalAdminDiscount = roundMoney(Math.min(eligibleForAdmin, Math.max(0, rawAdminDiscount)));
      const shippingCharges = roundMoney(existingCharges.shipping_charges);
      const codCharges = roundMoney(existingCharges.cod_charges);
      const salesDiscount = roundMoney(existingCharges.sales_discount);

      const updates: Record<string, any> = {
        total_seller_discount: totalSellerDiscount,
        seller_discount: totalSellerDiscount,
        admin_discount: isAdminValid ? adminRate : 0,
        admin_discount_type: adminType,
        total_admin_discount: totalAdminDiscount,
        shipping_charges: shippingCharges,
        cod_charges: codCharges,
        sales_discount: salesDiscount,
      };

      const charges = await CartCharges.findOneAndUpdate(
        { cart_id },
        { $set: updates },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      return { charges, totalSellerDiscount, totalAdminDiscount };
    } catch (error) {
      await logError(error, { function: "syncCartDiscountsAndCharges", payload: { cart_id } });
      return { charges: null, totalSellerDiscount: 0 };
    }
  }

  export async function recalculateCart(cart_id: string) {
    try {
      if (!cart_id) return;

      const salesResult = await applySalesAndGetUpsells(cart_id);

      await upsertCartCharges(cart_id, {
        sales_discount: roundMoney(salesResult?.totalCartSavings ?? 0),
        upsell_message: salesResult?.upsellMessage ?? "",
      });

      const { charges } = await syncCartDiscountsAndCharges(cart_id);

      const updatedCart: any = await getPopulatedCartQuery(cart_id);
      if (!updatedCart) return;

      const activeCharges: any = charges || getProp<any>(updatedCart, "cartCharges", {}) || {};
      const activeCoupon: any = getProp<any>(updatedCart, "cartCoupon", null);

      const total = roundMoney(salesResult?.totalCartSubtotal ?? 0);
      const sales_discount = roundMoney(activeCharges.sales_discount ?? 0);
      const admin_discount = roundMoney(activeCharges.admin_discount ?? 0);
      const totalSellerDiscount = roundMoney(
        activeCharges.total_seller_discount ?? activeCharges.seller_discount ?? 0
      );
      const shippingCharges = roundMoney(activeCharges.shipping_charges ?? 0);
      const codCharges = roundMoney(activeCharges.cod_charges ?? 0);
      const adminCoupon = roundMoney(activeCoupon?.admin_coupon_discount ?? 0);
      const sellerCoupon = roundMoney(activeCoupon?.seller_coupon_discount ?? 0);

      const payable_amount =
        total +
        shippingCharges +
        codCharges -
        (sales_discount +
          admin_discount +
          totalSellerDiscount +
          adminCoupon +
          sellerCoupon);

      updatedCart.total = total;
      updatedCart.payable_amount = Math.max(0, roundMoney(payable_amount));

      await updatedCart.save();
    } catch (error) {
      await logError(error, {
        function: "recalculateCart",
        payload: { cart_id },
      });
    }
  }
// CART CALUCLAUTIONS

// FUNCTIONS
  export async function isValidUntil(validityDate: unknown, now: Date): Promise<boolean> {
    try{
      if (!validityDate) return true;
      const expiry = new Date(validityDate as string | Date);
      if (Number.isNaN(expiry.getTime())) return true;
      return expiry.getTime() >= now.getTime();
    } catch (error) { await logError(error, { function: "isValidUntil", payload: {validityDate, now} }); return true; }
  }

  function roundMoney(val: unknown): number {
    const num = Number(val || 0);
    return Number.isNaN(num) ? 0 : Number(num.toFixed(2));
  }

  function getSkuUnitPrice(cartSku: any): number {
    const price = Number(cartSku?.price ?? 0);
    const sale = Number(cartSku?.sale ?? 0);
    return sale > 0 && sale < price ? sale : price;
  }

  export async function getPopulatedCartQuery(cart_id: string | any) {
    return Cart.findById(cart_id).populate([
      { path: "cartCoupon" },
      { path: "cartCharges" },
      { path: 'cartConsent' },
      { path: "couponSuggestions" },
      { path: 'billing_address_id' }, { path: 'shipping_address_id' }, 
      { path: "cartSkus", populate: [
        { path: "sku_id"},
        { path: "discount" },
        { path: "product_id", populate: [
                          { path: "seller_id" },
                          { path: "brands", populate: { path: "productBrand_id" } },
                          { path: 'mediaHubs', populate: { path: 'media_id' } }
                        ]},
      ]},
    ]);
  }

  export async function deleteCartSkuDiscount(discountId: unknown) {
    if (!discountId) return null;
    return await CartSkuDiscount.findByIdAndDelete(discountId);
  }
// FUNCTIONS