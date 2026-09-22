import mongoose, { Schema } from 'mongoose';
import { AppendixAKit } from '../types/kit.js';

export interface IKitDoc {
  _id: string;
  userId: string;
  kit: AppendixAKit;
  createdAt: Date;
  updatedAt: Date;
}

const KitSchema = new Schema<IKitDoc>({
  _id: { type: String, required: true },
  userId: { type: String, required: true, index: true },
  kit: { type: Schema.Types.Mixed, required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  _id: false
});

export const Kit = mongoose.models.Kit || mongoose.model<IKitDoc>('Kit', KitSchema);
