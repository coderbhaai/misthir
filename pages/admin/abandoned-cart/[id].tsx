import SingleAbandoneCart from '@amitkk/ecom/admin/single-abandoned-cart';
import { useRouter } from 'next/router';

const EditSingleAbandoneCart = () => {
  const router = useRouter();
  const { id } = router.query;

  if (!router.isReady) return <div>Loading...</div>;
  if (!id) return <div>Error: No ID found</div>;

  return <SingleAbandoneCart dataId={id as string}/>;
};

export default EditSingleAbandoneCart;