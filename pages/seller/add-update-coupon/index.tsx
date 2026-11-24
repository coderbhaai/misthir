// pages/seller/add-update-coupon/[id].tsx

import { hitToastr } from '@amitkk/basic/utils/my-utils/admin-utils';
import { getSellerId } from '@amitkk/basic/utils/my-utils/ecom-utils';
import SellerCouponForm from '@amitkk/coupon/admin/add-update-coupon-form';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

const AddSellerCouponId = () => {
  const router = useRouter();
  const { id } = router.query;
  const [sellerId, setSellerId] = useState<string>('');
  const [isLoadingSeller, setIsLoadingSeller] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadSellerId = async () => {
      const sellerRes = await getSellerId();
      if (!isMounted) return;
      if (sellerRes.error) { hitToastr('error', sellerRes.error.message); }

      setSellerId(sellerRes.seller_id ?? '');
      setIsLoadingSeller(false);
    };

    loadSellerId();

    return () => {
      isMounted = false;
    };
  }, []);

  if (!router.isReady || isLoadingSeller) return <div>Loading...</div>;
  if (!id) return <div>Error: No ID found</div>;

  return (
    <SellerCouponForm dataId={id as string} seller_id={sellerId} coupon_by="Seller"/>
  );
};

export default AddSellerCouponId;