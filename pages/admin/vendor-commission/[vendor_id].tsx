import AdminSellerCommission from "@amitkk/ecom/seller-commission";
import { useRouter } from "next/router";

export default function AddUpdateSellerCommission() {
  const router = useRouter();
  if (!router.isReady) return null;
  const { seller_id } = router.query;

  return <AdminSellerCommission seller_id={seller_id as string} />;
}
