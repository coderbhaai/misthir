import { Types } from 'mongoose';
import type { NextApiRequest, NextApiResponse } from 'next';
import { createApiHandler, ExtendedRequest } from 'pages/api/apiHandler';
import BulkOrder from 'lib/models/ecom/BulkOrder';
import { APIHandlers } from 'lib/server/middleware';
import { buildFilterQuery } from 'lib/server/plugins/buildFilterQuery';
import { getUserIdFromToken } from 'lib/services/authService';
import { logError } from 'lib/services/errorService';
import { initAction } from 'lib/services/actionService';

// Bulk Order
  export async function create_bulk_order(req: ExtendedRequest, res: NextApiResponse) {
    try {
      const data = req.body;
      if (!data?.name || !data?.email || !data?.phone ) { return res.status(400).json({ message: 'Required fields missing' }); }

      const user_id = await getUserIdFromToken(req);    
      const newEntry = new BulkOrder({
          user_id: user_id,
          product_id: data.product_id,
          sku_id: data.sku_id,
          name: data.name,
          email: data.email,
          phone: data.phone,
          status: data.status,
          quantity: data.quantity,
          user_remarks: data.user_remarks,
          updatedAt: new Date(),
          createdAt: new Date(),
      });
      await newEntry.save();

      await initAction('Bulk Order', newEntry._id as Types.ObjectId);
      
      return res.status(201).json({ message: 'Entry created successfully', data: newEntry });
    } catch (error) {await logError(error, { function: "create_bulk_order", payload: req.body }); }
  }

  export async function get_single_bulk_order(req: NextApiRequest, res: NextApiResponse) {
    try {
      const { id } = req.body;
      if ( !id ) { return res.status(400).json({ message: 'Invalid or missing Id' }); }
  
      const data = await BulkOrder.findById(id).populate([ { path: 'product_id', select: 'name url' }, { path: 'sku_id', select: 'name' } ]).exec();
  
      return res.status(200).json({ message: 'Single Bulk Order Fetched', data });
    } catch (error) { await logError(error, { function: "get_single_bulk_order", payload: req.body }); }
  }

  export async function get_filtered_bulk_orders(req: NextApiRequest, res: NextApiResponse) {
    try {
      const { filters = {}, page = 0, limit = 10 } = req.body || {};
      const { matchQuery, skip, limit: safeLimit } = buildFilterQuery(filters, { page, limit, defaultLimit: 10, maxLimit: 100, searchableFields: ["name"] });
      const total = await BulkOrder.countDocuments(matchQuery);
  
      const data = await BulkOrder.find().populate([ { path: 'product_id', populate: [ { path: 'mediaHubs', populate: { path: 'media_id' } } ]}, { path: 'sku_id' } ]);     
      return res.status(200).json({ message: 'Fetched all Bulk Orders', data, pagination: { total, page, limit: safeLimit, pages: Math.ceil(total / safeLimit) } });
    } catch (error) { await logError(error, { function: "get_filtered_bulk_orders", payload: req.body }); }
  }

  // export async function update_bulk_order(req: ExtendedRequest, res: NextApiResponse) {
  //   try {
  //     const data = req.body;
  //     if (!data?.name || !data?.email || !data?.phone ) { return res.status(400).json({ message: 'Required fields missing' }); }

  //     const entry = await BulkOrder.findByIdAndUpdate(data._id, {
  //         product_id: data.product_id,
  //         sku_id: data.sku_id,
  //         name: data.name,
  //         email: data.email,
  //         phone: data.phone,
  //         status: data.status,
  //         quantity: data.quantity,
  //         user_remarks: data.user_remarks,
  //         admin_remarks: data.admin_remarks,
  //         updatedAt: new Date(),
  //       },{ new: true, upsert: true }
  //     );
      
  //     return res.status(201).json({ message: 'Entry created successfully', data: entry });
  //   } catch (error) {await logError(error, { function: "update_bulk_order", payload: req.body }); }
  // }

  // export async function get_bulk_order_options(req: NextApiRequest, res: NextApiResponse) {
  //   try {
  //     const { id } = req.body;
  //     if ( !id ) { return res.status(400).json({ message: 'Invalid or missing Id' }); }
  
  //     const data = await BulkOrder.findById(id).populate([ { path: 'product_id', select: 'name url' }, { path: 'sku_id', select: 'name' } ]).exec();
  
  //     return res.status(200).json({ message: 'Single Bulk Order Fetched', data });
  //   } catch (error) { await logError(error, { function: "get_bulk_order_options", payload: req.body }); }
  // }
// Bulk Order

export const functions: APIHandlers = {
  create_bulk_order : { middlewares: ["checkUserId"] },
  // update_bulk_order : { middlewares: ["checkUserId", "checkPostMethod"] },
  get_filtered_bulk_orders : { middlewares: ["checkUserId", "checkPostMethod"] },
  get_single_bulk_order : { middlewares: [ "checkPostMethod"] },
  // get_bulk_order_options : { middlewares: ["checkUserId", "checkPostMethod"] },
}

export const bulkOrderHandlers = {
  create_bulk_order,
  // update_bulk_order,
  get_filtered_bulk_orders,
  get_single_bulk_order,
  // get_bulk_order_options
};

export const config = { api: { bodyParser: false } };
export default createApiHandler(functions, bulkOrderHandlers);