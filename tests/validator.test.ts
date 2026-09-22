import { describe, it, expect } from 'vitest';
import { validatePrepKit } from '../server/src/services/pipeline/kitValidator.js';
import { PrepKit } from '../server/src/types/kit.js';

describe('Kit Structure Validator (Appendix A Compliance)', () => {
  const validKit: PrepKit = {
    source: {
      company: 'Acme Corp',
      company_url: 'https://acme.example.com',
      role: 'Senior Full Stack Engineer',
      location: 'Remote',
      jd_chars: 520,
      researched_at: '2026-09-01T09:00:00Z',
      pages_used: ['https://acme.example.com', 'https://acme.example.com/careers'],
    },
    company_brief: {
      summary: 'Acme Corp is a technology enterprise.',
      what_they_do: 'Builds enterprise automation tools.',
      sources: ['https://acme.example.com'],
    },
    role: {
      title: 'Senior Full Stack Engineer',
      seniority: 'Senior',
      responsibilities: ['Architect microservices', 'Mentor team members'],
      requirements: [
        {
          id: 'r1',
          text: '5+ years with React',
          kind: 'technical',
          priority: 'must',
        },
        {
          id: 'r2',
          text: 'Mentoring junior engineers',
          kind: 'behavioural',
          priority: 'must',
        },
      ],
    },
    questions: [
      {
        id: 'q1',
        requirement_ids: ['r1'],
        category: 'technical',
        prompt: 'How do React hooks work internally?',
        answer_outline: 'Fiber nodes, memoizedState linked list',
        difficulty: 2,
      },
      {
        id: 'q2',
        requirement_ids: ['r2'],
        category: 'behavioural',
        prompt: 'Describe a time you coached a struggling teammate',
        answer_outline: 'Empathy, structured check-ins, measurable outcome',
        difficulty: 2,
      },
    ],
    flashcards: [
      {
        id: 'f1',
        front: 'React Fiber Architecture',
        back: 'Reconciliation algorithm allowing interruptible rendering',
        requirement_ids: ['r1'],
      },
    ],
    schedule: {
      days_available: 2,
      days: [
        {
          day: 1,
          focus: 'Technical Mastery',
          question_ids: ['q1'],
          minutes: 45,
        },
        {
          day: 2,
          focus: 'Behavioral & Leadership',
          question_ids: ['q2'],
          minutes: 45,
        },
      ],
    },
    coverage: {
      uncovered_requirement_ids: [],
      passes: 1,
    },
  };

  it('validates a correct kit adhering to Appendix A', () => {
    const result = validatePrepKit(validKit);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('rejects kits with missing required Appendix A fields', () => {
    const invalid = { ...validKit };
    // @ts-expect-error test invalid schema
    delete invalid.company_brief;
    const result = validatePrepKit(invalid);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('rejects float or non-integer minutes in schedule', () => {
    const invalid = JSON.parse(JSON.stringify(validKit)) as PrepKit;
    invalid.schedule.days[0].minutes = 45.5; // Float
    const result = validatePrepKit(invalid);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('minutes') || e.includes('Expected integer'))).toBe(true);
  });

  it('rejects difficulty outside 1 to 3', () => {
    const invalid = JSON.parse(JSON.stringify(validKit)) as PrepKit;
    invalid.questions[0].difficulty = 5; // Invalid difficulty
    const result = validatePrepKit(invalid);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('difficulty'))).toBe(true);
  });

  it('rejects schedule referencing non-existent question_ids', () => {
    const invalid = JSON.parse(JSON.stringify(validKit)) as PrepKit;
    invalid.schedule.days[0].question_ids = ['q999']; // Non-existent
    const result = validatePrepKit(invalid);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('non-existent question_id "q999"'))).toBe(true);
  });

  it('rejects schedule where a must-have requirement is not scheduled', () => {
    const invalid = JSON.parse(JSON.stringify(validKit)) as PrepKit;
    // Day 2 was covering r2 (must have); if we change Day 2 to also only cover q1:
    invalid.schedule.days[1].question_ids = ['q1'];
    const result = validatePrepKit(invalid);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Must-have requirement "r2"'))).toBe(true);
  });
});
