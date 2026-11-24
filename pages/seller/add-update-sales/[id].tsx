// pages/seller/add-update-sales/[id].tsx

import { hitToastr } from "@amitkk/basic/utils/my-utils/admin-utils";
import { getSellerId } from "@amitkk/basic/utils/my-utils/ecom-utils";
import SellerSalesForm from "@amitkk/sales/admin/add-update-sales";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

const EditSellerSales = () => {
  const router = useRouter();
  const { id } = router.query;
  const resolvedId = typeof id === "string" ? id : "";

  const [sellerId, setSellerId] = useState<string>("");
  const [isLoadingSeller, setIsLoadingSeller] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadSellerId = async () => {
      const sellerRes = await getSellerId();
      if (!isMounted) return;

      if (sellerRes.error) {
        hitToastr("error", sellerRes.error.message);
      }

      setSellerId(sellerRes.seller_id ?? "");
      setIsLoadingSeller(false);
    };

    loadSellerId();

    return () => {
      isMounted = false;
    };
  }, []);

  if (!router.isReady || isLoadingSeller) return <div>Loading...</div>;
  if (!resolvedId) return <div>Error: No ID found</div>;

  return (
    <SellerSalesForm dataId={resolvedId} seller_id={sellerId} sale_by="Seller" />
  );
};

export default EditSellerSales;