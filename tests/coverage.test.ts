import { describe, it, expect } from 'vitest';
import { checkCoverage } from '../server/src/services/pipeline/coverageChecker.js';
import { RoleRequirement, KitQuestion } from '../server/src/types/kit.js';

describe('Coverage Checker (Deterministic)', () => {
  const mockRequirements: RoleRequirement[] = [
    { id: 'r1', text: 'Expert in TypeScript', kind: 'technical', priority: 'must' },
    { id: 'r2', text: 'Experience leading agile sprints', kind: 'behavioural', priority: 'must' },
    { id: 'r3', text: 'Knowledge of AWS CloudFormation', kind: 'domain', priority: 'nice' },
  ];

  it('detects uncovered requirements accurately', () => {
    // Only r1 covered
    const partialQuestions: KitQuestion[] = [
      {
        id: 'q1',
        requirement_ids: ['r1'],
        category: 'technical',
        prompt: 'TypeScript generics questions',
        answer_outline: 'Explain type constraints',
        difficulty: 2,
      },
    ];

    const result = checkCoverage(mockRequirements, partialQuestions, 0);
    expect(result.hasGaps).toBe(true);
    expect(result.hasMustGaps).toBe(true);
    expect(result.coverage.uncovered_requirement_ids).toEqual(['r2', 'r3']);
    expect(result.uncoveredMustRequirements.map((r) => r.id)).toEqual(['r2']);
    expect(result.uncoveredNiceRequirements.map((r) => r.id)).toEqual(['r3']);
    expect(result.coverage.passes).toBe(1);
  });

  it('returns no gaps when all requirements are covered', () => {
    const fullQuestions: KitQuestion[] = [
      {
        id: 'q1',
        requirement_ids: ['r1'],
        category: 'technical',
        prompt: 'TypeScript generics',
        answer_outline: 'Type bounds',
        difficulty: 2,
      },
      {
        id: 'q2',
        requirement_ids: ['r2'],
        category: 'behavioural',
        prompt: 'Sprint leadership',
        answer_outline: 'Agile rituals',
        difficulty: 2,
      },
      {
        id: 'q3',
        requirement_ids: ['r3'],
        category: 'technical',
        prompt: 'AWS infrastructure',
        answer_outline: 'CloudFormation stacks',
        difficulty: 2,
      },
    ];

    const result = checkCoverage(mockRequirements, fullQuestions, 1);
    expect(result.hasGaps).toBe(false);
    expect(result.hasMustGaps).toBe(false);
    expect(result.coverage.uncovered_requirement_ids).toEqual([]);
    expect(result.coverage.passes).toBe(2);
    expect(result.coverageRatio).toBe(1.0);
  });
});
