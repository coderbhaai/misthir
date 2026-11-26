import SellerSiteSetting from "lib/models/seller/SellerSiteSetting";
import { APIHandlers } from "lib/server/middleware";
import { logError } from "lib/services/errorService";
import { NextApiRequest, NextApiResponse } from "next";
import { createApiHandler, ExtendedRequest } from "../apiHandler";
import { Types } from "mongoose";
import { buildFilterQuery } from "lib/server/plugins/buildFilterQuery";
import { sellerFilter } from "lib/server/plugins/sellerFilter";


// SellerSiteSetting
  export async function get_filtered_seller_settings(req: NextApiRequest, res: NextApiResponse) {
    try {
      const { filters = {}, page = 0, limit = 10 } = req.body || {};
      const { matchQuery, skip, limit: safeLimit } = buildFilterQuery(filters, { page, limit, defaultLimit: 10, maxLimit: 100, searchableFields: ["module"] });
      const { error } = await sellerFilter(matchQuery, req);
      if (error) { return res.status(error.status).json({ message: error.message }); }

      const total = await SellerSiteSetting.countDocuments(matchQuery);
      const data = await SellerSiteSetting.find(matchQuery).populate([ { path: "seller_id" } ]).sort({ name: 1 }).skip(skip).limit(safeLimit);
  
      return res.status(200).json({ message: "Fetched all Seller Settings", data, pagination: { total, page, limit: safeLimit, pages: Math.ceil(total / safeLimit), }, });
    } catch (error) { await logError(error, { function: "get_filtered_seller_settings", payload: req.body }); }
  }

  export async function get_single_seller_setting(req: NextApiRequest, res: NextApiResponse){
    try{
      const id = (req.method === 'GET' ? req.query.id : req.body.id) as string;
      if (!id || !Types.ObjectId.isValid(id)) { return res.status(400).json({ message: 'Invalid or missing ID' }); }  
    
      const entry = await SellerSiteSetting.findById(id).exec();  
      if (!entry) { return res.status(404).json({ message: `SellerSiteSetting with ID ${id} not found` }); }
    
      return res.status(200).json({ message: '✅ Single Entry Fetched', data: entry });

    }catch (error) { await logError(error, { function: "get_single_seller_setting", payload: req.body }); }
  };

  export async function create_update_seller_setting(req: ExtendedRequest, res: NextApiResponse) {
    try {
      const data = req.body;
      if (!data?.module || !data?.module_value ) { return res.status(400).json({ message: '❌ Required fields missing' }); }

      const entry = await SellerSiteSetting.findOneAndUpdate({ module: data.module }, {
        seller_id: data.seller_id,
        module: data.module,
        module_value: data.module_value,
        status: data.status,
        updatedAt: new Date(),
      }, { new: true, upsert: true, setDefaultsOnInsert: true });

      return res.status(200).json({ message: '✅ Entry updated successfully', data: entry });
    } catch (error) { await logError(error, { function: "create_update_seller_setting", payload: req.body }); }
  }
// SellerSiteSetting

export const functions: APIHandlers = {
  get_filtered_seller_settings : { middlewares: [] },	
  get_single_seller_setting : { middlewares: [] },	
  create_update_seller_setting : { middlewares: ["checkPostMethod"] },	
}

export const sellerHandlers = {
  get_filtered_seller_settings,
  get_single_seller_setting,
  create_update_seller_setting,
};

export const config = { api: { bodyParser: false } };
export default createApiHandler(functions, sellerHandlers);