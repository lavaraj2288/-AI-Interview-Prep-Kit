import mongoose from 'mongoose';
import { PrepKit } from '../../types/kit.js';

interface MemUser {
  _id: string;
  email: string;
  passwordHash: string;
  name: string;
  createdAt: Date;
}

interface MemKit {
  _id: string;
  userId: string;
  title: string;
  company: string;
  kit: PrepKit;
  status: 'ready' | 'draft';
  createdAt: Date;
  updatedAt: Date;
}

interface MemPractice {
  userId: string;
  kitId: string;
  cardReviews: Array<{ flashcardId: string; confidence: number; reviewedAt: Date }>;
  lastPracticedAt: Date;
}

export class FallbackStore {
  static users: Map<string, MemUser> = new Map();
  static kits: Map<string, MemKit> = new Map();
  static practiceSessions: Map<string, MemPractice> = new Map();

  static isMongoConnected(): boolean {
    return mongoose.connection.readyState === 1;
  }
}
