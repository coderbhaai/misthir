"use client";

import { useEffect, useState } from "react";
import { apiRequest, clo } from "@amitkk/basic/utils/my-utils/admin-utils";
import { CartProps, CartSkuProps } from '@amitkk/ecom/types';
import PaymentStatic from "@amitkk/ecom/static/PaymentStatic";
import { semiAddress } from "@amitkk/address/utils/addressUtils";
import CartCharges from "@amitkk/ecom/static/CartCharges";
import SellerDiscountModal from "@amitkk/ecom/seller/admin/SellerDiscountModal";
import { Button } from "@amitkk/components/button/button";
import { Textarea } from "@amitkk/components/basic/textarea";
import { Separator } from "@amitkk/components/ui/separator";
import ContactInfoSection from "@amitkk/ecom/static/ContactInfoSection";
import { AddressProps } from "@amitkk/address/types";
import SkuItemList from "@amitkk/ecom/static/SkuItemList";
import CouponForm from "@amitkk/coupon/static/CouponForm";
import { SkuProps } from "@amitkk/ecom/types/product";

interface DataFormProps {
    dataId?: string;
} 

export const SellerSingleAbandonedCart: React.FC<DataFormProps> = ({ dataId = "" }) => {
  const [cart, setCart] = useState<CartProps | null>(null);
  const [cartItemCount, setCartItemCount] = useState(0);
  const [openDiscountModal, setOpenDiscountModal] = useState(false);
  
  const fetchSingleEntry = async () => {
    if (!dataId) return;

    try {
      const res = await apiRequest("GET", `ecom/ecom?function=get_single_abdandoned_cart&id=${dataId}`);
      if (res?.data) {
        const cartData = res.data as CartProps;
        setCart(cartData);

        const itemCount = (cartData.cartSkus || []).reduce(
          (sum, sku: any) => sum + (sku?.quantity || 0),
          0
        );
        setCartItemCount(itemCount);
      }
    } catch (error) { clo(error); }
  };

  useEffect(() => { fetchSingleEntry(); }, [dataId]);

  const [selectedSku, setSelectedSku] = useState<CartSkuProps | null>(null);

  if( !cart ){ return null; }
   return (
    <div className="row py-6">
      <div className="col-span-12 md:col-span-7 space-y-6">
        <div>
          <h3 className="font-semibold text-lg mb-4">Contact</h3>
          <ContactInfoSection email={cart?.cartConsent?.email} phone={cart?.cartConsent?.phone} emailConsent={cart?.cartConsent?.emailConsent} phoneConsent={cart?.cartConsent?.phoneConsent} editable={false}/>
        </div>

        { cart?.shipping_address_id && ( <p className="my-3"><strong>Shipping Address</strong> : {semiAddress(cart?.shipping_address_id as AddressProps)}</p>)}
        { cart?.billing_address_id && ( <p className="my-3"><strong>Billing Address</strong> : {semiAddress(cart?.billing_address_id as AddressProps)}</p>)}

        <div className="py-5 space-y-4">
          <PaymentStatic />
          <div className="col-span-12 space-y-4">
            <p><strong>Payment Method:</strong> {cart.paymode}</p>
            <Textarea label="Order Note" id="user-remarks" placeholder="Add a note" rows={3} value={cart?.user_remarks || ""} disabled/>
            <Button className="w-full bg-black text-white hover:bg-gray-800 py-6 my-3">Pay Now</Button>
          </div>
        </div>
      </div>

      <div className="hidden md:block md:col-span-1 flex justify-center">
        <Separator orientation="vertical" className="h-full" />
      </div>

      <div className="col-span-12 md:col-span-5">
        <div className="rounded-2xl p-4 sticky top-5 space-y-4">
          <SkuItemList items={cart?.cartSkus ?? []} />
          <CouponForm coupon_code={cart?.cartCoupon?.coupon_code} allowed={false}/>
          <CartCharges cart={cart}/>
          <Button className="w-full bg-black text-white hover:bg-black/90 py-5" onClick={() => setOpenDiscountModal(true)}>Give Additional Discount</Button>
        </div>
      </div>

      {selectedSku && (
        <SellerDiscountModal
          open={Boolean(selectedSku)}
          handleClose={() => setSelectedSku(null)}
          cartSku={selectedSku}
          limit={Number((selectedSku.sku_id as SkuProps)?.price ?? 0)}
          refreshCart={fetchSingleEntry}/>
      )}
    </div>
  );
}

export default SellerSingleAbandonedCart;