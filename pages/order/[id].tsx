import { useRouter } from "next/router";
import { useEffect } from "react";

export default function OrderRedirectPage() {
  const router = useRouter();
  const { id } = router.query;

  useEffect(() => {
    if (!router.isReady || !id) return;

    const orderId = Array.isArray(id) ? id[0] : id;
    if (!orderId) return;

    try {
      window.localStorage.setItem("order_id", orderId);
    } catch {
      // Ignore storage access errors (e.g., private browsing / restricted context)
    }

    router.replace("/order");
  }, [router.isReady, id, router]);

  const displayId = Array.isArray(id) ? id[0] : id;

  if (!displayId) return <p>Loading order...</p>;
  return <p>Loading order {displayId}...</p>;
}