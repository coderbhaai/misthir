import CartCharges from "lib/models/ecom/CartCharges";
import CartSku from "lib/models/ecom/CartSku";
import CartSkuDiscount from "lib/models/ecom/CartSkuDiscount";
import { APIHandlers } from "lib/server/middleware";
import { computeExpiry, cartCheck, isValidUntil } from "lib/services/ecomService";
import { logError } from "lib/services/errorService";
import { NextApiRequest, NextApiResponse } from "next";
import { createApiHandler } from "../apiHandler";
import { safeParse } from "lib/services/dataService";

export async function apply_admin_discount(req: NextApiRequest, res: NextApiResponse) {
  try {
    const data = req.body?.data ?? req.body ?? {};
    const {
      cart_id,
      additional_discount,
      admin_discount_type,
      admin_discount_unit,
      admin_discount_validity_value,
    } = data;

    if (
      !cart_id ||
      additional_discount === undefined ||
      additional_discount === null ||
      !admin_discount_unit ||
      !admin_discount_validity_value
    ) {
      return res.status(400).json({ status: false, message: "Fields are Missing" });
    }

    const discountType: "flat" | "percent" =
      admin_discount_type === "percent" ? "percent" : "flat";

    const numericRate = Number(additional_discount);
    if (Number.isNaN(numericRate) || numericRate < 0) {
      return res.status(400).json({ status: false, message: "Invalid discount value" });
    }
    if (discountType === "percent" && numericRate > 100) {
      return res.status(400).json({ status: false, message: "Percentage cannot exceed 100" });
    }

    const expiry = await computeExpiry(admin_discount_validity_value, admin_discount_unit);
    if (!expiry) {
      return res.status(400).json({ status: false, message: "Invalid validity value or unit" });
    }

    const discountFields = {
      admin_discount_type: discountType,
      admin_discount: numericRate,
      admin_discount_validity: expiry,
      admin_discount_validity_value: Number(admin_discount_validity_value),
      admin_discount_unit,
    };

    const cartCharges = await CartCharges.findOneAndUpdate(
      { cart_id },
      {
        $set: discountFields,
        $setOnInsert: { cart_id },
      },
      { new: true, upsert: true }
    );

    await cartCheck(cart_id);
    return res.status(200).json({ status: true, message: "Cart Updated", data: cartCharges });
  } catch (error) {
    await logError(error, { function: "apply_admin_discount", payload: req.body });
    return res.status(500).json({ status: false, message: "Internal Server Error" });
  }
}

export async function apply_seller_discount(req: NextApiRequest, res: NextApiResponse) {
  try {
    const payload = req.body ?? {};
    const validityValue = Number(payload.seller_discount_validity_value ?? 0);
    const validityUnit = payload.seller_discount_validity_unit === "days" ? "days" : "hours";

    if (!payload.cart_id) { return res.status(400).json({ status: false, message: "Cart ID is Missing" }); }
    if (!validityValue || validityValue <= 0) { return res.status(400).json({ status: false, message: "Validity is Missing" }); }

    const rawItems = safeParse(payload.items);
    if (!Array.isArray(rawItems) || rawItems.length === 0) { return res.status(400).json({ status: false, message: "Items are Missing" }); }

    const expiry = await computeExpiry(validityValue, validityUnit);
    if (!expiry) { return res.status(400).json({ status: false, message: "Invalid Validity" }); }

    const discountType: "flat" | "percent" =
      payload.discount_type === "percent" ? "percent" : "flat";

    for (const entry of rawItems) {
      const targetCartSkuId = entry.cart_sku_id || entry.cartSku_id;
      const rateValue = Number(entry.discount_value ?? entry.seller_discount);
      if (!targetCartSkuId || Number.isNaN(rateValue) || rateValue < 0) { return res.status(400).json({ status: false, message: "Invalid SKU discount fields" }); }
      if (discountType === "percent" && rateValue > 100) { return res.status(400).json({ status: false, message: "Percentage cannot exceed 100" }); }

      const cartSku = await CartSku.findById(targetCartSkuId);
      if (!cartSku) { return res.status(400).json({ status: false, message: "Sku Not Found" }); }

      await CartSkuDiscount.findOneAndUpdate({ cart_sku_id: cartSku._id }, {
          $set: {
            cart_id: cartSku.cart_id,
            cart_sku_id: cartSku._id,
            sku_id: cartSku.sku_id,
            seller_id: entry.seller_id,
            discount_type: discountType,
            seller_discount: rateValue,
            seller_discount_validity: expiry,
            seller_discount_validity_value: validityValue,
            seller_discount_unit: validityUnit,
          },
        }, { upsert: true, new: true, setDefaultsOnInsert: true });
    }

    await cartCheck(payload.cart_id);
    return res.status(200).json({ status: true, message: "Cart Updated", data: true });
  } catch (error) {
    await logError(error, { function: "apply_seller_discount", payload: req.body });
    return res.status(500).json({ status: false, message: "Internal Server Error" });
  }
}

export async function get_seller_sku_discounts(req: NextApiRequest, res: NextApiResponse) {
  try {
    const payload = req.body?.data ?? req.body ?? {};
    const { cart_id, seller_id } = payload;

    if (!cart_id) {
      return res.status(400).json({ status: false, message: "cart_id is required" });
    }

    const query: Record<string, any> = { cart_id };
    if (seller_id) {
      query.seller_id = seller_id;
    }

    const discounts = await CartSkuDiscount.find(query).lean();
    const now = new Date();

    // Keep only still-valid discounts (or include all if editing expired ones is allowed)
    const validDiscounts = [];
    for (const d of discounts) {
      if (await isValidUntil(d.seller_discount_validity, now)) {
        validDiscounts.push(d);
      }
    }

    return res.status(200).json({ status: true, data: validDiscounts });
  } catch (error) {
    await logError(error, { function: "get_seller_sku_discounts", payload: req.body });
    return res.status(500).json({ status: false, message: "Internal Server Error" });
  }
}

export const functions: APIHandlers = {
  apply_admin_discount : { middlewares: ["checkUserId", "checkPostMethod"] },
  apply_seller_discount : { middlewares: ["checkUserId", "checkPostMethod"] },
  get_seller_sku_discounts : { middlewares: ["checkUserId", "checkPostMethod"] },
}

export const discountHandlers = {
  apply_admin_discount,
  apply_seller_discount,
  get_seller_sku_discounts,
};

export const config = { api: { bodyParser: false } };
export default createApiHandler(functions, discountHandlers);