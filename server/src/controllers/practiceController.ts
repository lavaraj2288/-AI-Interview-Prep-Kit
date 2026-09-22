import { Response } from 'express';
import mongoose from 'mongoose';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { fallbackStore } from '../services/storage/fallbackStore.js';
import { PracticeSession } from '../models/PracticeSession.js';
import { Kit } from '../models/Kit.js';

const isDbConnected = () => mongoose.connection.readyState === 1;

export async function recordCardReview(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { kitId } = req.params;
    const { cardId, confidence } = req.body;
    const userId = req.user?.id || 'guest_user';

    if (!cardId || !confidence || ![1, 2, 3].includes(confidence)) {
      res.status(400).json({ error: 'Valid cardId and confidence score (1, 2, or 3) are required' });
      return;
    }

    const now = new Date();
    const reviewData = {
      cardId,
      confidence,
      reviewedAt: now
    };

    // Primary update in MongoDB
    if (isDbConnected()) {
      try {
        let dbSession = await PracticeSession.findOne({ kitId, userId });
        if (!dbSession) {
          dbSession = new PracticeSession({
            _id: `session_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            kitId,
            userId,
            reviews: [reviewData],
            updatedAt: now
          });
          await dbSession.save();
        } else {
          const existingIdx = dbSession.reviews.findIndex((r: any) => r.cardId === cardId);
          if (existingIdx >= 0) {
            dbSession.reviews[existingIdx] = reviewData;
          } else {
            dbSession.reviews.push(reviewData);
          }
          dbSession.updatedAt = now;
          await dbSession.save();
        }
      } catch (dbErr: any) {
        console.warn(`[PracticeController] MongoDB record review error: ${dbErr.message}`);
      }
    }

    // Keep fallbackStore in sync
    let session = fallbackStore.findPracticeSession(kitId, userId);
    if (!session) {
      session = {
        id: `session_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        kitId,
        userId,
        reviews: [],
        updatedAt: now.toISOString()
      };
    }

    const existingIdx = session.reviews.findIndex(r => r.cardId === cardId);
    const storedReview = {
      cardId,
      confidence,
      reviewedAt: now.toISOString()
    };

    if (existingIdx >= 0) {
      session.reviews[existingIdx] = storedReview;
    } else {
      session.reviews.push(storedReview);
    }
    session.updatedAt = now.toISOString();
    fallbackStore.savePracticeSession(session);

    res.json({
      message: 'Review recorded',
      review: storedReview,
      totalReviewed: session.reviews.length
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to record card review', details: err.message });
  }
}

export async function getPracticeSession(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const { kitId } = req.params;
    const userId = req.user?.id || 'guest_user';

    let flashcards: any[] = [];

    // Fetch kit flashcards
    if (isDbConnected()) {
      const dbKit = await Kit.findById(kitId).lean() as any;
      if (dbKit && dbKit.kit && Array.isArray(dbKit.kit.flashcards)) {
        flashcards = dbKit.kit.flashcards;
      }
    }

    if (flashcards.length === 0) {
      const kitRecord = fallbackStore.findKitById(kitId);
      if (kitRecord && kitRecord.kit && Array.isArray(kitRecord.kit.flashcards)) {
        flashcards = kitRecord.kit.flashcards;
      }
    }

    if (flashcards.length === 0) {
      res.status(404).json({ error: 'Kit not found or has no flashcards' });
      return;
    }

    let reviews: any[] = [];

    // Fetch reviews from MongoDB
    if (isDbConnected()) {
      const dbSession = await PracticeSession.findOne({ kitId, userId }).lean() as any;
      if (dbSession && Array.isArray(dbSession.reviews)) {
        reviews = dbSession.reviews;
      }
    }

    if (reviews.length === 0) {
      const session = fallbackStore.findPracticeSession(kitId, userId);
      reviews = session?.reviews || [];
    }

    const reviewMap = new Map(reviews.map(r => [r.cardId, r]));
    const totalCards = flashcards.length;
    const coveredCards = reviews.length;

    const breakdown = {
      hard: reviews.filter(r => r.confidence === 1).length,
      good: reviews.filter(r => r.confidence === 2).length,
      easy: reviews.filter(r => r.confidence === 3).length,
      unseen: Math.max(0, totalCards - coveredCards)
    };

    // Prioritized smart ordering for next study session: least confident first
    const prioritizedCards = [...flashcards].sort((a, b) => {
      const revA = reviewMap.get(a.id);
      const revB = reviewMap.get(b.id);
      const scoreA = revA ? revA.confidence : 2.5;
      const scoreB = revB ? revB.confidence : 2.5;
      return scoreA - scoreB;
    });

    res.json({
      kitId,
      totalCards,
      coveredCards,
      breakdown,
      prioritizedCards,
      reviews
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to fetch practice session', details: err.message });
  }
}
