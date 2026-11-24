// pages/seller/add-update-sales/[index].tsx

import { hitToastr } from "@amitkk/basic/utils/my-utils/admin-utils";
import { getSellerId } from "@amitkk/basic/utils/my-utils/ecom-utils";
import SellerSalesForm from "@amitkk/sales/admin/add-update-sales";
import { useEffect, useState } from "react";

const AddSellerSales = () => {
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

  if (isLoadingSeller) return <div>Loading...</div>;

  return <SellerSalesForm seller_id={sellerId} sale_by="Seller" />;
};

export default AddSellerSales;