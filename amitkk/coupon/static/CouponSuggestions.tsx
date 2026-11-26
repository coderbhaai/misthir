"use client";

import React, { useState } from "react";
import { apiRequest, clo, hitToastr } from "@amitkk/basic/utils/my-utils/admin-utils";
import { Button } from "@amitkk/components/button/button";
import { useEcom } from "contexts/EcomContext";

export type CouponSuggestionItem = {
  _id?: string;
  cart_id: string;
  coupon_code: string;
  cart_sku_id?: string;
  sku_id?: string;
  product_name?: string;
  additional_qty_needed: number;
  estimated_savings: number;
  message: string;
};

type CouponSuggestionsProps = {
  suggestions?: CouponSuggestionItem[];
  allowed?: boolean;
  disabled?: boolean;
};

export default function CouponSuggestions({ suggestions = [], allowed = true, disabled = false }: CouponSuggestionsProps) {
  if (!suggestions || suggestions.length === 0) { return null; }

  const { fetchCart } = useEcom();
  const [addingKey, setAddingKey] = useState<string | null>(null);

  const handleAddUnits = async (suggestion: CouponSuggestionItem) => {
    const skuTargetId = suggestion.cart_sku_id || suggestion.sku_id;
    if (!skuTargetId) return;

    const actionKey = String(suggestion._id || skuTargetId);
    const qtyToAdd = Math.max(1, Number(suggestion.additional_qty_needed || 1));

    try {
      setAddingKey(actionKey);

      const res = await apiRequest("POST", "ecom/coupon", {
        function: "add_suggestion_units",
        data: {
          cart_id: suggestion.cart_id,
          cart_sku_id: suggestion.cart_sku_id,
          sku_id: suggestion.sku_id,
          quantity: qtyToAdd,
          coupon_code: suggestion.coupon_code,
        },
      });

      if (res?.status) {
        await fetchCart();
        hitToastr("success", res?.message || `Added ${qtyToAdd} unit(s)`);
        return;
      }
    } catch (error) { clo(error); } finally { setAddingKey(null); }
  };

  return (
    <div className="space-y-2 pt-1">
      <p className="text-xs font-semibold text-muted-foreground">Suggested Offers</p>

      {suggestions.map((suggestion, idx) => {
        const key = String(suggestion._id || `${suggestion.coupon_code}-${idx}`);
        const isAdding = addingKey === key;
        const canAdd = Boolean(suggestion.cart_sku_id || suggestion.sku_id) && allowed;

        return (
          <div key={key} className="flex items-center justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-2.5 text-xs">
            <div className="space-y-0.5 min-w-0">
              <p className="font-medium text-foreground leading-snug">{suggestion.message}</p>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-400 font-semibold">Code: {suggestion.coupon_code} · Save ₹ {Number(suggestion.estimated_savings || 0).toFixed(2)}</p>
            </div>

            {canAdd && (
              <Button type="button" size="sm" variant="outline" className="shrink-0 h-8 text-xs" disabled={disabled || isAdding} onClick={() => handleAddUnits(suggestion)}>{isAdding ? "Adding..." : `+${suggestion.additional_qty_needed} Unit`} </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}