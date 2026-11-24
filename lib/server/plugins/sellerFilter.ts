import { getSellerIdFromToken } from "lib/services/ecomService";
import { FilterQuery, Types } from "mongoose";
import { NextApiRequest } from "next";

export interface SellerFilterError {
  status: number;
  message: string;
}

export async function sellerFilter<T extends Document>(
  matchQuery: FilterQuery<T>,
  req?: NextApiRequest | null,
  field: string = "seller_id"
): Promise<{
  sellerId: string | null;
  error: SellerFilterError | null;
}> {
  if (!req) {
    return { sellerId: null, error: null };
  }

  const resolved = await getSellerIdFromToken(req);
  const sellerId = resolved?.sellerId ?? null;
  const error = resolved?.error ?? null;

  if (error) {
    return { sellerId: null, error };
  }

  if (sellerId) {
    if (!Types.ObjectId.isValid(sellerId)) {
      return {
        sellerId: null,
        error: { status: 400, message: "Invalid seller ID." },
      };
    }

    // Remove any conflicting $or seller/user filter if token-enforced seller scope applies
    if (field === "seller_id" && Array.isArray((matchQuery as any).$or)) {
      (matchQuery as any).$or = (matchQuery as any).$or.filter(
        (cond: Record<string, any>) => !("seller_id" in cond) && !("user_id" in cond)
      );
      if ((matchQuery as any).$or.length === 0) {
        delete (matchQuery as any).$or;
      }
    }

    (matchQuery as any)[field] = new Types.ObjectId(sellerId);
  }

  return { sellerId, error: null };
}