'use client';

import { Printer, X } from 'lucide-react';

interface PrintCheatsheetModalProps {
  kit: any;
  onClose: () => void;
}

export function PrintCheatsheetModal({ kit, onClose }: PrintCheatsheetModalProps) {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm print:p-0 print:bg-white print:static">
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto print:max-h-none print:shadow-none print:border-none print:bg-white print:text-black print:overflow-visible">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6 print:hidden">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Printer className="w-5 h-5 text-emerald-400" />
            Interview Day Cheatsheet Preview
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-4 py-2 rounded-xl transition shadow"
            >
              <Printer className="w-4 h-4" />
              Print / Save PDF
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Body */}
        <div className="space-y-6 text-slate-100 print:text-black">
          <div className="border-b border-slate-800 print:border-black/30 pb-4">
            <h1 className="text-2xl font-bold">{kit.role.title} — {kit.source.company}</h1>
            <p className="text-sm text-slate-400 print:text-gray-600">
              Researched Horizon: {kit.schedule.days_available} Days • Researched At: {new Date(kit.source.researched_at).toLocaleDateString()}
            </p>
          </div>

          {/* Company Brief */}
          <div className="space-y-1">
            <h2 className="text-sm font-bold uppercase tracking-wider text-emerald-400 print:text-black">Company Intelligence & Mission</h2>
            <p className="text-sm leading-relaxed text-slate-300 print:text-gray-800">{kit.company_brief.summary}</p>
            <p className="text-xs text-slate-400 print:text-gray-600 italic">{kit.company_brief.what_they_do}</p>
          </div>

          {/* Key Requirements */}
          <div className="space-y-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-emerald-400 print:text-black">Must-Have Competencies Evaluated</h2>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {kit.role.requirements.map((r: any) => (
                <div key={r.id} className="p-2 rounded border border-slate-800 print:border-gray-300">
                  <span className="font-bold">[{r.id}]</span> {r.text} ({r.priority})
                </div>
              ))}
            </div>
          </div>

          {/* High Priority Questions */}
          <div className="space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-emerald-400 print:text-black">Core Interview Questions & Outline</h2>
            <div className="space-y-3">
              {kit.questions.slice(0, 8).map((q: any) => (
                <div key={q.id} className="p-3 rounded-lg border border-slate-800 print:border-gray-300 space-y-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-emerald-400 print:text-black">[{q.category.toUpperCase()}] {q.id}</span>
                    <span>Difficulty: {q.difficulty}/3</span>
                  </div>
                  <p className="text-xs font-medium">{q.prompt}</p>
                  <p className="text-xs text-slate-400 print:text-gray-700"><strong>Outline:</strong> {q.answer_outline}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Schedule Summary */}
          <div className="space-y-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-emerald-400 print:text-black">Daily Schedule Plan</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {kit.schedule.days.map((d: any) => (
                <div key={d.day} className="p-2 border border-slate-800 print:border-gray-300 rounded">
                  <div className="font-bold">Day {d.day} ({d.minutes} mins): {d.focus}</div>
                  <div className="text-slate-400 print:text-gray-600">Questions: {d.question_ids.join(', ')}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
