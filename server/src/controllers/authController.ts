import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { fallbackStore } from '../services/storage/fallbackStore.js';
import { User } from '../models/User.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-interview-kit-jwt-key-2026';

const isDbConnected = () => mongoose.connection.readyState === 1;

export async function register(req: Request, res: Response): Promise<void> {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters long' });
      return;
    }

    const cleanEmail = email.toLowerCase().trim();

    // Check existing in MongoDB
    if (isDbConnected()) {
      const existingDbUser = await User.findOne({ email: cleanEmail }).lean();
      if (existingDbUser) {
        res.status(400).json({ error: 'A user with this email already exists' });
        return;
      }
    }

    // Check existing in fallback store
    if (fallbackStore.findUserByEmail(cleanEmail)) {
      res.status(400).json({ error: 'A user with this email already exists' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const displayName = name?.trim() || cleanEmail.split('@')[0];

    const newUser = fallbackStore.createUser({
      id: userId,
      email: cleanEmail,
      passwordHash,
      name: displayName,
      createdAt: new Date().toISOString()
    });

    // Primary persist to MongoDB
    if (isDbConnected()) {
      try {
        await User.create({
          _id: userId,
          email: cleanEmail,
          passwordHash,
          name: displayName,
          createdAt: new Date()
        });
      } catch (dbErr: any) {
        console.warn(`[AuthController] MongoDB create user error: ${dbErr.message}`);
      }
    }

    const token = jwt.sign({ id: newUser.id, email: newUser.email }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      message: 'Registration successful',
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to register user', details: err.message });
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    const cleanEmail = email.toLowerCase().trim();
    let user: { id: string; email: string; passwordHash: string; name?: string } | null = null;

    if (isDbConnected()) {
      try {
        const dbUser = await User.findOne({ email: cleanEmail }).lean() as any;
        if (dbUser) {
          user = {
            id: dbUser._id,
            email: dbUser.email,
            passwordHash: dbUser.passwordHash,
            name: dbUser.name
          };
        }
      } catch (dbErr: any) {
        console.warn(`[AuthController] MongoDB login find error: ${dbErr.message}`);
      }
    }

    if (!user) {
      user = fallbackStore.findUserByEmail(cleanEmail);
    }

    if (!user) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to login', details: err.message });
  }
}

export async function getMe(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  let user: { id: string; email: string; name?: string } | null = null;

  if (isDbConnected()) {
    try {
      const dbUser = await User.findById(req.user.id).lean() as any;
      if (dbUser) {
        user = {
          id: dbUser._id,
          email: dbUser.email,
          name: dbUser.name
        };
      }
    } catch {
      // ignore
    }
  }

  if (!user) {
    const memUser = fallbackStore.findUserById(req.user.id);
    if (memUser) {
      user = {
        id: memUser.id,
        email: memUser.email,
        name: memUser.name
      };
    }
  }

  res.json({
    user: {
      id: req.user.id,
      email: req.user.email,
      name: user?.name || req.user.email.split('@')[0]
    }
  });
}
