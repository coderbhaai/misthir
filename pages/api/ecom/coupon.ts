import mongoose, { isValidObjectId, Types } from 'mongoose';
import type { NextApiRequest, NextApiResponse } from 'next';
import { logError } from 'lib/services/errorService';
import { createApiHandler, ExtendedRequest, } from '../apiHandler';
import Coupon from 'lib/models/coupon/Coupon';
import { uploadMedia } from '../basic/media';
import BuyOneGetOne from 'lib/models/ecom/BuyOneGetOne';
import { APIHandlers } from 'lib/server/middleware';
import { buildFilterQuery } from 'lib/server/plugins/buildFilterQuery';
import Product from 'lib/models/product/Product';
import ProductBrand from 'lib/models/product/ProductBrand';
import ProductProductmeta from 'lib/models/product/ProductProductmeta';
import Productmeta from 'lib/models/product/Productmeta';
import CouponTarget from 'lib/models/coupon/CouponTarget';
import { getCartIdFromRequest } from '../cartUtils';
import { escapeRegExp } from 'lib/services/dataService';
import { cartCheck, getSellerIdFromToken } from 'lib/services/ecomService';
import { sellerFilter } from 'lib/server/plugins/sellerFilter';
import { remove_coupon } from 'lib/services/couponService';

export async function get_filtered_coupon(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { filters = {}, page = 0, limit = 10 } = req.body || {};
    const { matchQuery, skip, limit: safeLimit } = buildFilterQuery(filters, { page, limit, defaultLimit: 10, maxLimit: 100, searchableFields: ["name", "url"] });
    const { error } = await sellerFilter(matchQuery, req);
    if (error) { return res.status(error.status).json({ message: error.message }); }
    
    const total = await Coupon.countDocuments(matchQuery);
    
    const data = await Coupon.find(matchQuery).populate([ 
      { path: "media_id" }, 
      { path: "seller_id", select: "_id name email phone" }, 
      { path: "bogo_items", populate: [ { path: "buy_id", select: "_id sku name" }, { path: "get_id", select: "_id sku name" }, ] } 
    ]).skip(skip).limit(safeLimit).sort({ createdAt: -1 });

    return res.status(200).json({ message: "Fetched all coupons", data, pagination: { total, page, limit: safeLimit, pages: Math.ceil(total / safeLimit) } });
  } catch (error) { await logError(error, { function: "get_filtered_coupon", payload: req.body }); }
}

export async function get_single_coupon(req: NextApiRequest, res: NextApiResponse){
  try{
    const id = (req.method === 'GET' ? req.query.id : req.body.id) as string;
    if (!id || !Types.ObjectId.isValid(id)) { return res.status(400).json({ message: 'Invalid or missing ID' }); }

    const { seller_id } = req.body;
    const filter: any = {};
    filter._id = new mongoose.Types.ObjectId(id);
    if (seller_id && mongoose.Types.ObjectId.isValid(seller_id as string)) {
      filter.seller_id = new mongoose.Types.ObjectId(seller_id as string);
    }
    const { sellerId, error } = await getSellerIdFromToken(req);
    if (error) { return res.status(error.status).json({ message: error.message }); }
    if (sellerId) { filter.seller_id = new mongoose.Types.ObjectId(sellerId); }
  
    const entry = await Coupon.findOne(filter).populate([ { path: "media_id" }, { path: "seller_id", select: "_id name email phone" }, { path: "bogo_items", populate: [ { path: "buy_id", select: "_id sku name" }, { path: "get_id", select: "_id sku name" }, ] } ]).exec();
    if (!entry) { return res.status(404).json({ message: `Coupon with ID ${id} not found` }); }
  
    const targets = await CouponTarget.find({ coupon_id: entry._id }).lean();
    return res.status(200).json({ message: '✅ Single Entry Fetched', data: { entry, targets }});
  } catch (error) { await logError(error, { function: "get_single_coupon", payload: req.body }); }
};

export async function create_update_coupon(req: ExtendedRequest, res: NextApiResponse) {
  try {
    const data = req.body;  
    if ( !data?.usage_type || !data?.discount_type  || !data?.name || !data?.coupon_code || !data?.sales || !data?.status || !data?.valid_from || !data?.valid_to ) { 
      return res.status(400).json({ message: 'Required fields missing' }); 
    }
    
    const modelId = typeof data._id === 'string' || data._id instanceof Types.ObjectId ? data._id : null;

    let media_id: string | null = null;
    if (data.media_id && isValidObjectId(data.media_id)) { media_id = data.media_id; }
    const file = Array.isArray(req.files?.image) ? req.files.image[0] : req.files?.image;
    if (file) { media_id = await uploadMedia({ file, name: data.name, pathType: "Coupon", media_id: data.media_id ?? null, user_id: null }); }    
    
    let coupon_code = data.coupon_code.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    
    let coupon: any;

    const couponPayload = {
      coupon_by: data.coupon_by,
      usage_type: data.usage_type,
      seller_id: data.seller_id,
      media_id: media_id,
      discount_type: data.discount_type,
      discount: Number(data.discount),
      name: data.name,
      coupon_code,
      sales: data.sales,
      status: data.status,
      valid_from: data.valid_from,
      valid_to: data.valid_to,
      buy_one: data.buy_one,
      description: data.description,
      updatedAt: new Date(),
    };

    if (modelId && isValidObjectId(modelId)) {
      coupon = await Coupon.findByIdAndUpdate(modelId, couponPayload, { new: true });
    } else {
      coupon = new Coupon({ ...couponPayload, createdAt: new Date() });
      await coupon.save();
    }

    if (data.selected_targets) {
      let targets = [];
      targets = typeof data.selected_targets === "string" ? JSON.parse(data.selected_targets) : data.selected_targets;

      await CouponTarget.deleteMany({ coupon_id: coupon._id });

      if (Array.isArray(targets) && targets.length > 0) {
        const targetDocs = targets.map((t: any) => ({ 
          coupon_id: coupon._id, 
          module: t.module,
          quantity: Number(t.quantity),
          module_id: new Types.ObjectId(t.module_id)
        }));
        await CouponTarget.insertMany(targetDocs, { ordered: false }).catch(() => {});
      }
    }
    
    if (Array.isArray(data.bogo_items)) {
      await BuyOneGetOne.deleteMany({ coupon_id: coupon._id });
      await BuyOneGetOne.insertMany(
        data.bogo_items.map((item: any) => ({
          coupon_id: coupon._id,
          buy_id: item.buy_id,
          get_id: item.get_id,
        }))
      );
    }

    return res.status(modelId ? 200 : 201).json({ message: modelId ? "✅ Coupon updated successfully" : "✅ Coupon created successfully", data: coupon });
  } catch (error) { 
    await logError(error, { function: "create_update_coupon", payload: req.body }); 
    return res.status(500).json({ message: "Server error", error });
  }
}

export async function get_target_options(req: ExtendedRequest, res: NextApiResponse) {
  try {
    const { module, seller_id: bodyOrQuerySellerId, search, selected_ids } = req.body || req.query;

    const { sellerId: tokenSellerId, error } = await getSellerIdFromToken(req);
    if (error) {
      return res.status(error.status).json({ message: error.message });
    }

    const effectiveSellerId = tokenSellerId || (typeof bodyOrQuerySellerId === "string" && bodyOrQuerySellerId.trim() ? bodyOrQuerySellerId.trim() : null);
    if (effectiveSellerId && !Types.ObjectId.isValid(effectiveSellerId)) {
      return res.status(400).json({ message: "Invalid seller ID." });
    }

    const modules: string[] = Array.isArray(module) ? module : [module].filter(Boolean);
    const selectedIdsArray: string[] = Array.isArray(selected_ids) ? selected_ids : (selected_ids ? [selected_ids] : []);
    const selectedObjectIds = selectedIdsArray.filter((id) => Types.ObjectId.isValid(id)).map((id) => new Types.ObjectId(id));
    const searchFilter = search && search.trim() !== "" ? { name: { $regex: escapeRegExp(search.trim()), $options: "i" } } : {};
    const sellerFilter = effectiveSellerId ? { seller_id: new Types.ObjectId(effectiveSellerId) } : {};

    let productsPromise: Promise<any[]> = Promise.resolve([]);
    let productBrandsPromise: Promise<any[]> = Promise.resolve([]);
    let productTypesPromise: Promise<any[]> = Promise.resolve([]);

    if (modules.includes("Product")) {
      productsPromise = (async () => {
        const searchResults = await Product.find({ ...sellerFilter, ...searchFilter })
          .populate([{ path: "skus" }])
          .limit(50)
          .lean();
        const searchResultIds = new Set(searchResults.map((p: any) => p._id.toString()));
        const missingSelectedIds = selectedObjectIds.filter((id) => !searchResultIds.has(id.toString()));

        let forcedProducts: any[] = [];
        if (missingSelectedIds.length > 0) {
          forcedProducts = await Product.find({ _id: { $in: missingSelectedIds }, ...sellerFilter })
            .populate([{ path: "skus" }])
            .lean();
        }

        const combined = [...forcedProducts, ...searchResults];
        const uniqueMap = new Map();
        combined.forEach((item) => uniqueMap.set(item._id.toString(), item));
        return Array.from(uniqueMap.values());
      })();
    }

    if (modules.includes("ProductBrand") || modules.includes("Product Brand")) {
      productBrandsPromise = (async () => {
        const searchResults = await ProductBrand.find({ ...sellerFilter, ...searchFilter })
          .select("_id name")
          .limit(50)
          .lean();
        const searchResultIds = new Set(searchResults.map((b: any) => b._id.toString()));
        const missingSelectedIds = selectedObjectIds.filter((id) => !searchResultIds.has(id.toString()));

        let forcedBrands: any[] = [];
        if (missingSelectedIds.length > 0) {
          forcedBrands = await ProductBrand.find({ _id: { $in: missingSelectedIds }, ...sellerFilter })
            .select("_id name")
            .lean();
        }

        const combined = [...forcedBrands, ...searchResults];
        const uniqueMap = new Map();
        combined.forEach((item) => uniqueMap.set(item._id.toString(), item));
        return Array.from(uniqueMap.values());
      })();
    }

    if (modules.includes("ProductType") || modules.includes("Product Type")) {
      productTypesPromise = (async () => {
        const sellerProducts = await Product.find(sellerFilter).select("_id").lean();
        const productIds = sellerProducts.map((p) => p._id);

        const productMetas =
          productIds.length > 0
            ? await ProductProductmeta.find({ product_id: { $in: productIds } }).select("productmeta_id").lean()
            : [];
        const metaIds = [...new Set(productMetas.map((pm) => pm.productmeta_id))];

        const searchResults =
          metaIds.length > 0
            ? await Productmeta.find({
                _id: { $in: metaIds },
                module: "Type",
                ...searchFilter,
              })
                .select("_id name")
                .limit(50)
                .lean()
            : [];

        const searchResultIds = new Set(searchResults.map((t: any) => t._id.toString()));
        const missingSelectedIds = selectedObjectIds.filter((id) => !searchResultIds.has(id.toString()));

        let forcedTypes: any[] = [];
        if (missingSelectedIds.length > 0) {
          forcedTypes = await Productmeta.find({
            _id: { $in: missingSelectedIds },
            module: "Type",
          })
            .select("_id name")
            .lean();
        }

        const combined = [...forcedTypes, ...searchResults];
        const uniqueMap = new Map();
        combined.forEach((item) => uniqueMap.set(item._id.toString(), item));
        return Array.from(uniqueMap.values());
      })();
    }

    const [products, productBrands, productTypes] = await Promise.all([
      productsPromise,
      productBrandsPromise,
      productTypesPromise,
    ]);

    return res.status(200).json({
      message: "✅ Targets Fetched successfully",
      data: {
        products,
        productBrands,
        productTypes,
      },
    });
  } catch (error) {
    await logError(error, { function: "get_target_options", payload: req.body });
    if (!res.headersSent) {
      return res.status(500).json({ message: "Server error", error });
    }
  }
}

export async function apply_coupon(req: NextApiRequest, res: NextApiResponse) {
  try {
    const cart_id = await getCartIdFromRequest(req, res);
    if (!cart_id) { return res.status(400).json({ status: false, message: "Cart not found", data: null }); }

    const { coupon_code } = req.body;
    if (!coupon_code) { return res.status(400).json({ status: false, message: "Coupon code is required", data: null }); }

    await cartCheck(cart_id);
    return res.status(200).json({ status: true, message: "Coupon Applied succesfully", data: null });
  } catch (error) { await logError(error, { function: "apply_coupon", payload: req.body }); }
}

export const functions: APIHandlers = {
  create_update_coupon : { middlewares: ["checkUserId", "checkPostMethod" ] },
  get_filtered_coupon : { middlewares: ["checkUserId", "checkPostMethod" ] },
  get_target_options : { middlewares: ["checkUserId", "checkPostMethod" ] },
  get_single_coupon : { middlewares: ["checkUserId", "checkPostMethod"] },
  apply_coupon : { middlewares: ["checkPostMethod"] },
}

export const couponHandlers = {
  create_update_coupon,
  get_filtered_coupon,
  get_target_options,
  get_single_coupon,
  apply_coupon,
};

export const config = { api: { bodyParser: false } };
export default createApiHandler(functions, couponHandlers);