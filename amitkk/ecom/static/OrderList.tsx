import { OrderProps } from "../types";
import OrderSkuItemList from "./OrderSkuItemList";
import OrderCharges from "./OrderCharges";
import OrderCouponBadge from "@amitkk/coupon/static/OrderCouponBadge";

interface OrderListProps {
  order: OrderProps;
}

export default function OrderList({ order }: OrderListProps) {
  const orderSkus = order?.orderSkus ?? [];

  return (
    <div className="col-span-12 md:col-span-4">
      <div className="rounded-2xl p-4 sticky top-5 space-y-4">
        <OrderSkuItemList items={orderSkus} />
        <OrderCouponBadge coupon={order?.orderCoupon} />
        <OrderCharges order={order} />
      </div>
    </div>
  );
}