import { describe, it, expect } from 'vitest';
import { validateAppendixAKit } from '../server/src/services/pipeline/kitValidator.js';
import { AppendixAKit } from '../server/src/types/kit.js';

describe('Kit Validator (Appendix A Schema Compliance)', () => {
  const validKit: AppendixAKit = {
    source: {
      company: 'Acme Corp',
      company_url: 'https://acme.com',
      role: 'Staff Engineer',
      location: 'Remote',
      jd_chars: 1200,
      researched_at: '2026-09-01T12:00:00Z',
      pages_used: ['https://acme.com']
    },
    company_brief: {
      summary: 'Acme builds distributed telemetry tools.',
      what_they_do: 'They build observability platforms and hire through take-home exercises.',
      sources: ['https://acme.com']
    },
    role: {
      title: 'Staff Engineer',
      seniority: 'Staff',
      responsibilities: ['Architect scalable systems', 'Mentor staff'],
      requirements: [
        { id: 'r1', text: '5+ years with React', kind: 'technical', priority: 'must' }
      ]
    },
    questions: [
      {
        id: 'q1',
        requirement_ids: ['r1'],
        category: 'technical',
        prompt: 'How do you optimize render cycles in large React apps?',
        answer_outline: 'Fiber reconciliation, memoization, virtualization',
        difficulty: 2
      }
    ],
    flashcards: [
      {
        id: 'f1',
        front: 'What is reconciliation in React?',
        back: 'The algorithm React uses to diff one tree with another to determine what needs to be changed.',
        requirement_ids: ['r1']
      }
    ],
    schedule: {
      days_available: 5,
      days: [
        {
          day: 1,
          focus: 'React internals & reconciliation',
          question_ids: ['q1'],
          minutes: 60
        }
      ]
    },
    coverage: {
      uncovered_requirement_ids: [],
      passes: 2
    }
  };

  it('validates a correct Appendix A kit structure', () => {
    const result = validateAppendixAKit(validKit);
    expect(result.valid).toBe(true);
    expect(result.data).toBeDefined();
  });

  it('rejects non-integer minutes in schedule (e.g. 60.5)', () => {
    const invalid = JSON.parse(JSON.stringify(validKit));
    invalid.schedule.days[0].minutes = 60.5;

    const result = validateAppendixAKit(invalid);
    expect(result.valid).toBe(false);
    expect(result.errors?.[0]).toContain('Expected integer');
  });

  it('rejects invalid difficulty outside 1..3 range (e.g. 5)', () => {
    const invalid = JSON.parse(JSON.stringify(validKit));
    invalid.questions[0].difficulty = 5;

    const result = validateAppendixAKit(invalid);
    expect(result.valid).toBe(false);
  });

  it('rejects schedule referencing non-existent question ID', () => {
    const invalid = JSON.parse(JSON.stringify(validKit));
    invalid.schedule.days[0].question_ids = ['q_does_not_exist'];

    const result = validateAppendixAKit(invalid);
    expect(result.valid).toBe(false);
    expect(result.errors?.[0]).toContain("references unknown question ID 'q_does_not_exist'");
  });

  it('rejects missing mandatory fields like company_brief', () => {
    const invalid = JSON.parse(JSON.stringify(validKit));
    delete invalid.company_brief;

    const result = validateAppendixAKit(invalid);
    expect(result.valid).toBe(false);
  });
});
