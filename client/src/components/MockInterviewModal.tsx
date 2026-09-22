'use client';

import { useState } from 'react';
import { api } from '../lib/api';
import { Bot, CheckCircle, AlertTriangle, Lightbulb, X, Send, Sparkles } from 'lucide-react';

interface MockInterviewModalProps {
  kitId: string;
  questions: any[];
  onClose: () => void;
}

export function MockInterviewModal({ kitId, questions, onClose }: MockInterviewModalProps) {
  const [selectedQuestionId, setSelectedQuestionId] = useState(questions[0]?.id || '');
  const [userAnswer, setUserAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const currentQuestion = questions.find(q => q.id === selectedQuestionId);

  const handleEvaluate = async () => {
    if (!userAnswer.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const res = await api.evaluateMockAnswer(kitId, selectedQuestionId, userAnswer);
      setResult(res.evaluation);
    } catch (err: any) {
      setError(err.message || 'Evaluation failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center gap-2 text-emerald-400">
            <Bot className="w-5 h-5" />
            <h3 className="text-lg font-bold text-white">AI Mock Interview Simulator</h3>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Question Selector */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Select Question to Drill</label>
          <select
            value={selectedQuestionId}
            onChange={e => {
              setSelectedQuestionId(e.target.value);
              setResult(null);
            }}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
          >
            {questions.map(q => (
              <option key={q.id} value={q.id}>
                [{q.category.toUpperCase()}] {q.prompt.slice(0, 80)}...
              </option>
            ))}
          </select>
        </div>

        {/* Current Question Display */}
        {currentQuestion && (
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800/80 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-emerald-400 uppercase">{currentQuestion.category}</span>
              <span className="text-slate-400">Difficulty: {currentQuestion.difficulty}/3</span>
            </div>
            <p className="text-sm font-medium text-white">{currentQuestion.prompt}</p>
          </div>
        )}

        {/* Answer Input */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Your Spoken / Written Response</label>
          <textarea
            rows={4}
            value={userAnswer}
            onChange={e => setUserAnswer(e.target.value)}
            placeholder="Structure your answer using STAR or concrete architectural principles..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <button
          onClick={handleEvaluate}
          disabled={loading || !userAnswer.trim()}
          className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium py-2.5 rounded-xl shadow transition"
        >
          {loading ? (
            <span>Analyzing Answer with Interview Model...</span>
          ) : (
            <>
              <Send className="w-4 h-4" />
              <span>Submit for Instant AI Feedback</span>
            </>
          )}
        </button>

        {error && (
          <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs">
            {error}
          </div>
        )}

        {/* Evaluation Results */}
        {result && (
          <div className="p-5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-800/60 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-emerald-400" />
                <span className="font-semibold text-white">Score: {result.score}/100</span>
              </div>
              <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                result.score >= 80 ? 'bg-emerald-500/20 text-emerald-400' :
                result.score >= 65 ? 'bg-amber-500/20 text-amber-400' :
                'bg-red-500/20 text-red-400'
              }`}>
                {result.rating}
              </span>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" /> Strengths Identified:
              </span>
              <ul className="list-disc list-inside text-xs text-slate-300 space-y-1">
                {result.strengths?.map((s: string, i: number) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-semibold text-amber-400 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> Areas to Elevate:
              </span>
              <ul className="list-disc list-inside text-xs text-slate-300 space-y-1">
                {result.areas_for_improvement?.map((a: string, i: number) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </div>

            {result.model_response_tip && (
              <div className="p-3 rounded-lg bg-emerald-950/30 border border-emerald-800/40 text-xs text-emerald-200 flex items-start gap-2">
                <Lightbulb className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                <span><strong>Coach Tip:</strong> {result.model_response_tip}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
