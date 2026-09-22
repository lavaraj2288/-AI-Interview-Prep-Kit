import mongoose from 'mongoose';
import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { Kit } from '../models/Kit.js';
import { PracticeSession } from '../models/PracticeSession.js';
import { FallbackStore } from '../services/storage/fallbackStore.js';

export async function getPracticeSession(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const kitId = String(req.params.kitId);
    const userId = String(req.userId || 'anon');

    let kitTitle = 'Interview Preparation Kit';
    let flashcards: any[] = [];

    // Check FallbackStore or MongoDB
    if (!FallbackStore.isMongoConnected() || kitId.startsWith('mem_')) {
      const memDoc = FallbackStore.kits.get(kitId);
      if (!memDoc || (req.userId && memDoc.userId !== req.userId)) {
        res.status(404).json({ error: 'Kit not found or access denied.' });
        return;
      }
      kitTitle = memDoc.title;
      flashcards = memDoc.kit.flashcards || [];

      const sessionKey = `${userId}_${kitId}`;
      let memSession = FallbackStore.practiceSessions.get(sessionKey);
      if (!memSession) {
        memSession = {
          userId,
          kitId,
          cardReviews: [],
          lastPracticedAt: new Date(),
        };
        FallbackStore.practiceSessions.set(sessionKey, memSession);
      }

      const reviewMap = new Map<string, { confidence: number; reviewedAt: Date }>();
      memSession.cardReviews.forEach((r) => {
        reviewMap.set(r.flashcardId, { confidence: r.confidence, reviewedAt: r.reviewedAt });
      });

      const enrichedCards = flashcards.map((card) => {
        const review = reviewMap.get(card.id);
        return {
          ...card,
          confidence: review ? review.confidence : null,
          isCovered: review !== undefined,
          lastReviewedAt: review ? review.reviewedAt : null,
        };
      });

      const orderedCards = [...enrichedCards].sort((a, b) => {
        const scoreA = a.confidence === null ? 0 : a.confidence;
        const scoreB = b.confidence === null ? 0 : b.confidence;
        if (scoreA !== scoreB) return scoreA - scoreB;
        const timeA = a.lastReviewedAt ? new Date(a.lastReviewedAt).getTime() : 0;
        const timeB = b.lastReviewedAt ? new Date(b.lastReviewedAt).getTime() : 0;
        return timeA - timeB;
      });

      const coveredCount = enrichedCards.filter((c) => c.isCovered).length;
      const totalCount = enrichedCards.length;

      res.status(200).json({
        kitTitle,
        totalCards: totalCount,
        coveredCards: coveredCount,
        uncoveredCards: totalCount - coveredCount,
        progressPercentage: totalCount > 0 ? Math.round((coveredCount / totalCount) * 100) : 0,
        orderedCards,
      });
      return;
    }

    const kitDoc = await Kit.findOne({
      _id: new mongoose.Types.ObjectId(kitId),
      userId: new mongoose.Types.ObjectId(userId),
    });
    if (!kitDoc) {
      res.status(404).json({ error: 'Kit not found or access denied.' });
      return;
    }

    let session = await PracticeSession.findOne({
      kitId: new mongoose.Types.ObjectId(kitId),
      userId: new mongoose.Types.ObjectId(userId),
    });
    if (!session) {
      session = await PracticeSession.create({
        userId: new mongoose.Types.ObjectId(userId),
        kitId: new mongoose.Types.ObjectId(kitId),
        cardReviews: [],
      });
    }

    const reviewMap = new Map<string, { confidence: number; reviewedAt: Date }>();
    session.cardReviews.forEach((r) => {
      reviewMap.set(r.flashcardId, { confidence: r.confidence, reviewedAt: r.reviewedAt });
    });

    flashcards = kitDoc.kit.flashcards || [];

    // Attach review info to each flashcard
    const enrichedCards = flashcards.map((card) => {
      const review = reviewMap.get(card.id);
      return {
        ...card,
        confidence: review ? review.confidence : null, // 1: Low, 2: Med, 3: High, null: Uncovered
        isCovered: review !== undefined,
        lastReviewedAt: review ? review.reviewedAt : null,
      };
    });

    // Confidence-weighted Spaced Repetition Ordering:
    // 1. Uncovered cards first (null)
    // 2. Low confidence (1)
    // 3. Medium confidence (2)
    // 4. High confidence (3) (ordered by oldest reviewedAt)
    const orderedCards = [...enrichedCards].sort((a, b) => {
      const scoreA = a.confidence === null ? 0 : a.confidence;
      const scoreB = b.confidence === null ? 0 : b.confidence;

      if (scoreA !== scoreB) {
        return scoreA - scoreB;
      }

      const timeA = a.lastReviewedAt ? new Date(a.lastReviewedAt).getTime() : 0;
      const timeB = b.lastReviewedAt ? new Date(b.lastReviewedAt).getTime() : 0;
      return timeA - timeB;
    });

    const coveredCount = enrichedCards.filter((c) => c.isCovered).length;
    const totalCount = enrichedCards.length;

    res.status(200).json({
      kitTitle: kitDoc.title,
      totalCards: totalCount,
      coveredCards: coveredCount,
      uncoveredCards: totalCount - coveredCount,
      progressPercentage: totalCount > 0 ? Math.round((coveredCount / totalCount) * 100) : 0,
      orderedCards,
    });
  } catch (err) {
    console.error('Get practice session error:', err);
    res.status(500).json({ error: 'Failed to retrieve practice session.' });
  }
}

export async function recordCardConfidence(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    const kitId = String(req.params.kitId);
    const userId = String(req.userId || 'anon');
    const { flashcardId, confidence } = req.body;

    if (!flashcardId || !confidence || confidence < 1 || confidence > 3) {
      res.status(400).json({ error: 'flashcardId and valid confidence (1..3) are required.' });
      return;
    }

    if (!FallbackStore.isMongoConnected() || kitId.startsWith('mem_')) {
      const sessionKey = `${userId}_${kitId}`;
      let memSession = FallbackStore.practiceSessions.get(sessionKey);
      if (!memSession) {
        memSession = {
          userId,
          kitId,
          cardReviews: [],
          lastPracticedAt: new Date(),
        };
        FallbackStore.practiceSessions.set(sessionKey, memSession);
      }

      const existingIndex = memSession.cardReviews.findIndex((r) => r.flashcardId === flashcardId);
      if (existingIndex >= 0) {
        memSession.cardReviews[existingIndex].confidence = confidence;
        memSession.cardReviews[existingIndex].reviewedAt = new Date();
      } else {
        memSession.cardReviews.push({
          flashcardId,
          confidence,
          reviewedAt: new Date(),
        });
      }
      memSession.lastPracticedAt = new Date();

      res.status(200).json({
        message: 'Confidence recorded',
        flashcardId,
        confidence,
      });
      return;
    }

    let session = await PracticeSession.findOne({
      kitId: new mongoose.Types.ObjectId(kitId),
      userId: new mongoose.Types.ObjectId(userId),
    });
    if (!session) {
      session = await PracticeSession.create({
        userId: new mongoose.Types.ObjectId(userId),
        kitId: new mongoose.Types.ObjectId(kitId),
        cardReviews: [],
      });
    }

    const existingIndex = session.cardReviews.findIndex((r) => r.flashcardId === flashcardId);
    if (existingIndex >= 0) {
      session.cardReviews[existingIndex].confidence = confidence;
      session.cardReviews[existingIndex].reviewedAt = new Date();
    } else {
      session.cardReviews.push({
        flashcardId,
        confidence,
        reviewedAt: new Date(),
      });
    }

    session.lastPracticedAt = new Date();
    await session.save();

    res.status(200).json({
      message: 'Confidence recorded',
      flashcardId,
      confidence,
    });
  } catch (err) {
    console.error('Record confidence error:', err);
    res.status(500).json({ error: 'Failed to record card confidence.' });
  }
}
