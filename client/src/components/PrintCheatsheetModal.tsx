'use client';

interface PrintCheatsheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  kit: any;
}

export default function PrintCheatsheetModal({
  isOpen,
  onClose,
  kit,
}: PrintCheatsheetModalProps) {
  if (!isOpen || !kit) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-4xl w-full p-8 shadow-2xl my-8 text-slate-900">
        <div className="flex justify-between items-center pb-4 border-b border-slate-200 mb-6 print:hidden">
          <h3 className="font-bold text-lg text-slate-800">Printable Interview Prep Cheatsheet</h3>
          <div className="flex gap-2">
            <button
              onClick={() => window.print()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg shadow-sm"
            >
              🖨️ Print / Save as PDF
            </button>
            <button
              onClick={onClose}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-lg"
            >
              Close
            </button>
          </div>
        </div>

        {/* Print Content Area */}
        <div className="space-y-6 text-sm">
          <div className="border-b border-slate-200 pb-4">
            <h1 className="text-2xl font-black text-slate-900">
              {kit.role.title} — {kit.source.company}
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Interview Prep Kit • {kit.schedule.days_available}-Day Schedule • Generated {new Date(kit.source.researched_at).toLocaleDateString()}
            </p>
          </div>

          {/* Company Brief */}
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-blue-700 mb-1">Company Overview</h2>
            <p className="text-xs text-slate-700 leading-relaxed mb-1">{kit.company_brief.summary}</p>
            <p className="text-xs text-slate-600 leading-relaxed">{kit.company_brief.what_they_do}</p>
          </div>

          {/* Must-Have Requirements */}
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-blue-700 mb-2">Target Role Requirements</h2>
            <div className="grid grid-cols-2 gap-2">
              {kit.role.requirements.map((r: any) => (
                <div
                  key={r.id}
                  className={`p-2 rounded border text-xs ${
                    r.priority === 'must'
                      ? 'bg-red-50/40 border-red-200'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <span className="font-bold uppercase text-[10px] mr-1">
                    [{r.priority}] [{r.kind}]
                  </span>
                  <span>{r.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Schedule */}
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-blue-700 mb-2">
              Day-by-Day Preparation Plan
            </h2>
            <div className="space-y-2">
              {kit.schedule.days.map((d: any) => (
                <div key={d.day} className="p-2.5 bg-slate-50 border border-slate-200 rounded text-xs flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-900 mr-2">Day {d.day}:</span>
                    <span className="text-slate-700">{d.focus}</span>
                  </div>
                  <span className="text-slate-500 font-medium">({d.minutes} min)</span>
                </div>
              ))}
            </div>
          </div>

          {/* Top High-Yield Questions */}
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-blue-700 mb-2">
              Essential Questions & Answer Outlines
            </h2>
            <div className="space-y-3">
              {kit.questions.map((q: any, idx: number) => (
                <div key={q.id} className="p-3 bg-white border border-slate-200 rounded-lg">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-slate-900 text-xs">
                      Q{idx + 1}. [{q.category}] {q.prompt}
                    </span>
                    <span className="text-[10px] font-semibold px-2 py-0.5 bg-slate-100 rounded">
                      Diff: {q.difficulty}/3
                    </span>
                  </div>
                  <pre className="text-[11px] font-sans text-slate-600 whitespace-pre-wrap bg-slate-50 p-2 rounded border border-slate-100">
                    {q.answer_outline}
                  </pre>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
