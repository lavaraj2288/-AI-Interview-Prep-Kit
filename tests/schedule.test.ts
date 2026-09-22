import { describe, it, expect } from 'vitest';
import { allocateSchedule } from '../server/src/services/pipeline/scheduleAllocator.js';
import { RoleRequirement, KitQuestion } from '../server/src/types/kit.js';

describe('Schedule Allocator (Deterministic Arithmetic)', () => {
  const mockRequirements: RoleRequirement[] = [
    { id: 'r1', text: '5+ years React and TypeScript', kind: 'technical', priority: 'must' },
    { id: 'r2', text: 'Distributed systems & Node.js', kind: 'technical', priority: 'must' },
    { id: 'r3', text: 'Mentoring junior engineers', kind: 'behavioural', priority: 'must' },
    { id: 'r4', text: 'Experience with GraphQL', kind: 'technical', priority: 'nice' },
    { id: 'r5', text: 'Docker & Kubernetes knowledge', kind: 'domain', priority: 'nice' },
  ];

  const mockQuestions: KitQuestion[] = [
    {
      id: 'q1',
      requirement_ids: ['r1'],
      category: 'technical',
      prompt: 'Explain React Concurrent Mode',
      answer_outline: 'Fiber architecture, priority lanes',
      difficulty: 3,
    },
    {
      id: 'q2',
      requirement_ids: ['r2'],
      category: 'system-design',
      prompt: 'Design a distributed event stream',
      answer_outline: 'Partitioning, consensus, backpressure',
      difficulty: 3,
    },
    {
      id: 'q3',
      requirement_ids: ['r3'],
      category: 'behavioural',
      prompt: 'Tell me about a time you mentored a junior engineer',
      answer_outline: 'Situation, guidance, measurable growth',
      difficulty: 2,
    },
    {
      id: 'q4',
      requirement_ids: ['r4'],
      category: 'technical',
      prompt: 'Explain N+1 problem in GraphQL',
      answer_outline: 'DataLoader, batching',
      difficulty: 1,
    },
    {
      id: 'q5',
      requirement_ids: ['r5'],
      category: 'technical',
      prompt: 'How do Kubernetes probes work?',
      answer_outline: 'Liveness, readiness, startup',
      difficulty: 2,
    },
  ];

  it('allocates schedule matching exactly the requested days', () => {
    for (const days of [1, 3, 5, 10, 30]) {
      const schedule = allocateSchedule(mockRequirements, mockQuestions, days);
      expect(schedule.days_available).toBe(days);
      expect(schedule.days.length).toBe(days);

      schedule.days.forEach((day, index) => {
        expect(day.day).toBe(index + 1);
        expect(Number.isInteger(day.minutes)).toBe(true);
        expect(day.minutes).toBeGreaterThan(0);
        expect(typeof day.focus).toBe('string');
        expect(day.focus.length).toBeGreaterThan(0);
      });
    }
  });

  it('ensures every must-have requirement appears somewhere in the schedule', () => {
    const schedule = allocateSchedule(mockRequirements, mockQuestions, 5);

    const scheduledQIds = new Set<string>();
    schedule.days.forEach((d) => d.question_ids.forEach((qid) => scheduledQIds.add(qid)));

    const questionMap = new Map<string, KitQuestion>(mockQuestions.map((q) => [q.id, q]));
    const scheduledReqIds = new Set<string>();

    scheduledQIds.forEach((qid) => {
      const q = questionMap.get(qid);
      if (q) {
        q.requirement_ids.forEach((rid) => scheduledReqIds.add(rid));
      }
    });

    const mustReqs = mockRequirements.filter((r) => r.priority === 'must');
    for (const mustReq of mustReqs) {
      expect(scheduledReqIds.has(mustReq.id)).toBe(true);
    }
  });

  it('front-loads harder and higher-priority material earlier in the schedule', () => {
    const schedule = allocateSchedule(mockRequirements, mockQuestions, 5);
    const day1QIds = schedule.days[0].question_ids;
    const day5QIds = schedule.days[4].question_ids;

    const questionMap = new Map<string, KitQuestion>(mockQuestions.map((q) => [q.id, q]));
    const day1Difficulties = day1QIds.map((qid) => questionMap.get(qid)?.difficulty || 0);
    const day5Difficulties = day5QIds.map((qid) => questionMap.get(qid)?.difficulty || 0);

    const avgDay1 = day1Difficulties.reduce((a, b) => a + b, 0) / (day1Difficulties.length || 1);
    const avgDay5 = day5Difficulties.reduce((a, b) => a + b, 0) / (day5Difficulties.length || 1);

    expect(avgDay1).toBeGreaterThanOrEqual(avgDay5);
  });

  it('handles 1-day edge case (intensive cram)', () => {
    const schedule = allocateSchedule(mockRequirements, mockQuestions, 1);
    expect(schedule.days_available).toBe(1);
    expect(schedule.days.length).toBe(1);
    expect(schedule.days[0].question_ids.length).toBeGreaterThan(0);
    expect(Number.isInteger(schedule.days[0].minutes)).toBe(true);
  });

  it('handles 60-day edge case with spaced repetition', () => {
    const schedule = allocateSchedule(mockRequirements, mockQuestions, 60);
    expect(schedule.days_available).toBe(60);
    expect(schedule.days.length).toBe(60);
  });
});
