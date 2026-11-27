import mongoose, { isValidObjectId, Types } from "mongoose";
import sanitizeHtml from "sanitize-html";
import { logError } from "./errorService";
import Blog from "lib/models/blog/Blog";
import Faq from "lib/models/basic/Faq";
import Testimonial from "lib/models/basic/Testimonial";
import CommentModel from 'lib/models/basic/Comment';
import GenericBlock from "lib/models/block/GenericBlock";
import BlockDetail from "lib/models/block/BlockDetail";
import Achievement from "lib/models/basic/Achievement";
import { AnyModel } from "lib/models";
import { clo } from "@amitkk/basic/utils/my-utils/admin-utils";
import ProductProductmeta from "lib/models/product/ProductProductmeta";
import Product from "lib/models/product/Product";

export const sanitizeText = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export function escapeRegExp(string: string) { return string.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

export const cleanContent = (html: string | undefined | null) => {
  if (!html || typeof html !== 'string') return '';

  const removeEmptyParagraphs = html.replace(/<p>(\s|&nbsp;|<br\s*\/?>)*<\/p>/gi, '');

  return sanitizeHtml(removeEmptyParagraphs, {
    allowedTags: [ 
      'p', 'b', 'i', 'em', 'strong', 'a', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4',
      'figure', 'img', 'blockquote', 'table', 'thead', 'tbody', 'tr', 'th', 'td'
    ],
    allowedAttributes: {
      'a': [ 'href', 'name', 'target' ],
      'img': [ 'src', 'alt', 'width', 'height', 'style' ],
      'figure': [ 'class' ]
    },
    allowedStyles: {
      'img': {
        'aspect-ratio': [/^\d+\/\d+$/],
        'width': [/^\d+(px|%)?$/],
        'height': [/^\d+(px|%)?$/]
      }
    }
  });
};

export const checkNullValue = (value: any) => {
  try {
    if ( value === 0 || value === null || value === "undefined" ) { return null; }
    return value;
  } catch { return value; }
}

export function toObjectId(id: string | mongoose.Types.ObjectId | null | undefined) {
  if (!id) return null;

  try {
    return typeof id === "string" ? new mongoose.Types.ObjectId(id) : id;
  }catch (error) { logError(error, { function: 'toObjectId', payload: {id} }); return null; }
}

export const safeParse = (value: any, fallback: any = []) => {
  if (Array.isArray(value)) return value;
  if (typeof value === "object" && value !== null) return value;
  if (typeof value !== "string") return fallback;

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

export async function pivotEntry(
  model: AnyModel,
  parentId: mongoose.Types.ObjectId | string,
  childIds: (mongoose.Types.ObjectId | string)[] | undefined | null,
  parentKey: string,
  childKey: string
): Promise<void> {
  try {
    const parentObjectId = new mongoose.Types.ObjectId(parentId);
    await model.deleteMany({ [parentKey]: parentObjectId });

    if (Array.isArray(childIds) && childIds.length > 0) {
      const entries = childIds?.map((childId) => ({
        [parentKey]: parentObjectId,
        [childKey]: new mongoose.Types.ObjectId(childId),
        createdAt: new Date(),
      }));

      await model.insertMany(entries);
    }
  } catch (error) {
    await logError(error, { function: "pivotEntry", payload: {model, parentId, childIds, parentKey, childKey} });
  }
}

// export async function getRelatedContent({ module, moduleId }: { module: string; moduleId: string }) {
//   try {
//     const id = new Types.ObjectId(moduleId);
//     const moduleFilter = { module, module_id: id, status: true };
//     const blogFilter = { status: true, ...(module === "Blog" && { _id: { $ne: id } }) };
//     const mediaSelect = "_id url path alt";
//     const mediaStatusFilter = { status: true, media_id: { $exists: true, $ne: null } };

//     const [faq, testimonials, achievements, comments, blogs, treatments, doctors, hospitals, packages] = await Promise.all([
//       Faq.find(moduleFilter).select("_id question answer displayOrder").sort({ displayOrder: 1, createdAt: -1 }).lean().exec(),
//       Testimonial.find(moduleFilter).select("_id content name designation company_name client_id displayOrder").populate({ path: "client_id", select: "_id name media_id", populate: { path: "media_id", model: "Media", select: mediaSelect } }).sort({ displayOrder: 1, createdAt: -1 }).lean().exec(),
//       Achievement.find(moduleFilter).select("_id title description value displayOrder").sort({ displayOrder: 1, createdAt: -1 }).lean().exec(),
//       CommentModel.find({ module, module_id: moduleId, status: true }).select("_id name comment createdAt").sort({ displayOrder: 1, createdAt: -1 }).lean().exec(),
//       Blog.find(mediaStatusFilter).select('_id name url media_id createdAt').populate([ { path: 'media_id', select: mediaSelect } ]).sort({ displayOrder: 1, createdAt: -1 }).limit(10).lean().exec(),
//       Treatment.find(mediaStatusFilter).select('_id name url media_id createdAt').populate([ { path: 'media_id', select: mediaSelect } ]).sort({ displayOrder: 1, createdAt: -1 }).limit(10).lean().exec(),
//       Doctor.find(mediaStatusFilter).select('_id name url media_id createdAt').populate([ { path: 'media_id', select: mediaSelect } ]).sort({ displayOrder: 1, createdAt: -1 }).limit(10).lean().exec(),
//       Hospital.find(mediaStatusFilter).select('_id name url media_id createdAt').populate([ { path: 'media_id', select: mediaSelect } ]).sort({ displayOrder: 1, createdAt: -1 }).limit(10).lean().exec(),
//       Package.find(mediaStatusFilter).select('_id name url media_id createdAt').populate([ { path: 'media_id', select: mediaSelect } ]).sort({ displayOrder: 1, createdAt: -1 }).limit(10).lean().exec(),
//     ]);

//     const sanitizedTestimonials = testimonials.map((t: any) => ({ ...t, content: typeof t.content === "string" ? sanitizeHtml(t.content) : "" }));
  
//     return { faq, testimonials: sanitizedTestimonials, achievements, comments, blogs, treatments, doctors, hospitals, packages };
//   } catch (error) { 
//     await logError(error, { function: 'getRelatedContent', payload: {} });
//     return { faq: [], testimonials: [], achievements: [], comments: [], blogs: [], treatments: [], doctors: [], hospitals: [], packages: [] }; 
//   }
// }


export async function getRelatedContent({ module, moduleId }: { module: string; moduleId: string }) {
  try {
    const id = new Types.ObjectId(moduleId);
    const moduleFilter = { module, module_id: id, status: true };
    const blogFilter = { status: true, ...(module === "Blog" && { _id: { $ne: id } }) };
    const mediaSelect = "_id url path alt";

    let products: any[] = [];
    if (module === "Product") {
      const currentProductTypes = await ProductProductmeta.find({ product_id: id }).select("productmeta_id").lean().exec();
      const typeIds = currentProductTypes.map((pt: any) => pt.productmeta_id);
      let relatedProductIds: Types.ObjectId[] = [];
    
      if (typeIds.length > 0) {
        const matchingRelations = await ProductProductmeta.find({ productmeta_id: { $in: typeIds }, product_id: { $ne: id } }).select("product_id").lean().exec();
        relatedProductIds = matchingRelations.map((rel: any) => rel.product_id);
      }
    
      if (relatedProductIds.length > 0) {
        products = await Product.find({ _id: { $in: relatedProductIds }, status: true }).populate([{ path: "mediaHubs", populate: { path: "media_id", model: "Media", select: "_id path alt" } }]).limit(10).lean().exec();
      }
    }

    if (products.length < 10) {
      const excludeIds = module === "Product" ? [id, ...products.map((p: any) => p._id)] : products.map((p: any) => p._id);
  
      const fallbackProducts = await Product.find({ _id: { $nin: excludeIds }, status: true }).populate([{ path: "mediaHubs", populate: { path: "media_id", model: "Media", select: "_id path alt" } }]).limit(10 - products.length).lean().exec();
        
      products = [...products, ...fallbackProducts];
    }
    
    const [faq, testimonials, achievements, comments, blogs] = await Promise.all([
      Faq.find(moduleFilter).select("_id question answer displayOrder").sort({ displayOrder: 1, createdAt: -1 }).lean().exec(),
      Testimonial.find(moduleFilter).select("_id content name designation company_name user_id displayOrder").sort({ displayOrder: 1, createdAt: -1 }).lean().exec(),
      Achievement.find(moduleFilter).select("_id title description value displayOrder").sort({ displayOrder: 1, createdAt: -1 }).lean().exec(),
      CommentModel.find({ module, module_id: moduleId, status: true }).select("_id name comment createdAt").sort({ displayOrder: 1, createdAt: -1 }).lean().exec(),
      Blog.find(blogFilter).select('_id name url media_id createdAt').populate([ { path: 'media_id', select: mediaSelect } ]).limit(10).lean().exec(),
    ]);

    const sanitizedTestimonials = testimonials.map((t: any) => ({ ...t, content: typeof t.content === "string" ? sanitizeHtml(t.content) : "" }));
  
    return { faq, testimonials: sanitizedTestimonials, achievements, comments, blogs, products };
  } catch (error) { 
    await logError(error, { function: 'getRelatedContent', payload: {} });
    return { faq: [], testimonials: [], achievements: [], comments: [], blogs: [], products: [] }; 
  }
}

export async function getBlockContent({ module, moduleId }: { module: string; moduleId: string }) {
  try {
    const id = new Types.ObjectId(moduleId);
    const mediaSelect = "url alt path";

    const [genericBlocks, blockDetails] = await Promise.all([
      GenericBlock.find({ module, module_id: id, status: true })
        .sort({ displayOrder: 1, createdAt: -1 })
        .populate([
          { path: "media_id", select: mediaSelect },
          { path: "mobile_media_id", select: mediaSelect }
        ])
        .lean()
        .exec(),

      BlockDetail.find({ module, module_id: id, status: true })
        .populate([
          { path: "media_id", select: mediaSelect },
          { path: "mobile_media_id", select: mediaSelect }
        ])
        .lean()
        .exec()
    ]);

    return { genericBlocks, blockDetails };
  } catch (error) {
    await logError(error, {
      function: "getBlockContent",
      payload: { module, moduleId }
    });

    return { genericBlocks: [], blockDetails: [] };
  }
}

export async function getGenericContent() {
  try{
    const [blogs] = await Promise.all([
      Blog.find({ status: true }).populate([ { path: 'media_id' }, { path: 'metas', populate: { path: 'blogmeta_id', model: 'Blogmeta', select: '_id type name url' } } ]).limit(10).lean().exec()
    ]);
  
    return { blogs };
  }catch (error) { await logError(error, { function: 'getGenericContent', payload: {} }); }
}

export async function findIdInDB(id: string) {
  try {
    if (!mongoose.Types.ObjectId.isValid(id)) { return []; }

    const objectId = new mongoose.Types.ObjectId(id);
    const db = mongoose.connection.db;

    if (!db) {
      throw new Error("MongoDB database connection is not available");
    }

    const collections = await db.listCollections().toArray();

    const results: any[] = [];

    for (const collection of collections) {
      try {
        const document = await db.collection(collection.name).findOne({
          _id: objectId
        });

        if (document) {
          results.push({
            collection: collection.name,
            id: document._id?.toString(),
            document
          });
        }
      } catch (error) { clo(error); }
    }

    return results;
  } catch (error) {
    console.error("❌ [findIdInDB] ERROR:", error);
    return [];
  }
}

export function numberOrDefault(value: any): number {
  const n = Number(value);
  return isNaN(n) ? 0 : n;
}

export const toObjectIds = (arr: string[]) => arr.map(id => new mongoose.Types.ObjectId(id));

export async function extractId(val: any): Promise<string> {
  if (!val) return "";
  if (typeof val === "object") {
    if (val._id) return String(val._id);
    if (typeof val.toString === "function") return val.toString();
  }
  return String(val);
}

export function getProp<T>(value: unknown, prop: keyof T, fallback: any = ""): any {
  if ( value && typeof value === "object" && !("toHexString" in (value as any)) ) {
    return (value as T)[prop] ?? fallback;
  }
  return fallback;
}

export async function isDateValid(validity: unknown, now: Date): Promise<boolean> {
  if (!validity) return true;
  const expiry = new Date(validity as string | Date);
  if (Number.isNaN(expiry.getTime())) return true;
  return expiry.getTime() >= now.getTime();
}

export function toIdString(val: unknown): string {
  if (!val) return "";
  if (typeof val === "string") return val;
  if (typeof val === "number" || typeof val === "boolean") return String(val);

  if (typeof val === "object") {
    const anyVal = val as {
      _id?: unknown;
      id?: unknown;
      toHexString?: () => string;
      toString?: () => string;
    };

    if (typeof anyVal.toHexString === "function") {
      return anyVal.toHexString();
    }

    // Only unwrap `_id` if it is a populated/parent object and `_id !== val`
    if (anyVal._id !== undefined && anyVal._id !== null && anyVal._id !== val) {
      return toIdString(anyVal._id);
    }

    if (anyVal.id !== undefined && anyVal.id !== null && anyVal.id !== val) {
      return toIdString(anyVal.id);
    }

    if (
      typeof anyVal.toString === "function" &&
      anyVal.toString !== Object.prototype.toString
    ) {
      const str = String(anyVal.toString());
      if (str && str !== "[object Object]") return str;
    }
  }

  return "";
}