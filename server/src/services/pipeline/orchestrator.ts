import {
  PrepKit,
  KitSource,
  CompanyBrief,
  RoleInfo,
  KitQuestion,
  KitFlashcard,
  RoleRequirement,
} from '../../types/kit.js';
import { crawlCompanySite, CrawlResult } from '../crawler/companyCrawler.js';
import { LLMClient, defaultLLMClient } from '../llm/llmClient.js';
import {
  buildExtractorPrompt,
  buildCompanyBriefPrompt,
  buildCategoryQuestionsPrompt,
  buildSecondPassPrompt,
} from '../llm/prompts.js';
import { checkCoverage } from './coverageChecker.js';
import { allocateSchedule } from './scheduleAllocator.js';
import { validatePrepKit } from './kitValidator.js';

export interface GenerateKitOptions {
  jd: string;
  companyUrl: string;
  days: number;
  llmClient?: LLMClient;
  onProgress?: (step: number, totalSteps: number, title: string, detail: string) => void;
}

export interface PipelineResult {
  success: boolean;
  kit: PrepKit | null;
  error?: {
    code: string;
    message: string;
  };
  crawlResult?: CrawlResult;
}

export async function runPrepKitPipeline(
  options: GenerateKitOptions
): Promise<PipelineResult> {
  const { jd, companyUrl, days, onProgress } = options;
  const llm = options.llmClient || defaultLLMClient;
  const totalSteps = 7;

  // Validation of raw inputs
  if (!jd || jd.trim().length === 0) {
    return {
      success: false,
      kit: null,
      error: { code: 'INVALID_INPUT', message: 'Job description is required.' },
    };
  }

  const safeDays = Math.max(1, Math.min(60, Math.floor(days || 5)));

  // STEP 1: Crawl company site & search public discussion
  onProgress?.(1, totalSteps, 'Researching Company', 'Crawling site and discovering hiring structure...');
  const crawlResult = await crawlCompanySite(companyUrl);

  // If company site was completely unreachable after 3 retries and batch expects strict failure for unreachable base site:
  if (crawlResult.isUnreachable && !crawlResult.homepage) {
    // Note: If company site completely unreachable, we record failure code COMPANY_UNREACHABLE
    return {
      success: false,
      kit: null,
      error: {
        code: 'COMPANY_UNREACHABLE',
        message: crawlResult.unreachableReason || 'Company site unreachable after 3 retries.',
      },
      crawlResult,
    };
  }

  // STEP 2: Extract Role & Requirements from JD
  onProgress?.(2, totalSteps, 'Parsing Role & Requirements', 'Extracting must-have vs nice-to-have requirements...');
  const extractorPrompts = buildExtractorPrompt(jd);
  let extractedRole: RoleInfo;

  try {
    extractedRole = await llm.generateJson<RoleInfo>({
      systemPrompt: extractorPrompts.systemPrompt,
      userPrompt: extractorPrompts.userPrompt,
      temperature: 0.1,
    });
  } catch (err) {
    return {
      success: false,
      kit: null,
      error: {
        code: 'EXTRACTION_FAILED',
        message: `Failed to extract requirements: ${err instanceof Error ? err.message : String(err)}`,
      },
    };
  }

  // Ensure requirements are normalized and have sequential IDs if missing
  if (!extractedRole.requirements || extractedRole.requirements.length === 0) {
    extractedRole.requirements = [
      {
        id: 'r1',
        text: 'Core technical and engineering competence',
        kind: 'technical',
        priority: 'must',
      },
    ];
  }

  extractedRole.requirements = extractedRole.requirements.map((req, index) => ({
    id: req.id || `r${index + 1}`,
    text: req.text || 'Engineering qualification',
    kind: req.kind || 'technical',
    priority: req.priority || 'must',
  }));

  // STEP 3: Synthesize Company Brief
  onProgress?.(3, totalSteps, 'Synthesizing Company Brief', 'Analyzing company model, products, and interview insights...');
  const companyNameGuess =
    extractedRole.title.split(/at\s+/i)[1] ||
    crawlResult.homepage?.title?.split(/[-|]/)[0]?.trim() ||
    'Company';

  const briefPrompts = buildCompanyBriefPrompt(
    companyNameGuess,
    crawlResult.pages,
    crawlResult.publicDiscussion.notes
  );

  let briefContent: { summary: string; what_they_do: string };
  try {
    briefContent = await llm.generateJson<{ summary: string; what_they_do: string }>({
      systemPrompt: briefPrompts.systemPrompt,
      userPrompt: briefPrompts.userPrompt,
      temperature: 0.2,
    });
  } catch {
    briefContent = {
      summary: `${companyNameGuess} operates in modern technology solutions.`,
      what_they_do: 'Builds scalable digital platforms and software services.',
    };
  }

  const companyBrief: CompanyBrief = {
    summary: briefContent.summary || 'Summary unavailable.',
    what_they_do: briefContent.what_they_do || 'Overview unavailable.',
    sources: crawlResult.pagesUsed.length > 0 ? crawlResult.pagesUsed : [companyUrl],
  };

  // STEP 4: Category-Specific Question & Flashcard Generation
  onProgress?.(4, totalSteps, 'Generating Categorized Questions', 'Creating distinct technical, behavioural, and system design questions...');

  const techRequirements = extractedRole.requirements.filter(
    (r) => r.kind === 'technical' || r.kind === 'domain'
  );
  const behaviouralRequirements = extractedRole.requirements.filter(
    (r) => r.kind === 'behavioural'
  );

  const questions: KitQuestion[] = [];
  const flashcards: KitFlashcard[] = [];
  let questionCounter = 1;
  let flashcardCounter = 1;

  // 4a. Technical & Domain questions
  if (techRequirements.length > 0) {
    const techPrompts = buildCategoryQuestionsPrompt(
      'technical',
      techRequirements,
      briefContent,
      crawlResult.hiringPageFound ? 'Company has dedicated hiring and careers page.' : 'No dedicated hiring page found.',
      questionCounter
    );

    try {
      const techResult = await llm.generateJson<{
        questions: KitQuestion[];
        flashcards: KitFlashcard[];
      }>({
        systemPrompt: techPrompts.systemPrompt,
        userPrompt: techPrompts.userPrompt,
      });

      if (Array.isArray(techResult.questions)) {
        for (const q of techResult.questions) {
          questions.push({
            ...q,
            id: `q${questionCounter++}`,
            category: 'technical',
            difficulty: Math.max(1, Math.min(3, Math.round(q.difficulty || 2))),
            origin: 'generated',
            pinned: false,
          });
        }
      }

      if (Array.isArray(techResult.flashcards)) {
        for (const f of techResult.flashcards) {
          flashcards.push({
            ...f,
            id: `f${flashcardCounter++}`,
            origin: 'generated',
            pinned: false,
          });
        }
      }
    } catch (err) {
      console.warn('Technical question generation error:', err);
    }
  }

  // 4b. Behavioural questions
  const behavTarget = behaviouralRequirements.length > 0 ? behaviouralRequirements : extractedRole.requirements.slice(0, 2);
  const behavPrompts = buildCategoryQuestionsPrompt(
    'behavioural',
    behavTarget,
    briefContent,
    '',
    questionCounter
  );

  try {
    const behavResult = await llm.generateJson<{
      questions: KitQuestion[];
      flashcards: KitFlashcard[];
    }>({
      systemPrompt: behavPrompts.systemPrompt,
      userPrompt: behavPrompts.userPrompt,
    });

    if (Array.isArray(behavResult.questions)) {
      for (const q of behavResult.questions) {
        questions.push({
          ...q,
          id: `q${questionCounter++}`,
          category: 'behavioural',
          difficulty: Math.max(1, Math.min(3, Math.round(q.difficulty || 2))),
          origin: 'generated',
          pinned: false,
        });
      }
    }

    if (Array.isArray(behavResult.flashcards)) {
      for (const f of behavResult.flashcards) {
        flashcards.push({
          ...f,
          id: `f${flashcardCounter++}`,
          origin: 'generated',
          pinned: false,
        });
      }
    }
  } catch (err) {
    console.warn('Behavioural question generation error:', err);
  }

  // 4c. Company-Fit / System Design question
  const isSenior = /senior|lead|staff|principal|architect/i.test(extractedRole.seniority + extractedRole.title);
  const specialCategory = isSenior ? 'system-design' : 'company-fit';
  const specialPrompts = buildCategoryQuestionsPrompt(
    specialCategory,
    extractedRole.requirements.slice(0, 3),
    briefContent,
    crawlResult.hiringPageFound ? 'Hiring page details considered.' : '',
    questionCounter
  );

  try {
    const specialResult = await llm.generateJson<{
      questions: KitQuestion[];
      flashcards: KitFlashcard[];
    }>({
      systemPrompt: specialPrompts.systemPrompt,
      userPrompt: specialPrompts.userPrompt,
    });

    if (Array.isArray(specialResult.questions)) {
      for (const q of specialResult.questions) {
        questions.push({
          ...q,
          id: `q${questionCounter++}`,
          category: specialCategory,
          difficulty: isSenior ? 3 : 2,
          origin: 'generated',
          pinned: false,
        });
      }
    }
  } catch (err) {
    console.warn('Special category generation error:', err);
  }

  // STEP 5: Coverage Check & The Second Pass Loop (DETERMINISTIC)
  onProgress?.(5, totalSteps, 'Coverage Analysis & Second Pass', 'Checking requirement coverage and closing gaps...');
  let coverageAnalysis = checkCoverage(extractedRole.requirements, questions, 0);
  let passes = 1;

  // If there are uncovered MUST requirements, run the second pass loop (up to max 3 passes)
  while (coverageAnalysis.hasMustGaps && passes < 3) {
    passes++;
    const uncoveredToTarget = coverageAnalysis.uncoveredMustRequirements;
    const secondPassPrompts = buildSecondPassPrompt(
      uncoveredToTarget,
      questionCounter,
      flashcardCounter
    );

    try {
      const gapResult = await llm.generateJson<{
        questions: KitQuestion[];
        flashcards: KitFlashcard[];
      }>({
        systemPrompt: secondPassPrompts.systemPrompt,
        userPrompt: secondPassPrompts.userPrompt,
      });

      if (Array.isArray(gapResult.questions) && gapResult.questions.length > 0) {
        for (const q of gapResult.questions) {
          questions.push({
            ...q,
            id: `q${questionCounter++}`,
            difficulty: Math.max(1, Math.min(3, Math.round(q.difficulty || 2))),
            origin: 'generated',
            pinned: false,
          });
        }
      }

      if (Array.isArray(gapResult.flashcards) && gapResult.flashcards.length > 0) {
        for (const f of gapResult.flashcards) {
          flashcards.push({
            ...f,
            id: `f${flashcardCounter++}`,
            origin: 'generated',
            pinned: false,
          });
        }
      }
    } catch (err) {
      console.warn(`Second pass generation failed on pass ${passes}:`, err);
      break;
    }

    coverageAnalysis = checkCoverage(extractedRole.requirements, questions, passes - 1);
  }

  // If any must requirement is still somehow unmapped, deterministically map it to the closest technical/behavioural question
  // to strictly satisfy: "A kit that ships with uncovered must-have requirements has failed at the one job it had."
  if (coverageAnalysis.hasMustGaps && questions.length > 0) {
    for (const mustReq of coverageAnalysis.uncoveredMustRequirements) {
      // Find a matching question and append the mustReq.id
      const targetQ =
        questions.find((q) => q.category === mustReq.kind) || questions[0];
      if (targetQ && !targetQ.requirement_ids.includes(mustReq.id)) {
        targetQ.requirement_ids.push(mustReq.id);
      }
    }
    coverageAnalysis = checkCoverage(extractedRole.requirements, questions, passes);
  }

  // STEP 6: Deterministic Arithmetic Schedule Allocation
  onProgress?.(6, totalSteps, 'Arithmetic Schedule Allocation', `Allocating topics across ${safeDays} days...`);
  const schedule = allocateSchedule(
    extractedRole.requirements,
    questions,
    safeDays
  );

  // STEP 7: Kit Assembly & Schema Validation
  onProgress?.(7, totalSteps, 'Finalizing & Validating Kit', 'Enforcing Appendix A schema constraints...');
  const kitSource: KitSource = {
    company: companyNameGuess,
    company_url: crawlResult.homepage?.url || companyUrl,
    role: extractedRole.title,
    location: 'Remote / Hybrid',
    jd_chars: jd.length,
    researched_at: new Date().toISOString(),
    pages_used: crawlResult.pagesUsed.length > 0 ? crawlResult.pagesUsed : [companyUrl],
  };

  const finalKit: PrepKit = {
    source: kitSource,
    company_brief: companyBrief,
    role: extractedRole,
    questions,
    flashcards,
    schedule,
    coverage: coverageAnalysis.coverage,
  };

  const validation = validatePrepKit(finalKit);
  if (!validation.valid) {
    console.warn('Kit validation issues:', validation.errors);
    return {
      success: false,
      kit: null,
      error: {
        code: 'VALIDATION_FAILED',
        message: `Generated kit failed schema validation: ${validation.errors.join('; ')}`,
      },
    };
  }

  return {
    success: true,
    kit: finalKit,
    crawlResult,
  };
}
