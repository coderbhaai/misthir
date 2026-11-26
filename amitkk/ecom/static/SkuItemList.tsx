import React from "react";
import { CartSkuProps } from "../types";
import ImageWithFallback from "@amitkk/basic/static/ImageWithFallback";
import { Card } from "@amitkk/components/ui/card";

interface SkuItemListProps {
  items: CartSkuProps[];
  seller_id?: string;
}

function getItemSellerId(item: CartSkuProps): string {
  const anyItem = item as any;
  const product = item.product_id as any;
  const rawSeller =
    anyItem?.seller_id ??
    product?.seller_id ??
    product?.seller?._id ??
    product?.seller ??
    product?.user_id ??
    "";

  if (typeof rawSeller === "object" && rawSeller !== null) {
    return String(rawSeller._id ?? rawSeller.id ?? "");
  }
  return String(rawSeller || "");
}

function formatValidityTimestamp(validity: string | Date | null): string {
  if (!validity) return "";
  const date = new Date(validity);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function getBaseUnitPrice(item: any): number {
  const price = Number(item?.price || 0);
  const sale = Number(item?.sale || 0);
  return sale > 0 && sale < price ? sale : price;
}

function getActiveSellerDiscount(item: any, baseUnit: number, qty: number) {
  const rawDiscountDoc =
    item?.discount ??
    item?.cartSkuDiscount ??
    item?.skuDiscount ??
    (typeof item?.seller_discount === "object" ? item.seller_discount : null);

  const validity =
    rawDiscountDoc?.seller_discount_validity ?? item?.seller_discount_validity ?? null;

  if (validity) {
    const expiryTime = new Date(validity).getTime();
    if (!Number.isNaN(expiryTime) && expiryTime < Date.now()) {
      return null;
    }
  }

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
    formattedValidity: formatValidityTimestamp(validity),
  };
}

export default function SkuItemList({ items = [], seller_id }: SkuItemListProps) {
  if (!items || items.length === 0) return null;

  const filteredItems = seller_id
    ? items.filter((item) => getItemSellerId(item) === String(seller_id))
    : items;
  if (filteredItems.length === 0) return null;

  return (
    <div className="flex-1 overflow-y-auto w-full space-y-3">
      <ul className="space-y-3 p-0 m-0 list-none">
        {filteredItems.map((item) => {
          const product = item.product_id as any;
          const qty = Math.max(1, Number(item.quantity || 1));
          const baseUnit = getBaseUnitPrice(item);
          const baseLineTotal = Number((qty * baseUnit).toFixed(2));
          const sellerDisc = getActiveSellerDiscount(item, baseUnit, qty);

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
            <li key={item._id?.toString()}>
              <Card className="w-full p-3 shadow-none border border-border bg-card flex flex-col space-y-3 relative mb-2">
                <div className="flex items-start gap-3">
                  <ImageWithFallback img={product?.medias?.[0]} width={80} height={80} />
                  <div className="flex-grow min-w-0 space-y-1">
                    <p className="text-sm font-semibold leading-snug">{product?.name}</p>

                    {hasSellerDiscount && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                        <span className="inline-flex items-center rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                          {badgeText}
                        </span>
                        {sellerDisc?.formattedValidity && (
                          <span className="text-[11px] text-amber-700 dark:text-amber-400 bg-amber-500/10 border border-amber-500/25 rounded-full px-2 py-0.5">
                            Valid till {sellerDisc.formattedValidity}
                          </span>
                        )}
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
                    ) : item.sale && item.sale < item.price ? (
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-gray-500 line-through">₹{item.price}</p>
                        <p className="text-sm font-bold text-red-600">₹{item.sale}</p>
                      </div>
                    ) : (
                      <p className="text-sm font-bold">₹{item.price}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between bg-muted/40 p-2 rounded-md">
                  <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>

                  {hasSellerDiscount ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground line-through">
                        ₹{baseLineTotal}
                      </span>
                      <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
                        ₹{finalLineTotal}
                      </span>
                    </div>
                  ) : item.sale && item.sale < item.price ? (
                    <div className="flex items-center gap-2">
                      <p className="text-xs text-gray-500 line-through">
                        ₹{item.quantity * item.price}
                      </p>
                      <p className="text-sm font-bold text-red-600">
                        ₹{item.quantity * item.sale}
                      </p>
                    </div>
                  ) : (
                    <p className="text-sm font-bold">₹{item.quantity * item.price}</p>
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