import mongoose, { Schema, model, models, Types, Document } from "mongoose";

export interface SellerPayoutRequestDoc extends Document<Types.ObjectId> {
  seller_id: Types.ObjectId;
  amount_requested: number;
  amount_paid: number;
  user_remarks: string;
  admin_remarks: string;
  status: string;
  payment_id: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const SellerPayoutRequestSchema = new Schema<SellerPayoutRequestDoc>({
  seller_id: { type: Schema.Types.ObjectId, required: true, ref: 'User', },
  amount_requested: { type: Number, required: true, },
  amount_paid: { type: Number, required: true, },
  user_remarks: { type: String, required: false },
  admin_remarks: { type: String, required: false },
  status: { type: String, required: true },
  payment_id: { type: Schema.Types.ObjectId, required: true, ref: 'Payment', },
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

export default mongoose.models.SellerPayoutRequest || mongoose.model<SellerPayoutRequestDoc>("SellerPayoutRequest", SellerPayoutRequestSchema);