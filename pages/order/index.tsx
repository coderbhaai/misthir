import UserSingleOrder from "@amitkk/ecom/user/admin/user-single-order";
import { useEffect, useState } from "react";

export default function OrderPage() {
  const [orderId, setOrderId] = useState<string | null>(null);
  const [checkedStorage, setCheckedStorage] = useState<boolean>(false);

  useEffect(() => {
    try {
      const storedOrderId = window.localStorage.getItem("order_id");
      setOrderId(storedOrderId);
    } catch {
      setOrderId(null);
    } finally {
      setCheckedStorage(true);
    }
  }, []);

  if (!checkedStorage) return <p>Loading order...</p>;
  if (!orderId) return <p>No order found</p>;

  return <UserSingleOrder order_id={orderId} />;
}