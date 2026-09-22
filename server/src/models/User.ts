import mongoose, { Schema } from 'mongoose';

export interface IUser {
  _id: string;
  email: string;
  passwordHash: string;
  name?: string;
  createdAt: Date;
}

const UserSchema = new Schema<IUser>({
  _id: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  name: { type: String, trim: true },
  createdAt: { type: Date, default: Date.now }
}, {
  _id: false
});

export const User = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
