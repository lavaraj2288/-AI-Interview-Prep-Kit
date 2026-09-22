import { describe, it, expect } from 'vitest';
import { allocateSchedule } from '../server/src/services/pipeline/scheduleAllocator.js';
import { KitQuestion, KitRequirement } from '../server/src/types/kit.js';

describe('Schedule Allocator (Deterministic Arithmetic)', () => {
  const sampleRequirements: KitRequirement[] = [
    { id: 'r1', text: '5+ years Node.js and TypeScript', kind: 'technical', priority: 'must' },
    { id: 'r2', text: 'Distributed system architecture', kind: 'technical', priority: 'must' },
    { id: 'r3', text: 'Mentoring junior engineers', kind: 'behavioural', priority: 'must' },
    { id: 'r4', text: 'Go or Rust knowledge', kind: 'technical', priority: 'nice' }
  ];

  const sampleQuestions: KitQuestion[] = [
    {
      id: 'q1',
      requirement_ids: ['r1'],
      category: 'technical',
      prompt: 'Explain event loop and async hooks in Node.js',
      answer_outline: 'Event loop phases, libuv, microtasks queue',
      difficulty: 2
    },
    {
      id: 'q2',
      requirement_ids: ['r2'],
      category: 'system-design',
      prompt: 'Design a high-throughput distributed message broker',
      answer_outline: 'Partitioning, consensus, offset management',
      difficulty: 3
    },
    {
      id: 'q3',
      requirement_ids: ['r3'],
      category: 'behavioural',
      prompt: 'Describe a time you coached an underperforming engineer',
      answer_outline: 'STAR framework, empathetic feedback, PIP',
      difficulty: 2
    },
    {
      id: 'q4',
      requirement_ids: ['r4'],
      category: 'technical',
      prompt: 'Compare Go goroutines with Node worker threads',
      answer_outline: 'Memory footprint, M:N scheduler',
      difficulty: 1
    }
  ];

  it('allocates exactly the requested number of days (5 days)', () => {
    const schedule = allocateSchedule(5, sampleQuestions, sampleRequirements);
    expect(schedule.days_available).toBe(5);
    expect(schedule.days.length).toBe(5);
    expect(schedule.days.map(d => d.day)).toEqual([1, 2, 3, 4, 5]);
  });

  it('handles 1-day crunch schedule', () => {
    const schedule = allocateSchedule(1, sampleQuestions, sampleRequirements);
    expect(schedule.days_available).toBe(1);
    expect(schedule.days.length).toBe(1);
    expect(schedule.days[0].day).toBe(1);
    expect(schedule.days[0].question_ids.length).toBeGreaterThanOrEqual(sampleQuestions.length);
    expect(Number.isInteger(schedule.days[0].minutes)).toBe(true);
  });

  it('handles 60-day horizon schedule', () => {
    const schedule = allocateSchedule(60, sampleQuestions, sampleRequirements);
    expect(schedule.days_available).toBe(60);
    expect(schedule.days.length).toBe(60);
    schedule.days.forEach((day, index) => {
      expect(day.day).toBe(index + 1);
      expect(Number.isInteger(day.minutes)).toBe(true);
      expect(day.minutes).toBeGreaterThan(0);
    });
  });

  it('ensures all durations are integer minutes (no floats, no strings)', () => {
    const schedule = allocateSchedule(7, sampleQuestions, sampleRequirements);
    for (const day of schedule.days) {
      expect(typeof day.minutes).toBe('number');
      expect(Number.isInteger(day.minutes)).toBe(true);
      expect(day.minutes).toBeGreaterThan(0);
    }
  });

  it('ensures harder and higher-priority questions land earlier in the schedule', () => {
    const schedule = allocateSchedule(4, sampleQuestions, sampleRequirements);
    // q2 is difficulty 3 with must requirement r2. It should land on Day 1
    expect(schedule.days[0].question_ids).toContain('q2');
  });

  it('ensures every must-have requirement appears in the schedule', () => {
    const schedule = allocateSchedule(3, sampleQuestions, sampleRequirements);
    const scheduledQuestionIds = new Set<string>();
    for (const day of schedule.days) {
      day.question_ids.forEach(id => scheduledQuestionIds.add(id));
    }

    const mustReqs = sampleRequirements.filter(r => r.priority === 'must');
    for (const must of mustReqs) {
      const isCovered = sampleQuestions
        .filter(q => q.requirement_ids.includes(must.id))
        .some(q => scheduledQuestionIds.has(q.id));
      expect(isCovered).toBe(true);
    }
  });

  it('ensures every scheduled question ID exists in the questions list', () => {
    const schedule = allocateSchedule(5, sampleQuestions, sampleRequirements);
    const validQuestionIds = new Set(sampleQuestions.map(q => q.id));

    for (const day of schedule.days) {
      for (const qId of day.question_ids) {
        expect(validQuestionIds.has(qId)).toBe(true);
      }
    }
  });
});
