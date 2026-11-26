import { Separator } from "@amitkk/components/ui/separator";
import React from "react";
import ChargeRow from "./ChargeRow";
import { CartProps, OrderProps } from "../types";
import { getProp } from "@amitkk/basic/utils/my-utils/shared-utils";

function getId(val: unknown): string {
  if (!val) return "";
  if (typeof val === "object" && val !== null) {
    const anyVal = val as any;
    if (anyVal._id) {
      return typeof anyVal._id === "object" && "toString" in anyVal._id
        ? anyVal._id.toString()
        : String(anyVal._id);
    }
    if (typeof anyVal.toString === "function") return anyVal.toString();
  }
  return String(val);
}

function getSkuSellerId(item: any): string {
  if (!item) return "";
  if (item.seller_id) return getId(item.seller_id);
  const product = item.product_id;
  if (product && typeof product === "object") {
    return getId(product.seller_id || product.seller || "");
  }
  return "";
}

function getSkuUnitPrice(item: any): number {
  const price = Number(item?.price ?? 0);
  const sale = Number(item?.sale ?? 0);
  return sale > 0 && sale < price ? sale : price;
}

function getActiveSkuDiscountAmount(
  item: any,
  unitPrice: number,
  qty: number,
  baseLineTotal: number,
  targetSellerId: string
): number {
  if (!item || baseLineTotal <= 0 || unitPrice <= 0 || qty <= 0) return 0;

  const rawDiscount =
    item?.discount && typeof item.discount === "object"
      ? item.discount
      : item?.cartSkuDiscount && typeof item.cartSkuDiscount === "object"
      ? item.cartSkuDiscount
      : item?.skuDiscount && typeof item.skuDiscount === "object"
      ? item.skuDiscount
      : item?.seller_discount && typeof item.seller_discount === "object"
      ? item.seller_discount
      : null;

  const validity =
    rawDiscount?.seller_discount_validity ?? item?.seller_discount_validity ?? null;

  if (validity) {
    const expiryTime = new Date(validity).getTime();
    if (!Number.isNaN(expiryTime) && expiryTime < Date.now()) {
      return 0;
    }
  }

  const discountSellerId = getId(rawDiscount?.seller_id);
  const itemSellerId = getSkuSellerId(item);

  if (targetSellerId && discountSellerId && discountSellerId !== targetSellerId) {
    return 0;
  }
  if (!targetSellerId && discountSellerId && itemSellerId && discountSellerId !== itemSellerId) {
    return 0;
  }

  const rate = Number(
    rawDiscount?.seller_discount ??
      (typeof item?.seller_discount === "number" ? item.seller_discount : 0)
  );

  if (!rate || rate <= 0) return 0;

  const discountType: "flat" | "percent" =
    rawDiscount?.discount_type === "percent" || item?.discount_type === "percent"
      ? "percent"
      : "flat";

  const rawPerUnit =
    discountType === "percent" ? (unitPrice * Math.min(rate, 100)) / 100 : rate;
  const perUnitDiscount = Math.min(unitPrice, Math.max(0, rawPerUnit));
  const totalSkuDiscount = perUnitDiscount * qty;

  return Math.min(baseLineTotal, Math.max(0, Number(totalSkuDiscount.toFixed(2))));
}

function getActiveAdminDiscountAmount(
  charges: any,
  eligibleSubtotal: number,
  hideAdminDiscount: boolean
): number {
  if (!charges || hideAdminDiscount || eligibleSubtotal <= 0) return 0;

  const validity = charges?.admin_discount_validity ?? null;
  if (validity) {
    const expiryTime = new Date(validity).getTime();
    if (!Number.isNaN(expiryTime) && expiryTime < Date.now()) {
      return 0;
    }
  }

  const rate = Number(charges?.admin_discount ?? 0);
  if (rate > 0) {
    const adminType: "flat" | "percent" =
      charges?.admin_discount_type === "percent" ? "percent" : "flat";
    const rawAmount =
      adminType === "percent" ? (eligibleSubtotal * Math.min(rate, 100)) / 100 : rate;
    return Math.min(eligibleSubtotal, Math.max(0, Number(rawAmount.toFixed(2))));
  }

  const storedTotal = Number(charges?.total_admin_discount ?? 0);
  return storedTotal > 0
    ? Math.min(eligibleSubtotal, Math.max(0, Number(storedTotal.toFixed(2))))
    : 0;
}

interface CartChargesProps {
  cart?: CartProps | OrderProps;
  cart_status?: boolean;
  seller_id?: string;
  isSellerView?: boolean;
}

export default function CartCharges({
  cart,
  cart_status = true,
  seller_id,
  isSellerView = false,
}: CartChargesProps) {
  const allSkus: any[] = getProp(cart, "cartSkus", getProp(cart, "orderSkus", []));
  const targetSellerId = seller_id ? String(seller_id) : "";
  const hideAdminDiscount = Boolean(targetSellerId) || Boolean(isSellerView);

  const skus = targetSellerId
    ? allSkus.filter((item) => getSkuSellerId(item) === targetSellerId)
    : allSkus;

  const itemCount = skus.reduce(
    (acc, item) => acc + Number(item?.quantity ?? 0),
    0
  );

  let rawSubtotal = 0;
  let skuDiscountSum = 0;

  for (const item of skus) {
    const qty = Number(item?.quantity ?? 0);
    const unitPrice = getSkuUnitPrice(item);
    const baseLineTotal = qty * unitPrice;

    rawSubtotal += baseLineTotal;
    skuDiscountSum += getActiveSkuDiscountAmount(
      item,
      unitPrice,
      qty,
      baseLineTotal,
      targetSellerId
    );
  }

  const charges: any = getProp(cart, "cartCharges", getProp(cart, "orderCharges", null));
  const coupon: any = getProp(cart, "cartCoupon", null);

  const subtotal = Number(rawSubtotal.toFixed(2));
  const roundedSkuDiscount = Number(skuDiscountSum.toFixed(2));

  const shippingCharges = hideAdminDiscount ? 0 : Number(charges?.shipping_charges ?? 0);
  const codCharges = hideAdminDiscount ? 0 : Number(charges?.cod_charges ?? 0);
  const salesDiscount = hideAdminDiscount ? 0 : Number(charges?.sales_discount ?? 0);

  const totalCouponDiscount = targetSellerId
    ? Number(coupon?.seller_coupon_discount ?? 0)
    : Number(coupon?.admin_coupon_discount ?? 0) +
      Number(coupon?.seller_coupon_discount ?? 0);

  const sellerDiscountTotal =
    roundedSkuDiscount > 0
      ? roundedSkuDiscount
      : targetSellerId
      ? Number(charges?.seller_discount ?? 0)
      : Number(charges?.total_seller_discount ?? charges?.seller_discount ?? 0);

  const eligibleForAdmin = Math.max(0, subtotal - sellerDiscountTotal);
  const adminDiscountTotal = getActiveAdminDiscountAmount(
    charges,
    eligibleForAdmin,
    hideAdminDiscount
  );

  const payableAmount = Math.max(
    0,
    Number(
      (
        subtotal +
        shippingCharges +
        codCharges -
        salesDiscount -
        totalCouponDiscount -
        sellerDiscountTotal -
        adminDiscountTotal
      ).toFixed(2)
    )
  );

  return (
    <>
      <Separator className="my-4" />
      <div className="flex justify-between mb-2 text-sm">
        <span>Subtotal · {itemCount} Items</span>
        <span>₹{subtotal}</span>
      </div>

      {charges && (
        <>
          {!hideAdminDiscount && (
            <>
              <ChargeRow label="Shipping Charges (Inc)" value={shippingCharges} />
              <ChargeRow label="COD Charges (Inc)" value={codCharges} />
              <ChargeRow label="Sales Discount" value={salesDiscount} />
            </>
          )}
          <ChargeRow label="Coupon Discount" value={totalCouponDiscount} />
          <ChargeRow label="Seller Discount" value={sellerDiscountTotal} />
          {!hideAdminDiscount && (
            <ChargeRow label="Admin Discount" value={adminDiscountTotal} />
          )}
        </>
      )}

      <Separator className="my-4" />
      <div className="flex justify-between text-base font-bold">
        <span>{cart_status ? "Payable" : "Paid"}</span>
        <span>₹{payableAmount}</span>
      </div>
    </>
  );
}