import React, { useEffect, useState } from "react";
import { TextField } from "@amitkk/components/basic/TextField";
import { Button } from "@amitkk/components/button/button";
import CustomModal from "@amitkk/basic/static/CustomModal";
import { apiRequest, clo, hitToastr } from "@amitkk/basic/utils/my-utils/admin-utils";
import OpenSelect from "@amitkk/components/basic/OpenSelect";

type Props = {
  open: boolean;
  handleClose: () => void;
  cartSku: any;
  limit: number;
  refreshCart: () => void; 
};

type FormData = {
  seller_discount: number | "";
  seller_discount_validity_value: number | "";
  seller_discount_unit: "hours" | "days" | "";
};

export default function SellerDiscountModal({ open, handleClose, cartSku, limit, refreshCart }: Props) {
  const [formData, setFormData] = useState<FormData>({
    seller_discount: "",
    seller_discount_validity_value: "",
    seller_discount_unit: "hours",
  });

  useEffect(() => {
    if (open && cartSku) {
      setFormData({
        seller_discount: cartSku.seller_discount ?? "",
        seller_discount_validity_value: cartSku.seller_discount_validity_value ?? "",
        seller_discount_unit: cartSku.seller_discount_unit ?? "hours",
      });
    }
  }, [open, cartSku]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === "seller_discount") {
      const num = Number(value);
      if (num > limit) { hitToastr("error", `Discount cannot exceed ₹${limit}`); return; }
    }
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleUnitChange = (val: "hours" | "days") => {
  setFormData((prev) => ({ ...prev, seller_discount_unit: val }));
};

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (Number(formData.seller_discount) > limit) { hitToastr("error", `Discount cannot exceed ₹${limit}`); return; }
    if (Number(formData.seller_discount) < 1) { hitToastr("error", `Discount cannot be below ₹1`); return; }
    if (Number(formData.seller_discount_validity_value) < 1) { hitToastr("error", `Discount Time cannot be below ₹1`); return; }

    try {
      const payload = {
        function: "apply_seller_discount",
        data: {
          cartSku_id: cartSku._id,
          seller_discount: Number(formData.seller_discount) || 0,
          seller_discount_validity_value: Number(formData.seller_discount_validity_value),
          seller_discount_unit: formData.seller_discount_unit,
        }
      };

      const res = await apiRequest("POST", "ecom/ecom", payload);
      if (res?.status) {
        refreshCart();
        handleClose();
      }
    } catch (error) { clo(error); }
  };

  return (
    <CustomModal open={open} handleClose={handleClose} title="Give Discount">
      <form onSubmit={handleSubmit} className="space-y-4">
          <TextField label={`Discount (Limit - ${limit})`} type="number" value={formData.seller_discount} name="seller_discount" onChange={handleChange} required/>
          <div className="flex gap-2">
            <TextField label="Validity" type="number" value={formData.seller_discount_validity_value} name="seller_discount_validity_value" onChange={handleChange} required/>
            <OpenSelect name="seller_discount_unit" label="Unit" value={formData.seller_discount_unit} onChange={handleUnitChange} options={[ { label: "Hours", value: "hours" }, { label: "Days", value: "days" } ]}/>
          </div>
          <Button type="submit" color="primary">Save Discount</Button>
      </form>
    </CustomModal>
  );
}