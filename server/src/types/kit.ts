export type RequirementKind = 'technical' | 'behavioural' | 'domain';
export type RequirementPriority = 'must' | 'nice';

export interface RoleRequirement {
  id: string;
  text: string;
  kind: RequirementKind;
  priority: RequirementPriority;
}

export interface RoleInfo {
  title: string;
  seniority: string;
  responsibilities: string[];
  requirements: RoleRequirement[];
}

export interface KitSource {
  company: string;
  company_url: string;
  role: string;
  location: string;
  jd_chars: number;
  researched_at: string;
  pages_used: string[];
}

export interface CompanyBrief {
  summary: string;
  what_they_do: string;
  sources: string[];
}

export type QuestionCategory = 'technical' | 'behavioural' | 'system-design' | 'company-fit';

export interface KitQuestion {
  id: string;
  requirement_ids: string[];
  category: QuestionCategory;
  prompt: string;
  answer_outline: string;
  difficulty: number; // 1 to 3
  // Builder state tracking metadata
  origin?: 'generated' | 'edited' | 'manual';
  pinned?: boolean;
}

export interface KitFlashcard {
  id: string;
  front: string;
  back: string;
  requirement_ids: string[];
  // Builder state tracking metadata
  origin?: 'generated' | 'edited' | 'manual';
  pinned?: boolean;
}

export interface ScheduleDay {
  day: number;
  focus: string;
  question_ids: string[];
  minutes: number; // integer
}

export interface KitSchedule {
  days_available: number;
  days: ScheduleDay[];
}

export interface KitCoverage {
  uncovered_requirement_ids: string[];
  passes: number;
}

// Appendix A exact structure
export interface PrepKit {
  source: KitSource;
  company_brief: CompanyBrief;
  role: RoleInfo;
  questions: KitQuestion[];
  flashcards: KitFlashcard[];
  schedule: KitSchedule;
  coverage: KitCoverage;
}

// Batch evaluation interfaces (Appendix B)
export interface BatchCaseInput {
  id: string;
  jd: string;
  company_url: string;
  days: number;
}

export interface BatchCaseError {
  code: string;
  message: string;
}

export interface BatchCaseResult {
  id: string;
  status: 'ok' | 'failed';
  kit: PrepKit | null;
  error: BatchCaseError | null;
}

export interface BatchOutput {
  version: string;
  generated_at: string;
  kits: BatchCaseResult[];
}
