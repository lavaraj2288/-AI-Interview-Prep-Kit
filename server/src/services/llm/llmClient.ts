import { globalLlmRateLimiter } from './rateLimiter.js';

export class LlmClient {
  private geminiKey: string;
  private geminiModel: string;
  private openaiKey?: string;
  private openaiBaseUrl: string;
  private openaiModel: string;

  constructor() {
    this.geminiKey = process.env.GEMINI_API_KEY || '';
    this.geminiModel = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
    this.openaiKey = process.env.OPENAI_API_KEY;
    this.openaiBaseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
    this.openaiModel = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  }

  async generateJson<T>(prompt: string, fallbackGenerator?: () => T): Promise<T> {
    // If an API key is available, attempt remote call with backoff
    if (this.geminiKey) {
      try {
        return await globalLlmRateLimiter.executeWithRetry(async () => {
          return await this.callGemini<T>(prompt);
        });
      } catch (err: any) {
        console.warn(`[LlmClient] Gemini API call failed: ${err.message}. Checking fallback.`);
        if (fallbackGenerator) {
          return fallbackGenerator();
        }
        throw err;
      }
    }

    if (this.openaiKey) {
      try {
        return await globalLlmRateLimiter.executeWithRetry(async () => {
          return await this.callOpenAi<T>(prompt);
        });
      } catch (err: any) {
        console.warn(`[LlmClient] OpenAI API call failed: ${err.message}. Checking fallback.`);
        if (fallbackGenerator) {
          return fallbackGenerator();
        }
        throw err;
      }
    }

    // Offline / deterministic fallback when no API key is set
    if (fallbackGenerator) {
      return fallbackGenerator();
    }

    throw new Error('No LLM API key configured (set GEMINI_API_KEY in .env) and no fallback provided.');
  }

  private async callGemini<T>(prompt: string): Promise<T> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.geminiModel}:generateContent?key=${this.geminiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: 'application/json'
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      const err: any = new Error(`Gemini API error ${response.status}: ${errorText}`);
      err.status = response.status;
      throw err;
    }

    const data: any = await response.json();
    const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!candidateText) {
      throw new Error('Empty response from Gemini API');
    }

    return this.cleanAndParseJson<T>(candidateText);
  }

  private async callOpenAi<T>(prompt: string): Promise<T> {
    const url = `${this.openaiBaseUrl}/chat/completions`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.openaiKey}`
      },
      body: JSON.stringify({
        model: this.openaiModel,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
        temperature: 0.2
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      const err: any = new Error(`OpenAI API error ${response.status}: ${errorText}`);
      err.status = response.status;
      throw err;
    }

    const data: any = await response.json();
    const content = data.choices?.[0]?.message?.content;
    return this.cleanAndParseJson<T>(content);
  }

  private cleanAndParseJson<T>(rawText: string): T {
    let cleaned = rawText.trim();

    // Strip markdown code fences if present
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    return JSON.parse(cleaned);
  }
}

export const defaultLlmClient = new LlmClient();
