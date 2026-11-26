import React, { useEffect, useState } from "react";
import CustomModal from "@amitkk/basic/static/CustomModal";
import { apiRequest, clo, hitToastr } from "@amitkk/basic/utils/my-utils/admin-utils";
import { TextField } from "@amitkk/components/basic/TextField";
import { Button } from "@amitkk/components/button/button";

type DiscountUnit = "flat" | "percent";

type AdminAdditionalDiscountModalProps = {
  open: boolean;
  handleClose: () => void;
  cart_id: string;
  limit: number;
  refreshCart?: () => void;
  cartCharges?: {
    shipping_charges?: number | string;
    cod_charges?: number | string;
    sales_discount?: number | string;
    admin_discount_type?: DiscountUnit | string;
    admin_discount?: number | string;
    admin_discount_validity?: string | Date | null;
    admin_discount_validity_value?: number | string;
    admin_discount_unit?: string;
    seller_discount?: number | string;
  };
};

type FormData = {
  admin_discount_type: DiscountUnit;
  additional_discount: number | "";
  admin_discount_validity_value: number | "";
  admin_discount_unit: "hours" | "days";
};

export default function AdminAdditionalDiscountModal({
  open,
  handleClose,
  cart_id,
  limit,
  refreshCart,
  cartCharges,
}: AdminAdditionalDiscountModalProps) {
  const [formData, setFormData] = useState<FormData>({
    admin_discount_type: "flat",
    additional_discount: "",
    admin_discount_validity_value: 24,
    admin_discount_unit: "hours",
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;

    const savedType: DiscountUnit =
      cartCharges?.admin_discount_type === "percent" ? "percent" : "flat";
    const savedRate = Number(cartCharges?.admin_discount ?? 0);
    const savedValidity = Number(cartCharges?.admin_discount_validity_value ?? 24);
    const savedUnit =
      cartCharges?.admin_discount_unit === "days" ? "days" : "hours";

    setFormData({
      admin_discount_type: savedType,
      additional_discount: savedRate > 0 ? savedRate : "",
      admin_discount_validity_value: savedValidity > 0 ? savedValidity : 24,
      admin_discount_unit: savedUnit,
    });
  }, [open, cartCharges]);

  const handleTypeChange = (nextType: DiscountUnit) => {
    setFormData((prev) => {
      const current = Number(prev.additional_discount || 0);
      const maxAllowed = nextType === "percent" ? 100 : limit;
      return {
        ...prev,
        admin_discount_type: nextType,
        additional_discount: current > 0 ? Math.min(current, maxAllowed) : "",
      };
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === "additional_discount") {
      if (value === "") {
        setFormData((prev) => ({ ...prev, additional_discount: "" }));
        return;
      }
      const num = Number(value);
      if (Number.isNaN(num) || num < 0) return;
      const maxAllowed = formData.admin_discount_type === "percent" ? 100 : limit;
      if (num > maxAllowed) return;
    }
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const rateVal = Number(formData.additional_discount || 0);
  const computedRupeeDiscount =
    formData.admin_discount_type === "percent"
      ? Math.min(limit, Number(((limit * rateVal) / 100).toFixed(2)))
      : Math.min(limit, rateVal);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.admin_discount_type === "percent") {
      if (rateVal <= 0 || rateVal > 100) {
        hitToastr("error", "Percentage must be between 1 and 100");
        return;
      }
    } else {
      if (rateVal > limit) {
        hitToastr("error", `Discount cannot exceed ₹${limit}`);
        return;
      }
      if (rateVal < 1) {
        hitToastr("error", "Discount cannot be below ₹1");
        return;
      }
    }

    if (Number(formData.admin_discount_validity_value) < 1) {
      hitToastr("error", "Validity cannot be below 1");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        function: "apply_admin_discount",
        data: {
          cart_id,
          admin_discount_type: formData.admin_discount_type,
          additional_discount: rateVal,
          admin_discount_validity_value: Number(formData.admin_discount_validity_value),
          admin_discount_unit: formData.admin_discount_unit,
        },
      };

      const res = await apiRequest("POST", "ecom/discount", payload);
      if (res?.status) {
        hitToastr("success", res?.message || "Discount applied");
        refreshCart?.();
        handleClose();
      }
    } catch (error) {
      clo(error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <CustomModal open={open} handleClose={handleClose} title="Give Additional Discount">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1">Discount Type</label>
            <select
              value={formData.admin_discount_type}
              onChange={(e) => handleTypeChange(e.target.value as DiscountUnit)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="flat">Flat (₹)</option>
              <option value="percent">Percent (%)</option>
            </select>
          </div>

          <TextField
            label={
              formData.admin_discount_type === "percent"
                ? "Discount (%)"
                : `Discount (Max ₹${limit})`
            }
            type="number"
            value={formData.additional_discount}
            name="additional_discount"
            onChange={handleChange}
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <TextField
            label="Validity"
            type="number"
            value={formData.admin_discount_validity_value}
            name="admin_discount_validity_value"
            onChange={handleChange}
            required
          />

          <div>
            <label className="block text-xs font-medium mb-1">Validity Unit</label>
            <select
              value={formData.admin_discount_unit}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  admin_discount_unit: e.target.value as "hours" | "days",
                }))
              }
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="hours">Hours</option>
              <option value="days">Days</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-border">
          <span className="text-sm font-semibold">
            Effective Discount: ₹{computedRupeeDiscount.toFixed(2)}
          </span>
          <Button type="submit" color="primary" disabled={submitting}>
            {submitting ? "Saving..." : "Save Discount"}
          </Button>
        </div>
      </form>
    </CustomModal>
  );
}