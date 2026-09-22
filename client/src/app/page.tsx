'use client';

import Link from 'next/link';
import { ArrowRight, Bot, Compass, CheckCircle2, RotateCcw, ShieldCheck, Sparkles, BookOpen, Layers } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="space-y-16 py-6">
      {/* Hero Section */}
      <section className="text-center space-y-6 max-w-4xl mx-auto pt-8">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs font-medium">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Full-Stack Engineering Assessment FS-AI-INTERVIEW-01</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-tight">
          Turn Any Job Description Into A{' '}
          <span className="bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
            Personalized Interview Kit
          </span>
        </h1>

        <p className="text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
          Paste the job description, enter the company website, and specify your preparation horizon.
          The pipeline crawls company hiring culture, guarantees must-have coverage with a second-pass loop, and generates a day-by-day arithmetic schedule.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-6 py-3 rounded-xl shadow-lg shadow-emerald-600/25 transition"
          >
            Open Preparation Studio
            <ArrowRight className="w-4 h-4" />
          </Link>
          <a
            href="#how-it-works"
            className="flex items-center gap-2 border border-slate-700 bg-slate-900/60 hover:bg-slate-800 text-slate-300 font-medium px-6 py-3 rounded-xl transition"
          >
            How the Pipeline Works
          </a>
        </div>
      </section>

      {/* Feature Grid */}
      <section id="how-it-works" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-12">
        <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/40 backdrop-blur-sm space-y-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Compass className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-semibold text-white">1. Intelligent Company Crawling</h3>
          <p className="text-sm text-slate-400 leading-relaxed">
            Crawls the company domain, respects robots.txt, heuristically ranks links for <code className="text-xs bg-slate-800 px-1 py-0.5 rounded">/careers</code>, <code className="text-xs bg-slate-800 px-1 py-0.5 rounded">/handbook</code>, and hiring culture, handling local & external URLs safely.
          </p>
        </div>

        <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/40 backdrop-blur-sm space-y-3">
          <div className="w-10 h-10 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-400">
            <RotateCcw className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-semibold text-white">2. Deterministic Second Pass</h3>
          <p className="text-sm text-slate-400 leading-relaxed">
            Code (not a prompt) checks generated questions against requirements. If any must-have requirement lacks questions, a second pass generates targeted questions to close the gap.
          </p>
        </div>

        <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/40 backdrop-blur-sm space-y-3">
          <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <Layers className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-semibold text-white">3. Reshapeable Kit Builder</h3>
          <p className="text-sm text-slate-400 leading-relaxed">
            Edit, reorder, move between categories, pin items, and add questions by hand. Regenerating a category or brief strictly preserves your manual edits.
          </p>
        </div>

        <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/40 backdrop-blur-sm space-y-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <BookOpen className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-semibold text-white">4. Interactive Practice Mode</h3>
          <p className="text-sm text-slate-400 leading-relaxed">
            Step through high-yield flashcards, flip to reveal answers, record 1–3 confidence ratings, with keyboard shortcuts and smart session sorting prioritizing least confident cards.
          </p>
        </div>

        <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/40 backdrop-blur-sm space-y-3">
          <div className="w-10 h-10 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400">
            <Bot className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-semibold text-white">5. AI Mock Interview Drill</h3>
          <p className="text-sm text-slate-400 leading-relaxed">
            Optional creative feature: practice answering questions from your kit and receive instantaneous AI evaluation on scoring, strengths, and missing points.
          </p>
        </div>

        <div className="p-6 rounded-2xl border border-slate-800 bg-slate-900/40 backdrop-blur-sm space-y-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-semibold text-white">6. Mandatory Batch Evaluator</h3>
          <p className="text-sm text-slate-400 leading-relaxed">
            Supports <code className="text-xs bg-slate-800 px-1 py-0.5 rounded">npm run evaluate -- --input &lt;cases.json&gt; --output &lt;kits.json&gt;</code> producing exact Appendix B JSON output from a clean clone.
          </p>
        </div>
      </section>
    </div>
  );
}
