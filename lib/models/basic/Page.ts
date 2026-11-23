import mongoose, { Schema, Document, Types } from "mongoose";

export interface PageDoc extends Document {
  module: string;
  module_id?: Types.ObjectId;
  name: string;
  url: string;
  media_id?: Types.ObjectId;
  meta_id?: Types.ObjectId;
  content?: string;
  status: boolean;
  displayOrder?: number;
  schema_status?: boolean;
  sitemap?: boolean;
  createdAt: Date;
  details?: Types.ObjectId;
}

const pageSchema = new Schema<PageDoc>(
  {
    module: { type: String, required: true },
    module_id: { type: Schema.Types.ObjectId, required: false, refPath: "module" },
    name: { type: String, required: true },
    url: { type: String, required: true },
    media_id: { type: Schema.Types.ObjectId, ref: "Media" },
    meta_id: { type: Schema.Types.ObjectId, ref: "Meta" },
    content: { type: String, required: false },
    status: { type: Boolean, default: true },
    displayOrder: { type: Number, required: false },
    schema_status: { type: Boolean, default: false },
    sitemap: { type: Boolean, default: true },
  }, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true }});

pageSchema.virtual("details", { ref: "PageDetail", localField: "_id", foreignField: "page_id", justOne: true });

const PageModel = mongoose.models?.Page || mongoose.model<PageDoc>("Page", pageSchema);
export default PageModel;