import { z } from 'zod';
import { PrepKit } from '../../types/kit.js';

export const RoleRequirementSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  kind: z.enum(['technical', 'behavioural', 'domain']),
  priority: z.enum(['must', 'nice']),
});

export const RoleInfoSchema = z.object({
  title: z.string().min(1),
  seniority: z.string().min(1),
  responsibilities: z.array(z.string()),
  requirements: z.array(RoleRequirementSchema).min(1),
});

export const KitSourceSchema = z.object({
  company: z.string(),
  company_url: z.string(),
  role: z.string(),
  location: z.string(),
  jd_chars: z.number().int().nonnegative(),
  researched_at: z.string(),
  pages_used: z.array(z.string()),
});

export const CompanyBriefSchema = z.object({
  summary: z.string(),
  what_they_do: z.string(),
  sources: z.array(z.string()),
});

export const KitQuestionSchema = z.object({
  id: z.string().min(1),
  requirement_ids: z.array(z.string()),
  category: z.enum(['technical', 'behavioural', 'system-design', 'company-fit']),
  prompt: z.string().min(1),
  answer_outline: z.string().min(1),
  difficulty: z.number().int().min(1).max(3),
  origin: z.enum(['generated', 'edited', 'manual']).optional(),
  pinned: z.boolean().optional(),
});

export const KitFlashcardSchema = z.object({
  id: z.string().min(1),
  front: z.string().min(1),
  back: z.string().min(1),
  requirement_ids: z.array(z.string()),
  origin: z.enum(['generated', 'edited', 'manual']).optional(),
  pinned: z.boolean().optional(),
});

export const ScheduleDaySchema = z.object({
  day: z.number().int().positive(),
  focus: z.string().min(1),
  question_ids: z.array(z.string()),
  minutes: z.number().int().positive(),
});

export const KitScheduleSchema = z.object({
  days_available: z.number().int().positive(),
  days: z.array(ScheduleDaySchema),
});

export const KitCoverageSchema = z.object({
  uncovered_requirement_ids: z.array(z.string()),
  passes: z.number().int().nonnegative(),
});

export const PrepKitSchema = z.object({
  source: KitSourceSchema,
  company_brief: CompanyBriefSchema,
  role: RoleInfoSchema,
  questions: z.array(KitQuestionSchema),
  flashcards: z.array(KitFlashcardSchema),
  schedule: KitScheduleSchema,
  coverage: KitCoverageSchema,
});

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validatePrepKit(kit: unknown): ValidationResult {
  const parseResult = PrepKitSchema.safeParse(kit);
  if (!parseResult.success) {
    return {
      valid: false,
      errors: parseResult.error.issues.map(
        (issue) => `${issue.path.join('.')}: ${issue.message}`
      ),
    };
  }

  const typedKit = parseResult.data as PrepKit;
  const semanticErrors: string[] = [];

  // Check 1: Schedule days count must equal days_available
  if (typedKit.schedule.days.length !== typedKit.schedule.days_available) {
    semanticErrors.push(
      `Schedule days count (${typedKit.schedule.days.length}) does not match days_available (${typedKit.schedule.days_available}).`
    );
  }

  // Check 2: Every question_id in schedule must exist in questions
  const questionIdSet = new Set(typedKit.questions.map((q) => q.id));
  const scheduledQuestionIds = new Set<string>();

  for (const day of typedKit.schedule.days) {
    for (const qId of day.question_ids) {
      scheduledQuestionIds.add(qId);
      if (!questionIdSet.has(qId)) {
        semanticErrors.push(
          `Schedule references non-existent question_id "${qId}" on day ${day.day}.`
        );
      }
    }
  }

  // Check 3: Every must-have requirement must appear somewhere in the schedule
  // Map from question_id -> requirement_ids covered
  const questionReqMap = new Map<string, string[]>();
  for (const q of typedKit.questions) {
    questionReqMap.set(q.id, q.requirement_ids || []);
  }

  const scheduledReqIds = new Set<string>();
  for (const qId of scheduledQuestionIds) {
    const rIds = questionReqMap.get(qId) || [];
    for (const rId of rIds) {
      scheduledReqIds.add(rId);
    }
  }

  const mustRequirements = typedKit.role.requirements.filter(
    (r) => r.priority === 'must'
  );

  for (const mustReq of mustRequirements) {
    if (!scheduledReqIds.has(mustReq.id)) {
      semanticErrors.push(
        `Must-have requirement "${mustReq.id}" (${mustReq.text.slice(0, 40)}...) is not covered in the schedule.`
      );
    }
  }

  // Check 4: Sequential day numbers (1..N)
  typedKit.schedule.days.forEach((d, idx) => {
    if (d.day !== idx + 1) {
      semanticErrors.push(`Schedule day order is invalid: expected day ${idx + 1}, got ${d.day}.`);
    }
  });

  if (semanticErrors.length > 0) {
    return {
      valid: false,
      errors: semanticErrors,
    };
  }

  return {
    valid: true,
    errors: [],
  };
}
