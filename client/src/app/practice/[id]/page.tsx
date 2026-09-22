'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { practiceApi } from '@/lib/api';

export default function PracticePage() {
  const { id } = useParams();
  const router = useRouter();
  const kitId = id as string;

  const [sessionData, setSessionData] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [recording, setRecording] = useState(false);

  useEffect(() => {
    loadSession();
  }, [kitId]);

  const loadSession = async () => {
    setLoading(true);
    try {
      const data = await practiceApi.getSession(kitId);
      setSessionData(data);
      setCurrentIndex(0);
      setIsFlipped(false);
    } catch (err) {
      console.error('Failed to load practice session:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRateConfidence = async (confidence: number) => {
    if (!sessionData || !currentCard) return;
    setRecording(true);

    try {
      await practiceApi.recordConfidence(kitId, currentCard.id, confidence);

      // Update card in local state
      const updatedCards = [...sessionData.orderedCards];
      updatedCards[currentIndex].confidence = confidence;
      updatedCards[currentIndex].isCovered = true;

      const coveredCount = updatedCards.filter((c) => c.isCovered).length;
      const progress = Math.round((coveredCount / updatedCards.length) * 100);

      setSessionData({
        ...sessionData,
        orderedCards: updatedCards,
        coveredCards: coveredCount,
        uncoveredCards: updatedCards.length - coveredCount,
        progressPercentage: progress,
      });

      // Move to next card or loop
      if (currentIndex < updatedCards.length - 1) {
        setCurrentIndex(currentIndex + 1);
        setIsFlipped(false);
      } else {
        // Completed current pass
        setIsFlipped(false);
      }
    } catch (err) {
      alert('Failed to record confidence rating.');
    } finally {
      setRecording(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center p-12 text-slate-500 text-sm">
        Loading Practice Session...
      </div>
    );
  }

  if (!sessionData || sessionData.orderedCards.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
        <h2 className="text-xl font-bold text-slate-800 mb-2">No Flashcards Found</h2>
        <p className="text-sm text-slate-500 mb-4">This kit doesn't have any flashcards yet.</p>
        <Link href={`/kit/${kitId}`} className="text-blue-600 font-semibold hover:underline">
          Return to Kit Builder
        </Link>
      </div>
    );
  }

  const currentCard = sessionData.orderedCards[currentIndex];
  const isLastCard = currentIndex === sessionData.orderedCards.length - 1;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full flex-1 flex flex-col justify-between">
      {/* Practice Header & Progress */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-200 mb-6 gap-3">
          <div>
            <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full uppercase tracking-wider">
              Practice Mode • Spaced Repetition
            </span>
            <h1 className="text-2xl font-bold text-slate-900 mt-1">{sessionData.kitTitle}</h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={loadSession}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-200"
            >
              🔄 Reorder by Weak Spots
            </button>
            <Link
              href={`/kit/${kitId}`}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white px-3 py-1.5 rounded-lg border border-slate-300"
            >
              Back to Builder
            </Link>
          </div>
        </div>

        {/* Coverage Progress Bar */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 mb-8 shadow-sm">
          <div className="flex justify-between items-center text-xs font-semibold text-slate-600 mb-2">
            <span>
              Card {currentIndex + 1} of {sessionData.totalCards}
            </span>
            <span>
              Coverage: {sessionData.coveredCards}/{sessionData.totalCards} ({sessionData.progressPercentage}%)
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
            <div
              className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${sessionData.progressPercentage}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* 3D Flashcard Presentation */}
      <div className="flex-1 flex flex-col justify-center items-center my-6">
        <div
          onClick={() => setIsFlipped(!isFlipped)}
          className="w-full max-w-xl h-80 cursor-pointer select-none perspective-1000 group"
        >
          <div
            className={`relative w-full h-full duration-500 transform-style-3d transition-transform ${
              isFlipped ? 'rotate-y-180' : ''
            }`}
          >
            {/* Front of Card */}
            <div className="absolute inset-0 w-full h-full bg-white rounded-2xl border-2 border-slate-200 p-8 flex flex-col justify-between shadow-lg backface-hidden group-hover:border-indigo-300 transition">
              <div className="flex justify-between items-center text-xs text-slate-400">
                <span className="font-bold uppercase tracking-wider text-[10px]">Concept / Question</span>
                {currentCard.confidence && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      currentCard.confidence === 1
                        ? 'bg-red-100 text-red-700'
                        : currentCard.confidence === 2
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-emerald-100 text-emerald-700'
                    }`}
                  >
                    Confidence: {currentCard.confidence}/3
                  </span>
                )}
              </div>

              <div className="text-center my-auto">
                <p className="text-lg sm:text-xl font-bold text-slate-900 leading-relaxed">
                  {currentCard.front}
                </p>
              </div>

              <div className="text-center text-xs text-indigo-600 font-medium">
                Click anywhere to flip & reveal answer outline ↻
              </div>
            </div>

            {/* Back of Card */}
            <div className="absolute inset-0 w-full h-full bg-indigo-900 text-white rounded-2xl border-2 border-indigo-700 p-8 flex flex-col justify-between shadow-lg backface-hidden rotate-y-180">
              <div className="flex justify-between items-center text-xs text-indigo-200">
                <span className="font-bold uppercase tracking-wider text-[10px]">Answer / Key Takeaways</span>
                <span className="text-[10px] text-indigo-300">Click to flip back</span>
              </div>

              <div className="text-left my-auto overflow-y-auto max-h-48 pr-2">
                <p className="text-sm text-indigo-100 leading-relaxed whitespace-pre-wrap">
                  {currentCard.back}
                </p>
              </div>

              <div className="text-center text-[11px] text-indigo-300">
                Rate your confidence below to schedule your next review
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Confidence Rating Bar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm max-w-xl mx-auto w-full">
        <p className="text-xs font-bold text-slate-700 uppercase tracking-wider text-center mb-3">
          How confident do you feel on this topic?
        </p>

        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={() => handleRateConfidence(1)}
            disabled={recording}
            className="py-2.5 px-3 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl font-bold text-xs shadow-sm transition active:scale-95 disabled:opacity-50 flex flex-col items-center"
          >
            <span>Needs Work</span>
            <span className="text-[10px] font-normal text-red-500">Low (Review soon)</span>
          </button>

          <button
            onClick={() => handleRateConfidence(2)}
            disabled={recording}
            className="py-2.5 px-3 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-xl font-bold text-xs shadow-sm transition active:scale-95 disabled:opacity-50 flex flex-col items-center"
          >
            <span>Getting There</span>
            <span className="text-[10px] font-normal text-amber-600">Medium</span>
          </button>

          <button
            onClick={() => handleRateConfidence(3)}
            disabled={recording}
            className="py-2.5 px-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl font-bold text-xs shadow-sm transition active:scale-95 disabled:opacity-50 flex flex-col items-center"
          >
            <span>Mastered</span>
            <span className="text-[10px] font-normal text-emerald-600">High (Spaced out)</span>
          </button>
        </div>

        {/* Card Navigation */}
        <div className="flex justify-between items-center mt-4 pt-3 border-t border-slate-100 text-xs">
          <button
            onClick={() => {
              if (currentIndex > 0) {
                setCurrentIndex(currentIndex - 1);
                setIsFlipped(false);
              }
            }}
            disabled={currentIndex === 0}
            className="text-slate-500 hover:text-slate-800 disabled:opacity-30 font-medium"
          >
            ← Previous Card
          </button>

          <span className="text-slate-400">
            {currentIndex + 1} / {sessionData.orderedCards.length}
          </span>

          <button
            onClick={() => {
              if (!isLastCard) {
                setCurrentIndex(currentIndex + 1);
                setIsFlipped(false);
              }
            }}
            disabled={isLastCard}
            className="text-slate-500 hover:text-slate-800 disabled:opacity-30 font-medium"
          >
            Next Card →
          </button>
        </div>
      </div>
    </div>
  );
}
