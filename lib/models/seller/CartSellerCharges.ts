import mongoose, { Schema, model, models, Types, Document } from "mongoose";

export interface CartSellerChargesDoc extends Document<Types.ObjectId> {
  cart_id: Types.ObjectId;
  seller_id: Types.ObjectId;
  subtotal: number;
  shipping_charges: number;
  cod_charges: number;
  allow_cod: boolean;
  free_shipping_above?: number | null;
  createdAt: Date;
  updatedAt: Date;
}

const cartSellerChargesSchema = new Schema<CartSellerChargesDoc>({
    cart_id: { type: Schema.Types.ObjectId, required: true, ref: "Cart", index: true },
    seller_id: { type: Schema.Types.ObjectId, required: true, ref: "User", index: true },
    subtotal: { type: Number, required: true, default: 0 },
    shipping_charges: { type: Number, required: true, default: 0 },
    cod_charges: { type: Number, required: true, default: 0 },
    allow_cod: { type: Boolean, required: true, default: false },
    free_shipping_above: { type: Number, default: null },
  }, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

cartSellerChargesSchema.index({ cart_id: 1, seller_id: 1 }, { unique: true });
export default models.CartSellerCharges || model<CartSellerChargesDoc>("CartSellerCharges", cartSellerChargesSchema);