import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { User } from '../server/src/models/User.js';
import { Kit } from '../server/src/models/Kit.js';
import { PracticeSession } from '../server/src/models/PracticeSession.js';
import { AppendixAKit } from '../server/src/types/kit.js';

dotenv.config();

const uri = process.env.MONGODB_URI;

if (!uri) {
  console.error('No MONGODB_URI found in .env');
  process.exit(1);
}

async function seed() {
  console.log('Connecting to MongoDB Atlas...');
  await mongoose.connect(uri!);

  console.log('Connected! Creating initial data for interview-prep-kit...');

  // 1. Create a demo user
  const passwordHash = await bcrypt.hash('password123', 10);
  const userId = 'user_demo_01';

  await User.findOneAndUpdate(
    { email: 'lavaraju@example.com' },
    {
      _id: userId,
      email: 'lavaraju@example.com',
      passwordHash,
      name: 'Lavaraju Bandaru',
      createdAt: new Date()
    },
    { upsert: true, new: true }
  );
  console.log('✓ Created User in "users" collection');

  // 2. Create a sample kit conforming strictly to Appendix A
  const sampleKit: AppendixAKit = {
    source: {
      company: 'PostHog',
      company_url: 'https://posthog.com',
      role: 'Full Stack Engineer',
      location: 'Remote',
      jd_chars: 1240,
      researched_at: new Date().toISOString(),
      pages_used: ['https://posthog.com/careers', 'https://posthog.com/handbook']
    },
    company_brief: {
      summary: 'PostHog provides open-source product analytics, session recording, and feature flags built for engineering teams.',
      what_they_do: 'They build developer-centric analytics tools with transparent compensation and an open-source handbook.',
      sources: ['https://posthog.com']
    },
    role: {
      title: 'Full Stack Engineer',
      seniority: 'Senior',
      responsibilities: [
        'Build and scale high-throughput analytics query pipelines',
        'Create interactive dashboard visualization components in React and TypeScript'
      ],
      requirements: [
        { id: 'r1', text: 'Proficiency in Python / Django and React / TypeScript', kind: 'technical', priority: 'must' },
        { id: 'r2', text: 'Experience building data-intensive user interfaces', kind: 'technical', priority: 'must' },
        { id: 'r3', text: 'Strong ownership mindset and transparent engineering culture', kind: 'behavioural', priority: 'must' },
        { id: 'r4', text: 'Open-source contribution history', kind: 'technical', priority: 'nice' }
      ]
    },
    questions: [
      {
        id: 'q1',
        requirement_ids: ['r1'],
        category: 'technical',
        prompt: 'How do you optimize state management and rendering performance for data-intensive tables in React?',
        answer_outline: '1. Virtualization techniques (react-window). 2. Selective re-rendering with memo/useCallback. 3. Web Worker offloading for computation.',
        difficulty: 3
      },
      {
        id: 'q2',
        requirement_ids: ['r2'],
        category: 'system-design',
        prompt: 'Design an event ingestion service capable of processing 50,000 analytics events per second with sub-second querying.',
        answer_outline: 'Kafka buffer, ClickHouse analytical storage, Redis deduping, and read-replica routing.',
        difficulty: 3
      },
      {
        id: 'q3',
        requirement_ids: ['r3'],
        category: 'behavioural',
        prompt: 'Describe a project where you took full end-to-end ownership from user feedback to production deployment. How did you handle trade-offs?',
        answer_outline: 'STAR framework: Situation, Task, Action, and measurable Result. Transparent customer communication.',
        difficulty: 2
      },
      {
        id: 'q4',
        requirement_ids: ['r1', 'r3'],
        category: 'company-fit',
        prompt: 'Why do you want to build in the open at PostHog, and how do you align with public handbooks and async work?',
        answer_outline: 'Autonomy, async communication, high trust, and building products engineers love.',
        difficulty: 1
      }
    ],
    flashcards: [
      {
        id: 'f1',
        front: 'What is ClickHouse used for in large analytics platforms?',
        back: 'A columnar distributed DBMS designed for real-time analytical reporting (OLAP) on trillions of rows.',
        requirement_ids: ['r2']
      },
      {
        id: 'f2',
        front: 'What is the STAR method for behavioural interviews?',
        back: 'Situation (context), Task (goal), Action (what you specifically did), Result (quantifiable outcome).',
        requirement_ids: ['r3']
      }
    ],
    schedule: {
      days_available: 5,
      days: [
        { day: 1, focus: 'System Design & High-Throughput Ingestion', question_ids: ['q2'], minutes: 60 },
        { day: 2, focus: 'React State Optimization & TypeScript Deep-Dive', question_ids: ['q1'], minutes: 50 },
        { day: 3, focus: 'Behavioural STAR Stories & Autonomy', question_ids: ['q3'], minutes: 45 },
        { day: 4, focus: 'Flashcards Rapid Recall & Review', question_ids: ['q1', 'q2'], minutes: 40 },
        { day: 5, focus: 'Company Culture, Values & Final Alignment', question_ids: ['q4'], minutes: 35 }
      ]
    },
    coverage: {
      uncovered_requirement_ids: [],
      passes: 2
    }
  };

  const kitId = 'kit_demo_posthog_01';
  await Kit.findOneAndUpdate(
    { _id: kitId },
    {
      _id: kitId,
      userId,
      kit: sampleKit,
      createdAt: new Date(),
      updatedAt: new Date()
    },
    { upsert: true, new: true }
  );
  console.log('✓ Created Prep Kit in "kits" collection');

  // 3. Create a sample practice session
  await PracticeSession.findOneAndUpdate(
    { kitId, userId },
    {
      _id: 'session_demo_01',
      kitId,
      userId,
      reviews: [
        { cardId: 'f1', confidence: 3, reviewedAt: new Date() },
        { cardId: 'f2', confidence: 2, reviewedAt: new Date() }
      ],
      updatedAt: new Date()
    },
    { upsert: true, new: true }
  );
  console.log('✓ Created Practice Session in "practicesessions" collection');

  console.log('\n🎉 Successfully initialized interview-prep-kit database in MongoDB Atlas!');
  await mongoose.disconnect();
}

seed().catch(err => {
  console.error('Seed error:', err);
  process.exit(1);
});
