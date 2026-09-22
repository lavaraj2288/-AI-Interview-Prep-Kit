import fs from 'fs';
import path from 'path';
import { AppendixAKit } from '../../types/kit.js';

export interface StoredUser {
  id: string;
  email: string;
  passwordHash: string;
  name?: string;
  createdAt: string;
}

export interface StoredKit {
  id: string;
  userId: string;
  kit: AppendixAKit;
  createdAt: string;
  updatedAt: string;
}

export interface StoredPracticeReview {
  cardId: string;
  confidence: number; // 1 to 3
  reviewedAt: string;
}

export interface StoredPracticeSession {
  id: string;
  kitId: string;
  userId: string;
  reviews: StoredPracticeReview[];
  updatedAt: string;
}

class FallbackStore {
  private users: Map<string, StoredUser> = new Map();
  private kits: Map<string, StoredKit> = new Map();
  private sessions: Map<string, StoredPracticeSession> = new Map();
  private storageFile: string = path.resolve(process.cwd(), '.kits_storage.json');

  constructor() {
    this.loadFromDisk();
  }

  private loadFromDisk() {
    try {
      if (fs.existsSync(this.storageFile)) {
        const data = JSON.parse(fs.readFileSync(this.storageFile, 'utf-8'));
        if (Array.isArray(data.users)) {
          data.users.forEach((u: StoredUser) => this.users.set(u.id, u));
        }
        if (Array.isArray(data.kits)) {
          data.kits.forEach((k: StoredKit) => this.kits.set(k.id, k));
        }
        if (Array.isArray(data.sessions)) {
          data.sessions.forEach((s: StoredPracticeSession) => this.sessions.set(s.id, s));
        }
      }
    } catch {
      // Ignore initial disk load error
    }
  }

  private saveToDisk() {
    try {
      const data = {
        users: Array.from(this.users.values()),
        kits: Array.from(this.kits.values()),
        sessions: Array.from(this.sessions.values())
      };
      fs.writeFileSync(this.storageFile, JSON.stringify(data, null, 2), 'utf-8');
    } catch {
      // Ignore disk save error
    }
  }

  // Users
  createUser(user: StoredUser): StoredUser {
    this.users.set(user.id, user);
    this.saveToDisk();
    return user;
  }

  findUserByEmail(email: string): StoredUser | null {
    for (const u of this.users.values()) {
      if (u.email.toLowerCase() === email.toLowerCase()) return u;
    }
    return null;
  }

  findUserById(id: string): StoredUser | null {
    return this.users.get(id) || null;
  }

  // Kits
  saveKit(kitRecord: StoredKit): StoredKit {
    this.kits.set(kitRecord.id, kitRecord);
    this.saveToDisk();
    return kitRecord;
  }

  findKitById(id: string): StoredKit | null {
    return this.kits.get(id) || null;
  }

  findKitsByUserId(userId: string): StoredKit[] {
    return Array.from(this.kits.values()).filter(k => k.userId === userId);
  }

  deleteKit(id: string): boolean {
    const deleted = this.kits.delete(id);
    if (deleted) this.saveToDisk();
    return deleted;
  }

  // Practice Sessions
  savePracticeSession(session: StoredPracticeSession): StoredPracticeSession {
    this.sessions.set(session.id, session);
    this.saveToDisk();
    return session;
  }

  findPracticeSession(kitId: string, userId: string): StoredPracticeSession | null {
    for (const s of this.sessions.values()) {
      if (s.kitId === kitId && s.userId === userId) return s;
    }
    return null;
  }
}

export const fallbackStore = new FallbackStore();
