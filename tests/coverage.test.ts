import { describe, it, expect } from 'vitest';
import { checkRequirementCoverage } from '../server/src/services/pipeline/coverageChecker.js';
import { KitQuestion, KitRequirement } from '../server/src/types/kit.js';

describe('Coverage Checker & Second Pass Logic', () => {
  const requirements: KitRequirement[] = [
    { id: 'r1', text: '5+ years with React', kind: 'technical', priority: 'must' },
    { id: 'r2', text: 'GraphQL architecture', kind: 'technical', priority: 'must' },
    { id: 'r3', text: 'Mentoring junior developers', kind: 'behavioural', priority: 'must' },
    { id: 'r4', text: 'Docker containerization', kind: 'technical', priority: 'nice' }
  ];

  it('detects 100% coverage when all requirements are referenced', () => {
    const questions: KitQuestion[] = [
      { id: 'q1', requirement_ids: ['r1'], category: 'technical', prompt: 'P1', answer_outline: 'A1', difficulty: 2 },
      { id: 'q2', requirement_ids: ['r2', 'r4'], category: 'technical', prompt: 'P2', answer_outline: 'A2', difficulty: 2 },
      { id: 'q3', requirement_ids: ['r3'], category: 'behavioural', prompt: 'P3', answer_outline: 'A3', difficulty: 1 }
    ];

    const result = checkRequirementCoverage(requirements, questions);
    expect(result.uncoveredRequirementIds.length).toBe(0);
    expect(result.uncoveredMustHaves.length).toBe(0);
    expect(result.coverageRatio).toBe(1.0);
  });

  it('detects gaps when must-have requirements are missing', () => {
    // Only q1 referencing r1 is present. r2 (must), r3 (must), and r4 (nice) are missing.
    const questions: KitQuestion[] = [
      { id: 'q1', requirement_ids: ['r1'], category: 'technical', prompt: 'P1', answer_outline: 'A1', difficulty: 2 }
    ];

    const result = checkRequirementCoverage(requirements, questions);
    expect(result.uncoveredRequirementIds).toContain('r2');
    expect(result.uncoveredRequirementIds).toContain('r3');
    expect(result.uncoveredRequirementIds).toContain('r4');
    expect(result.uncoveredMustHaves.map(r => r.id)).toEqual(['r2', 'r3']);
    expect(result.uncoveredNiceToHaves.map(r => r.id)).toEqual(['r4']);
    expect(result.coverageRatio).toBe(0.25);
  });

  it('simulates second pass closing the coverage gap', () => {
    let questions: KitQuestion[] = [
      { id: 'q1', requirement_ids: ['r1'], category: 'technical', prompt: 'P1', answer_outline: 'A1', difficulty: 2 }
    ];

    // First pass check
    let firstPassResult = checkRequirementCoverage(requirements, questions);
    expect(firstPassResult.uncoveredMustHaves.length).toBe(2);

    // Second pass: generate questions targeting the uncovered must-haves
    const gapClosingQuestions: KitQuestion[] = firstPassResult.uncoveredMustHaves.map((req, i) => ({
      id: `q_gap_${i + 1}`,
      requirement_ids: [req.id],
      category: req.kind === 'behavioural' ? 'behavioural' : 'technical',
      prompt: `Gap question for ${req.text}`,
      answer_outline: 'Answer outline',
      difficulty: 2
    }));

    questions = [...questions, ...gapClosingQuestions];

    // Second pass check
    const secondPassResult = checkRequirementCoverage(requirements, questions);
    expect(secondPassResult.uncoveredMustHaves.length).toBe(0);
    expect(secondPassResult.coveredRequirementIds).toContain('r1');
    expect(secondPassResult.coveredRequirementIds).toContain('r2');
    expect(secondPassResult.coveredRequirementIds).toContain('r3');
  });
});
