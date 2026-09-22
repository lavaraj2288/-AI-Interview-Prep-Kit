import { z } from 'zod';
import { AppendixAKit } from '../../types/kit.js';

export const AppendixAKitSchema = z.object({
  source: z.object({
    company: z.string(),
    company_url: z.string(),
    role: z.string(),
    location: z.string(),
    jd_chars: z.number().int().nonnegative(),
    researched_at: z.string(),
    pages_used: z.array(z.string())
  }),
  company_brief: z.object({
    summary: z.string(),
    what_they_do: z.string(),
    sources: z.array(z.string())
  }),
  role: z.object({
    title: z.string(),
    seniority: z.string(),
    responsibilities: z.array(z.string()),
    requirements: z.array(z.object({
      id: z.string().min(1),
      text: z.string().min(1),
      kind: z.enum(['technical', 'behavioural', 'domain']),
      priority: z.enum(['must', 'nice'])
    }))
  }),
  questions: z.array(z.object({
    id: z.string().min(1),
    requirement_ids: z.array(z.string()),
    category: z.enum(['technical', 'behavioural', 'system-design', 'company-fit']),
    prompt: z.string().min(1),
    answer_outline: z.string(),
    difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)])
  })),
  flashcards: z.array(z.object({
    id: z.string().min(1),
    front: z.string().min(1),
    back: z.string().min(1),
    requirement_ids: z.array(z.string())
  })),
  schedule: z.object({
    days_available: z.number().int().positive(),
    days: z.array(z.object({
      day: z.number().int().positive(),
      focus: z.string(),
      question_ids: z.array(z.string()),
      minutes: z.number().int().positive() // Strict integer minutes check
    }))
  }),
  coverage: z.object({
    uncovered_requirement_ids: z.array(z.string()),
    passes: z.number().int().positive()
  })
});

export function validateAppendixAKit(kit: any): { valid: boolean; errors?: string[]; data?: AppendixAKit } {
  const parseResult = AppendixAKitSchema.safeParse(kit);
  if (!parseResult.success) {
    const errorMessages = parseResult.error.errors.map(
      e => `${e.path.join('.')}: ${e.message}`
    );
    return { valid: false, errors: errorMessages };
  }

  // Extra invariant validation: Check that all question_ids in schedule actually exist in questions
  const questionIdsSet = new Set(parseResult.data.questions.map(q => q.id));
  for (const day of parseResult.data.schedule.days) {
    for (const qId of day.question_ids) {
      if (!questionIdsSet.has(qId)) {
        return {
          valid: false,
          errors: [`Schedule day ${day.day} references unknown question ID '${qId}'`]
        };
      }
    }
  }

  return { valid: true, data: parseResult.data as AppendixAKit };
}
