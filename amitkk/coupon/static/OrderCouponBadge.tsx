import React from "react";
import { Tag, CheckCircle2 } from "lucide-react";

interface OrderCouponData {
  coupon_code?: string | null;
  name?: string | null;
  admin_coupon_discount?: number | null;
  vendor_coupon_discount?: number | null;
  seller_coupon_discount?: number | null;
  discount_type?: string | null;
  discount?: number | null;
}

interface OrderCouponBadgeProps {
  coupon?: OrderCouponData | null;
  seller_id?: string;
}

function toAmount(val: unknown): number {
  const num = Number(val ?? 0);
  return Number.isFinite(num) ? Number(num.toFixed(2)) : 0;
}

export default function OrderCouponBadge({
  coupon,
  seller_id,
}: OrderCouponBadgeProps) {
  if (!coupon?.coupon_code) return null;

  const adminDiscount = toAmount(coupon.admin_coupon_discount);
  const sellerDiscount = toAmount(
    coupon.vendor_coupon_discount ?? coupon.seller_coupon_discount
  );

  const totalDiscount = seller_id
    ? sellerDiscount
    : toAmount(adminDiscount + sellerDiscount);

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
          <Tag className="h-4 w-4" />
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300 truncate">
              {coupon.coupon_code}
            </span>
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80 truncate">
            {coupon.name ? `${coupon.name} · Coupon applied` : "Coupon applied"}
          </p>
        </div>
      </div>

      {totalDiscount > 0 && (
        <div className="text-right shrink-0">
          <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">-₹{totalDiscount}</span>
          <p className="text-[10px] text-emerald-700/75 dark:text-emerald-400/75">Saved</p>
        </div>
      )}
    </div>
  );
}