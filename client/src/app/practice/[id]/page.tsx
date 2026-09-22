'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '../../../lib/api';
import {
  ArrowLeft, ArrowRight, RotateCw, CheckCircle2, AlertTriangle,
  Award, Layers, Keyboard, Sparkles, BookOpen
} from 'lucide-react';

export default function PracticeModePage() {
  const { id } = useParams<{ id: string }>();
  const [sessionData, setSessionData] = useState<any>(null);
  const [cards, setCards] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [recording, setRecording] = useState(false);

  const fetchSession = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const data = await api.getPracticeSession(id);
      setSessionData(data);
      setCards(data.prioritizedCards || []);
      setCurrentIndex(0);
      setIsFlipped(false);
    } catch {
      // fallback
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  const currentCard = cards[currentIndex];

  const handleRate = async (confidence: number) => {
    if (!id || !currentCard || recording) return;
    setRecording(true);
    try {
      await api.recordReview(id, currentCard.id, confidence);

      // Advance to next card or loop
      if (currentIndex + 1 < cards.length) {
        setCurrentIndex(prev => prev + 1);
        setIsFlipped(false);
      } else {
        // Finished deck round
        setIsFlipped(false);
      }

      // Refresh background stats
      api.getPracticeSession(id).then(res => setSessionData(res));
    } catch (err: any) {
      alert(err.message || 'Failed to record review');
    } finally {
      setRecording(false);
    }
  };

  // Keyboard navigation (Section 12: keyboard accessible)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        setIsFlipped(prev => !prev);
      } else if (e.key === '1') {
        e.preventDefault();
        handleRate(1);
      } else if (e.key === '2') {
        e.preventDefault();
        handleRate(2);
      } else if (e.key === '3') {
        e.preventDefault();
        handleRate(3);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (currentIndex + 1 < cards.length) {
          setCurrentIndex(prev => prev + 1);
          setIsFlipped(false);
        }
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (currentIndex > 0) {
          setCurrentIndex(prev => prev - 1);
          setIsFlipped(false);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, cards.length, isFlipped, id, currentCard, recording]);

  if (loading) {
    return <div className="py-20 text-center text-slate-400">Loading Practice Deck...</div>;
  }

  if (!cards || cards.length === 0) {
    return (
      <div className="py-20 text-center space-y-4">
        <h2 className="text-xl font-bold text-white">No flashcards available in this kit</h2>
        <Link href={`/kit/${id}`} className="text-emerald-400 hover:underline">
          Return to Builder to generate or add cards
        </Link>
      </div>
    );
  }

  const breakdown = sessionData?.breakdown || { hard: 0, good: 0, easy: 0, unseen: cards.length };
  const progressPercent = Math.round(((sessionData?.coveredCards || 0) / cards.length) * 100);

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-16">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-4">
        <Link
          href={`/kit/${id}`}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Kit Builder
        </Link>

        <button
          onClick={fetchSession}
          className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 transition"
        >
          <RotateCw className="w-3.5 h-3.5" />
          Reorder by Weakest Spots
        </button>
      </div>

      {/* Progress & Stats Bar */}
      <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800 space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-white">
            Deck Progress: {sessionData?.coveredCards || 0} / {cards.length} Cards Covered ({progressPercent}%)
          </span>
          <div className="flex items-center gap-3">
            <span className="text-red-400 font-medium">Hard: {breakdown.hard}</span>
            <span className="text-amber-400 font-medium">Good: {breakdown.good}</span>
            <span className="text-emerald-400 font-medium">Easy: {breakdown.easy}</span>
            <span className="text-slate-500">Unseen: {breakdown.unseen}</span>
          </div>
        </div>

        <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden flex">
          <div style={{ width: `${(breakdown.hard / cards.length) * 100}%` }} className="bg-red-500 transition-all duration-300" />
          <div style={{ width: `${(breakdown.good / cards.length) * 100}%` }} className="bg-amber-500 transition-all duration-300" />
          <div style={{ width: `${(breakdown.easy / cards.length) * 100}%` }} className="bg-emerald-500 transition-all duration-300" />
        </div>
      </div>

      {/* The 3D Interactive Card */}
      <div className="space-y-4">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>Card {currentIndex + 1} of {cards.length}</span>
          <span>Requirement: {currentCard?.requirement_ids?.join(', ') || 'Core'}</span>
        </div>

        <div
          onClick={() => setIsFlipped(prev => !prev)}
          className="relative min-h-[300px] w-full rounded-3xl p-8 cursor-pointer select-none transition-all duration-300 bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 hover:border-slate-700 shadow-2xl flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-xs">
            <span className="font-mono text-emerald-400 font-bold">[{currentCard.id}]</span>
            <span className="text-slate-500 uppercase tracking-wider text-[10px]">
              {isFlipped ? 'Answer Key (Revealed)' : 'Question Prompt (Click to Flip)'}
            </span>
          </div>

          <div className="py-6 my-auto text-center space-y-4">
            {!isFlipped ? (
              <p className="text-xl sm:text-2xl font-bold text-white leading-relaxed">
                {currentCard.front}
              </p>
            ) : (
              <div className="space-y-3 text-left">
                <p className="text-base text-slate-200 leading-relaxed font-normal">
                  {currentCard.back}
                </p>
              </div>
            )}
          </div>

          <div className="text-center text-xs text-slate-500">
            {isFlipped ? 'Rate confidence below or press 1, 2, or 3' : 'Click card or press Space to reveal'}
          </div>
        </div>
      </div>

      {/* Confidence Rating Controls (Section 7) */}
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={() => handleRate(1)}
            disabled={recording}
            className="flex flex-col items-center justify-center p-3 rounded-2xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 font-semibold transition"
          >
            <span className="text-sm">1. Again (Hard)</span>
            <span className="text-[10px] text-red-500/80 font-normal">Review first next session</span>
          </button>

          <button
            onClick={() => handleRate(2)}
            disabled={recording}
            className="flex flex-col items-center justify-center p-3 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 font-semibold transition"
          >
            <span className="text-sm">2. Good</span>
            <span className="text-[10px] text-amber-500/80 font-normal">Moderate confidence</span>
          </button>

          <button
            onClick={() => handleRate(3)}
            disabled={recording}
            className="flex flex-col items-center justify-center p-3 rounded-2xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 font-semibold transition"
          >
            <span className="text-sm">3. Easy</span>
            <span className="text-[10px] text-emerald-500/80 font-normal">Mastered concept</span>
          </button>
        </div>

        {/* Card Switchers & Keyboard Hints */}
        <div className="flex items-center justify-between text-xs text-slate-400 pt-2">
          <button
            onClick={() => {
              if (currentIndex > 0) {
                setCurrentIndex(prev => prev - 1);
                setIsFlipped(false);
              }
            }}
            disabled={currentIndex === 0}
            className="flex items-center gap-1 disabled:opacity-30 hover:text-white"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Previous
          </button>

          <div className="hidden sm:flex items-center gap-3 text-[11px] text-slate-500">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">Space</kbd> Flip
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">1-3</kbd> Rate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">← / →</kbd> Navigate
            </span>
          </div>

          <button
            onClick={() => {
              if (currentIndex + 1 < cards.length) {
                setCurrentIndex(prev => prev + 1);
                setIsFlipped(false);
              }
            }}
            disabled={currentIndex + 1 >= cards.length}
            className="flex items-center gap-1 disabled:opacity-30 hover:text-white"
          >
            Next <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
