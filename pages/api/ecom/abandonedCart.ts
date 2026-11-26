import { logError } from "lib/services/errorService";
import { createApiHandler } from "../apiHandler";
import { NextApiRequest, NextApiResponse } from "next";
import { buildFilterQuery } from "lib/server/plugins/buildFilterQuery";
import { sellerFilter } from "lib/server/plugins/sellerFilter";
import mongoose from "mongoose";
import Product from "lib/models/product/Product";
import CartSku from "lib/models/ecom/CartSku";
import Cart from "lib/models/ecom/Cart";
import { APIHandlers } from "lib/server/middleware";
import { getPopulatedCartQuery } from "lib/services/ecomService";

export async function get_filtered_abandoned_carts(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { filters = {}, page = 0, limit = 10 } = req.body || {};
    const { seller_id: rawFilterSellerId, ...cleanFilters } = filters || {};
    const { matchQuery, skip, limit: safeLimit } = buildFilterQuery(cleanFilters, { page, limit, defaultLimit: 10, maxLimit: 100, searchableFields: [], });
    
    const sellerScopeQuery: Record<string, any> = {};
    const { sellerId: tokenSellerId, error } = await sellerFilter(sellerScopeQuery, req);
    if (error) { return res.status(error.status).json({ message: error.message }); }

    const effectiveSellerId = tokenSellerId || (typeof rawFilterSellerId === "string" && mongoose.Types.ObjectId.isValid(rawFilterSellerId) ? rawFilterSellerId : null);
    if (rawFilterSellerId && !tokenSellerId && !mongoose.Types.ObjectId.isValid(String(rawFilterSellerId))) {
      return res.status(400).json({ message: "Invalid seller ID." });
    }

    if (effectiveSellerId) {
      const sellerObjectId = new mongoose.Types.ObjectId(effectiveSellerId);
      const sellerProductIds = await Product.find({ seller_id: sellerObjectId }).distinct("_id");

      const skuMatchConditions: Record<string, any>[] = [{ seller_id: sellerObjectId }];
      if (sellerProductIds.length > 0) {
        skuMatchConditions.push({ product_id: { $in: sellerProductIds } });
      }

      const matchingCartIds = await CartSku.distinct("cart_id", {
        $or: skuMatchConditions,
      });

      if (!matchingCartIds.length) { return res.status(200).json({ message: "Fetched Abandoned Carts", data: [], pagination: { total: 0, page, limit: safeLimit, pages: 0 } }); }
      
      if ((matchQuery as any)._id?.$in) {
        const existingSet = new Set( (matchQuery as any)._id.$in.map((id: any) => id.toString()) );
        const intersectedIds = matchingCartIds.filter((id: any) => existingSet.has(id.toString()));
        if (!intersectedIds.length) { return res.status(200).json({ message: "Fetched Abandoned Carts", data: [], pagination: { total: 0, page, limit: safeLimit, pages: 0 } }); }

        (matchQuery as any)._id = { $in: intersectedIds };
      } else {
        (matchQuery as any)._id = { $in: matchingCartIds };
      }
    }

    const total = await Cart.countDocuments(matchQuery);

    const data = await Cart.find(matchQuery)
      .populate([
        { path: "cartCharges" },
        { path: "cartCoupon", populate: { path: "coupon_id" } },
        { path: "user_id" },
        {
          path: "cartSkus",
          match: effectiveSellerId
            ? {
                $or: [
                  { seller_id: new mongoose.Types.ObjectId(effectiveSellerId) },
                ],
              }
            : undefined,
          populate: [
            { path: "sku_id" },
            {
              path: "product_id",
              populate: [{ path: "mediaHubs", populate: { path: "media_id" } }],
            },
          ],
        },
      ]).skip(skip).limit(safeLimit).sort({ createdAt: -1 });

    return res.status(200).json({ message: "Fetched Abandoned Carts", data, pagination: { total, page, limit: safeLimit, pages: Math.ceil(total / safeLimit) } });
  } catch (error) { return await logError(error, { function: "get_filtered_abandoned_carts", payload: req.body }); }
}

export async function get_single_abdandoned_cart(req: NextApiRequest, res: NextApiResponse) {
  try {
    const id = (req.method === 'GET' ? req.query.id : req.body.id) as string;
    if ( !id ) { return res.status(400).json({ message: 'Invalid or missing Id' }); }

    const cart: any = await getPopulatedCartQuery(id);

    return res.status(200).json({ message: 'Single ABandoned Cart Fetched', data: cart });
  } catch (error) { return await logError(error, { function: "get_single_abdandoned_cart", payload: req.body }); }
}

export const functions: APIHandlers = {  
  get_filtered_abandoned_carts : { middlewares: ["checkUserId", "checkPostMethod"] },
  get_single_abdandoned_cart : { middlewares: ["checkUserId", "checkPostMethod"] },
}

export const abandonedCartHandlers = {
  get_filtered_abandoned_carts,
  get_single_abdandoned_cart,
};

export const config = { api: { bodyParser: false } };
export default createApiHandler(functions, abandonedCartHandlers);