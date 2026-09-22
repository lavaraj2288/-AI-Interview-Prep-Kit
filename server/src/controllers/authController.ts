import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { generateToken, AuthenticatedRequest } from '../middleware/auth.js';
import { FallbackStore } from '../services/storage/fallbackStore.js';

export async function register(req: Request, res: Response): Promise<void> {
  try {
    const { email, password, name } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters long.' });
      return;
    }

    if (!FallbackStore.isMongoConnected()) {
      for (const u of FallbackStore.users.values()) {
        if (u.email === email.toLowerCase()) {
          res.status(409).json({ error: 'An account with this email already exists.' });
          return;
        }
      }

      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);
      const fakeId = `mem_usr_${Date.now()}`;
      const newUser = {
        _id: fakeId,
        email: email.toLowerCase(),
        passwordHash,
        name: name || '',
        createdAt: new Date(),
      };
      FallbackStore.users.set(fakeId, newUser);
      const token = generateToken(fakeId, newUser.email);
      res.status(201).json({
        message: 'Registration successful (in-memory mode)',
        token,
        user: { id: fakeId, email: newUser.email, name: newUser.name },
      });
      return;
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      res.status(409).json({ error: 'An account with this email already exists.' });
      return;
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = await User.create({
      email: email.toLowerCase(),
      passwordHash,
      name: name || '',
    });

    const token = generateToken(user._id.toString(), user.email);

    res.status(201).json({
      message: 'Registration successful',
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Failed to create user account.' });
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    if (!FallbackStore.isMongoConnected()) {
      let matchedUser = null;
      for (const u of FallbackStore.users.values()) {
        if (u.email === email.toLowerCase()) {
          matchedUser = u;
          break;
        }
      }

      if (!matchedUser) {
        res.status(401).json({ error: 'Invalid email or password.' });
        return;
      }

      const isMatch = await bcrypt.compare(password, matchedUser.passwordHash);
      if (!isMatch) {
        res.status(401).json({ error: 'Invalid email or password.' });
        return;
      }

      const token = generateToken(matchedUser._id, matchedUser.email);
      res.status(200).json({
        message: 'Login successful (in-memory mode)',
        token,
        user: { id: matchedUser._id, email: matchedUser.email, name: matchedUser.name },
      });
      return;
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const token = generateToken(user._id.toString(), user.email);

    res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Failed to log in.' });
  }
}

export async function getCurrentUser(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  try {
    if (!FallbackStore.isMongoConnected()) {
      const user = FallbackStore.users.get(req.userId || '');
      if (!user) {
        res.status(404).json({ error: 'User not found.' });
        return;
      }
      res.status(200).json({
        user: { id: user._id, email: user.email, name: user.name },
      });
      return;
    }

    const user = await User.findById(req.userId).select('-passwordHash');
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    res.status(200).json({
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve user session.' });
  }
}
