/**
 * API client for The AI Interview Prep Kit
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

function getAuthToken(): string | null {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('trao_prep_token');
  }
  return null;
}

export function setAuthToken(token: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('trao_prep_token', token);
  }
}

export function clearAuthToken(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('trao_prep_token');
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {})
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  if (!res.ok) {
    let errorMsg = `Request failed with status ${res.status}`;
    try {
      const errJson = await res.json();
      errorMsg = errJson.error || errJson.details || errorMsg;
    } catch {
      // ignore json parse error
    }
    throw new Error(errorMsg);
  }

  return res.json();
}

export const api = {
  // Auth
  register: (data: { email: string; password: string; name?: string }) =>
    request<{ token: string; user: any }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  login: (data: { email: string; password: string }) =>
    request<{ token: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  getMe: () => request<{ user: any }>('/auth/me'),

  // Kits
  createKit: (data: { jd: string; company_url: string; days: number; company_name?: string }) =>
    request<{ id: string; kit: any }>('/kits', {
      method: 'POST',
      body: JSON.stringify(data)
    }),

  getKits: () => request<{ kits: any[] }>('/kits'),

  getKitById: (id: string) => request<{ id: string; kit: any; createdAt: string; updatedAt: string }>(`/kits/${id}`),

  updateKit: (id: string, kit: any) =>
    request<{ message: string; id: string; kit: any }>(`/kits/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ kit })
    }),

  regenerateSection: (id: string, target: string) =>
    request<{ message: string; kit: any }>(`/kits/${id}/regenerate`, {
      method: 'POST',
      body: JSON.stringify({ target })
    }),

  deleteKit: (id: string) =>
    request<{ message: string }>(`/kits/${id}`, {
      method: 'DELETE'
    }),

  // Practice
  recordReview: (kitId: string, cardId: string, confidence: number) =>
    request<{ message: string; review: any; totalReviewed: number }>(`/kits/${kitId}/practice/review`, {
      method: 'POST',
      body: JSON.stringify({ cardId, confidence })
    }),

  getPracticeSession: (kitId: string) =>
    request<{
      kitId: string;
      totalCards: number;
      coveredCards: number;
      breakdown: { hard: number; good: number; easy: number; unseen: number };
      prioritizedCards: any[];
      reviews: any[];
    }>(`/kits/${kitId}/practice`),

  // Creative Feature: Mock Interview Drills
  evaluateMockAnswer: (kitId: string, questionId: string, userAnswer: string) =>
    request<{
      questionId: string;
      prompt: string;
      evaluation: {
        score: number;
        rating: string;
        strengths: string[];
        areas_for_improvement: string[];
        model_response_tip: string;
      };
    }>('/mock/evaluate', {
      method: 'POST',
      body: JSON.stringify({ kitId, questionId, userAnswer })
    })
};
