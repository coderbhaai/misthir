"use client";

import { useEffect, useState } from "react";
import { apiRequest, clo, hitToastr } from "@amitkk/basic/utils/my-utils/admin-utils";
import { CartProps } from "@amitkk/ecom/types";
import PaymentStatic from "@amitkk/ecom/static/PaymentStatic";
import { semiAddress } from "@amitkk/address/utils/addressUtils";
import CartCharges from "@amitkk/ecom/static/CartCharges";
import SellerDiscountModal from "@amitkk/ecom/seller/admin/SellerDiscountModal";
import { Button } from "@amitkk/components/button/button";
import { Textarea } from "@amitkk/components/basic/textarea";
import ContactInfoSection from "@amitkk/ecom/static/ContactInfoSection";
import { AddressProps } from "@amitkk/address/types";
import SkuItemList from "@amitkk/ecom/static/SkuItemList";
import CouponForm from "@amitkk/coupon/static/CouponForm";
import { getSellerId } from "@amitkk/basic/utils/my-utils/ecom-utils";

interface DataFormProps {
  dataId?: string;
}

export const SellerSingleAbandonedCart: React.FC<DataFormProps> = ({ dataId = "" }) => {
  const [cart, setCart] = useState<CartProps | null>(null);
  const [openDiscountModal, setOpenDiscountModal] = useState(false);
  const [seller_id, setSellerId] = useState("");
  const [sellerLoading, setSellerLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const loadSellerId = async () => {
      try {
        const sellerRes = await getSellerId();
        if (!isMounted) return;
        if (sellerRes.error) {
          hitToastr("error", sellerRes.error.message);
        }
        setSellerId(sellerRes.seller_id ?? "");
      } finally {
        if (isMounted) setSellerLoading(false);
      }
    };

    loadSellerId();
    return () => {
      isMounted = false;
    };
  }, []);

  const fetchSingleEntry = async () => {
    if (!dataId) return;

    try {
      const res = await apiRequest("POST", `ecom/abandonedCart`, {
        function: "get_single_abdandoned_cart",
        id: dataId,
      });

      if (res?.data) {
        setCart(res.data as CartProps);
      }
    } catch (error) {
      clo(error);
    }
  };

  useEffect(() => {
    fetchSingleEntry();
  }, [dataId]);

  if (!cart || sellerLoading || !seller_id) {
    return null;
  }

  return (
    <div className="row py-6">
      <div className="col-span-12 md:col-span-7 space-y-6">
        <h1 className="text-xl md:text-2xl font-bold mb-5">Cart</h1>
        <ContactInfoSection
          email={cart?.cartConsent?.email}
          phone={cart?.cartConsent?.phone}
          emailConsent={cart?.cartConsent?.emailConsent}
          phoneConsent={cart?.cartConsent?.phoneConsent}
          editable={false}
          maskContact
        />

        {cart?.shipping_address_id && (
          <p className="my-3">
            <strong>Shipping Address</strong> :{" "}
            {semiAddress(cart?.shipping_address_id as AddressProps)}
          </p>
        )}
        {cart?.billing_address_id && (
          <p className="my-3">
            <strong>Billing Address</strong> :{" "}
            {semiAddress(cart?.billing_address_id as AddressProps)}
          </p>
        )}

        <div className="py-5 space-y-4">
          <PaymentStatic />
          <div className="col-span-12 space-y-4">
            <p>
              <strong>Payment Method:</strong> {cart.paymode}
            </p>
            <Textarea
              label="Order Note"
              id="user-remarks"
              placeholder="Add a note"
              rows={3}
              value={cart?.user_remarks || ""}
              disabled
            />
            <Button className="w-full bg-black text-white hover:bg-gray-800 py-6 my-3">
              Pay Now
            </Button>
          </div>
        </div>
      </div>

      <div className="col-span-12 md:col-span-5">
        <div className="rounded-2xl p-4 sticky top-5 space-y-4">
          <SkuItemList items={cart?.cartSkus ?? []} seller_id={seller_id} />
          <CouponForm coupon_code={cart?.cartCoupon?.coupon_code} allowed={false} />
          <CartCharges cart={cart} seller_id={seller_id} isSellerView />
          <Button
            className="w-full bg-black text-white hover:bg-black/90 py-5"
            onClick={() => setOpenDiscountModal(true)}
          >
            Give Additional Discount
          </Button>
        </div>
      </div>

      {openDiscountModal && (
        <SellerDiscountModal
          open={openDiscountModal}
          handleClose={() => setOpenDiscountModal(false)}
          cartId={String(cart._id)}
          seller_id={seller_id}
          items={cart?.cartSkus ?? []}
          refreshCart={fetchSingleEntry}
        />
      )}
    </div>
  );
};

export default SellerSingleAbandonedCart;