import Sku from "lib/models/product/Sku";
import SkuDetail from "lib/models/product/SkuDetail";
import mongoose, { Types } from "mongoose";
import { pivotEntry } from "./dataService";
import { logError } from "./errorService";
import SkuProductFeature from "lib/models/product/SkuProductFeature";
import { NextApiRequest } from "next";
import { getUserIdFromToken } from "./authService";
import User from "lib/models/spatie/User";

export interface SellerResolveResult {
  sellerId: string | null;
  error?: { status: number; message: string };
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