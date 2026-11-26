import { Schema, model, models, Document, Types } from "mongoose";

interface SellerSiteSettingDoc extends Document<Types.ObjectId> {
  seller_id: Types.ObjectId;
  module: string;
  module_value: string;
  status: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SellerSiteSettingSchema = new Schema<SellerSiteSettingDoc>({
  seller_id: { type: Schema.Types.ObjectId, required: true, ref: 'User', },
  module: { type: String, required: true },
  module_value: { type: String, required: true },
  status: { type: Boolean, required: true, default: true },
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

export default models.SellerSiteSetting || model<SellerSiteSettingDoc>("SellerSiteSetting", SellerSiteSettingSchema);