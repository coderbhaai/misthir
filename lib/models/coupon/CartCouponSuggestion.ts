import mongoose, { Schema, Types, Document } from "mongoose";

export interface CartCouponSuggestionDoc extends Document<Types.ObjectId> {
  cart_id: Types.ObjectId | string;
  coupon_id?: Types.ObjectId | string | null;
  coupon_code: string;
  coupon_title?: string;
  seller_id?: Types.ObjectId | string | null;
  cart_sku_id?: Types.ObjectId | string | null;
  sku_id?: Types.ObjectId | string | null;
  product_id?: Types.ObjectId | string | null;
  product_name?: string;
  additional_qty_needed: number;
  estimated_savings: number;
  min_order_amount: number;
  current_eligible_amount: number;
  message: string;
  createdAt: Date;
  updatedAt: Date;
}

const cartCouponSuggestionSchema = new Schema<CartCouponSuggestionDoc>(
  {
    cart_id: {
      type: Schema.Types.ObjectId,
      ref: "Cart",
      required: true,
      index: true,
    },
    coupon_id: {
      type: Schema.Types.ObjectId,
      ref: "Coupon",
      default: null,
    },
    coupon_code: { type: String, required: true },
    coupon_title: { type: String, default: "" },
    seller_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    cart_sku_id: {
      type: Schema.Types.ObjectId,
      ref: "CartSku",
      default: null,
    },
    sku_id: {
      type: Schema.Types.ObjectId,
      ref: "Sku",
      default: null,
    },
    product_id: {
      type: Schema.Types.ObjectId,
      ref: "Product",
      default: null,
    },
    product_name: { type: String, default: "" },
    additional_qty_needed: { type: Number, required: true, min: 1 },
    estimated_savings: { type: Number, required: true, min: 0 },
    min_order_amount: { type: Number, required: true, min: 0 },
    current_eligible_amount: { type: Number, required: true, min: 0 },
    message: { type: String, required: true },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

export default mongoose.models.CartCouponSuggestion ||
  mongoose.model<CartCouponSuggestionDoc>(
    "CartCouponSuggestion",
    cartCouponSuggestionSchema
  );