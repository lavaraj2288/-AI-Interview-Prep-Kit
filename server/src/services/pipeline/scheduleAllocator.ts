import {
  RoleRequirement,
  KitQuestion,
  KitSchedule,
  ScheduleDay,
} from '../../types/kit.js';

interface ScoredQuestion {
  question: KitQuestion;
  score: number;
  coversMust: boolean;
  maxDifficulty: number;
}

/**
 * Deterministic arithmetic schedule allocation.
 * Pure application logic without LLM hallucinations.
 *
 * Constraints:
 * 1. Schedule length equals exactly `daysAvailable`.
 * 2. Every must-have requirement appears in at least one scheduled question.
 * 3. Harder (difficulty 3) and higher-priority (must-have) material lands earlier.
 * 4. All question durations and day totals are integer minutes.
 * 5. Every question_id in the schedule refers to an actual question in the kit.
 */
export function allocateSchedule(
  requirements: RoleRequirement[],
  questions: KitQuestion[],
  daysAvailable: number
): KitSchedule {
  const safeDays = Math.max(1, Math.min(60, Math.floor(daysAvailable)));

  if (!questions || questions.length === 0) {
    // Edge case: Empty questions (stub JD)
    return {
      days_available: safeDays,
      days: Array.from({ length: safeDays }, (_, i) => ({
        day: i + 1,
        focus: i === 0 ? 'Initial Role Assessment' : 'Self-Directed Review',
        question_ids: [],
        minutes: 30,
      })),
    };
  }

  // Map requirements by id for quick lookup
  const reqMap = new Map<string, RoleRequirement>();
  for (const r of requirements) {
    reqMap.set(r.id, r);
  }

  // Score each question: Must-have coverage and higher difficulty score higher
  const scoredQuestions: ScoredQuestion[] = questions.map((q) => {
    let coversMust = false;
    let kindBonus = 0;

    for (const rId of q.requirement_ids || []) {
      const req = reqMap.get(rId);
      if (req) {
        if (req.priority === 'must') coversMust = true;
        if (req.kind === 'technical') kindBonus = Math.max(kindBonus, 20);
        if (req.kind === 'domain') kindBonus = Math.max(kindBonus, 15);
        if (req.kind === 'behavioural') kindBonus = Math.max(kindBonus, 10);
      }
    }

    const catBonus =
      q.category === 'system-design'
        ? 30
        : q.category === 'technical'
        ? 25
        : q.category === 'behavioural'
        ? 15
        : 10;

    const diff = Number.isInteger(q.difficulty) ? q.difficulty : 2;
    // Score: coversMust = +100, difficulty = diff * 20 (up to 60), category bonus up to 30
    const score = (coversMust ? 100 : 0) + diff * 20 + catBonus + kindBonus;

    return {
      question: q,
      score,
      coversMust,
      maxDifficulty: diff,
    };
  });

  // Sort descending: highest score (must-have + hard technical/system design) first!
  scoredQuestions.sort((a, b) => b.score - a.score);

  // Separate must-have covering questions to guarantee every must-have requirement is scheduled
  const mustReqIds = new Set(
    requirements.filter((r) => r.priority === 'must').map((r) => r.id)
  );

  const days: ScheduleDay[] = [];

  if (safeDays === 1) {
    // 1-Day Intensive: Schedule all questions, prioritizing must-haves
    const qIds = scoredQuestions.map((sq) => sq.question.id);
    const totalMinutes = Math.min(
      240,
      scoredQuestions.reduce(
        (acc, sq) => acc + (sq.maxDifficulty === 3 ? 25 : sq.maxDifficulty === 2 ? 15 : 10),
        0
      )
    );

    days.push({
      day: 1,
      focus: 'Intensive Cram: Core Must-Haves, Technicals & High-Impact Preparation',
      question_ids: qIds,
      minutes: Math.max(45, Math.round(totalMinutes)),
    });

    return {
      days_available: 1,
      days,
    };
  }

  // Multi-day distribution
  // Step 1: Ensure all must-have covering questions are scheduled in the early-to-mid days
  // Partition scoredQuestions across days
  const dayQuestionBuckets: KitQuestion[][] = Array.from(
    { length: safeDays },
    () => []
  );

  // If we have fewer questions than days, distribute questions and use spaced repetition / review for extra days
  if (scoredQuestions.length <= safeDays) {
    // Place one question per day for the first N days
    scoredQuestions.forEach((sq, idx) => {
      dayQuestionBuckets[idx].push(sq.question);
    });

    // For days with no new questions, assign key questions for spaced repetition & review
    // Hard questions get reviewed on later days
    for (let d = scoredQuestions.length; d < safeDays; d++) {
      // Pick 1-2 most important questions for review
      const reviewTarget = scoredQuestions[(d - scoredQuestions.length) % scoredQuestions.length];
      if (reviewTarget) {
        dayQuestionBuckets[d].push(reviewTarget.question);
      }
    }
  } else {
    // More questions than days: allocate higher priority / harder questions to earlier days
    // Weight each day: earlier days get more intense allocation
    const totalQ = scoredQuestions.length;
    let qIndex = 0;

    // Distribute all questions across safeDays
    for (let dayIdx = 0; dayIdx < safeDays; dayIdx++) {
      const remainingDays = safeDays - dayIdx;
      const remainingQuestions = totalQ - qIndex;

      // Base share of questions for this day
      let share = Math.ceil(remainingQuestions / remainingDays);
      if (share < 1) share = 1;

      for (let i = 0; i < share && qIndex < totalQ; i++) {
        dayQuestionBuckets[dayIdx].push(scoredQuestions[qIndex].question);
        qIndex++;
      }
    }

    // If any question left due to rounding, append to middle days
    while (qIndex < totalQ) {
      const targetDay = Math.min(safeDays - 1, Math.floor(safeDays / 2));
      dayQuestionBuckets[targetDay].push(scoredQuestions[qIndex].question);
      qIndex++;
    }
  }

  // Step 2: Verify that EVERY must-have requirement appears somewhere in the schedule
  const scheduledReqIds = new Set<string>();
  for (const bucket of dayQuestionBuckets) {
    for (const q of bucket) {
      for (const rId of q.requirement_ids || []) {
        scheduledReqIds.add(rId);
      }
    }
  }

  // If any must-have requirement was missed in questions, find any question covering it and inject into Day 1 or Day 2
  for (const mustReqId of mustReqIds) {
    if (!scheduledReqIds.has(mustReqId)) {
      const candidateQ = questions.find((q) =>
        (q.requirement_ids || []).includes(mustReqId)
      );
      if (candidateQ) {
        dayQuestionBuckets[0].unshift(candidateQ);
        scheduledReqIds.add(mustReqId);
      }
    }
  }

  // Step 3: Compute focus, minutes and format ScheduleDay for each day
  for (let d = 0; d < safeDays; d++) {
    const bucket = dayQuestionBuckets[d];
    const dayNum = d + 1;

    // Calculate integer minutes based on difficulty
    const dayMinutes = bucket.reduce((sum, q) => {
      const diff = q.difficulty || 2;
      return sum + (diff === 3 ? 25 : diff === 2 ? 15 : 10);
    }, 0);

    const minutes = Math.max(30, Math.min(180, Math.round(dayMinutes)));

    // Determine focus title based on day position and categories
    const categories = Array.from(new Set(bucket.map((q) => q.category)));
    let focus = '';

    if (dayNum === 1) {
      focus = 'Core Must-Haves & Foundational Deep Dive';
    } else if (dayNum === safeDays) {
      focus = 'Final Polish, Company Alignment & Mock Drills';
    } else if (categories.includes('system-design')) {
      focus = 'System Architecture, Scalability & Design Trade-offs';
    } else if (categories.includes('technical')) {
      focus = 'Technical Mastery & Practical Problem Solving';
    } else if (categories.includes('behavioural')) {
      focus = 'Leadership, Behavioral Scenarios & STAR Responses';
    } else {
      focus = `Day ${dayNum} Focus: ${categories.join(' & ') || 'Comprehensive Review'}`;
    }

    days.push({
      day: dayNum,
      focus,
      question_ids: bucket.map((q) => q.id),
      minutes,
    });
  }

  return {
    days_available: safeDays,
    days,
  };
}
