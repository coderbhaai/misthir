import { APIHandlers } from "lib/server/middleware";
import { createApiHandler } from "../apiHandler";
import { NextApiRequest, NextApiResponse } from "next";
import Order from "lib/models/ecom/Order";
import { logError } from "lib/services/errorService";
import mongoose from "mongoose";
import OrderSku from "lib/models/ecom/OrderSku";
import { getGenericContent } from "lib/services/dataService";
import { getUserIdFromToken } from "lib/services/authService";

export async function get_all_orders(req: NextApiRequest, res: NextApiResponse) {
  try {
    const data = await Order.find().populate([ { path: 'orderCharges' }, { path: 'user_id' }, { path: 'orderSkus', populate: [ { path: 'sku_id' }, { path: 'product_id', populate: [ { path: 'mediaHubs', populate: { path: 'media_id' } } ] } ]  }]);

    return res.status(200).json({ message: 'All ORders Fetched', data });
  } catch (error) { return await logError(error, { function: "get_all_orders", payload: req.body }); }
}

export async function get_seller_orders(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { seller_id } = req.body;

    if (!seller_id || !mongoose.Types.ObjectId.isValid(seller_id as string)) {
      return res.status(400).json({ message: "Invalid seller_id", data: [] });
    }

    const selllerObjectId = new mongoose.Types.ObjectId(seller_id as string);
    
    const orderSkus = await OrderSku.find({ seller_id: selllerObjectId }).select("order_id").exec();
    const orderIds = orderSkus.map((s) => s.order_id);

    if (orderIds.length === 0) { return res.status(200).json({ message: "No orders found for this Seller", data: [] }); }
    
    const orders = await Order.find({ _id: { $in: orderIds } })
      .populate([
        { path: "orderCharges" }, { path: "user_id" },
        {
          path: "orderSkus",
          match: { seller_id: selllerObjectId },
          populate: [
            { path: "sku_id" },
            {
              path: "product_id",
              populate: [
                { path: "mediaHubs", populate: { path: "media_id" } }
              ]
            }
          ]
        }
      ])
      .exec();

    return res.status(200).json({ message: "Seller orders fetched", data: orders });
  } catch (error) { return await logError(error, { function: "get_seller_orders", payload: req.body }); }
}

export async function get_single_order(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { order_id } = req.body;
    if ( !order_id ) { return res.status(400).json({ message: 'Invalid or missing Id' }); }
    const objectId = new mongoose.Types.ObjectId(order_id);

    const data = await Order.findById(objectId).populate([ { path: 'orderCharges' }, { path: 'billing_address_id' }, { path: 'shipping_address_id' }, { path: 'orderSkus', populate: [ { path: 'sku_id' }, { path: 'product_id', populate: [ { path: 'mediaHubs', populate: { path: 'media_id' } } ] } ]  }]).exec();
    const relatedContent = await getGenericContent();

    return res.status(200).json({ message: 'Single Order Fetched', data, relatedContent });
  } catch (error) { return await logError(error, { function: "get_single_order", payload: req.body }); }
}

export async function get_user_orders(req: NextApiRequest, res: NextApiResponse) {
  try {
    const user_id = await getUserIdFromToken(req);

    if (!user_id || !mongoose.Types.ObjectId.isValid(user_id as string)) {
      return res.status(400).json({ message: "Invalid user_id", data: [] });
    }
    
    const orders = await Order.find({ user_id })
      .populate([
        { path: "orderCharges" }, { path: "user_id" },
        {
          path: "orderSkus",
          populate: [
            { path: "sku_id" },
            {
              path: "product_id",
              populate: [
                { path: "mediaHubs", populate: { path: "media_id" } }
              ]
            }
          ]
        }
      ])
      .exec();

    return res.status(200).json({ message: "User orders fetched", data: orders });
  } catch (error) { return await logError(error, { function: "get_user_orders", payload: req.body }); }
}

export const functions: APIHandlers = {
  get_all_orders : { middlewares: [] },
  get_seller_orders : { middlewares: [] },
  get_single_order : { middlewares: ["checkPostMethod"] },
  
  get_user_orders : { middlewares: [] },
}

export const orderHandlers = {
  get_all_orders,
  get_seller_orders,
  get_single_order,

  get_user_orders,
};

export const config = { api: { bodyParser: false } };
export default createApiHandler(functions, orderHandlers);