import mongoose, { Schema, Document } from 'mongoose';
import { PrepKit } from '../types/kit.js';

export interface IKitDocument extends Document {
  userId: mongoose.Types.ObjectId;
  title: string;
  company: string;
  kit: PrepKit;
  status: 'ready' | 'draft';
  createdAt: Date;
  updatedAt: Date;
}

const KitSchema = new Schema<IKitDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    company: {
      type: String,
      required: true,
      trim: true,
    },
    kit: {
      type: Schema.Types.Mixed,
      required: true,
    },
    status: {
      type: String,
      enum: ['ready', 'draft'],
      default: 'ready',
    },
  },
  {
    timestamps: true,
  }
);

export const Kit = mongoose.model<IKitDocument>('Kit', KitSchema);
