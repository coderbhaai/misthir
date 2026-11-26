"use client";

import React, { useEffect, useState } from "react";
import { apiRequest, clo, hitToastr } from "@amitkk/basic/utils/my-utils/admin-utils";
import { CartSkuProps } from "@amitkk/ecom/types";
import { Button } from "@amitkk/components/button/button";
import { TextField } from "@amitkk/components/basic/TextField";
import CustomModal from "@amitkk/basic/static/CustomModal";

interface SellerDiscountModalProps {
  open: boolean;
  handleClose: () => void;
  cartId?: string;
  seller_id?: string;
  items?: CartSkuProps[];
  refreshCart?: () => void;
}

type DiscountUnit = "flat" | "percent";

interface SavedSkuDiscount {
  _id?: string;
  cart_id: string;
  cart_sku_id: string;
  sku_id: string;
  seller_id?: string;
  discount_type?: DiscountUnit;
  seller_discount: number;
  seller_discount_validity?: string | Date | null;
  seller_discount_validity_value?: number | null;
  seller_discount_unit?: "hours" | "days" | string | null;
}

function getId(val: unknown): string {
  if (!val) return "";
  if (typeof val === "object") {
    const anyVal = val as any;
    if (anyVal._id) return String(anyVal._id);
    if (typeof anyVal.toString === "function") return anyVal.toString();
  }
  return String(val);
}

function getSkuUnitPrice(item: CartSkuProps): number {
  const price = Number(item.price || 0);
  const sale = Number(item.sale || 0);
  return sale > 0 && sale < price ? sale : price;
}

function getSkuLineTotal(item: CartSkuProps): number {
  const qty = Number(item.quantity || 1);
  return getSkuUnitPrice(item) * qty;
}

export default function SellerDiscountModal({
  open,
  handleClose,
  cartId,
  seller_id,
  items = [],
  refreshCart,
}: SellerDiscountModalProps) {
  const filteredItems = seller_id
    ? items.filter((item) => {
        const product = item.product_id as any;
        return getId(product?.seller_id) === String(seller_id);
      })
    : items;

  const [discounts, setDiscounts] = useState<Record<string, number>>({});
  const [discountUnit, setDiscountUnit] = useState<DiscountUnit>("flat");
  const [validityHours, setValidityHours] = useState<number>(24);
  const [loadingDiscounts, setLoadingDiscounts] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;

    const initial: Record<string, number> = {};
    filteredItems.forEach((item, idx) => {
      const key = getId(item._id) || getId(item.sku_id) || String(idx);
      initial[key] = 0;
    });
    setDiscounts(initial);
    setDiscountUnit("flat");
    setValidityHours(24);

    if (!cartId) return;

    let active = true;
    const loadExistingDiscounts = async () => {
      setLoadingDiscounts(true);
      try {
        const res = await apiRequest("POST", "ecom/discount", {
          function: "get_seller_sku_discounts",
          cart_id: cartId,
          seller_id,
        });

        const records: SavedSkuDiscount[] = res?.data ?? [];
        if (!active || records.length === 0) return;

        const firstWithMeta =
          records.find((r) => r.seller_discount_validity_value || r.discount_type) || records[0];

        const nextUnit: DiscountUnit =
          firstWithMeta?.discount_type === "percent" ? "percent" : "flat";
        setDiscountUnit(nextUnit);

        if (firstWithMeta?.seller_discount_validity_value) {
          const val = Number(firstWithMeta.seller_discount_validity_value);
          const hoursVal = firstWithMeta.seller_discount_unit === "days" ? val * 24 : val;
          setValidityHours(Math.max(0, hoursVal));
        }

        const byCartSkuId = new Map<string, SavedSkuDiscount>();
        const bySkuId = new Map<string, SavedSkuDiscount>();
        records.forEach((rec) => {
          const cId = getId(rec.cart_sku_id);
          const sId = getId(rec.sku_id);
          if (cId) byCartSkuId.set(cId, rec);
          if (sId) bySkuId.set(sId, rec);
        });

        const nextDiscounts: Record<string, number> = {};
        filteredItems.forEach((item, idx) => {
          const cartSkuKey = getId(item._id);
          const skuKey = getId(item.sku_id);
          const key = cartSkuKey || skuKey || String(idx);
          const match = byCartSkuId.get(cartSkuKey) || bySkuId.get(skuKey);

          if (match) {
            const savedRate = Number(match.seller_discount || 0);
            const maxVal = nextUnit === "percent" ? 100 : getSkuUnitPrice(item);
            nextDiscounts[key] = Math.min(maxVal, Math.max(0, savedRate));
          } else {
            nextDiscounts[key] = 0;
          }
        });

        setDiscounts(nextDiscounts);
      } catch (error) {
        clo(error);
      } finally {
        if (active) setLoadingDiscounts(false);
      }
    };

    loadExistingDiscounts();
    return () => {
      active = false;
    };
  }, [open, cartId, seller_id]);

  if (!open) return null;

  const handleDiscountUnitChange = (nextUnit: DiscountUnit) => {
    setDiscountUnit(nextUnit);
    setDiscounts((prev) => {
      const updated: Record<string, number> = {};
      filteredItems.forEach((item, idx) => {
        const key = getId(item._id) || getId(item.sku_id) || String(idx);
        const current = Number(prev[key] || 0);
        const maxVal = nextUnit === "percent" ? 100 : getSkuUnitPrice(item);
        updated[key] = Math.min(maxVal, Math.max(0, current));
      });
      return updated;
    });
  };

  const handleSkuDiscountChange = (key: string, rawVal: string, maxAmount: number) => {
    const parsed = Number(rawVal);
    if (Number.isNaN(parsed) || parsed < 0) {
      setDiscounts((prev) => ({ ...prev, [key]: 0 }));
      return;
    }
    const clamped =
      discountUnit === "percent" ? Math.min(parsed, 100) : Math.min(parsed, maxAmount);
    setDiscounts((prev) => ({ ...prev, [key]: clamped }));
  };

  // Per-SKU rate * qty for flat, or % of lineTotal for percent
  const totalDiscountAmount = filteredItems.reduce((sum, item, idx) => {
    const key = getId(item._id) || getId(item.sku_id) || String(idx);
    const rate = Number(discounts[key] || 0);
    const qty = Number(item.quantity || 1);
    const unitPrice = getSkuUnitPrice(item);
    const lineTotal = unitPrice * qty;

    const skuDiscount =
      discountUnit === "percent"
        ? (lineTotal * rate) / 100
        : Math.min(rate, unitPrice) * qty;

    return sum + skuDiscount;
  }, 0);

  const handleApplyDiscounts = async () => {
    setSubmitting(true);
    try {
      const payloadItems = filteredItems.map((item, idx) => {
        const key = getId(item._id) || getId(item.sku_id) || String(idx);
        const rateValue = Number(discounts[key] || 0);

        return {
          cart_sku_id: item._id,
          sku_id: getId(item.sku_id),
          product_id: getId(item.product_id),
          seller_id: seller_id || getId((item.product_id as any)?.seller_id),
          discount_type: discountUnit,
          seller_discount: rateValue,
        };
      });

      const res = await apiRequest("POST", "ecom/discount", {
        function: "apply_seller_discount",
        cart_id: cartId,
        seller_id,
        discount_type: discountUnit,
        seller_discount_validity_unit: "hours",
        seller_discount_validity_value: Number(validityHours || 0),
        items: JSON.stringify(payloadItems),
      });

      hitToastr("success", res?.message);

      if (res?.data || res?.status) {
        refreshCart?.();
        handleClose();
      }
    } catch (error) {
      clo(error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <CustomModal open={open} handleClose={handleClose} title="SKU Discounts">
      <div className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-xl bg-muted/40">
          <div>
            <label className="block text-xs font-medium mb-1">Discount Type</label>
            <select
              value={discountUnit}
              onChange={(e) => handleDiscountUnitChange(e.target.value as DiscountUnit)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="flat">Flat (₹ / unit)</option>
              <option value="percent">Percent (%)</option>
            </select>
          </div>

          <div className="sm:col-span-2">
            <TextField
              type="number"
              label="Validity (Hours, Same for All)"
              value={String(validityHours)}
              onChange={(e) => setValidityHours(Math.max(0, Number(e.target.value || 0)))}
            />
          </div>
        </div>

        {loadingDiscounts ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Loading SKU discounts...</p>
        ) : (
          <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
            {filteredItems.map((item, idx) => {
              const key = getId(item._id) || getId(item.sku_id) || String(idx);
              const product = item.product_id as any;
              const unitPrice = getSkuUnitPrice(item);
              const lineTotal = getSkuLineTotal(item);

              return (
                <div
                  key={key}
                  className="flex items-center justify-between gap-4 p-3 rounded-xl border border-border"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">
                      {product?.name || `Item ${idx + 1}`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Unit: ₹{unitPrice} · Qty: {item.quantity} · Line Total: ₹{lineTotal}
                    </p>
                  </div>

                  <div className="w-36">
                    <TextField
                      type="number"
                      label={discountUnit === "percent" ? "Discount (%)" : "Discount (₹/unit)"}
                      value={String(discounts[key] ?? 0)}
                      onChange={(e) => handleSkuDiscountChange(key, e.target.value, unitPrice)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex items-center justify-between pt-3 border-t border-border">
          <span className="text-sm font-semibold">
            Total Discount: ₹{totalDiscountAmount.toFixed(2)}
          </span>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={handleClose} disabled={submitting}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleApplyDiscounts}
              disabled={submitting || loadingDiscounts}
            >
              {submitting ? "Saving..." : "Apply Discounts"}
            </Button>
          </div>
        </div>
      </div>
    </CustomModal>
  );
}