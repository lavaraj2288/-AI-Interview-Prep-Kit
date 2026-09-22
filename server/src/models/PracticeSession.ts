import mongoose, { Schema, Document } from 'mongoose';

export interface ICardReview {
  flashcardId: string;
  confidence: number; // 1: Low / Needs work, 2: Medium / Getting there, 3: High / Mastered
  reviewedAt: Date;
}

export interface IPracticeSession extends Document {
  userId: mongoose.Types.ObjectId;
  kitId: mongoose.Types.ObjectId;
  cardReviews: ICardReview[];
  lastPracticedAt: Date;
}

const CardReviewSchema = new Schema<ICardReview>(
  {
    flashcardId: { type: String, required: true },
    confidence: { type: Number, required: true, min: 1, max: 3 },
    reviewedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const PracticeSessionSchema = new Schema<IPracticeSession>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    kitId: { type: Schema.Types.ObjectId, ref: 'Kit', required: true, index: true },
    cardReviews: [CardReviewSchema],
    lastPracticedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

PracticeSessionSchema.index({ userId: 1, kitId: 1 }, { unique: true });

export const PracticeSession = mongoose.model<IPracticeSession>(
  'PracticeSession',
  PracticeSessionSchema
);
