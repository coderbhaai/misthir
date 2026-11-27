import React from "react";
import { OrderSkuProps } from "../types";
import ImageWithFallback from "@amitkk/basic/static/ImageWithFallback";
import { Card } from "@amitkk/components/ui/card";
import { getProp } from "@amitkk/basic/utils/my-utils/shared-utils";

interface OrderSkuItemListProps {
  items: OrderSkuProps[];
  seller_id?: string;
}

function resolveId(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    const obj = value as { _id?: unknown; id?: unknown };
    return String(obj._id ?? obj.id ?? "");
  }
  return String(value);
}

function getOrderItemSellerId(item: OrderSkuProps): string {
  return resolveId(item.seller_id);
}

function getOrderUnitPrice(item: any): number {
  const savedPrice = Number(item?.price ?? 0);
  if (savedPrice > 0) return savedPrice;
  return Number(getProp(item?.sku_id, "price") ?? 0);
}

function getSavedSellerDiscount(item: any, baseUnit: number, qty: number) {
  const rawDiscountDoc =
    item?.orderSkuDiscount ??
    item?.discount ??
    item?.skuDiscount ??
    (typeof item?.seller_discount === "object" ? item.seller_discount : null);

  const rate = Number(
    rawDiscountDoc?.seller_discount ??
      (typeof item?.seller_discount === "number" ? item.seller_discount : 0)
  );

  if (!rate || rate <= 0 || baseUnit <= 0 || qty <= 0) return null;

  const discountType: "flat" | "percent" =
    rawDiscountDoc?.discount_type === "percent" || item?.discount_type === "percent"
      ? "percent"
      : "flat";

  const rawPerUnit =
    discountType === "percent" ? (baseUnit * Math.min(rate, 100)) / 100 : rate;
  const perUnitDiscount = Number(Math.min(baseUnit, rawPerUnit).toFixed(2));
  const totalDiscount = Number((perUnitDiscount * qty).toFixed(2));

  if (perUnitDiscount <= 0) return null;

  return {
    rate,
    discountType,
    perUnitDiscount,
    totalDiscount,
  };
}

export default function OrderSkuItemList({
  items = [],
  seller_id,
}: OrderSkuItemListProps) {
  if (!items || items.length === 0) return null;

  const targetSellerId = seller_id ? String(seller_id) : "";
  const filteredItems = targetSellerId
    ? items.filter((item) => getOrderItemSellerId(item) === targetSellerId)
    : items;

  if (filteredItems.length === 0) return null;

  return (
    <div className="flex-1 overflow-y-auto w-full space-y-3">
      <ul className="space-y-3 p-0 m-0 list-none">
        {filteredItems.map((item) => {
          const anyItem = item as any;
          const product =
            typeof item.product_id === "object" && item.product_id !== null
              ? (item.product_id as any)
              : null;
          const productName = getProp(item.product_id, "name");
          const productImage = product?.medias?.[0];
          const sellerName = (item.seller_id as any)?.name;

          const qty = Math.max(1, Number(item.quantity || 1));
          const baseUnit = getOrderUnitPrice(anyItem);
          const baseLineTotal = Number((qty * baseUnit).toFixed(2));
          const sellerDisc = getSavedSellerDiscount(anyItem, baseUnit, qty);

          const perUnitDiscount = sellerDisc ? sellerDisc.perUnitDiscount : 0;
          const discountedUnitPrice = Math.max(
            0,
            Number((baseUnit - perUnitDiscount).toFixed(2))
          );
          const totalLineDiscount = sellerDisc
            ? Math.min(baseLineTotal, sellerDisc.totalDiscount)
            : 0;
          const finalLineTotal = Math.max(
            0,
            Number((baseLineTotal - totalLineDiscount).toFixed(2))
          );
          const hasSellerDiscount = perUnitDiscount > 0;

          const badgeText =
            sellerDisc?.discountType === "percent"
              ? `Seller Offer: ${sellerDisc.rate}% off (-₹${perUnitDiscount}/unit)`
              : `Seller Offer: -₹${perUnitDiscount}/unit`;

          return (
            <li key={String(item._id)}>
              <Card className="w-full p-3 shadow-none border border-border bg-card flex flex-col space-y-3 relative mb-2">
                <div className="flex items-start gap-3">
                  <ImageWithFallback img={productImage} width={80} height={80} />
                  <div className="flex-grow min-w-0 space-y-1">
                    <p className="text-sm font-semibold leading-snug">{productName}</p>
                    {sellerName && (
                      <p className="text-xs text-muted-foreground">By {sellerName}</p>
                    )}

                    {hasSellerDiscount && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                        <span className="inline-flex items-center rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                          {badgeText}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="text-right shrink-0">
                    {hasSellerDiscount ? (
                      <div className="flex flex-col items-end">
                        <span className="text-xs text-muted-foreground line-through">
                          ₹{baseUnit}
                        </span>
                        <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
                          ₹{discountedUnitPrice}
                        </span>
                      </div>
                    ) : (
                      <p className="text-sm font-bold">₹{baseUnit}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between bg-muted/40 p-2 rounded-md">
                  <p className="text-xs text-muted-foreground">Qty: {qty}</p>

                  {hasSellerDiscount ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground line-through">
                        ₹{baseLineTotal}
                      </span>
                      <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
                        ₹{finalLineTotal}
                      </span>
                    </div>
                  ) : (
                    <p className="text-sm font-bold">₹{baseLineTotal}</p>
                  )}
                </div>
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}