import mongoose, { Schema, Types, Document } from 'mongoose';

export interface IUserLoginLogProps extends Document<Types.ObjectId> {
  user_id: Types.ObjectId;
  device?: string;
  ip_address?: string;
  location?: {
    country?: string;
    region?: string;
    city?: string;
    latitude?: number;
    longitude?: number;
  };
  browser?: string;
  os?: string;
  login_at: Date;
}

const userLoginLogSchema = new Schema<IUserLoginLogProps>({
  user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  device: { type: String },
  ip_address: { type: String },
  location: {
    country: { type: String },
    region: { type: String },
    city: { type: String },
    latitude: { type: Number },
    longitude: { type: Number },
  },
  browser: { type: String },
  os: { type: String },
  login_at: { type: Date, default: Date.now, index: true },
}, { timestamps: true });

export default mongoose.models?.UserLoginLog || mongoose.model<IUserLoginLogProps>("UserLoginLog", userLoginLogSchema);