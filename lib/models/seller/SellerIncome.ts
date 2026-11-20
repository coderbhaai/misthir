import mongoose, { Schema, model, models, Types, Document } from "mongoose";

export interface SellerIncomeDoc extends Document<Types.ObjectId> {
  module: string;
  module_id: Types.ObjectId;
  seller_id: Types.ObjectId;
  margin: number;
  payable: number;
  paid: number;
  due: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

const SellerIncomeSchema = new Schema<SellerIncomeDoc>({
    module: { type: String, required: true, index: true },
    module_id: { type: Schema.Types.ObjectId, required: true, index: true },
    seller_id: { type: Schema.Types.ObjectId, required: true, ref: 'User', },
    margin: { type: Number, required: false, },
    payable: { type: Number, required: true, },
    paid: { type: Number },
    due: { type: Number  },
    status: { type: String, required: true },
  }, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

export default mongoose.models.SellerIncome || mongoose.model<SellerIncomeDoc>("SellerIncome", SellerIncomeSchema);