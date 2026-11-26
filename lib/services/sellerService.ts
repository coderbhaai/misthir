import Cart from "lib/models/ecom/Cart";
import CartCharges from "lib/models/ecom/CartCharges";
import CartSku from "lib/models/ecom/CartSku";
import CartSellerCharges from "lib/models/seller/CartSellerCharges";
import SellerSiteSetting from "lib/models/seller/SellerSiteSetting";
import { Types } from "mongoose";

interface SellerSettingMap {
  shippingCharges: number;
  freeShippingAbove: number | null;
  allowCod: boolean;
  codCharges: number;
}

export async function syncSellerCartCharges(cart_id: string) {
  if (!Types.ObjectId.isValid(cart_id)) return;

  const cartObjectId = new Types.ObjectId(cart_id);

  const [cart, cartSkus] = await Promise.all([
    Cart.findById(cartObjectId).lean(),
    CartSku.find({ cart_id: cartObjectId }).lean(),
  ]);
  if (!cart) return;

  const isCodSelected = String((cart as any).paymode || "").trim().toLowerCase() === "cod";
  const sellerSubtotals = new Map<string, number>();

  for (const sku of cartSkus as any[]) {
    if (!sku.seller_id) continue;

    const sellerIdStr = String(sku.seller_id);
    const qty = Number(sku.quantity ?? 0);
    const unitPrice = Number(sku.price ?? 0);
    const saleAmount = Number(sku.sale ?? 0);
    const effectiveUnitPrice = saleAmount > 0 ? saleAmount : unitPrice;
    const lineTotal = qty * effectiveUnitPrice;
    sellerSubtotals.set(sellerIdStr, (sellerSubtotals.get(sellerIdStr) ?? 0) + lineTotal);
  }

  const activeSellerIds = Array.from(sellerSubtotals.keys());

  await CartSellerCharges.deleteMany({
    cart_id: cartObjectId,
    ...(activeSellerIds.length > 0
      ? { seller_id: { $nin: activeSellerIds.map((id) => new Types.ObjectId(id)) } }
      : {}),
  });

  if (activeSellerIds.length === 0) {
    await CartCharges.findOneAndUpdate(
      { cart_id: cartObjectId },
      { shipping_charges: 0, cod_charges: 0 },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return;
  }

  const settings = await SellerSiteSetting.find({
    seller_id: { $in: activeSellerIds.map((id) => new Types.ObjectId(id)) },
    status: true,
    module: {
      $in: ["Shipping Charges", "Free Shipping Above", "Allow Cod", "Cod Charges"],
    },
  }).lean();

  const settingsBySeller = new Map<string, SellerSettingMap>();
  for (const sellerId of activeSellerIds) {
    settingsBySeller.set(sellerId, {
      shippingCharges: 0,
      freeShippingAbove: null,
      allowCod: false,
      codCharges: 0,
    });
  }

  for (const setting of settings as any[]) {
    const sellerIdStr = String(setting.seller_id);
    const current = settingsBySeller.get(sellerIdStr);
    if (!current) continue;

    const val = String(setting.module_value ?? "").trim();

    switch (setting.module) {
      case "Shipping Charges":
        current.shippingCharges = Math.max(0, Number(val) || 0);
        break;
      case "Free Shipping Above": {
        const parsed = Number(val);
        current.freeShippingAbove = val !== "" && !Number.isNaN(parsed) ? parsed : null;
        break;
      }
      case "Allow Cod":
        current.allowCod =
          val === "1" || val.toLowerCase() === "true" || val.toLowerCase() === "yes";
        break;
      case "Cod Charges":
        current.codCharges = Math.max(0, Number(val) || 0);
        break;
    }
  }

  let totalShippingCharges = 0;
  let totalCodCharges = 0;

  for (const [sellerIdStr, subtotal] of sellerSubtotals.entries()) {
    const cfg = settingsBySeller.get(sellerIdStr)!;
    const sellerObjectId = new Types.ObjectId(sellerIdStr);

    const qualifiesFreeShipping = cfg.freeShippingAbove !== null && subtotal >= cfg.freeShippingAbove;
    const shipping_charges = qualifiesFreeShipping ? 0 : cfg.shippingCharges;
    const cod_charges = isCodSelected && !cfg.allowCod ? cfg.codCharges : 0;

    totalShippingCharges += shipping_charges;
    totalCodCharges += cod_charges;

    await CartSellerCharges.findOneAndUpdate(
      { cart_id: cartObjectId, seller_id: sellerObjectId },
      {
        cart_id: cartObjectId,
        seller_id: sellerObjectId,
        subtotal,
        shipping_charges,
        cod_charges,
        allow_cod: cfg.allowCod,
        free_shipping_above: cfg.freeShippingAbove,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }

  await CartCharges.findOneAndUpdate(
    { cart_id: cartObjectId },
    {
      shipping_charges: totalShippingCharges,
      cod_charges: totalCodCharges,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}