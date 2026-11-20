import mongoose, { Schema, Types, Document, model } from "mongoose";

interface SellerDoc extends Document<Types.ObjectId> {
  user_id?: Types.ObjectId;
  adminApproval: boolean;
  heading?: string;
  content?: string;
  displayOrder?: number;
  createdAt: Date;
  updatedAt: Date;
  products?: { product_id: Types.ObjectId }[];
}

const SellerSchema = new Schema<SellerDoc>({
    user_id: { type: Schema.Types.ObjectId, ref: "User" },
    adminApproval: { type: Boolean, default: true },
    heading: { type: String, required: false },
    content: { type: String, required: false },
    displayOrder: { type: Number, required: false },
  }, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

export default mongoose.models.Seller || model<SellerDoc>("Seller", SellerSchema);