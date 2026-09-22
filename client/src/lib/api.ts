const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

function getAuthHeader(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const token = localStorage.getItem('trao_prep_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    ...getAuthHeader(),
    ...options.headers,
  };

  const response = await fetch(url, { ...options, headers });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || `Request failed with status ${response.status}`);
  }

  return data as T;
}

export const authApi = {
  login: (email: string, password: string) =>
    apiRequest<{ token: string; user: { id: string; email: string; name: string } }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  register: (email: string, password: string, name?: string) =>
    apiRequest<{ token: string; user: { id: string; email: string; name: string } }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    }),
  me: () =>
    apiRequest<{ user: { id: string; email: string; name: string } }>('/auth/me', {
      method: 'GET',
    }),
};

export const kitApi = {
  list: () =>
    apiRequest<{
      kits: Array<{
        _id: string;
        title: string;
        company: string;
        kit: { coverage: { uncovered_requirement_ids: string[]; passes: number }; schedule: { days_available: number } };
        createdAt: string;
      }>;
    }>('/kits', { method: 'GET' }),
  get: (id: string) =>
    apiRequest<{ id: string; title: string; company: string; kit: any }> (`/kits/${id}`, {
      method: 'GET',
    }),
  create: (jd: string, company_url: string, days: number) =>
    apiRequest<{ message: string; kitId: string; kit: any }>('/kits', {
      method: 'POST',
      body: JSON.stringify({ jd, company_url, days }),
    }),
  update: (id: string, kit: any) =>
    apiRequest<{ message: string; kit: any }>(`/kits/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ kit }),
    }),
  delete: (id: string) =>
    apiRequest<{ message: string }>(`/kits/${id}`, {
      method: 'DELETE',
    }),
  regenerateSection: (id: string, section: string, category?: string) =>
    apiRequest<{ message: string; kit: any }>(`/kits/${id}/regenerate-section`, {
      method: 'POST',
      body: JSON.stringify({ section, category }),
    }),
  batchUpload: (cases: Array<{ jd: string; company_url: string; days: number }>) =>
    apiRequest<{ message: string; createdKits: any[]; errors: any[] }>('/kits/batch', {
      method: 'POST',
      body: JSON.stringify({ cases }),
    }),
};

export const practiceApi = {
  getSession: (kitId: string) =>
    apiRequest<{
      kitTitle: string;
      totalCards: number;
      coveredCards: number;
      uncoveredCards: number;
      progressPercentage: number;
      orderedCards: Array<{
        id: string;
        front: string;
        back: string;
        requirement_ids: string[];
        confidence: number | null;
        isCovered: boolean;
        lastReviewedAt: string | null;
      }>;
    }>(`/practice/${kitId}`, { method: 'GET' }),
  recordConfidence: (kitId: string, flashcardId: string, confidence: number) =>
    apiRequest<{ message: string; flashcardId: string; confidence: number }>(
      `/practice/${kitId}/confidence`,
      {
        method: 'POST',
        body: JSON.stringify({ flashcardId, confidence }),
      }
    ),
};

export const mockInterviewApi = {
  evaluate: (payload: {
    questionPrompt: string;
    answerOutline: string;
    candidateAnswer: string;
    category?: string;
  }) =>
    apiRequest<{
      evaluation: {
        overallScore: number;
        accuracyScore: number;
        communicationScore: number;
        strengths: string[];
        improvements: string[];
        feedback: string;
        followUpQuestion: string;
      };
    }>('/mock-interview/evaluate', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};
