import mongoose, { Schema, Document, models, Types } from "mongoose";

export interface ITaxCollected extends Document<Types.ObjectId> {
  module: string;
  module_id: Types.ObjectId;
  tax_id: Types.ObjectId;
  tax_rate: number;
  price: number;
  quantity: number;
  admin_discount?: number;
  seller_discount?: number;
  cgst?: number;
  sgst?: number;
  igst?: number;
  total?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

const TaxCollectedSchema = new Schema<ITaxCollected>({
    module: { type: String, required: true },
    module_id: { type: Schema.Types.ObjectId, required: true }, 
    tax_id: { type: Schema.Types.ObjectId, required: true, ref: 'Tax',}, 
    tax_rate: { type: Number, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true },
    admin_discount: { type: Number, required: false },
    seller_discount: { type: Number, required: false },
    cgst: { type: Number },
    sgst: { type: Number },
    igst: { type: Number },
    total: { type: Number },
  },{ timestamps: true }
);

export default models.TaxCollected || mongoose.model<ITaxCollected>("TaxCollected", TaxCollectedSchema);
