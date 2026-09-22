import { CompanyCrawler } from '../crawler/companyCrawler.js';
import { DiscussionFinder } from '../crawler/discussionFinder.js';
import { LlmClient, defaultLlmClient } from '../llm/llmClient.js';
import { PROMPTS } from '../llm/prompts.js';
import { checkRequirementCoverage } from './coverageChecker.js';
import { allocateSchedule } from './scheduleAllocator.js';
import { validateAppendixAKit } from './kitValidator.js';
import {
  AppendixAKit,
  KitRole,
  KitRequirement,
  KitQuestion,
  KitFlashcard,
  CompanyBrief,
  KitSource
} from '../../types/kit.js';

export interface GenerationProgressCallback {
  (step: string, percent: number, details?: string): void;
}

export class KitPipelineOrchestrator {
  private crawler: CompanyCrawler;
  private discussionFinder: DiscussionFinder;
  private llm: LlmClient;

  constructor(llmClient?: LlmClient) {
    this.crawler = new CompanyCrawler();
    this.discussionFinder = new DiscussionFinder();
    this.llm = llmClient || defaultLlmClient;
  }

  async runPipeline(params: {
    jd: string;
    companyUrl: string;
    days: number;
    companyName?: string;
    onProgress?: GenerationProgressCallback;
  }): Promise<AppendixAKit> {
    const { jd, companyUrl, days, onProgress } = params;
    const progress = onProgress || (() => {});

    // ----------------------------------------------------
    // Step 1: Extract Role & Requirements from JD
    // (Section 3: Pasted text needs no retrieval at all)
    // ----------------------------------------------------
    progress('extracting_requirements', 15, 'Analyzing job description for technical, behavioural, and domain requirements...');
    const extractedRole = await this.extractRoleAndRequirements(jd);

    // ----------------------------------------------------
    // Step 2: Crawl Company Website
    // (Section 3: A company homepage needs crawling before it is useful)
    // ----------------------------------------------------
    progress('crawling_company', 30, `Crawling company site at ${companyUrl} to find hiring practices and company context...`);
    const crawlerResult = await this.crawler.crawlCompanySite(companyUrl);

    // ----------------------------------------------------
    // Step 3: Search Public Discussion
    // (Section 3: Look for public discussion of how the company interviews)
    // ----------------------------------------------------
    progress('researching_discussions', 45, 'Checking public interview experiences and community feedback...');
    const inferredCompanyName = params.companyName || this.inferCompanyName(companyUrl, jd);
    const discussions = await this.discussionFinder.findDiscussions(inferredCompanyName);

    // Combine crawled text
    const aggregatedCrawledText = crawlerResult.pages.map(p => `--- ${p.title} (${p.url}) ---\n${p.text}`).join('\n\n');
    const pagesUsed = crawlerResult.pages.map(p => p.url);

    // ----------------------------------------------------
    // Step 4: Generate Company Brief
    // (Section 10: Honest brief if nothing found)
    // ----------------------------------------------------
    progress('generating_brief', 55, 'Synthesizing company brief and hiring process details...');
    const companyBrief = await this.generateCompanyBrief(
      inferredCompanyName,
      companyUrl,
      aggregatedCrawledText,
      discussions.findings,
      pagesUsed
    );

    // ----------------------------------------------------
    // Step 5: Categorized Question Generation (Pass 1)
    // (Section 3: Technical vs Behavioural come from separate instructions)
    // ----------------------------------------------------
    progress('generating_questions', 70, 'Generating specialized technical, behavioural, system design, and company fit questions...');
    let questions = await this.generateCategorizedQuestions(
      extractedRole,
      companyBrief.summary,
      crawlerResult.hiringPageFound
    );

    // ----------------------------------------------------
    // Step 6: Generate Flashcards
    // ----------------------------------------------------
    progress('generating_flashcards', 80, 'Creating quick-recall flashcards for core concepts...');
    const flashcards = await this.generateFlashcards(extractedRole.requirements, questions);

    // ----------------------------------------------------
    // Step 7: Deterministic Coverage Check & Second Pass
    // (Section 3 & 4: Deterministic code gap analysis)
    // ----------------------------------------------------
    progress('checking_coverage', 85, 'Running deterministic requirement coverage check (Pass 1)...');
    let coverage = checkRequirementCoverage(extractedRole.requirements, questions);
    let passes = 1;

    // Second Pass: If must-have requirements remain uncovered, generate targeted questions
    if (coverage.uncoveredMustHaves.length > 0 && passes < 2) {
      progress('second_pass_generation', 90, `Second pass: Closing coverage gap for ${coverage.uncoveredMustHaves.length} must-have requirement(s)...`);
      const gapQuestions = await this.generateGapClosingQuestions(
        coverage.uncoveredMustHaves,
        extractedRole.title,
        questions.length + 1
      );

      // Append new gap-closing questions
      questions = [...questions, ...gapQuestions];
      passes = 2;

      // Re-run deterministic coverage check
      coverage = checkRequirementCoverage(extractedRole.requirements, questions);
    }

    // ----------------------------------------------------
    // Step 8: Deterministic Arithmetic Schedule Allocation
    // (Section 3 & 8: Belongs in code, not in a prompt)
    // ----------------------------------------------------
    progress('allocating_schedule', 95, `Calculating day-by-day study schedule across ${days} day(s)...`);
    const schedule = allocateSchedule(days, questions, extractedRole.requirements);

    // Assemble source metadata
    const source: KitSource = {
      company: inferredCompanyName,
      company_url: companyUrl,
      role: extractedRole.title,
      location: this.extractLocation(jd),
      jd_chars: jd.length,
      researched_at: new Date().toISOString(),
      pages_used: pagesUsed.length > 0 ? pagesUsed : [companyUrl]
    };

    const generatedKit: AppendixAKit = {
      source,
      company_brief: companyBrief,
      role: extractedRole,
      questions,
      flashcards,
      schedule,
      coverage: {
        uncovered_requirement_ids: coverage.uncoveredRequirementIds,
        passes
      }
    };

    // ----------------------------------------------------
    // Step 9: Validate Kit Structure (Appendix A)
    // ----------------------------------------------------
    progress('validating_kit', 98, 'Verifying generated kit against Appendix A schema...');
    const validation = validateAppendixAKit(generatedKit);
    if (!validation.valid) {
      console.warn('[Orchestrator] Kit schema validation warnings:', validation.errors);
    }

    progress('completed', 100, 'Interview prep kit generation complete!');
    return validation.valid && validation.data ? validation.data : generatedKit;
  }

  /**
   * Step 1: Extract Role & Requirements
   */
  private async extractRoleAndRequirements(jd: string): Promise<KitRole> {
    const prompt = PROMPTS.EXTRACT_ROLE_AND_REQUIREMENTS(jd);

    const fallback = (): KitRole => {
      return this.deterministicExtractRoleAndRequirements(jd);
    };

    try {
      const parsed = await this.llm.generateJson<KitRole>(prompt, fallback);
      if (parsed && Array.isArray(parsed.requirements) && parsed.requirements.length > 0) {
        // Normalize requirement IDs to stable r1, r2...
        parsed.requirements = parsed.requirements.map((r, i) => ({
          id: `r${i + 1}`,
          text: r.text || `Requirement ${i + 1}`,
          kind: (['technical', 'behavioural', 'domain'].includes(r.kind) ? r.kind : 'technical') as any,
          priority: (r.priority === 'must' || r.priority === 'nice' ? r.priority : 'must') as any
        }));
        return parsed;
      }
      return fallback();
    } catch {
      return fallback();
    }
  }

  /**
   * Deterministic fallback requirement extractor
   * Accurately distinguishes must vs nice, technical vs behavioural, and preserves thin JDs
   */
  public deterministicExtractRoleAndRequirements(jd: string): KitRole {
    const lines = jd.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    const titleLine = lines[0] || 'Software Professional';
    let title = titleLine.replace(/^#+\s*/, '').slice(0, 80);
    if (title.length < 3) title = 'Software Engineer';

    let seniority = 'Mid-Senior';
    const lowerJd = jd.toLowerCase();
    if (lowerJd.includes('lead') || lowerJd.includes('principal') || lowerJd.includes('staff')) seniority = 'Lead / Staff';
    else if (lowerJd.includes('senior') || lowerJd.includes('sr.')) seniority = 'Senior';
    else if (lowerJd.includes('junior') || lowerJd.includes('associate') || lowerJd.includes('entry')) seniority = 'Junior';

    const responsibilities: string[] = [];
    const requirements: KitRequirement[] = [];

    // Filter candidate requirement lines
    const bulletCandidates = lines.filter(l =>
      l.startsWith('-') ||
      l.startsWith('•') ||
      l.startsWith('*') ||
      /^\d+[\.\)]\s/.test(l) ||
      l.toLowerCase().includes('year') ||
      l.toLowerCase().includes('experience') ||
      l.toLowerCase().includes('proficien') ||
      l.toLowerCase().includes('knowledge of') ||
      l.toLowerCase().includes('degree')
    );

    // If description is a thin 2-line stub, extract strictly what is present without hallucination
    const targets = bulletCandidates.length > 0 ? bulletCandidates : lines.slice(1, 4);

    let reqIndex = 1;
    for (const rawLine of targets) {
      const cleanLine = rawLine.replace(/^[-•*]\s*/, '').replace(/^\d+[\.\)]\s*/, '').trim();
      if (cleanLine.length < 5) continue;

      const lower = cleanLine.toLowerCase();

      // Priority classification: must vs nice
      const isNice = lower.includes('plus') ||
        lower.includes('bonus') ||
        lower.includes('preferred') ||
        lower.includes('nice to have') ||
        lower.includes('good to have') ||
        lower.includes('desirable');
      const priority = isNice ? 'nice' : 'must';

      // Kind classification: technical vs behavioural vs domain
      let kind: 'technical' | 'behavioural' | 'domain' = 'technical';
      if (
        lower.includes('mentor') ||
        lower.includes('communication') ||
        lower.includes('collaborat') ||
        lower.includes('team') ||
        lower.includes('lead') ||
        lower.includes('empathy') ||
        lower.includes('stakeholder')
      ) {
        kind = 'behavioural';
      } else if (
        lower.includes('fintech') ||
        lower.includes('healthcare') ||
        lower.includes('banking') ||
        lower.includes('compliance') ||
        lower.includes('ecommerce') ||
        lower.includes('domain') ||
        lower.includes('regulat')
      ) {
        kind = 'domain';
      }

      requirements.push({
        id: `r${reqIndex++}`,
        text: cleanLine,
        kind,
        priority
      });

      if (requirements.length >= 12) break;
    }

    // Extract responsibilities
    const respCandidates = lines.filter(l =>
      l.toLowerCase().includes('build') ||
      l.toLowerCase().includes('design') ||
      l.toLowerCase().includes('develop') ||
      l.toLowerCase().includes('manage') ||
      l.toLowerCase().includes('maintain')
    ).slice(0, 4);

    responsibilities.push(...respCandidates.map(c => c.replace(/^[-•*]\s*/, '').trim()));
    if (responsibilities.length === 0) {
      responsibilities.push('Collaborate with cross-functional teams to deliver high-quality solutions.');
    }

    // If literally no requirements found (e.g. empty/one-line text), create honest 1-line requirement
    if (requirements.length === 0) {
      requirements.push({
        id: 'r1',
        text: lines.slice(1).join(' ').trim() || 'Software engineering proficiency',
        kind: 'technical',
        priority: 'must'
      });
    }

    return {
      title,
      seniority,
      responsibilities,
      requirements
    };
  }

  /**
   * Step 4: Generate Company Brief
   */
  private async generateCompanyBrief(
    companyName: string,
    companyUrl: string,
    crawledText: string,
    publicFindings: string[],
    pagesUsed: string[]
  ): Promise<CompanyBrief> {
    const fallback = (): CompanyBrief => {
      if (!crawledText || crawledText.length < 50) {
        return {
          summary: `${companyName} is a technology company. Limited public information was directly discoverable at the provided domain.`,
          what_they_do: `Based on initial discovery, ${companyName} operates at ${companyUrl}. Specific hiring guidelines or engineering handbooks were not publicly exposed.`,
          sources: pagesUsed.length > 0 ? pagesUsed : [companyUrl]
        };
      }
      const preview = crawledText.slice(0, 300).replace(/\n+/g, ' ');
      return {
        summary: `${companyName} build modern digital solutions. Research indicates focus on scalable services and user-centric software.`,
        what_they_do: preview,
        sources: pagesUsed.length > 0 ? pagesUsed : [companyUrl]
      };
    };

    const prompt = PROMPTS.GENERATE_COMPANY_BRIEF(companyName, companyUrl, crawledText, publicFindings);

    try {
      const result = await this.llm.generateJson<CompanyBrief>(prompt, fallback);
      if (result && result.summary && result.what_they_do) {
        result.sources = pagesUsed.length > 0 ? pagesUsed : [companyUrl];
        return result;
      }
      return fallback();
    } catch {
      return fallback();
    }
  }

  /**
   * Step 5: Categorized Question Generation (Pass 1)
   */
  private async generateCategorizedQuestions(
    role: KitRole,
    companyBrief: string,
    hasHiringPage: boolean
  ): Promise<KitQuestion[]> {
    const categories: Array<'technical' | 'behavioural' | 'system-design' | 'company-fit'> = [
      'technical',
      'system-design',
      'behavioural',
      'company-fit'
    ];

    let allQuestions: KitQuestion[] = [];
    let qCounter = 1;

    for (const cat of categories) {
      // Find requirements matching this category or relevant
      let targetReqs: KitRequirement[] = [];
      if (cat === 'technical') {
        targetReqs = role.requirements.filter(r => r.kind === 'technical');
      } else if (cat === 'behavioural') {
        targetReqs = role.requirements.filter(r => r.kind === 'behavioural');
      } else if (cat === 'system-design') {
        targetReqs = role.requirements.filter(r => r.kind === 'technical' || r.kind === 'domain');
      } else {
        // company-fit
        targetReqs = role.requirements.filter(r => r.kind === 'domain' || r.kind === 'behavioural');
      }

      // If category has no specific requirements, link to first must-have requirement
      if (targetReqs.length === 0 && role.requirements.length > 0) {
        targetReqs = [role.requirements[0]];
      }

      const prompt = PROMPTS.GENERATE_CATEGORY_QUESTIONS(
        cat,
        targetReqs,
        companyBrief,
        role.title,
        qCounter
      );

      const fallback = (): KitQuestion[] => {
        return this.deterministicCategoryQuestions(cat, targetReqs, role.title, qCounter);
      };

      try {
        const catQuestions = await this.llm.generateJson<KitQuestion[]>(prompt, fallback);
        if (Array.isArray(catQuestions) && catQuestions.length > 0) {
          const validated = catQuestions.map(q => ({
            id: `q${qCounter++}`,
            requirement_ids: Array.isArray(q.requirement_ids) && q.requirement_ids.length > 0
              ? q.requirement_ids
              : targetReqs.map(r => r.id),
            category: cat,
            prompt: q.prompt || `${cat.toUpperCase()} assessment question`,
            answer_outline: q.answer_outline || 'Outline key trade-offs, architecture, and examples.',
            difficulty: ([1, 2, 3].includes(q.difficulty) ? q.difficulty : 2) as 1 | 2 | 3
          }));
          allQuestions.push(...validated);
        } else {
          const fb = fallback();
          qCounter += fb.length;
          allQuestions.push(...fb);
        }
      } catch {
        const fb = fallback();
        qCounter += fb.length;
        allQuestions.push(...fb);
      }
    }

    return allQuestions;
  }

  /**
   * Deterministic question generator for offline/fallback
   */
  private deterministicCategoryQuestions(
    cat: 'technical' | 'behavioural' | 'system-design' | 'company-fit',
    targetReqs: KitRequirement[],
    roleTitle: string,
    startIndex: number
  ): KitQuestion[] {
    const list: KitQuestion[] = [];
    let idx = startIndex;

    for (const req of targetReqs.slice(0, 3)) {
      let promptText = '';
      let outlineText = '';
      let diff: 1 | 2 | 3 = 2;

      if (cat === 'technical') {
        promptText = `Explain the core principles and common pitfalls when working with: "${req.text}". How do you ensure high performance and maintainability?`;
        outlineText = `1. Explain core mechanisms. 2. Discuss memory/runtime complexity and failure modes. 3. Detail automated testing strategies.`;
        diff = req.priority === 'must' ? 3 : 2;
      } else if (cat === 'system-design') {
        promptText = `Design a resilient, scalable subsystem addressing requirement: "${req.text}". What data models and APIs would you implement?`;
        outlineText = `1. Identify bottlenecks & throughput. 2. Partitioning / caching patterns. 3. Fault-tolerance & monitoring.`;
        diff = 3;
      } else if (cat === 'behavioural') {
        promptText = `Tell me about a time you demonstrated strong capability in: "${req.text}". What was the situation, your specific action, and the measurable outcome?`;
        outlineText = `Use STAR format: Situation, Task, Action, and measurable Result. Highlight communication and conflict resolution.`;
        diff = 2;
      } else {
        // company-fit
        promptText = `How do your past engineering experiences and approach to "${req.text}" align with our team's mission and culture?`;
        outlineText = `Connect technical values to business objectives. Emphasize adaptability, continuous learning, and cross-team empathy.`;
        diff = 1;
      }

      list.push({
        id: `q${idx++}`,
        requirement_ids: [req.id],
        category: cat,
        prompt: promptText,
        answer_outline: outlineText,
        difficulty: diff
      });
    }

    if (list.length === 0 && targetReqs.length > 0) {
      list.push({
        id: `q${idx++}`,
        requirement_ids: [targetReqs[0].id],
        category: cat,
        prompt: `Core ${cat} evaluation: How do you approach ${targetReqs[0].text}?`,
        answer_outline: 'Structured response with practical examples.',
        difficulty: 2
      });
    }

    return list;
  }

  /**
   * Step 6: Generate Flashcards
   */
  private async generateFlashcards(
    requirements: KitRequirement[],
    questions: KitQuestion[]
  ): Promise<KitFlashcard[]> {
    const prompt = PROMPTS.GENERATE_FLASHCARDS(requirements, questions, 1);

    const fallback = (): KitFlashcard[] => {
      return requirements.map((req, i) => ({
        id: `f${i + 1}`,
        front: `Key Concept: What are the fundamental considerations when implementing "${req.text}"?`,
        back: `Core architectural trade-offs, standard patterns, operational constraints, and edge-case handling for ${req.text}.`,
        requirement_ids: [req.id]
      }));
    };

    try {
      const parsed = await this.llm.generateJson<KitFlashcard[]>(prompt, fallback);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((f, i) => ({
          id: `f${i + 1}`,
          front: f.front || `Flashcard ${i + 1}`,
          back: f.back || `Key notes on requirement`,
          requirement_ids: Array.isArray(f.requirement_ids) && f.requirement_ids.length > 0
            ? f.requirement_ids
            : [requirements[i % requirements.length]?.id || 'r1']
        }));
      }
      return fallback();
    } catch {
      return fallback();
    }
  }

  /**
   * Step 7 (Pass 2): Generate Gap-Closing Questions
   */
  private async generateGapClosingQuestions(
    uncoveredMustHaves: KitRequirement[],
    roleTitle: string,
    startIndex: number
  ): Promise<KitQuestion[]> {
    const prompt = PROMPTS.GENERATE_GAP_CLOSING_QUESTIONS(uncoveredMustHaves, roleTitle, startIndex);

    const fallback = (): KitQuestion[] => {
      return uncoveredMustHaves.map((req, i) => {
        const cat: 'technical' | 'behavioural' | 'system-design' | 'company-fit' =
          req.kind === 'behavioural' ? 'behavioural' : 'technical';
        return {
          id: `q${startIndex + i}`,
          requirement_ids: [req.id],
          category: cat,
          prompt: `[Coverage Gap Drill] Deep-dive into must-have requirement: "${req.text}". How do you demonstrate mastery here?`,
          answer_outline: `Detailed breakdown of ${req.text}, real-world scenarios, and key technical/behavioural points.`,
          difficulty: (req.priority === 'must' ? 3 : 2) as 1 | 2 | 3
        };
      });
    };

    try {
      const parsed = await this.llm.generateJson<KitQuestion[]>(prompt, fallback);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((q, i) => ({
          id: `q${startIndex + i}`,
          requirement_ids: Array.isArray(q.requirement_ids) && q.requirement_ids.length > 0
            ? q.requirement_ids
            : [uncoveredMustHaves[i % uncoveredMustHaves.length].id],
          category: (['technical', 'behavioural', 'system-design', 'company-fit'].includes(q.category)
            ? q.category
            : 'technical') as any,
          prompt: q.prompt || `Targeted question for ${uncoveredMustHaves[i % uncoveredMustHaves.length]?.text}`,
          answer_outline: q.answer_outline || 'Structured outline.',
          difficulty: ([1, 2, 3].includes(q.difficulty) ? q.difficulty : 2) as 1 | 2 | 3
        }));
      }
      return fallback();
    } catch {
      return fallback();
    }
  }

  private inferCompanyName(url: string, jd: string): string {
    try {
      const parsed = new URL(url);
      const hostParts = parsed.hostname.replace(/^www\./, '').split('.');
      if (hostParts.length > 0 && hostParts[0] !== 'localhost') {
        const name = hostParts[0];
        return name.charAt(0).toUpperCase() + name.slice(1);
      }
    } catch {
      // ignore
    }

    // Infer from JD first 2 lines
    const match = jd.match(/(?:at|about|join)\s+([A-Z][A-Za-z0-9]+)/);
    if (match && match[1]) {
      return match[1];
    }

    return 'Company';
  }

  private extractLocation(jd: string): string {
    const locationMatch = jd.match(/(?:Location|Based in|Workplace):\s*([^\n]+)/i) ||
      jd.match(/\b(Remote|Hybrid|New York|San Francisco|London|Bengaluru|Berlin|Austin)\b/i);
    return locationMatch ? locationMatch[1].trim() : 'Remote / Unspecified';
  }
}
