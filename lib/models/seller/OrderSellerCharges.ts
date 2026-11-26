import mongoose, { Schema, model, models, Types, Document } from "mongoose";

export interface OrderSellerChargesDoc extends Document<Types.ObjectId> {
  order_id: Types.ObjectId;
  seller_id: Types.ObjectId;
  subtotal: number;
  shipping_charges: number;
  cod_charges: number;
  allow_cod: boolean;
  free_shipping_above?: number | null;
  createdAt: Date;
  updatedAt: Date;
}

const OrderSellerChargesSchema = new Schema<OrderSellerChargesDoc>({
  order_id: { type: Schema.Types.ObjectId, required: true, ref: "Order", index: true },
  seller_id: { type: Schema.Types.ObjectId, required: true, ref: "User", index: true },
  subtotal: { type: Number, required: true, default: 0 },
  shipping_charges: { type: Number, required: true, default: 0 },
  cod_charges: { type: Number, required: true, default: 0 },
  allow_cod: { type: Boolean, required: true, default: false },
  free_shipping_above: { type: Number, default: null },
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

OrderSellerChargesSchema.index({ order_id: 1, seller_id: 1 }, { unique: true });

export default models.OrderSellerCharges || model<OrderSellerChargesDoc>("OrderSellerCharges", OrderSellerChargesSchema);