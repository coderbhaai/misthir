import SellerCouponForm from '@amitkk/coupon/admin/add-update-coupon-form';
import { useSellerId } from 'hooks/useSellerId';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

const EditSellerCouponId = () => {
  const router = useRouter();
  const { id } = router.query;
  const seller_id = useSellerId();

  useEffect(() => {
  }, [router.query]);

  if (!router.isReady) return <div>Loading...</div>;

  if (!id) return <div>Error: No ID found</div>;

  return <SellerCouponForm dataId={id as string} seller_id ={seller_id as string} coupon_by="Seller"/>;
};

export default EditSellerCouponId;
