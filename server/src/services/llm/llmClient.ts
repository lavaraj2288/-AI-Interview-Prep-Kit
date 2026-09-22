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
      const rawJd = prompt.replace(/^JOB DESCRIPTION:\s*/i, '').trim();
      const rawLines = rawJd
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

      let title = 'Software Engineer';
      let seniority = 'Mid-level';

      const firstLine = rawLines[0] || '';
      if (firstLine.length < 90) {
        title = firstLine.replace(/^(job title|role|position):\s*/i, '').trim();
        if (/\b(senior|sr\.?)\b/i.test(firstLine)) seniority = 'Senior';
        else if (/\b(staff|principal|architect|director)\b/i.test(firstLine)) seniority = 'Lead';
        else if (/\b(lead|team lead|tech lead)\b/i.test(firstLine)) seniority = 'Lead';
        else if (/\b(junior|jr\.?|entry|intern|associate)\b/i.test(firstLine)) seniority = 'Junior';
      }

      // Sentence and bullet point parser
      const extractedChunks: Array<{ text: string; isNice: boolean }> = [];

      for (let i = 0; i < rawLines.length; i++) {
        const line = rawLines[i];
        if (i === 0 && line === title) continue; // Skip title header

        // Split line into sentences or clauses
        const sentences = line
          .split(/(?<=[.?!;])\s+/)
          .map((s) => s.trim())
          .filter((s) => s.length > 3);

        for (const sentence of sentences) {
          // Check if sentence has multiple distinct clauses (e.g. "Must have X. Bonus points for Y")
          const bonusIndex = sentence.search(/\b(bonus points for|nice to have|plus:|preferred:|optional:)\b/i);
          if (bonusIndex > 0) {
            const part1 = sentence.slice(0, bonusIndex).trim();
            const part2 = sentence.slice(bonusIndex).trim();
            if (part1.length > 3) extractedChunks.push({ text: part1, isNice: false });
            if (part2.length > 3) extractedChunks.push({ text: part2, isNice: true });
          } else {
            const isNice = /\b(bonus|nice to have|plus|preferred|desirable|optional|good to have|advantageous)\b/i.test(sentence);
            extractedChunks.push({ text: sentence, isNice });
          }
        }
      }

      // Filter and clean extracted requirement chunks
      const parsedReqs: Array<{ text: string; kind: 'technical' | 'behavioural' | 'domain'; priority: 'must' | 'nice' }> = [];

      for (const chunk of extractedChunks) {
        let cleanText = chunk.text
          .replace(/^[-*•\d.]+\s*/, '') // remove bullets
          .replace(/^(we are looking for|must have|should have|looking for|requirements?|responsibilities?|bonus points for|nice to have|plus:)\s*/i, '')
          .replace(/^(an experienced developer with|experience with|proficient in|solid knowledge of|strong background in)\s+/i, '')
          .replace(/[.,;:!?]+$/, '')
          .trim();

        // If chunk is still long and contains conjunctions linking distinct skills (e.g. "X and mentoring skills"), split it
        if (cleanText.length > 10 && /\b(and mentoring|and leadership|and strong)\b/i.test(cleanText)) {
          const subParts = cleanText.split(/\b(?=and\s+(?:mentoring|leadership|strong))\b/i);
          for (const sub of subParts) {
            let subClean = sub.replace(/^and\s+/i, '').replace(/[.,;:!?]+$/, '').trim();
            if (subClean.length > 3) {
              const lower = subClean.toLowerCase();
              let kind: 'technical' | 'behavioural' | 'domain' = 'technical';
              if (/\b(lead|mentor\w*|collaborat\w*|communicat\w*|team|agile|cross-functional|stakeholder|ownership|initiative|empathy|conflict)\b/i.test(lower)) {
                kind = 'behavioural';
              } else if (/\b(fintech|healthcare|ecommerce|saas|compliance|security|gdpr|banking|payments?|crypto|ai\/ml|infra|devops|cloud)\b/i.test(lower)) {
                kind = 'domain';
              }
              parsedReqs.push({
                text: subClean,
                kind,
                priority: chunk.isNice ? 'nice' : 'must',
              });
            }
          }
          continue;
        }

        if (cleanText.length < 5) continue;

        const lower = cleanText.toLowerCase();
        let kind: 'technical' | 'behavioural' | 'domain' = 'technical';
        if (/\b(lead|mentor\w*|collaborat\w*|communicat\w*|team|agile|cross-functional|stakeholder|ownership|initiative|empathy|conflict)\b/i.test(lower)) {
          kind = 'behavioural';
        } else if (/\b(fintech|healthcare|ecommerce|saas|compliance|security|gdpr|banking|payments?|crypto|ai\/ml|infra|devops|cloud)\b/i.test(lower)) {
          kind = 'domain';
        }

        parsedReqs.push({
          text: cleanText,
          kind,
          priority: chunk.isNice ? 'nice' : 'must',
        });
      }

      // If nothing extracted (stub JD), parse lines directly without hallucinating
      if (parsedReqs.length === 0) {
        const stubText = rawLines.slice(1).join(' ').trim() || 'Software engineering principles and core delivery';
        // Check if stub mentions multiple items like "Python APIs and PostgreSQL databases"
        if (stubText.includes(' and ')) {
          const parts = stubText.split(/\band\b/i);
          for (const p of parts) {
            const pt = p.trim();
            if (pt.length > 3) {
              parsedReqs.push({ text: pt, kind: 'technical', priority: 'must' });
            }
          }
        } else {
          parsedReqs.push({ text: stubText, kind: 'technical', priority: 'must' });
        }
      }

      // Assign sequential stable IDs
      const requirements = parsedReqs.slice(0, 10).map((r, idx) => ({
        id: `r${idx + 1}`,
        text: r.text,
        kind: r.kind,
        priority: r.priority,
      }));

      return {
        title,
        seniority,
        responsibilities: [
          'Design, build, and maintain efficient, scalable, and reliable software components',
          'Collaborate with cross-functional stakeholders to define, scope, and deliver business initiatives',
          'Uphold high standards of code hygiene, test coverage, and documentation',
        ],
        requirements,
      } as unknown as T;
    }

    // Company brief call
    if (options.systemPrompt.includes('corporate research analyst')) {
      const companyMatch = prompt.match(/COMPANY NAME:\s*([^\n]+)/);
      const compName = companyMatch ? companyMatch[1].trim() : 'The Company';

      return {
        summary: `${compName} builds innovative software solutions with an engineering-first culture and high-velocity delivery.`,
        what_they_do: `${compName} develops modern web, cloud, and distributed backend platforms to serve customer needs.`,
      } as unknown as T;
    }

    // Mock interview evaluation call
    if (
      options.systemPrompt.includes('evaluating a candidate') ||
      options.systemPrompt.includes('RUBRIC') ||
      options.systemPrompt.includes('principal engineering interviewer evaluating')
    ) {
      return {
        overallScore: 86,
        accuracyScore: 88,
        communicationScore: 84,
        strengths: [
          'Addressed core technical constraints and trade-offs directly with practical considerations.',
          'Demonstrated clear architectural structure and logical step-by-step problem breakdown.',
        ],
        improvements: [
          'Elaborate more quantitatively on throughput, latency, and edge failure recovery.',
          'State edge case failure modes upfront before diving into the primary design path.',
        ],
        feedback:
          'Strong response overall. Demonstrated solid competence and structured reasoning aligned with the role expectations.',
        followUpQuestion: 'How would your approach adapt if traffic surged by 50x within a 5-minute window?',
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
          ? `How would you architect a fault-tolerant, scalable system around: ${req.text}?`
          : isCompanyFit
          ? `How do your experience and approach with ${req.text} align with our company culture and delivery standards?`
          : `Can you explain your deep-dive experience, internal mechanics, and trade-offs when working with: ${req.text}?`,
        answer_outline:
          '1. Clarify requirements, constraints, and baseline assumptions.\n2. Walk through architecture/implementation with concrete technical rationale.\n3. Discuss edge cases, failure modes, trade-offs, and lessons learned.',
        difficulty: isSystemDesign ? 3 : (idx % 3) + 1,
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
