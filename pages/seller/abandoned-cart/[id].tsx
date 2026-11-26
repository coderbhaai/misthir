import SellerSingleAbandonedCart from '@amitkk/ecom/seller/admin/seller-single-abandoned-cart'
import { useRouter } from 'next/router';

const EditSellerSingleAbandonedCart = () => {
  const router = useRouter();
  const { id } = router.query;

  if (!router.isReady) return <div>Loading...</div>;
  if (!id) return <div>Error: No ID found</div>;

  return <SellerSingleAbandonedCart dataId={id as string}/>;
};

export default EditSellerSingleAbandonedCart;