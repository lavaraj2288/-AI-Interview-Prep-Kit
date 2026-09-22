import Link from 'next/link';

export default function Home() {
  return (
    <div className="flex-1 flex flex-col justify-center items-center px-4 sm:px-6 lg:px-8 py-12 max-w-5xl mx-auto text-center">
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 mb-6">
        <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
        TRAO Engineering Assessment FS-AI-INTERVIEW-01
      </div>

      <h1 className="text-4xl sm:text-6xl font-extrabold text-slate-900 tracking-tight leading-tight sm:leading-tight mb-6">
        Turn Any Job Description Into a <br className="hidden sm:block" />
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">
          Personalised Prep Kit
        </span>
      </h1>

      <p className="text-lg sm:text-xl text-slate-600 max-w-3xl mb-10 leading-relaxed">
        Paste a job posting, enter the company website, and specify your interview timeframe.
        Our autonomous pipeline crawls their hiring culture, checks requirement coverage across passes,
        allocates a day-by-day study schedule, and provides interactive practice.
      </p>

      <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
        <Link
          href="/dashboard"
          className="w-full sm:w-auto px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/25 transition transform active:scale-95"
        >
          Generate a Kit Now →
        </Link>
        <Link
          href="/login"
          className="w-full sm:w-auto px-8 py-3.5 bg-white hover:bg-slate-50 text-slate-700 font-semibold rounded-xl border border-slate-300 shadow-sm transition"
        >
          Sign In to Your Kits
        </Link>
      </div>

      {/* Feature Highlights Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left w-full">
        <div className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-lg mb-4">
            🕷️
          </div>
          <h3 className="font-bold text-slate-900 text-base mb-2">Live Company Crawl</h3>
          <p className="text-sm text-slate-600 leading-relaxed">
            Crawls the target site, ranks links without hardcoded paths, checks robots.txt, and searches public interview discussions.
          </p>
        </div>

        <div className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="w-10 h-10 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold text-lg mb-4">
            🔄
          </div>
          <h3 className="font-bold text-slate-900 text-base mb-2">Deterministic Second Pass</h3>
          <p className="text-sm text-slate-600 leading-relaxed">
            Pure code coverage checks guarantee every must-have requirement has a question, triggering targeted gap-closing loops.
          </p>
        </div>

        <div className="p-6 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="w-10 h-10 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-lg mb-4">
            🧠
          </div>
          <h3 className="font-bold text-slate-900 text-base mb-2">The Builder & Practice</h3>
          <p className="text-sm text-slate-600 leading-relaxed">
            Edit, reorder, and regenerate sections without clobbering manual edits. Practice flashcards with spaced-repetition confidence sorting.
          </p>
        </div>
      </div>
    </div>
  );
}
