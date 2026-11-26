import mongoose, { Schema, model, models, Types, Document } from "mongoose";

export interface CartChargesDoc extends Document<Types.ObjectId> {
  cart_id: string | Types.ObjectId;
  shipping_charges?: number;
  shipping_chargeable_value?: number;
  sales_discount?: number;
  admin_discount_type?: "flat" | "percent";
  admin_discount?: number; // stores rate (₹ flat or % percent)
  total_admin_discount?: number; // stores computed ₹ discount
  admin_discount_validity?: Date | null;
  admin_discount_unit?: string | null;
  admin_discount_validity_value?: number | null;
  total_seller_discount?: number;
  seller_discount?: number;
  cod_charges?: number;
}

const cartChargesSchema = new Schema<CartChargesDoc>({
    cart_id: { type: Schema.Types.ObjectId, required: true, ref: "Cart" },
    shipping_charges: { type: Number },
    shipping_chargeable_value: { type: Number },
    sales_discount: { type: Number },
    admin_discount_type: { type: String, enum: ["flat", "percent"], default: "flat" },
    admin_discount: { type: Number },
    total_admin_discount: { type: Number, default: 0 },
    admin_discount_validity: { type: Date, default: null },
    admin_discount_unit: { type: String, default: null },
    admin_discount_validity_value: { type: Number, default: null },
    total_seller_discount: { type: Number },
    cod_charges: { type: Number },
    seller_discount: { type: Number, required: false },
  }, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

export default mongoose.models.CartCharges || mongoose.model<CartChargesDoc>("CartCharges", cartChargesSchema);