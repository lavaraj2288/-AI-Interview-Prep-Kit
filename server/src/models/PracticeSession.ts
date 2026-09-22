import mongoose, { Schema } from 'mongoose';

export interface IPracticeReview {
  cardId: string;
  confidence: number;
  reviewedAt: Date;
}

export interface IPracticeSessionDoc {
  _id: string;
  kitId: string;
  userId: string;
  reviews: IPracticeReview[];
  updatedAt: Date;
}

const PracticeReviewSchema = new Schema<IPracticeReview>({
  cardId: { type: String, required: true },
  confidence: { type: Number, required: true, min: 1, max: 3 },
  reviewedAt: { type: Date, default: Date.now }
}, { _id: false });

const PracticeSessionSchema = new Schema<IPracticeSessionDoc>({
  _id: { type: String, required: true },
  kitId: { type: String, required: true, index: true },
  userId: { type: String, required: true, index: true },
  reviews: [PracticeReviewSchema],
  updatedAt: { type: Date, default: Date.now }
}, {
  _id: false
});

export const PracticeSession = mongoose.models.PracticeSession || mongoose.model<IPracticeSessionDoc>('PracticeSession', PracticeSessionSchema);
