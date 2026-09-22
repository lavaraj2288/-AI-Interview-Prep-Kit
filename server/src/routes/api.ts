import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import {
  register,
  login,
  getCurrentUser,
} from '../controllers/authController.js';
import {
  createKit,
  getUserKits,
  getKitById,
  updateKit,
  deleteKit,
  regenerateSection,
  batchUpload,
} from '../controllers/kitController.js';
import {
  getPracticeSession,
  recordCardConfidence,
} from '../controllers/practiceController.js';
import { evaluateMockAnswer } from '../controllers/mockInterviewController.js';

const router = Router();

// Auth routes
router.post('/auth/register', register);
router.post('/auth/login', login);
router.get('/auth/me', authMiddleware, getCurrentUser);

// Kit routes
router.get('/kits', authMiddleware, getUserKits);
router.post('/kits', authMiddleware, createKit);
router.post('/kits/batch', authMiddleware, batchUpload);
router.get('/kits/:id', authMiddleware, getKitById);
router.put('/kits/:id', authMiddleware, updateKit);
router.delete('/kits/:id', authMiddleware, deleteKit);
router.post('/kits/:id/regenerate-section', authMiddleware, regenerateSection);

// Practice routes
router.get('/practice/:kitId', authMiddleware, getPracticeSession);
router.post('/practice/:kitId/confidence', authMiddleware, recordCardConfidence);

// Mock Interview evaluation route
router.post('/mock-interview/evaluate', authMiddleware, evaluateMockAnswer);

export default router;
