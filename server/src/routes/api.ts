import { Router } from 'express';
import { register, login, getMe } from '../controllers/authController.js';
import {
  createKit,
  getKits,
  getKitById,
  updateKit,
  regenerateSection,
  deleteKit
} from '../controllers/kitController.js';
import { recordCardReview, getPracticeSession } from '../controllers/practiceController.js';
import { evaluateMockAnswer } from '../controllers/mockInterviewController.js';
import { requireAuth, optionalAuth } from '../middleware/auth.js';

const router = Router();

// Auth routes
router.post('/auth/register', register);
router.post('/auth/login', login);
router.get('/auth/me', requireAuth, getMe);

// Prep Kit routes
router.post('/kits', optionalAuth, createKit);
router.get('/kits', optionalAuth, getKits);
router.get('/kits/:id', optionalAuth, getKitById);
router.put('/kits/:id', optionalAuth, updateKit);
router.post('/kits/:id/regenerate', optionalAuth, regenerateSection);
router.delete('/kits/:id', optionalAuth, deleteKit);

// Practice Mode routes
router.post('/kits/:kitId/practice/review', optionalAuth, recordCardReview);
router.get('/kits/:kitId/practice', optionalAuth, getPracticeSession);

// Creative Feature: Mock Interview Drills
router.post('/mock/evaluate', optionalAuth, evaluateMockAnswer);

export default router;
