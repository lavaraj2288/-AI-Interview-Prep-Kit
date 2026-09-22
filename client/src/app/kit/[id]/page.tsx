'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { kitApi } from '@/lib/api';
import MockInterviewModal from '@/components/MockInterviewModal';
import PrintCheatsheetModal from '@/components/PrintCheatsheetModal';

export default function KitBuilderPage() {
  const { id } = useParams();
  const router = useRouter();
  const kitId = id as string;

  const [kit, setKit] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [regenLoading, setRegenLoading] = useState<string | null>(null);

  // Tabs for question categories
  const [activeCategory, setActiveCategory] = useState<string>('all');

  // Modals
  const [mockQuestion, setMockQuestion] = useState<any | null>(null);
  const [isMockModalOpen, setIsMockModalOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  useEffect(() => {
    loadKit();
  }, [kitId]);

  const loadKit = async () => {
    setLoading(true);
    try {
      const res = await kitApi.get(kitId);
      setKit(res.kit);
    } catch (err) {
      console.error('Failed to load kit:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveKit = async () => {
    if (!kit) return;
    setSaving(true);
    setSaveSuccess(false);
    try {
      await kitApi.update(kitId, kit);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save kit changes');
    } finally {
      setSaving(false);
    }
  };

  // Section Regeneration
  const handleRegenerate = async (section: string, category?: string) => {
    const key = category ? `${section}:${category}` : section;
    if (
      !confirm(
        `Regenerate ${category || section}? Questions you edited or wrote by hand, as well as pinned questions, will be preserved.`
      )
    ) {
      return;
    }

    setRegenLoading(key);
    try {
      const res = await kitApi.regenerateSection(kitId, section, category);
      setKit(res.kit);
    } catch (err) {
      alert('Failed to regenerate section');
    } finally {
      setRegenLoading(null);
    }
  };

  // Inline Question Updates
  const updateQuestion = (qId: string, updates: Partial<any>) => {
    if (!kit) return;
    const updatedQuestions = kit.questions.map((q: any) => {
      if (q.id === qId) {
        return {
          ...q,
          ...updates,
          origin: q.origin === 'manual' ? 'manual' : 'edited', // Mark as edited so it survives regeneration!
        };
      }
      return q;
    });
    setKit({ ...kit, questions: updatedQuestions });
  };

  const togglePinQuestion = (qId: string) => {
    if (!kit) return;
    const updated = kit.questions.map((q: any) =>
      q.id === qId ? { ...q, pinned: !q.pinned } : q
    );
    setKit({ ...kit, questions: updated });
  };

  const deleteQuestion = (qId: string) => {
    if (!kit) return;
    setKit({
      ...kit,
      questions: kit.questions.filter((q: any) => q.id !== qId),
      // Also remove from schedule if present
      schedule: {
        ...kit.schedule,
        days: kit.schedule.days.map((d: any) => ({
          ...d,
          question_ids: d.question_ids.filter((id: string) => id !== qId),
        })),
      },
    });
  };

  const addManualQuestion = () => {
    if (!kit) return;
    const newId = `q_manual_${Date.now()}`;
    const newQ = {
      id: newId,
      requirement_ids: [kit.role.requirements[0]?.id || 'r1'],
      category: activeCategory === 'all' ? 'technical' : activeCategory,
      prompt: 'New Interview Question Prompt...',
      answer_outline: 'Outline the core points of a high-quality answer here...',
      difficulty: 2,
      origin: 'manual', // Manual origin survives any regeneration
      pinned: true,
    };
    setKit({
      ...kit,
      questions: [newQ, ...kit.questions],
    });
  };

  const moveQuestion = (qIndex: number, direction: 'up' | 'down') => {
    if (!kit) return;
    const newQuestions = [...kit.questions];
    const targetIndex = direction === 'up' ? qIndex - 1 : qIndex + 1;
    if (targetIndex < 0 || targetIndex >= newQuestions.length) return;

    const temp = newQuestions[qIndex];
    newQuestions[qIndex] = newQuestions[targetIndex];
    newQuestions[targetIndex] = temp;

    setKit({ ...kit, questions: newQuestions });
  };

  // Flashcard updates
  const updateFlashcard = (fId: string, updates: Partial<any>) => {
    if (!kit) return;
    const updated = kit.flashcards.map((f: any) =>
      f.id === fId ? { ...f, ...updates, origin: 'edited' } : f
    );
    setKit({ ...kit, flashcards: updated });
  };

  const addFlashcard = () => {
    if (!kit) return;
    const newF = {
      id: `f_manual_${Date.now()}`,
      front: 'New concept or question...',
      back: 'Explanation or key takeaway...',
      requirement_ids: [kit.role.requirements[0]?.id || 'r1'],
      origin: 'manual',
    };
    setKit({ ...kit, flashcards: [newF, ...kit.flashcards] });
  };

  const deleteFlashcard = (fId: string) => {
    if (!kit) return;
    setKit({
      ...kit,
      flashcards: kit.flashcards.filter((f: any) => f.id !== fId),
    });
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-12 text-slate-500 text-sm">
        Loading Kit Builder...
      </div>
    );
  }

  if (!kit) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
        <h2 className="text-xl font-bold text-slate-800 mb-2">Prep Kit Not Found</h2>
        <Link href="/dashboard" className="text-blue-600 font-semibold hover:underline">
          Return to Dashboard
        </Link>
      </div>
    );
  }

  const filteredQuestions =
    activeCategory === 'all'
      ? kit.questions
      : kit.questions.filter((q: any) => q.category === activeCategory);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
      {/* Top Banner & Actions */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mb-8 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800">
              {kit.role.seniority}
            </span>
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
              ✓ Coverage Passed (Pass {kit.coverage.passes})
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 mt-1">
            {kit.role.title}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Target Company:{' '}
            <a
              href={kit.source.company_url}
              target="_blank"
              rel="noreferrer"
              className="text-blue-600 hover:underline font-medium"
            >
              {kit.source.company} ↗
            </a>{' '}
            • {kit.schedule.days_available}-Day Schedule Plan
          </p>
        </div>

        {/* Builder Toolbar */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            href={`/practice/${kitId}`}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs sm:text-sm rounded-xl shadow-sm transition flex items-center gap-1.5"
          >
            <span>🃏</span> Practice Flashcards
          </Link>
          <button
            onClick={() => setIsPrintModalOpen(true)}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-xs sm:text-sm rounded-xl border border-slate-300 shadow-sm transition flex items-center gap-1.5"
          >
            <span>📄</span> Cheatsheet / Print
          </button>
          <button
            onClick={handleSaveKit}
            disabled={saving}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs sm:text-sm rounded-xl shadow-sm transition disabled:opacity-50 flex items-center gap-1.5"
          >
            {saving ? 'Saving...' : saveSuccess ? '✓ Saved!' : '💾 Save Changes'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Brief & Role & Schedule (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Company Brief Card */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <span>🏢</span> Company Brief
              </h2>
              <button
                onClick={() => handleRegenerate('company_brief')}
                disabled={regenLoading === 'company_brief'}
                className="text-[11px] text-blue-600 hover:text-blue-800 font-medium"
              >
                {regenLoading === 'company_brief' ? 'Regenerating...' : 'Regenerate Brief'}
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Summary
                </label>
                <textarea
                  rows={3}
                  value={kit.company_brief.summary}
                  onChange={(e) =>
                    setKit({
                      ...kit,
                      company_brief: { ...kit.company_brief, summary: e.target.value },
                    })
                  }
                  className="w-full text-xs text-slate-700 p-2 bg-slate-50 rounded-lg border border-slate-200 leading-relaxed focus:bg-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  What They Do & Engineering Culture
                </label>
                <textarea
                  rows={3}
                  value={kit.company_brief.what_they_do}
                  onChange={(e) =>
                    setKit({
                      ...kit,
                      company_brief: { ...kit.company_brief, what_they_do: e.target.value },
                    })
                  }
                  className="w-full text-xs text-slate-700 p-2 bg-slate-50 rounded-lg border border-slate-200 leading-relaxed focus:bg-white"
                />
              </div>
              <div className="text-[10px] text-slate-400">
                Sources: {kit.company_brief.sources?.length || 0} page(s) crawled
              </div>
            </div>
          </div>

          {/* Role Requirements Card */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <h2 className="font-bold text-slate-900 text-sm mb-3 flex items-center gap-2">
              <span>🎯</span> Extracted Requirements ({kit.role.requirements.length})
            </h2>
            <div className="space-y-2">
              {kit.role.requirements.map((r: any) => (
                <div
                  key={r.id}
                  className={`p-2.5 rounded-xl border text-xs leading-snug flex items-start gap-2 ${
                    r.priority === 'must'
                      ? 'bg-amber-50/60 border-amber-200 text-slate-800'
                      : 'bg-slate-50 border-slate-200 text-slate-700'
                  }`}
                >
                  <span
                    className={`px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase shrink-0 ${
                      r.priority === 'must'
                        ? 'bg-amber-200 text-amber-900'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {r.priority}
                  </span>
                  <span className="font-mono text-[10px] text-slate-400 shrink-0">
                    {r.id}
                  </span>
                  <span className="flex-1">{r.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Schedule Summary Card */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <span>📅</span> {kit.schedule.days_available}-Day Schedule
              </h2>
              <button
                onClick={() => handleRegenerate('schedule')}
                disabled={regenLoading === 'schedule'}
                className="text-[11px] text-blue-600 hover:text-blue-800 font-medium"
              >
                {regenLoading === 'schedule' ? 'Recalculating...' : 'Recalculate Schedule'}
              </button>
            </div>
            <div className="space-y-2">
              {kit.schedule.days.map((day: any) => (
                <div
                  key={day.day}
                  className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs flex justify-between items-center"
                >
                  <div>
                    <span className="font-bold text-slate-800 mr-2">Day {day.day}:</span>
                    <span className="text-slate-600">{day.focus}</span>
                  </div>
                  <span className="font-semibold text-slate-500 text-[11px] bg-white px-2 py-0.5 rounded border border-slate-200 shrink-0 ml-2">
                    {day.minutes} min
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Question Bank & Flashcards (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Question Bank Header & Controls */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-3">
              <div>
                <h2 className="font-bold text-slate-900 text-base flex items-center gap-2">
                  <span>❓</span> Categorized Question Bank ({filteredQuestions.length})
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Reorder, edit inline, move categories, or drill with the mock simulator.
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={addManualQuestion}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg transition"
                >
                  + Add Question
                </button>
                {activeCategory !== 'all' && (
                  <button
                    onClick={() => handleRegenerate('question_category', activeCategory)}
                    disabled={regenLoading === `question_category:${activeCategory}`}
                    className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold text-xs rounded-lg transition border border-blue-200"
                  >
                    {regenLoading === `question_category:${activeCategory}`
                      ? 'Regenerating...'
                      : `Regenerate ${activeCategory}`}
                  </button>
                )}
              </div>
            </div>

            {/* Category Filter Tabs */}
            <div className="flex flex-wrap gap-1.5 pt-4">
              {['all', 'technical', 'behavioural', 'system-design', 'company-fit'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition ${
                    activeCategory === cat
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat.replace('-', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Question List */}
          <div className="space-y-4">
            {filteredQuestions.map((q: any, idx: number) => {
              const realIndex = kit.questions.findIndex((item: any) => item.id === q.id);
              const isPinned = q.pinned;
              const isEdited = q.origin === 'edited' || q.origin === 'manual';

              return (
                <div
                  key={q.id}
                  className={`bg-white p-5 rounded-2xl border shadow-sm transition ${
                    isPinned ? 'border-blue-300 ring-1 ring-blue-100' : 'border-slate-200'
                  }`}
                >
                  {/* Question Card Header */}
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-400 font-mono">Q{idx + 1}</span>
                      <select
                        value={q.category}
                        onChange={(e) => updateQuestion(q.id, { category: e.target.value })}
                        className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="technical">Technical</option>
                        <option value="behavioural">Behavioural</option>
                        <option value="system-design">System Design</option>
                        <option value="company-fit">Company Fit</option>
                      </select>

                      {/* Origin badges */}
                      {isEdited && (
                        <span className="text-[10px] px-2 py-0.5 bg-amber-50 text-amber-800 font-bold rounded-full border border-amber-200">
                          {q.origin === 'manual' ? 'Handwritten' : 'Edited (Protected)'}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {/* Difficulty Selector */}
                      <span className="text-[11px] text-slate-400">Diff:</span>
                      <select
                        value={q.difficulty}
                        onChange={(e) =>
                          updateQuestion(q.id, { difficulty: parseInt(e.target.value, 10) })
                        }
                        className="text-xs font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-800 border-none"
                      >
                        <option value={1}>1 (Junior)</option>
                        <option value={2}>2 (Mid)</option>
                        <option value={3}>3 (Senior)</option>
                      </select>

                      {/* Pin Button */}
                      <button
                        onClick={() => togglePinQuestion(q.id)}
                        title={isPinned ? 'Unpin question' : 'Pin to preserve from regeneration'}
                        className={`p-1.5 rounded text-xs ${
                          isPinned ? 'text-blue-600 bg-blue-50 font-bold' : 'text-slate-400 hover:text-slate-600'
                        }`}
                      >
                        📌 {isPinned ? 'Pinned' : 'Pin'}
                      </button>

                      {/* Reorder Buttons */}
                      <button
                        onClick={() => moveQuestion(realIndex, 'up')}
                        disabled={realIndex === 0}
                        className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                      >
                        ▲
                      </button>
                      <button
                        onClick={() => moveQuestion(realIndex, 'down')}
                        disabled={realIndex === kit.questions.length - 1}
                        className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30"
                      >
                        ▼
                      </button>

                      {/* Delete */}
                      <button
                        onClick={() => deleteQuestion(q.id)}
                        className="p-1 text-red-400 hover:text-red-600 ml-1"
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  {/* Question Prompt Editor */}
                  <div className="py-3">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Prompt
                    </label>
                    <textarea
                      rows={2}
                      value={q.prompt}
                      onChange={(e) => updateQuestion(q.id, { prompt: e.target.value })}
                      className="w-full text-sm font-semibold text-slate-900 p-2 bg-slate-50/50 hover:bg-slate-50 rounded-lg border border-slate-200 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  {/* Answer Outline Editor */}
                  <div className="pb-3">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                      Answer Outline & Benchmark Points
                    </label>
                    <textarea
                      rows={3}
                      value={q.answer_outline}
                      onChange={(e) => updateQuestion(q.id, { answer_outline: e.target.value })}
                      className="w-full text-xs text-slate-700 p-2 bg-slate-50/50 hover:bg-slate-50 rounded-lg border border-slate-200 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 leading-relaxed"
                    />
                  </div>

                  {/* Question Footer: Mapped Requirement & Mock Drill Trigger */}
                  <div className="flex flex-wrap items-center justify-between pt-2 border-t border-slate-100 text-xs gap-2">
                    <div className="text-[11px] text-slate-500 flex items-center gap-1">
                      <span>Covers:</span>
                      {q.requirement_ids?.map((rid: string) => (
                        <span
                          key={rid}
                          className="px-1.5 py-0.5 bg-slate-100 rounded text-[10px] font-mono text-slate-600"
                        >
                          {rid}
                        </span>
                      ))}
                    </div>

                    <button
                      onClick={() => {
                        setMockQuestion(q);
                        setIsMockModalOpen(true);
                      }}
                      className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg font-semibold text-xs flex items-center gap-1 transition"
                    >
                      <span>🎙️</span> Practice Mock Drill
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Flashcard Manager */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="font-bold text-slate-900 text-base flex items-center gap-2">
                  <span>🃏</span> Flashcard Deck ({kit.flashcards.length})
                </h2>
                <p className="text-xs text-slate-400">
                  Quick recall cards used in Practice Mode with spaced repetition.
                </p>
              </div>
              <button
                onClick={addFlashcard}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg transition"
              >
                + Add Card
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {kit.flashcards.map((f: any) => (
                <div
                  key={f.id}
                  className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-2 relative"
                >
                  <button
                    onClick={() => deleteFlashcard(f.id)}
                    className="absolute top-2 right-2 text-slate-400 hover:text-red-500 text-xs"
                  >
                    ✕
                  </button>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase">
                      Front
                    </label>
                    <textarea
                      rows={2}
                      value={f.front}
                      onChange={(e) => updateFlashcard(f.id, { front: e.target.value })}
                      className="w-full text-xs font-semibold p-1.5 bg-white rounded border border-slate-200"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase">
                      Back
                    </label>
                    <textarea
                      rows={2}
                      value={f.back}
                      onChange={(e) => updateFlashcard(f.id, { back: e.target.value })}
                      className="w-full text-xs text-slate-600 p-1.5 bg-white rounded border border-slate-200"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <MockInterviewModal
        isOpen={isMockModalOpen}
        onClose={() => setIsMockModalOpen(false)}
        question={mockQuestion}
      />

      <PrintCheatsheetModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        kit={kit}
      />
    </div>
  );
}
