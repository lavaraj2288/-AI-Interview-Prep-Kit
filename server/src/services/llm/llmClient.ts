import { GoogleGenerativeAI } from '@google/generative-ai';
import axios from 'axios';
import { defaultRateLimiter } from './rateLimiter.js';
import { sanitizeJsonText } from './prompts.js';

export interface LLMGenerateOptions {
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
}

export class LLMClient {
  private provider: 'gemini' | 'groq' | 'mock';
  private geminiKey?: string;
  private groqKey?: string;
  private geminiModel: string;
  private groqModel: string;

  constructor() {
    this.geminiKey = process.env.GEMINI_API_KEY || '';
    this.groqKey = process.env.GROQ_API_KEY || '';
    this.geminiModel = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
    this.groqModel = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

    const configuredProvider = (process.env.LLM_PROVIDER || '').toLowerCase();
    if (configuredProvider === 'groq' && this.groqKey) {
      this.provider = 'groq';
    } else if (this.geminiKey) {
      this.provider = 'gemini';
    } else if (this.groqKey) {
      this.provider = 'groq';
    } else {
      // Offline fallback mock provider if no API key is set
      this.provider = 'mock';
    }
  }

  getProviderName(): string {
    return this.provider;
  }

  async generateJson<T>(options: LLMGenerateOptions): Promise<T> {
    return defaultRateLimiter.execute(async () => {
      if (this.provider === 'gemini' && this.geminiKey) {
        return this.callGemini<T>(options);
      } else if (this.provider === 'groq' && this.groqKey) {
        return this.callGroq<T>(options);
      } else {
        return this.callMock<T>(options);
      }
    });
  }

  private async callGemini<T>(options: LLMGenerateOptions): Promise<T> {
    const genAI = new GoogleGenerativeAI(this.geminiKey!);
    const model = genAI.getGenerativeModel({
      model: this.geminiModel,
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: options.temperature ?? 0.2,
      },
      systemInstruction: options.systemPrompt,
    });

    const result = await model.generateContent(options.userPrompt);
    const responseText = result.response.text();
    const cleanJson = sanitizeJsonText(responseText);

    try {
      return JSON.parse(cleanJson) as T;
    } catch (parseErr) {
      throw new Error(
        `Gemini returned invalid JSON: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}\nRaw text: ${responseText.slice(0, 200)}`
      );
    }
  }

  private async callGroq<T>(options: LLMGenerateOptions): Promise<T> {
    const url = 'https://api.groq.com/openai/v1/chat/completions';
    const response = await axios.post(
      url,
      {
        model: this.groqModel,
        messages: [
          { role: 'system', content: options.systemPrompt },
          { role: 'user', content: options.userPrompt },
        ],
        temperature: options.temperature ?? 0.2,
        response_format: { type: 'json_object' },
      },
      {
        headers: {
          Authorization: `Bearer ${this.groqKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 25000,
      }
    );

    const content = response.data?.choices?.[0]?.message?.content || '{}';
    const cleanJson = sanitizeJsonText(content);

    try {
      return JSON.parse(cleanJson) as T;
    } catch (parseErr) {
      throw new Error(
        `Groq returned invalid JSON: ${parseErr instanceof Error ? parseErr.message : String(parseErr)}`
      );
    }
  }

  /**
   * Deterministic mock engine for tests and running with no API keys.
   * Parses requirements from text directly and constructs valid kits.
   */
  private async callMock<T>(options: LLMGenerateOptions): Promise<T> {
    const prompt = options.userPrompt;

    // Check if this is an extraction call
    if (options.systemPrompt.includes('expert technical recruiter')) {
      const lines = prompt
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0 && !l.startsWith('JOB DESCRIPTION:'));

      let title = 'Software Engineer';
      let seniority = 'Mid-level';

      const firstLine = lines[0] || '';
      if (firstLine.length < 80) {
        title = firstLine;
        if (/senior|lead|staff|principal/i.test(firstLine)) seniority = 'Senior';
        else if (/junior|entry|intern/i.test(firstLine)) seniority = 'Junior';
      }

      const rawRequirements: string[] = [];
      for (const line of lines) {
        if (/^[-*•]|\d+\.|\b(experience with|knowledge of|proficient in|strong|hands-on|years|degree)\b/i.test(line)) {
          const cleaned = line.replace(/^[-*•\d.]\s*/, '').trim();
          if (cleaned.length > 5) {
            rawRequirements.push(cleaned);
          }
        }
      }

      // If no bullet points found (e.g. 2-line stub)
      if (rawRequirements.length === 0) {
        rawRequirements.push(lines.slice(1).join(' ').trim() || 'Software engineering principles and core delivery');
      }

      const requirements = rawRequirements.slice(0, 8).map((text, idx) => {
        const lower = text.toLowerCase();
        const isNice =
          lower.includes('bonus') ||
          lower.includes('nice to have') ||
          lower.includes('plus') ||
          lower.includes('preferred') ||
          lower.includes('optional');

        let kind: 'technical' | 'behavioural' | 'domain' = 'technical';
        if (lower.includes('lead') || lower.includes('mentor') || lower.includes('collaborat') || lower.includes('team') || lower.includes('agile')) {
          kind = 'behavioural';
        } else if (lower.includes('fintech') || lower.includes('healthcare') || lower.includes('compliance') || lower.includes('security') || lower.includes('saas')) {
          kind = 'domain';
        }

        return {
          id: `r${idx + 1}`,
          text,
          kind,
          priority: isNice ? 'nice' : 'must',
        };
      });

      return {
        title,
        seniority,
        responsibilities: [
          'Design, build, and maintain efficient, reusable, and reliable code',
          'Collaborate with cross-functional teams to define, design, and ship new features',
        ],
        requirements,
      } as unknown as T;
    }

    // Company brief call
    if (options.systemPrompt.includes('corporate research analyst')) {
      const companyMatch = prompt.match(/COMPANY NAME:\s*([^\n]+)/);
      const compName = companyMatch ? companyMatch[1].trim() : 'The Company';

      return {
        summary: `${compName} builds innovative software solutions with an engineering-first culture.`,
        what_they_do: `${compName} develops modern web and backend platforms to serve customer needs.`,
      } as unknown as T;
    }

    // Category questions call or second pass call
    if (options.systemPrompt.includes('interviewer') || options.systemPrompt.includes('coverage auditor')) {
      const reqMatches = [...prompt.matchAll(/"id":\s*"([^"]+)",\s*"text":\s*"([^"]+)"/g)];
      const reqList = reqMatches.map((m) => ({ id: m[1], text: m[2] }));

      // If regex match didn't find them, default to r1
      const effectiveReqs = reqList.length > 0 ? reqList : [{ id: 'r1', text: 'Core engineering competence' }];

      const isBehavioural = options.systemPrompt.includes('behavioural');
      const isSystemDesign = options.systemPrompt.includes('system-design');
      const isCompanyFit = options.systemPrompt.includes('company-fit');

      const category = isCompanyFit
        ? 'company-fit'
        : isSystemDesign
        ? 'system-design'
        : isBehavioural
        ? 'behavioural'
        : 'technical';

      const questions = effectiveReqs.map((req, idx) => ({
        id: `q${idx + 1}`,
        requirement_ids: [req.id],
        category,
        prompt: isBehavioural
          ? `Describe a challenging project where you demonstrated: ${req.text}. What was the outcome?`
          : isSystemDesign
          ? `How would you architect a fault-tolerant system around: ${req.text}?`
          : `Can you explain your deep-dive experience and trade-offs when working with: ${req.text}?`,
        answer_outline:
          '1. Clarify requirements and key constraints.\n2. Walk through architecture/approach with concrete examples.\n3. Discuss edge cases, trade-offs, and lessons learned.',
        difficulty: (idx % 3) + 1,
      }));

      const flashcards = effectiveReqs.map((req, idx) => ({
        id: `f${idx + 1}`,
        front: `Key concepts & principles: ${req.text}`,
        back: `Core architectural best practices, syntax nuances, and common pitfall mitigations for ${req.text}.`,
        requirement_ids: [req.id],
      }));

      return { questions, flashcards } as unknown as T;
    }

    return {} as unknown as T;
  }
}

export const defaultLLMClient = new LLMClient();
