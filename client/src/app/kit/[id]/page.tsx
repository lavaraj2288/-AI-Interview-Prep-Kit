'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '../../../lib/api';
import { MockInterviewModal } from '../../../components/MockInterviewModal';
import { PrintCheatsheetModal } from '../../../components/PrintCheatsheetModal';
import {
  Save, RotateCcw, Pin, PinOff, Plus, Trash2, BookOpen, Bot, Printer,
  CheckCircle, AlertCircle, ArrowUpDown, ChevronRight, Sparkles, Building2,
  Calendar, Layers, Clock, ShieldCheck, Tag
} from 'lucide-react';

export default function KitBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const [kit, setKit] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [regeneratingSection, setRegeneratingSection] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('technical');
  const [showMockModal, setShowMockModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState('');

  useEffect(() => {
    if (id) {
      api.getKitById(id)
        .then(res => setKit(res.kit))
        .catch(() => setKit(null))
        .finally(() => setLoading(false));
    }
  }, [id]);

  const showNotification = (msg: string) => {
    setFeedbackMsg(msg);
    setTimeout(() => setFeedbackMsg(''), 3000);
  };

  const handleSave = async () => {
    if (!kit || !id) return;
    setSaving(true);
    try {
      await api.updateKit(id, kit);
      showNotification('All edits saved successfully!');
    } catch (err: any) {
      alert(err.message || 'Failed to save kit');
    } finally {
      setSaving(false);
    }
  };

  // Section 6: Regenerate section while preserving pinned and edited state
  const handleRegenerate = async (target: string) => {
    if (!id) return;
    setRegeneratingSection(target);
    try {
      const res = await api.regenerateSection(id, target);
      setKit(res.kit);
      showNotification(`Section '${target}' regenerated! Preserved edited and pinned items.`);
    } catch (err: any) {
      alert(err.message || 'Failed to regenerate section');
    } finally {
      setRegeneratingSection(null);
    }
  };

  // Edit question inline & mark state as 'edited'
  const handleUpdateQuestion = (qId: string, field: string, value: any) => {
    setKit((prev: any) => {
      const updatedQuestions = prev.questions.map((q: any) => {
        if (q.id === qId) {
          return {
            ...q,
            [field]: value,
            origin: q.origin === 'pinned' ? 'pinned' : 'edited'
          };
        }
        return q;
      });
      return { ...prev, questions: updatedQuestions };
    });
  };

  // Move question across categories
  const handleMoveQuestionCategory = (qId: string, newCat: string) => {
    setKit((prev: any) => {
      const updatedQuestions = prev.questions.map((q: any) => {
        if (q.id === qId) {
          return { ...q, category: newCat, origin: 'edited' };
        }
        return q;
      });
      return { ...prev, questions: updatedQuestions };
    });
  };

  // Toggle pin
  const handleTogglePin = (qId: string) => {
    setKit((prev: any) => {
      const updatedQuestions = prev.questions.map((q: any) => {
        if (q.id === qId) {
          const nextOrigin = q.origin === 'pinned' ? 'edited' : 'pinned';
          return { ...q, origin: nextOrigin };
        }
        return q;
      });
      return { ...prev, questions: updatedQuestions };
    });
  };

  // Add question by hand
  const handleAddQuestion = () => {
    const newId = `q_custom_${Date.now()}`;
    const newQ = {
      id: newId,
      requirement_ids: [kit.role.requirements[0]?.id || 'r1'],
      category: activeCategory,
      prompt: 'New custom interview question (click to edit)',
      answer_outline: 'Custom answer outline and key points...',
      difficulty: 2,
      origin: 'custom'
    };

    setKit((prev: any) => ({
      ...prev,
      questions: [...prev.questions, newQ]
    }));
  };

  // Delete question
  const handleDeleteQuestion = (qId: string) => {
    setKit((prev: any) => ({
      ...prev,
      questions: prev.questions.filter((q: any) => q.id !== qId)
    }));
  };

  // Flashcards: add/delete/update
  const handleUpdateFlashcard = (fId: string, field: 'front' | 'back', val: string) => {
    setKit((prev: any) => ({
      ...prev,
      flashcards: prev.flashcards.map((f: any) => f.id === fId ? { ...f, [field]: val, origin: 'edited' } : f)
    }));
  };

  const handleAddFlashcard = () => {
    const newF = {
      id: `f_custom_${Date.now()}`,
      front: 'New Flashcard Concept (click to edit)',
      back: 'Answer / explanation on reverse side...',
      requirement_ids: [kit.role.requirements[0]?.id || 'r1'],
      origin: 'custom'
    };
    setKit((prev: any) => ({
      ...prev,
      flashcards: [...prev.flashcards, newF]
    }));
  };

  const handleDeleteFlashcard = (fId: string) => {
    setKit((prev: any) => ({
      ...prev,
      flashcards: prev.flashcards.filter((f: any) => f.id !== fId)
    }));
  };

  if (loading) {
    return <div className="py-20 text-center text-slate-400">Loading Kit Builder...</div>;
  }

  if (!kit) {
    return (
      <div className="text-center py-20">
        <h2 className="text-xl font-bold text-white">Kit not found</h2>
        <Link href="/dashboard" className="text-emerald-400 hover:underline mt-2 inline-block">Return to Dashboard</Link>
      </div>
    );
  }

  const categoryQuestions = kit.questions.filter((q: any) => q.category === activeCategory);

  return (
    <div className="space-y-8 pb-16">
      {/* Top Banner & Actions */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400 uppercase tracking-wider mb-1">
            <Building2 className="w-3.5 h-3.5" />
            <span>{kit.source.company} • Horizon: {kit.schedule.days_available} Days</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            {kit.role.title}
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Researched at {new Date(kit.source.researched_at).toLocaleDateString()} • {kit.source.pages_used?.length || 1} pages crawled
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setShowMockModal(true)}
            className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold px-3.5 py-2 rounded-xl transition shadow"
          >
            <Bot className="w-4 h-4" />
            AI Mock Drill
          </button>

          <Link
            href={`/practice/${id}`}
            className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold px-3.5 py-2 rounded-xl transition shadow"
          >
            <BookOpen className="w-4 h-4" />
            Practice Mode
          </Link>

          <button
            onClick={() => setShowPrintModal(true)}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-3 py-2 rounded-xl border border-slate-700 transition"
          >
            <Printer className="w-4 h-4" />
            Cheatsheet
          </button>

          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 rounded-xl transition shadow"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Kit'}
          </button>
        </div>
      </div>

      {feedbackMsg && (
        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs flex items-center gap-2">
          <CheckCircle className="w-4 h-4" />
          <span>{feedbackMsg}</span>
        </div>
      )}

      {/* Coverage Status Bar */}
      <div className="p-4 rounded-2xl border border-slate-800 bg-slate-900/50 backdrop-blur-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          <div>
            <span className="font-semibold text-white">Coverage Engine Verification: </span>
            <span className="text-slate-300">
              {kit.coverage.passes} pass(es) executed.
              {kit.coverage.uncovered_requirement_ids.length === 0 ? (
                <span className="text-emerald-400 ml-1">100% of must-have requirements mapped to interview questions.</span>
              ) : (
                <span className="text-amber-400 ml-1">
                  Uncovered requirement IDs: {kit.coverage.uncovered_requirement_ids.join(', ')}
                </span>
              )}
            </span>
          </div>
        </div>

        <button
          onClick={() => handleRegenerate('schedule')}
          disabled={regeneratingSection === 'schedule'}
          className="flex items-center gap-1 text-slate-400 hover:text-white px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 transition"
        >
          <RotateCcw className={`w-3.5 h-3.5 ${regeneratingSection === 'schedule' ? 'animate-spin' : ''}`} />
          <span>Recalculate Schedule</span>
        </button>
      </div>

      {/* Section 1: Company Brief */}
      <section className="p-6 rounded-2xl border border-slate-800 bg-slate-900/40 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Building2 className="w-5 h-5 text-emerald-400" />
            Company Intelligence & Brief
          </h2>
          <button
            onClick={() => handleRegenerate('brief')}
            disabled={regeneratingSection === 'brief'}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 transition"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${regeneratingSection === 'brief' ? 'animate-spin' : ''}`} />
            <span>Regenerate Brief</span>
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              Summary (Inline Editable)
            </label>
            <textarea
              rows={2}
              value={kit.company_brief.summary}
              onChange={e => setKit({ ...kit, company_brief: { ...kit.company_brief, summary: e.target.value } })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
              What They Do & Hiring Culture (Inline Editable)
            </label>
            <textarea
              rows={3}
              value={kit.company_brief.what_they_do}
              onChange={e => setKit({ ...kit, company_brief: { ...kit.company_brief, what_they_do: e.target.value } })}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>
      </section>

      {/* Section 2: Role & Requirements */}
      <section className="p-6 rounded-2xl border border-slate-800 bg-slate-900/40 space-y-4">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <Tag className="w-5 h-5 text-emerald-400" />
          Extracted Role & Requirements
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {kit.role.requirements.map((req: any) => (
            <div key={req.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-mono font-bold text-emerald-400">[{req.id}]</span>
                <div className="flex items-center gap-1.5">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                    req.priority === 'must' ? 'bg-red-500/20 text-red-300' : 'bg-blue-500/20 text-blue-300'
                  }`}>
                    {req.priority}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] uppercase">
                    {req.kind}
                  </span>
                </div>
              </div>
              <p className="text-xs text-slate-200">{req.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Section 3: Question Bank & The Builder */}
      <section className="p-6 rounded-2xl border border-slate-800 bg-slate-900/40 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-emerald-400" />
              Categorized Question Bank (The Builder)
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Inline edit prompts and outlines, move questions between categories, and regenerate individual sections while preserving edited/pinned cards.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleAddQuestion}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-700 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Question
            </button>

            <button
              onClick={() => handleRegenerate(`questions:${activeCategory}`)}
              disabled={regeneratingSection === `questions:${activeCategory}`}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${regeneratingSection === `questions:${activeCategory}` ? 'animate-spin' : ''}`} />
              <span>Regenerate {activeCategory}</span>
            </button>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex flex-wrap gap-2">
          {(['technical', 'system-design', 'behavioural', 'company-fit'] as const).map(cat => {
            const count = kit.questions.filter((q: any) => q.category === cat).length;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider transition flex items-center gap-2 ${
                  activeCategory === cat
                    ? 'bg-emerald-600 text-white shadow'
                    : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                <span>{cat}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-900/60">
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Question Cards List */}
        <div className="space-y-4">
          {categoryQuestions.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-slate-800 rounded-xl text-xs text-slate-500">
              No questions currently in this category. Click &quot;Add Question&quot; or &quot;Regenerate {activeCategory}&quot;.
            </div>
          ) : (
            categoryQuestions.map((q: any) => (
              <div
                key={q.id}
                className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 space-y-3 relative group"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-emerald-400">[{q.id}]</span>
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-semibold">
                      Diff: {q.difficulty}/3
                    </span>
                    <span className="text-slate-400 text-[10px]">
                      Covers: {q.requirement_ids?.join(', ') || 'r1'}
                    </span>
                    {q.origin && (
                      <span className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                        q.origin === 'pinned' ? 'bg-amber-500/20 text-amber-300' :
                        q.origin === 'edited' ? 'bg-indigo-500/20 text-indigo-300' :
                        q.origin === 'custom' ? 'bg-teal-500/20 text-teal-300' :
                        'bg-slate-800 text-slate-400'
                      }`}>
                        {q.origin}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Move to another category */}
                    <select
                      value={q.category}
                      onChange={e => handleMoveQuestionCategory(q.id, e.target.value)}
                      className="bg-slate-900 border border-slate-800 rounded px-2 py-1 text-[11px] text-slate-300 focus:outline-none"
                    >
                      <option value="technical">Technical</option>
                      <option value="system-design">System Design</option>
                      <option value="behavioural">Behavioural</option>
                      <option value="company-fit">Company Fit</option>
                    </select>

                    {/* Pin button */}
                    <button
                      onClick={() => handleTogglePin(q.id)}
                      className={`p-1.5 rounded hover:bg-slate-800 transition ${
                        q.origin === 'pinned' ? 'text-amber-400' : 'text-slate-500'
                      }`}
                      title={q.origin === 'pinned' ? 'Pinned (survives regeneration)' : 'Pin question'}
                    >
                      {q.origin === 'pinned' ? <Pin className="w-3.5 h-3.5" /> : <PinOff className="w-3.5 h-3.5" />}
                    </button>

                    {/* Delete button */}
                    <button
                      onClick={() => handleDeleteQuestion(q.id)}
                      className="p-1.5 text-slate-500 hover:text-red-400 rounded hover:bg-slate-800 transition"
                      title="Delete question"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Inline editable prompt */}
                <div>
                  <textarea
                    rows={2}
                    value={q.prompt}
                    onChange={e => handleUpdateQuestion(q.id, 'prompt', e.target.value)}
                    className="w-full bg-slate-900/60 border border-slate-800 rounded-lg p-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {/* Inline editable answer outline */}
                <div>
                  <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1">
                    Answer Outline / Assessment Criteria
                  </label>
                  <textarea
                    rows={2}
                    value={q.answer_outline}
                    onChange={e => handleUpdateQuestion(q.id, 'answer_outline', e.target.value)}
                    className="w-full bg-slate-900/40 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Section 4: Day-by-Day Arithmetic Schedule */}
      <section className="p-6 rounded-2xl border border-slate-800 bg-slate-900/40 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Calendar className="w-5 h-5 text-emerald-400" />
            Day-by-Day Study Schedule ({kit.schedule.days_available} Days)
          </h2>
          <span className="text-xs text-slate-400">Pure Arithmetic Distribution</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {kit.schedule.days.map((day: any) => (
            <div key={day.day} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-emerald-400">Day {day.day}</span>
                <span className="flex items-center gap-1 text-slate-400">
                  <Clock className="w-3 h-3" />
                  {day.minutes} mins
                </span>
              </div>
              <p className="text-xs font-semibold text-white">{day.focus}</p>
              <div className="pt-2 border-t border-slate-800/80">
                <span className="text-[10px] text-slate-500 block mb-1">Assigned Questions:</span>
                <div className="flex flex-wrap gap-1">
                  {day.question_ids.map((qId: string) => (
                    <span key={qId} className="px-1.5 py-0.5 rounded bg-slate-900 text-slate-300 text-[10px] border border-slate-800 font-mono">
                      {qId}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Section 5: Flashcards Preview */}
      <section className="p-6 rounded-2xl border border-slate-800 bg-slate-900/40 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-emerald-400" />
              Flashcards Deck ({kit.flashcards.length} Cards)
            </h2>
            <p className="text-xs text-slate-400 mt-1">Inline editable card deck for rapid concept drills.</p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleAddFlashcard}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-700 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Card
            </button>
            <Link
              href={`/practice/${id}`}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3.5 py-1.5 rounded-lg transition"
            >
              Launch Practice Mode
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {kit.flashcards.map((f: any) => (
            <div key={f.id} className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 relative">
              <div className="flex justify-between items-center text-xs">
                <span className="font-mono text-emerald-400 font-bold">[{f.id}]</span>
                <button
                  onClick={() => handleDeleteFlashcard(f.id)}
                  className="text-slate-500 hover:text-red-400 p-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <input
                type="text"
                value={f.front}
                onChange={e => handleUpdateFlashcard(f.id, 'front', e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-emerald-500"
              />
              <textarea
                rows={2}
                value={f.back}
                onChange={e => handleUpdateFlashcard(f.id, 'back', e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-emerald-500"
              />
            </div>
          ))}
        </div>
      </section>

      {/* Modals */}
      {showMockModal && (
        <MockInterviewModal
          kitId={id}
          questions={kit.questions}
          onClose={() => setShowMockModal(false)}
        />
      )}

      {showPrintModal && (
        <PrintCheatsheetModal
          kit={kit}
          onClose={() => setShowPrintModal(false)}
        />
      )}
    </div>
  );
}
