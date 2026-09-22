/**
 * The AI Interview Prep Kit - Core Domain Types
 * Conforms strictly to Appendix A & Appendix B of Trao Assessment FS-AI-INTERVIEW-01
 */

export type RequirementKind = 'technical' | 'behavioural' | 'domain';
export type RequirementPriority = 'must' | 'nice';

export interface KitRequirement {
  id: string; // stable e.g. "r1", "r2"
  text: string;
  kind: RequirementKind;
  priority: RequirementPriority;
}

export interface KitRole {
  title: string;
  seniority: string;
  responsibilities: string[];
  requirements: KitRequirement[];
}

export type QuestionCategory = 'technical' | 'behavioural' | 'system-design' | 'company-fit';

export interface KitQuestion {
  id: string; // stable e.g. "q1", "q2"
  requirement_ids: string[];
  category: QuestionCategory;
  prompt: string;
  answer_outline: string;
  difficulty: 1 | 2 | 3;
  // Builder state extension (Section 6: generated, edited, pinned, custom)
  origin?: 'generated' | 'edited' | 'pinned' | 'custom';
}

export interface KitFlashcard {
  id: string; // stable e.g. "f1", "f2"
  front: string;
  back: string;
  requirement_ids: string[];
  origin?: 'generated' | 'edited' | 'pinned' | 'custom';
}

export interface ScheduleDay {
  day: number;
  focus: string;
  question_ids: string[];
  minutes: number; // integer minutes
}

export interface KitSchedule {
  days_available: number;
  days: ScheduleDay[];
}

export interface KitCoverage {
  uncovered_requirement_ids: string[];
  passes: number;
}

export interface KitSource {
  company: string;
  company_url: string;
  role: string;
  location: string;
  jd_chars: number;
  researched_at: string; // ISO 8601
  pages_used: string[];
}

export interface CompanyBrief {
  summary: string;
  what_they_do: string;
  sources: string[];
}

/**
 * Exact Appendix A Kit Structure
 */
export interface AppendixAKit {
  source: KitSource;
  company_brief: CompanyBrief;
  role: KitRole;
  questions: KitQuestion[];
  flashcards: KitFlashcard[];
  schedule: KitSchedule;
  coverage: KitCoverage;
}

/**
 * Section 9 Batch Input Case (Appendix B)
 */
export interface BatchInputCase {
  id: string;
  jd: string;
  company_url: string;
  days: number;
}

/**
 * Section 9 Batch Output Case (Appendix B)
 */
export interface BatchOutputResult {
  id: string;
  status: 'ok' | 'failed';
  kit: AppendixAKit | null;
  error: {
    code: string;
    message: string;
  } | null;
}

export interface BatchOutputDocument {
  version: '1.0';
  generated_at: string;
  kits: BatchOutputResult[];
}

/**
 * Crawler types
 */
export interface CrawledPage {
  url: string;
  title: string;
  text: string;
  status: number;
  contentType: string;
  sizeBytes: number;
}

export interface CrawlerResult {
  pages: CrawledPage[];
  hiringPageFound: boolean;
  publicDiscussion: string[];
  errors: Array<{ url: string; reason: string }>;
}
