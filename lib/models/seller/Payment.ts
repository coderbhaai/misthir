import mongoose, { Schema, model, models, Types, Document } from "mongoose";

export interface PaymentDoc extends Document<Types.ObjectId> {
  seller_id: Types.ObjectId;
  amount_paid: number;
  user_remarks: string;
  admin_remarks: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema = new Schema<PaymentDoc>({
  seller_id: { type: Schema.Types.ObjectId, required: true, ref: 'User', },
  amount_paid: { type: Number, required: true, },
  user_remarks: { type: String, required: false },
  admin_remarks: { type: String, required: false },
  status: { type: String, required: true },
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

export default mongoose.models.Payment || mongoose.model<PaymentDoc>("Payment", PaymentSchema);