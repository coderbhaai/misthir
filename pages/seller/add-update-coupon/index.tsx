import SellerCouponForm from '@amitkk/coupon/admin/add-update-coupon-form';
import { useSellerId } from 'hooks/useSellerId';

const AddSellerCoupon = () => {
  const seller_id = useSellerId();
  
  return <SellerCouponForm dataId='' seller_id ={seller_id as string} coupon_by="Seller"/>;
};

export default AddSellerCoupon;