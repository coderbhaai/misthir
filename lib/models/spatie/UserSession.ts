import mongoose, { Schema, Types, Document } from 'mongoose';

export interface IUserSessionProps extends Document<Types.ObjectId> {
  user_id: Types.ObjectId;
  token_hash: string;
  device?: string;
  ip_address?: string;
  country?: string;
  region?: string;
  city?: string;
  last_activity: Date;
  expires_at: Date;
}

const userSessionSchema = new Schema<IUserSessionProps>({
  user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  token_hash: { type: String, required: true, unique: true },
  device: { type: String },
  ip_address: { type: String },
  country: { type: String },
  region: { type: String },
  city: { type: String },
  last_activity: { type: Date, default: Date.now },
  expires_at: { type: Date, required: true },
}, { timestamps: true });

export default mongoose.models?.UserSession || mongoose.model<IUserSessionProps>("UserSession", userSessionSchema);