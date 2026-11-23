import AdminProductForm from "@amitkk/ecom/admin/product/add-update-product-form";
import { useRouter } from 'next/router';
import { useEffect } from 'react';

const EditAdminProduct = () => {
  const router = useRouter();
  const { id } = router.query;

  useEffect(() => {
  }, [router.query]);

  if (!router.isReady) return <div>Loading...</div>;
  if (!id) return <div>Error: No ID found</div>;

  return <AdminProductForm dataId={id as string} />;
};

export default EditAdminProduct;
