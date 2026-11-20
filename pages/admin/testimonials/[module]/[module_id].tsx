import dynamic from "next/dynamic";
import { useRouter } from "next/router";

const Testimonials = dynamic(() => import("@amitkk/basic/testimonials"), { ssr: false });

export default function AddUpdateFaq() {
  const router = useRouter();
  const { module, module_id } = router.query;

  return (
    <Testimonials module={module as string} module_id={module_id as string}/>
  );
}