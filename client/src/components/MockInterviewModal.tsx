'use client';

import { useState } from 'react';
import { mockInterviewApi } from '@/lib/api';

interface MockInterviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  question: {
    id: string;
    prompt: string;
    answer_outline: string;
    category: string;
  } | null;
}

export default function MockInterviewModal({
  isOpen,
  onClose,
  question,
}: MockInterviewModalProps) {
  const [candidateAnswer, setCandidateAnswer] = useState('');
  const [evaluating, setEvaluating] = useState(false);
  const [evaluation, setEvaluation] = useState<any | null>(null);
  const [evalError, setEvalError] = useState('');

  if (!isOpen || !question) return null;

  const handleEvaluate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!candidateAnswer.trim()) return;

    setEvaluating(true);
    setEvalError('');
    setEvaluation(null);

    try {
      const res = await mockInterviewApi.evaluate({
        questionPrompt: question.prompt,
        answerOutline: question.answer_outline,
        candidateAnswer,
        category: question.category,
      });
      setEvaluation(res.evaluation);
    } catch (err) {
      setEvalError(err instanceof Error ? err.message : 'Evaluation failed.');
    } finally {
      setEvaluating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 sm:p-7 shadow-2xl border border-slate-100 my-8">
        <div className="flex justify-between items-start mb-4">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
              Mock Interview Simulator
            </span>
            <h3 className="text-lg font-bold text-slate-900 mt-1">Live Answer Drill</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 font-bold text-lg"
          >
            ✕
          </button>
        </div>

        {/* Question prompt card */}
        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 mb-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Interview Question ({question.category})
          </p>
          <p className="text-sm font-semibold text-slate-900">{question.prompt}</p>
        </div>

        {!evaluation ? (
          <form onSubmit={handleEvaluate} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                Your Answer (Type or speak what you would say in the interview)
              </label>
              <textarea
                required
                rows={6}
                value={candidateAnswer}
                onChange={(e) => setCandidateAnswer(e.target.value)}
                placeholder="Structure your answer clearly (e.g. Situation, Task, Action, Result)..."
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-sans leading-relaxed"
              />
            </div>

            {evalError && (
              <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-200">
                {evalError}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={evaluating}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-sm shadow transition disabled:opacity-50 flex items-center gap-2"
              >
                {evaluating ? 'Analyzing Answer...' : '🎯 Evaluate Against Rubric'}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-5">
            {/* Score Badges */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-center">
                <span className="text-2xl font-black text-blue-600">
                  {evaluation.overallScore}/100
                </span>
                <p className="text-[11px] font-bold text-blue-900 mt-0.5">Overall Score</p>
              </div>
              <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
                <span className="text-2xl font-black text-emerald-600">
                  {evaluation.accuracyScore}/100
                </span>
                <p className="text-[11px] font-bold text-emerald-900 mt-0.5">Technical Accuracy</p>
              </div>
              <div className="p-3.5 bg-purple-50 border border-purple-200 rounded-xl text-center">
                <span className="text-2xl font-black text-purple-600">
                  {evaluation.communicationScore}/100
                </span>
                <p className="text-[11px] font-bold text-purple-900 mt-0.5">Communication</p>
              </div>
            </div>

            {/* Strengths & Improvements */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3.5 bg-emerald-50/50 rounded-xl border border-emerald-200">
                <h4 className="text-xs font-bold text-emerald-800 uppercase tracking-wider mb-2">
                  ✓ Strengths
                </h4>
                <ul className="text-xs text-slate-700 space-y-1 list-disc list-inside">
                  {evaluation.strengths?.map((s: string, idx: number) => (
                    <li key={idx}>{s}</li>
                  ))}
                </ul>
              </div>

              <div className="p-3.5 bg-amber-50/50 rounded-xl border border-amber-200">
                <h4 className="text-xs font-bold text-amber-800 uppercase tracking-wider mb-2">
                  ▲ Areas for Improvement
                </h4>
                <ul className="text-xs text-slate-700 space-y-1 list-disc list-inside">
                  {evaluation.improvements?.map((imp: string, idx: number) => (
                    <li key={idx}>{imp}</li>
                  ))}
                </ul>
              </div>
            </div>

            {/* General feedback */}
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs leading-relaxed">
              <span className="font-bold text-slate-800">Interviewer Feedback: </span>
              <span className="text-slate-700">{evaluation.feedback}</span>
            </div>

            {/* Follow-up probe */}
            {evaluation.followUpQuestion && (
              <div className="p-3.5 bg-blue-50/50 border border-blue-200 rounded-xl text-xs">
                <span className="font-bold text-blue-900">Interviewer Follow-up: </span>
                <span className="text-blue-800 italic">"{evaluation.followUpQuestion}"</span>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setEvaluation(null)}
                className="px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg font-semibold"
              >
                Try Answering Again
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-900 text-white hover:bg-slate-800 rounded-lg text-sm font-semibold"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
