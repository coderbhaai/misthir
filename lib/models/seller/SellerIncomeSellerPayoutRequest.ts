import mongoose, { Schema } from 'mongoose';

const SellerIncomeSellerPayoutRequestSchema = new Schema({
  sellerIncome_id: { type: Schema.Types.ObjectId, ref: 'Blog', required: true },
  sellerPayoutRequest_id: { type: Schema.Types.ObjectId, ref: 'SellerPayoutRequest', required: true },
  createdAt: { type: Date, default: Date.now },
});

SellerIncomeSellerPayoutRequestSchema.index({ sellerIncome_id: 1, sellerPayoutRequest_id: 1 }, { unique: true });

export default mongoose.models.SellerIncomeSellerPayoutRequest || mongoose.model('SellerIncomeSellerPayoutRequest', SellerIncomeSellerPayoutRequestSchema);