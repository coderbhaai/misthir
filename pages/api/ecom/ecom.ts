import mongoose, { Types } from 'mongoose';
import { createApiHandler } from '../apiHandler';
import { NextApiRequest, NextApiResponse } from 'next';
import { getCartIdFromRequest, setCookie } from '../cartUtils';
import Product from 'lib/models/product/Product';
import { initAction } from "lib/services/actionService";
import { APIHandlers } from 'lib/server/middleware';
import Cart from 'lib/models/ecom/Cart';
import CartCoupon from 'lib/models/coupon/CartCoupon';
import CartSku from 'lib/models/ecom/CartSku';
import Order from 'lib/models/ecom/Order';
import OrderCharges from 'lib/models/ecom/OrderCharges';
import OrderCoupon from 'lib/models/coupon/OrderCoupon';
import OrderSku from 'lib/models/ecom/OrderSku';
import Address from 'lib/models/address/Address';
import CartConsent from 'lib/models/ecom/CartConsent';
import { processModuleFinancials } from 'lib/services/financialService';
import { logError } from 'lib/services/errorService';
import { cartCheck, create_cart, getPopulatedCartQuery, handleConsent, update_cart } from 'lib/services/ecomService';

export async function add_to_cart(req: any, res: any) {
  try {
    let cart_id = await getCartIdFromRequest(req, res);

    if (!cart_id) {
      cart_id = await create_cart(req, res);
    }
    if (!cart_id) { return res.status(200).json({ status: false, message: 'Cart not found' }); }

    const cartSkuResponse = await update_cart(req, cart_id);

    if (cartSkuResponse.status) {
      return res.status(200).json({ ...cartSkuResponse });
    } else {
      return res.status(400).json({ ...cartSkuResponse });
    }
  } catch (error) { return await logError(error, { function: "add_to_cart", payload: req.body }); }
} 

export async function get_cart_data(req: NextApiRequest, res: NextApiResponse) {
  try {
    let cart_id = await getCartIdFromRequest(req, res);
    if( !cart_id ){ return res.status(200).json({ message: 'Cart not found', data: null }); }

    const data = await getPopulatedCartQuery(cart_id);
    const cartProductIds = data?.cartSkus.map((item: any) => item.product_id._id);
    const relatedProducts = await Product.find({ _id: { $nin: cartProductIds }, }).populate({ path: "mediaHubs", populate: { path: "media_id", model: "Media", select: "_id path alt" } }).exec();

    return res.status(200).json({ message: 'Cart Fetched', data, relatedProducts });
  } catch (error) { return await logError(error, { function: "get_cart_data", payload: req.body }); }
}

export async function increment_cart(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { cart_sku_id } = req.body;
    if (!cart_sku_id) { return res.status(400).json({ status: false, message: 'cart_sku_id is required' }); }
    
    let cart_id = await getCartIdFromRequest(req, res);
    if( !cart_id ){ return res.status(200).json({ status: false, message: 'Cart not found' }); }
    
    let cartSku = await CartSku.findOne({ cart_id, _id: cart_sku_id });
    if (!cartSku) { return res.status(400).json({ status: false, message: 'Cart item not found' }); }
    
    cartSku.quantity += 1;
    await cartSku.save();
    await cartCheck(cart_id);
    
    return res.status(200).json({ status: true, message: 'Quantity incremented successfully' });
  } catch (error) { return await logError(error, { function: "increment_cart", payload: req.body }); }
}

export async function decrement_cart(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { cart_sku_id } = req.body;
    if (!cart_sku_id) { return res.status(400).json({ status: false, message: 'cart_sku_id is required' }); }

    const cart_id = await getCartIdFromRequest(req, res);
    if (!cart_id) { return res.status(200).json({ status: false, message: 'Cart not found' }); }

    let cartSku = await CartSku.findOne({ cart_id, _id: cart_sku_id });
    if (!cartSku) { return res.status(400).json({ status: false, message: 'Cart item not found' }); }

    cartSku.quantity -= 1;

    let message = "";
    if (cartSku.quantity <= 0) {
      await CartSku.deleteOne({ _id: cartSku._id });
      message =  'Cart item removed from cart';
    } else {
      await cartSku.save();
      message = 'Quantity decremented successfully';
    }    
    
    await cartCheck(cart_id);
    return res.status(200).json({ status: true, message });
  } catch (error) { return await logError(error, { function: "decrement_cart", payload: req.body }); }
};

export async function delete_cart_item(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { cart_sku_id } = req.body;
    if (!cart_sku_id) { return res.status(400).json({ status: false, message: 'cart_sku_id is required' }); }

    const cart_id = await getCartIdFromRequest(req, res);
    if (!cart_id) { return res.status(200).json({ status: false, message: 'Cart not found' }); }

    let cartSku = await CartSku.findOne({ cart_id, _id: cart_sku_id });
    if (!cartSku) { return res.status(400).json({ status: false, message: 'Cart item not found' }); }

    await CartSku.deleteOne({ _id: cartSku._id });
    await cartCheck(cart_id);
    return res.status(200).json({ status: true, message: 'Cart item removed from cart' });
  } catch (error) { await logError(error, { function: "delete_cart_item", payload: req.body }); return; }
};

export async function update_user_remarks(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { user_remarks } = req.body;
    if (!user_remarks) { return res.status(400).json({ status: false, message: 'user_remarks is required' }); }

    const cart_id = await getCartIdFromRequest(req, res);
    if (!cart_id) { return res.status(200).json({ status: false, message: 'Cart not found' }); }

    let cart = await Cart.findOne({ _id: cart_id });
    if (!cart) { return res.status(400).json({ status: false, message: 'Cart not found' }); }

    cart.user_remarks = user_remarks;
    await cart.save();

    return res.status(200).json({ status: true, message: "Order Note Updated" });
  } catch (error) { return await logError(error, { function: "update_user_remarks", payload: req.body }); }
};

export async function update_cart_array(req: NextApiRequest, res: NextApiResponse) {
  try {
    const cart_id = await getCartIdFromRequest(req, res);
    if (!cart_id) { return res.status(400).json({ status: false, message: 'Cart not found' }); }

    const { update } = req.body;
    if (typeof update !== 'object' || !update) { return res.status(400).json({ status: false, message: 'Invalid update payload' }); }

    const cart = await Cart.findOne({ _id: cart_id });
    if (!cart) { return res.status(400).json({ status: false, message: 'Cart not found' }); }
    
    const { email, phone, emailConsent, phoneConsent, ...cartUpdates } = update;
    for (const [key, value] of Object.entries(cartUpdates)) {
      cart.set(key, value);
    }
    await cart.save();

    let consentData: any = {
      cart_id: cart._id,
      user_id: cart.user_id,
    };

    if (email !== undefined) consentData.email = email;
    if (phone !== undefined) consentData.phone = phone;
    if (emailConsent !== undefined) consentData.emailConsent = emailConsent;
    if (phoneConsent !== undefined) consentData.phoneConsent = phoneConsent;
    
    const activeShippingId = cartUpdates.shipping_address_id || cart.shipping_address_id;
    if (activeShippingId) {
      const addressDoc = await Address.findById(activeShippingId);
      if (addressDoc) {
        consentData.city_id = addressDoc.city_id;
        if (addressDoc.state_id) consentData.state_id = addressDoc.state_id;
        if (addressDoc.country_id) consentData.country_id = addressDoc.country_id;
      }
    }

    await CartConsent.findOneAndUpdate(
      { cart_id: cart._id },
      { $set: consentData },
      { upsert: true, new: true }
    );

    await cartCheck(cart_id);
    return res.status(200).json({ status: true, message: "Cart Updated" });
  } catch (error) { 
    return await logError(error, { function: "update_cart_array", payload: req.body }); 
  }
}

export async function place_order(req: NextApiRequest, res: NextApiResponse) {
  try {
    // const cart_id = await getCartIdFromRequest(req, res);
    // if (!cart_id) { return res.status(200).json({ status: false, message: 'Cart not found' }); }


    // const payment = await createPaymentOrder("Cart", cart_id);

    // return res.status(200).json({ status: true, message: "Payment initiated", data: payment });


    // const result = await createOrderFromCart(cart_id, res);

    // return res.status(200).json({ status: true, message: "Order Placed", data: true });
  } catch (error) { return await logError(error, { function: "place_order", payload: req.body }); }
};

export async function createOrderFromCart(cart_id: string, res: NextApiResponse) {
  try{
    const cart = await Cart.findOne({ _id: cart_id }).populate([ 
      { path: "cartCharges"}, 
      { path: "cartConsent"}, 
      { path: "cartCoupon", populate: { path: "coupon_id", model: "Coupon" } }, 
      { path: "billing_address_id", populate: { path: "city_id", populate: { path: "state_id", }, }, }, 
      { path: "cartSkus", populate: [{ path: "sku_id" }, { path: "product_id", populate: { path: "tax_id" } }] } 
    ]);
    if (!cart) { return { status: false, message: "Cart not found" }; }
  
    const newEntry = new Order({
      user_id: cart.user_id,
      billing_address_id: cart.billing_address_id,
      shipping_address_id: cart.shipping_address_id,
      paymode: cart.paymode,
      weight: cart.weight,
      total: cart.total,
      paid: cart.payable_amount,
      user_remarks: cart.user_remarks,
      admin_remarks: cart.admin_remarks,
    });
  
    const savedOrder = await newEntry.save();
    const order_id = savedOrder._id.toString();
    setCookie(res, "order_id", order_id);
  
    if(cart.cartCharges) {
      await new OrderCharges({
        order_id: savedOrder._id,
        shipping_charges: cart.cartCharges.shipping_charges,
        shipping_chargeable_value: cart.cartCharges.shipping_chargeable_value,
        sales_discount: cart.cartCharges.sales_discount,
        admin_discount: cart.cartCharges.admin_discount,
        total_seller_discount: cart.cartCharges.total_seller_discount,
        cod_charges: cart.cartCharges.cod_charges,
      }).save();
    }
  
    if (cart.cartCoupon && typeof cart.cartCoupon === 'object' && cart.cartCoupon.coupon_id) {
      const coupon = cart.cartCoupon.coupon_id as any;
      
      await new OrderCoupon({
        order_id: savedOrder._id,
        coupon_id: cart.cartCoupon.coupon_id,
        admin_coupon_discount: cart.cartCoupon.admin_coupon_discount,
        seller_coupon_discount: cart.cartCoupon.seller_coupon_discount,
        coupon_code: cart.cartCoupon.coupon_code,
        coupon_by: coupon.coupon_by,
        usage_type: coupon.usage_type,
        seller_id: coupon.seller_id,
        discount_type: coupon.discount_type,
        discount: coupon.discount,
        name: coupon.name,
        sales: coupon.sales,
        status: coupon.status,
        valid_from: coupon.valid_from,
        valid_to: coupon.valid_to,
        buy_one: coupon.buy_one,
      }).save();
    }
  
    let totalQuantity = 0;
    if (Array.isArray(cart.cartSkus)) {
      totalQuantity = cart.cartSkus.reduce((sum: number, item: any) => sum + item.quantity, 0);
    }
  
    let perUnitAdminDiscount = 0;
    if (cart.cartCharges?.admin_discount && totalQuantity > 0) {
      perUnitAdminDiscount = cart.cartCharges.admin_discount / totalQuantity;
    }

    const financialItems: any[] = [];
    const orderSkuDocs: any[] = [];

    if (Array.isArray(cart.cartSkus) && cart.cartSkus.length > 0) {
      cart.cartSkus.forEach((item: any) => {
        let effectivePrice = item.sale || 0;
        effectivePrice -= perUnitAdminDiscount;

        if (item.seller_discount) {
          effectivePrice -= item.seller_discount;
        }

        const quantity = item.quantity || 0;
        orderSkuDocs.push({
          order_id: savedOrder._id,
          product_id: item.product_id?._id || item.product_id,
          sku_id: item.sku_id?._id || item.sku_id,
          seller_id: item.seller_id,
          price: item.sku_id?.price || item.price,
          quantity,
          admin_discount: perUnitAdminDiscount * quantity,
          seller_discount: item.seller_discount || 0,
          flavor_id: item.flavor_id,
        });

        financialItems.push({
          product_id: item.product_id,
          sku_id: item.sku_id,
          seller_id: item.seller_id,
          quantity,
          price: item.price,
          effectivePrice,
          admin_discount: perUnitAdminDiscount * quantity,
          seller_discount: item.seller_discount || 0,
        });
      });

      await OrderSku.insertMany(orderSkuDocs);
    }

    const billingState = cart.billing_address_id?.city_id?.state_id?.name || "";
    await processModuleFinancials({ module: "Order", module_id: savedOrder._id, items: financialItems, billingState });
    await handleConsent(savedOrder._id, cart.cartConsent);
    await initAction('Ecom', savedOrder._id as Types.ObjectId);
    return { status: true, message: "Order Placed", order_id };
  } catch (error) { return await logError(error, { function: "createOrderFromCart", payload: { cart_id } }); }
}

export const functions: APIHandlers = {
  add_to_cart : { middlewares: ["checkPostMethod"] },
  get_cart_data : { middlewares: [] },
  increment_cart : { middlewares: ["checkPostMethod"] },
  decrement_cart : { middlewares: ["checkPostMethod"] },
  delete_cart_item : { middlewares: ["checkPostMethod"] },
  update_user_remarks : { middlewares: ["checkPostMethod"] },
  update_cart_array : { middlewares: ["checkPostMethod"] },
  place_order : { middlewares: [] },
}

export const ecomHandlers = {
  add_to_cart,
  get_cart_data,
  increment_cart,
  decrement_cart,
  delete_cart_item,
  update_user_remarks,
  update_cart_array,
  place_order,
};

export const config = { api: { bodyParser: false } };
export default createApiHandler(functions, ecomHandlers);