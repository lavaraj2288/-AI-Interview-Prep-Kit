import { KitQuestion, KitRequirement, KitSchedule, ScheduleDay } from '../../types/kit.js';

export function allocateSchedule(
  daysAvailable: number,
  questions: KitQuestion[],
  requirements: KitRequirement[]
): KitSchedule {
  // Enforce positive integer days
  const validDays = Math.max(1, Math.round(daysAvailable));

  if (!questions || questions.length === 0) {
    // Edge case: No questions to allocate
    const emptyDays: ScheduleDay[] = [];
    for (let i = 1; i <= validDays; i++) {
      emptyDays.push({
        day: i,
        focus: 'Foundational Review & Overview',
        question_ids: [],
        minutes: 30
      });
    }
    return { days_available: validDays, days: emptyDays };
  }

  // Create lookup for requirement priority
  const reqPriorityMap = new Map<string, 'must' | 'nice'>();
  for (const r of requirements) {
    reqPriorityMap.set(r.id, r.priority);
  }

  // Calculate question weight:
  // Harder questions (difficulty 3) and must-have requirements get highest weight
  // to ensure they land earlier in the schedule
  const scoredQuestions = questions.map(q => {
    const hasMust = q.requirement_ids.some(rId => reqPriorityMap.get(rId) === 'must');
    const priorityScore = hasMust ? 20 : 5;
    const difficultyScore = (q.difficulty || 2) * 10;
    const totalScore = priorityScore + difficultyScore;

    // Time estimate based on difficulty (integer minutes)
    const baseMinutes = q.difficulty === 3 ? 35 : q.difficulty === 2 ? 25 : 15;

    return {
      question: q,
      totalScore,
      baseMinutes,
      hasMust
    };
  });

  // Sort descending by score: hardest and highest-priority first
  scoredQuestions.sort((a, b) => b.totalScore - a.totalScore);

  // Initialize schedule days
  const days: ScheduleDay[] = [];
  for (let i = 1; i <= validDays; i++) {
    days.push({
      day: i,
      focus: '',
      question_ids: [],
      minutes: 0
    });
  }

  // Distribution strategy:
  // Allocate questions prioritizing earlier days
  if (validDays === 1) {
    // Single-day intensive crunch
    const allQIds = scoredQuestions.map(sq => sq.question.id);
    const totalMinutes = scoredQuestions.reduce((acc, sq) => acc + sq.baseMinutes, 0);
    days[0] = {
      day: 1,
      focus: 'Intensive Comprehensive Preparation (All Topics)',
      question_ids: allQIds,
      minutes: Math.max(60, totalMinutes)
    };
  } else if (validDays >= scoredQuestions.length) {
    // More days available than questions (e.g. 60 days, 15 questions)
    // Place prime questions on earlier days, subsequent days get revision or deep dives
    for (let i = 0; i < scoredQuestions.length; i++) {
      days[i].question_ids.push(scoredQuestions[i].question.id);
      days[i].minutes = scoredQuestions[i].baseMinutes + 20; // extra deep-dive buffer
    }

    // Fill remaining days with targeted mock review of prime must-have questions
    const primeQuestions = scoredQuestions.filter(sq => sq.hasMust).map(sq => sq.question.id);
    const fallbackPool = primeQuestions.length > 0 ? primeQuestions : scoredQuestions.map(sq => sq.question.id);

    for (let i = scoredQuestions.length; i < validDays; i++) {
      const pickQ = fallbackPool[(i - scoredQuestions.length) % fallbackPool.length];
      days[i].question_ids.push(pickQ);
      days[i].minutes = 30; // standard drill session
    }
  } else {
    // More questions than days (e.g. 5 days, 15 questions)
    // Distribute earlier days with heavier/harder questions
    // Partition questions across validDays with front-loaded distribution
    let qIdx = 0;
    const questionsPerDay = Math.ceil(scoredQuestions.length / validDays);

    for (let dayIdx = 0; dayIdx < validDays; dayIdx++) {
      // Allocate chunk for today
      const remainingQuestions = scoredQuestions.length - qIdx;
      const remainingDays = validDays - dayIdx;
      const countForToday = Math.min(
        remainingQuestions,
        Math.max(1, Math.ceil(remainingQuestions / remainingDays))
      );

      for (let c = 0; c < countForToday && qIdx < scoredQuestions.length; c++) {
        days[dayIdx].question_ids.push(scoredQuestions[qIdx].question.id);
        days[dayIdx].minutes += scoredQuestions[qIdx].baseMinutes;
        qIdx++;
      }

      // Ensure a reasonable minimum integer duration per day
      if (days[dayIdx].minutes < 45) {
        days[dayIdx].minutes = 45;
      }
    }
  }

  // Ensure every must-have requirement appears somewhere in the schedule
  const mustReqs = requirements.filter(r => r.priority === 'must');
  const scheduledQuestionIds = new Set<string>();
  for (const d of days) {
    for (const qId of d.question_ids) {
      scheduledQuestionIds.add(qId);
    }
  }

  // Check if any must-have requirement's questions were missed
  for (const mustReq of mustReqs) {
    const coveringQuestions = questions.filter(q => q.requirement_ids.includes(mustReq.id));
    const isCoveredInSchedule = coveringQuestions.some(q => scheduledQuestionIds.has(q.id));

    if (!isCoveredInSchedule && coveringQuestions.length > 0) {
      // Add the covering question to Day 1 or Day 2
      const targetDay = days.length > 1 ? days[0] : days[0];
      const qToAdd = coveringQuestions[0].id;
      if (!targetDay.question_ids.includes(qToAdd)) {
        targetDay.question_ids.unshift(qToAdd);
        targetDay.minutes += 25;
      }
    }
  }

  // Assign descriptive focuses per day based on categories present
  const questionMap = new Map(questions.map(q => [q.id, q]));
  for (let i = 0; i < days.length; i++) {
    const day = days[i];
    const categoriesOnDay = day.question_ids
      .map(qId => questionMap.get(qId)?.category)
      .filter((cat): cat is NonNullable<typeof cat> => Boolean(cat));

    const uniqueCats = Array.from(new Set(categoriesOnDay));

    if (uniqueCats.includes('system-design') && uniqueCats.includes('technical')) {
      day.focus = 'Architecture, System Design & Core Technical Deep-Dive';
    } else if (uniqueCats.includes('technical')) {
      day.focus = 'Technical Mastery & Code Implementation';
    } else if (uniqueCats.includes('behavioural')) {
      day.focus = 'STAR Stories, Mentorship & Behavioural Competencies';
    } else if (uniqueCats.includes('company-fit')) {
      day.focus = 'Company Culture, Values & Final Alignment';
    } else if (i === days.length - 1 && days.length > 2) {
      day.focus = 'Final Polish, Key Concepts & Mock Simulation';
    } else {
      day.focus = `Core Review: ${uniqueCats.join(' & ') || 'Comprehensive Prep'}`;
    }

    // Round minutes to clean integer
    day.minutes = Math.round(day.minutes);
  }

  return {
    days_available: validDays,
    days
  };
}
