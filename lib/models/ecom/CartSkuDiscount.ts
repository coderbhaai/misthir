import mongoose, { Schema, Types, Document } from "mongoose";

export interface CartSkuDiscountDoc extends Document<Types.ObjectId> {
  cart_id: string | Types.ObjectId;
  cart_sku_id: string | Types.ObjectId;
  sku_id: string | Types.ObjectId;
  seller_id?: string | Types.ObjectId;
  discount_type?: "flat" | "percent";
  seller_discount: number;
  seller_discount_validity?: Date | null;
  seller_discount_validity_value?: number;
  seller_discount_unit?: "hours" | "days";
  createdAt: Date;
  updatedAt: Date;
}

const cartSkuDiscountSchema = new Schema<CartSkuDiscountDoc>({
    cart_id: { type: Schema.Types.ObjectId, ref: "Cart", required: true, index: true },
    cart_sku_id: { type: Schema.Types.ObjectId, ref: "CartSku", required: true, unique: true },
    sku_id: { type: Schema.Types.ObjectId, ref: "Sku", required: true },
    seller_id: { type: Schema.Types.ObjectId, ref: "User", required: false },
    discount_type: { type: String, enum: ["flat", "percent"], default: "flat" },
    seller_discount: { type: Number, required: true, default: 0 },
    seller_discount_validity: { type: Date, default: null },
    seller_discount_validity_value: { type: Number, default: null },
    seller_discount_unit: { type: String, enum: ["hours", "days"], default: "hours" },
  }, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

export default mongoose.models.CartSkuDiscount || mongoose.model<CartSkuDiscountDoc>("CartSkuDiscount", cartSkuDiscountSchema);