import { Separator } from "@amitkk/components/ui/separator";
import React from "react";
import ChargeRow from "./ChargeRow";
import { OrderProps } from "../types";
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

function toAmount(val: unknown): number {
  const num = Number(val ?? 0);
  return Number.isFinite(num) ? Number(num.toFixed(2)) : 0;
}

function getSellerChargesList(order: any): any[] {
  const list = getProp(
    order,
    "orderSellerCharges",
    getProp(order, "cartSellerCharges", getProp(order, "sellerCharges", []))
  );
  return Array.isArray(list) ? list : [];
}

function getSellerChargeRecord(order: any, targetSellerId: string) {
  if (!targetSellerId) return null;
  const sellerChargesList = getSellerChargesList(order);
  return (
    sellerChargesList.find((entry) => getId(entry?.seller_id) === targetSellerId) ??
    null
  );
}

function resolveCombinedSellerCharges(
  sellerChargesList: any[],
  charges: any
): { shipping: number; cod: number } {
  if (sellerChargesList.length > 0) {
    const sum = sellerChargesList.reduce(
      (acc, entry) => {
        acc.shipping += toAmount(entry?.shipping_charges);
        acc.cod += toAmount(entry?.cod_charges);
        return acc;
      },
      { shipping: 0, cod: 0 }
    );

    return {
      shipping: toAmount(sum.shipping),
      cod: toAmount(sum.cod),
    };
  }

  return {
    shipping: toAmount(charges?.shipping_charges),
    cod: toAmount(charges?.cod_charges),
  };
}

interface OrderChargesProps {
  order?: OrderProps;
  seller_id?: string;
  isSellerView?: boolean;
}

export default function OrderCharges({
  order,
  seller_id,
  isSellerView = false,
}: OrderChargesProps) {
  const allSkus: any[] = getProp(order, "orderSkus", []);
  const targetSellerId = seller_id ? String(seller_id) : "";
  const isScopedToSeller = Boolean(targetSellerId);
  const hideAdminBreakdown = isScopedToSeller || Boolean(isSellerView);

  const skus = isScopedToSeller
    ? allSkus.filter((item) => getSkuSellerId(item) === targetSellerId)
    : allSkus;

  const itemCount = skus.reduce(
    (acc, item) => acc + Number(item?.quantity ?? 0),
    0
  );

  const charges: any = getProp(order, "orderCharges", null);
  const sellerChargesList = getSellerChargesList(order);
  const sellerChargeRecord: any = getSellerChargeRecord(order, targetSellerId);
  const combinedCharges = resolveCombinedSellerCharges(sellerChargesList, charges);
  const coupon: any = getProp(order, "orderCoupon", null);

  const savedSubtotal = toAmount(
    isScopedToSeller
      ? sellerChargeRecord?.subtotal ??
          skus.reduce(
            (sum, item) =>
              sum + toAmount(item?.price) * Math.max(1, Number(item?.quantity ?? 1)),
            0
          )
      : order?.total ??
          skus.reduce(
            (sum, item) =>
              sum + toAmount(item?.price) * Math.max(1, Number(item?.quantity ?? 1)),
            0
          )
  );

  const shippingCharges = isScopedToSeller
    ? toAmount(sellerChargeRecord?.shipping_charges)
    : isSellerView
    ? 0
    : combinedCharges.shipping;

  const codCharges = isScopedToSeller
    ? toAmount(sellerChargeRecord?.cod_charges)
    : isSellerView
    ? 0
    : combinedCharges.cod;

  const salesDiscount = hideAdminBreakdown ? 0 : toAmount(charges?.sales_discount);

  const couponDiscount = isScopedToSeller
    ? toAmount(coupon?.vendor_coupon_discount ?? coupon?.seller_coupon_discount)
    : toAmount(
        toAmount(coupon?.admin_coupon_discount) +
          toAmount(coupon?.vendor_coupon_discount ?? coupon?.seller_coupon_discount)
      );

  const sellerDiscountTotal = isScopedToSeller
    ? toAmount(
        charges?.seller_discount ??
          skus.reduce((sum, item) => sum + toAmount(item?.seller_discount), 0)
      )
    : toAmount(
        charges?.total_seller_discount ??
          charges?.seller_discount ??
          skus.reduce((sum, item) => sum + toAmount(item?.seller_discount), 0)
      );

  const adminDiscountTotal = hideAdminBreakdown
    ? 0
    : toAmount(charges?.admin_discount ?? charges?.total_admin_discount);

  const savedPaidAmount = toAmount(
    isScopedToSeller
      ? sellerChargeRecord?.payable_amount ?? sellerChargeRecord?.paid ?? savedSubtotal
      : (order as any)?.paid ?? (order as any)?.payable_amount ?? savedSubtotal
  );

  const hasAnyChargeBreakdown =
    Boolean(charges) || Boolean(sellerChargeRecord) || sellerChargesList.length > 0;

  return (
    <>
      <Separator className="my-4" />
      <div className="flex justify-between mb-2 text-sm">
        <span>Subtotal · {itemCount} Items</span>
        <span>₹{savedSubtotal}</span>
      </div>

      {hasAnyChargeBreakdown && (
        <>
          {(!hideAdminBreakdown || isScopedToSeller) && (
            <>
              <ChargeRow label="Shipping Charges" value={shippingCharges} />
              <ChargeRow label="COD Charges" value={codCharges} />
            </>
          )}

          {!hideAdminBreakdown && (
            <ChargeRow label="Sales Discount" value={salesDiscount} />
          )}

          <ChargeRow label="Coupon Discount" value={couponDiscount} />
          <ChargeRow label="Seller Discount" value={sellerDiscountTotal} />

          {!hideAdminBreakdown && (
            <ChargeRow label="Admin Discount" value={adminDiscountTotal} />
          )}
        </>
      )}

      <Separator className="my-4" />
      <div className="flex justify-between text-base font-bold">
        <span>Paid</span>
        <span>₹{savedPaidAmount}</span>
      </div>
    </>
  );
}