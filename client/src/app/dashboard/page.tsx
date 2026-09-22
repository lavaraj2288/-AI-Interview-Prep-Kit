'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { kitApi } from '@/lib/api';

const SAMPLE_JD = `Senior Backend Engineer
About the Role:
We are seeking an experienced Senior Backend Engineer to architect and scale our distributed event-driven data pipelines.

Must-Have Requirements:
- 5+ years building distributed backend services with Node.js and TypeScript
- Deep production experience with PostgreSQL, Redis, and message queues (Kafka or RabbitMQ)
- Proven track record mentoring junior engineers and leading technical architecture reviews
- Solid understanding of microservice design patterns, CI/CD pipelines, and observability

Nice-to-Have Bonus Points:
- Hands-on experience with Kubernetes and Terraform
- Familiarity with GraphQL federated schemas`;

const SAMPLE_STUB_JD = `Backend Engineer
Build Python APIs and maintain PostgreSQL database.`;

export default function DashboardPage() {
  const router = useRouter();
  const [kits, setKits] = useState<any[]>([]);
  const [loadingKits, setLoadingKits] = useState(true);

  // Form states
  const [jd, setJd] = useState('');
  const [companyUrl, setCompanyUrl] = useState('');
  const [days, setDays] = useState(5);
  const [generating, setGenerating] = useState(false);
  const [progressStep, setProgressStep] = useState(0);
  const [progressText, setProgressText] = useState('');
  const [genError, setGenError] = useState('');

  // Batch states
  const [batchTab, setBatchTab] = useState(false);
  const [batchJson, setBatchJson] = useState('');
  const [batchProcessing, setBatchProcessing] = useState(false);
  const [batchMessage, setBatchMessage] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('trao_prep_token');
    if (!token) {
      router.push('/login');
      return;
    }
    loadKits();
  }, [router]);

  const loadKits = async () => {
    setLoadingKits(true);
    try {
      const data = await kitApi.list();
      setKits(data.kits || []);
    } catch (err) {
      console.error('Failed to load kits:', err);
    } finally {
      setLoadingKits(false);
    }
  };

  const simulateProgress = () => {
    const steps = [
      { step: 1, text: 'Crawling company site & searching public discussions...' },
      { step: 2, text: 'Extracting role requirements (must-have vs nice-to-have)...' },
      { step: 3, text: 'Synthesizing company brief and hiring process insights...' },
      { step: 4, text: 'Generating categorized questions (Technical, Behavioural, System Design)...' },
      { step: 5, text: 'Executing deterministic coverage check & second-pass loop...' },
      { step: 6, text: 'Arithmetically distributing schedule across requested days...' },
      { step: 7, text: 'Validating kit structure conforming strictly to Appendix A...' },
    ];

    let current = 0;
    const interval = setInterval(() => {
      if (current < steps.length) {
        setProgressStep(steps[current].step);
        setProgressText(steps[current].text);
        current++;
      } else {
        clearInterval(interval);
      }
    }, 1200);

    return interval;
  };

  const handleCreateKit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jd.trim() || !companyUrl.trim()) return;

    setGenerating(true);
    setGenError('');
    setProgressStep(1);
    setProgressText('Initiating research pipeline...');

    const intervalId = simulateProgress();

    try {
      const res = await kitApi.create(jd, companyUrl, days);
      clearInterval(intervalId);
      setProgressStep(7);
      setProgressText('Kit ready! Redirecting...');
      setTimeout(() => {
        router.push(`/kit/${res.kitId}`);
      }, 500);
    } catch (err) {
      clearInterval(intervalId);
      setGenError(err instanceof Error ? err.message : 'Generation failed.');
      setGenerating(false);
    }
  };

  const handleDeleteKit = async (id: string) => {
    if (!confirm('Are you sure you want to delete this kit?')) return;
    try {
      await kitApi.delete(id);
      setKits(kits.filter((k) => k._id !== id));
    } catch (err) {
      alert('Failed to delete kit');
    }
  };

  const handleBatchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBatchProcessing(true);
    setBatchMessage('');

    try {
      const parsed = JSON.parse(batchJson);
      if (!Array.isArray(parsed)) throw new Error('Input must be a JSON array of cases.');
      const res = await kitApi.batchUpload(parsed);
      setBatchMessage(res.message);
      loadKits();
      setBatchJson('');
    } catch (err) {
      setBatchMessage(err instanceof Error ? err.message : 'Batch processing error');
    } finally {
      setBatchProcessing(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-8 border-b border-slate-200 mb-8 gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Your Prep Kits</h1>
          <p className="text-sm text-slate-500 mt-1">
            Create, manage, and practice against your personalized interview kits
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setBatchTab(!batchTab)}
            className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 font-medium text-sm rounded-lg border border-slate-300 shadow-sm transition"
          >
            {batchTab ? 'Single Kit Mode' : '📦 Prepare for Multiple Roles (Batch)'}
          </button>
        </div>
      </div>

      {/* Main Grid: Form & List */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Creation Column (Left) */}
        <div className="lg:col-span-6 bg-white p-6 sm:p-7 rounded-2xl border border-slate-200 shadow-sm">
          {!batchTab ? (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-slate-900">Generate New Prep Kit</h2>
                <div className="flex gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setJd(SAMPLE_JD);
                      setCompanyUrl('https://example.com');
                      setDays(5);
                    }}
                    className="text-blue-600 hover:text-blue-800 font-medium bg-blue-50 px-2 py-1 rounded"
                  >
                    Sample Senior JD
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setJd(SAMPLE_STUB_JD);
                      setCompanyUrl('https://example.org');
                      setDays(2);
                    }}
                    className="text-amber-700 hover:text-amber-900 font-medium bg-amber-50 px-2 py-1 rounded"
                  >
                    Sample Stub JD
                  </button>
                </div>
              </div>

              {genError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg">
                  {genError}
                </div>
              )}

              <form onSubmit={handleCreateKit} className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Job Description
                    </label>
                    <span className="text-xs text-slate-400">{jd.length} characters</span>
                  </div>
                  <textarea
                    required
                    rows={8}
                    value={jd}
                    onChange={(e) => setJd(e.target.value)}
                    placeholder="Paste the complete job description here..."
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-xs leading-relaxed"
                  />
                  {jd.length > 0 && jd.length < 120 && (
                    <p className="text-[11px] text-amber-600 mt-1">
                      ⚠️ Short stub description detected. The pipeline will extract only explicit facts and report gaps honestly.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
                    Company Website Address
                  </label>
                  <input
                    type="url"
                    required
                    value={companyUrl}
                    onChange={(e) => setCompanyUrl(e.target.value)}
                    placeholder="https://company.com"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    We will crawl their site to discover hiring patterns and culture.
                  </p>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Days Available Before Interview
                    </label>
                    <span className="text-sm font-bold text-blue-600">{days} Days</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="60"
                    value={days}
                    onChange={(e) => setDays(parseInt(e.target.value, 10))}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                    <span>1 Day (Cram)</span>
                    <span>14 Days (Standard)</span>
                    <span>60 Days (Comprehensive)</span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={generating}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-sm shadow-md transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {generating ? (
                    <>
                      <span className="animate-spin text-base">⏳</span>
                      Generating Kit...
                    </>
                  ) : (
                    '🚀 Generate Interview Prep Kit'
                  )}
                </button>
              </form>
            </div>
          ) : (
            <div>
              <h2 className="text-lg font-bold text-slate-900 mb-2">Prepare for Multiple Roles</h2>
              <p className="text-xs text-slate-500 mb-4">
                Upload or paste a JSON array of description-and-company pairs to batch-generate kits.
              </p>

              {batchMessage && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 text-blue-800 text-xs rounded-lg">
                  {batchMessage}
                </div>
              )}

              <form onSubmit={handleBatchSubmit} className="space-y-4">
                <textarea
                  required
                  rows={10}
                  value={batchJson}
                  onChange={(e) => setBatchJson(e.target.value)}
                  placeholder={`[
  {
    "jd": "Senior Frontend Engineer...",
    "company_url": "https://stripe.com",
    "days": 5
  },
  {
    "jd": "Backend Systems Architect...",
    "company_url": "https://github.com",
    "days": 3
  }
]`}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />

                <button
                  type="submit"
                  disabled={batchProcessing}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-sm shadow transition disabled:opacity-50"
                >
                  {batchProcessing ? 'Processing Batch Cases...' : 'Execute Batch Generation'}
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Existing Kits Column (Right) */}
        <div className="lg:col-span-6 space-y-4">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-lg font-bold text-slate-900">Your Saved Kits ({kits.length})</h2>
            <button
              onClick={loadKits}
              className="text-xs text-blue-600 hover:underline font-medium"
            >
              Refresh
            </button>
          </div>

          {loadingKits ? (
            <div className="p-8 bg-white rounded-2xl border border-slate-200 text-center text-slate-400 text-sm">
              Loading kits...
            </div>
          ) : kits.length === 0 ? (
            <div className="p-10 bg-white rounded-2xl border border-slate-200 text-center">
              <div className="text-4xl mb-3">📁</div>
              <h3 className="font-bold text-slate-700 text-sm mb-1">No Prep Kits Generated Yet</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto mb-4">
                Paste a job description on the left to generate your first intelligent interview kit.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {kits.map((k) => (
                <div
                  key={k._id}
                  className="p-5 bg-white rounded-xl border border-slate-200/80 shadow-sm hover:border-blue-400 transition flex flex-col justify-between gap-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-bold text-slate-900 text-base">{k.title}</h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {k.company} • Created {new Date(k.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <span className="text-xs px-2.5 py-1 bg-blue-50 text-blue-700 font-semibold rounded-full border border-blue-200">
                      {k.kit?.schedule?.days_available || 5} Days
                    </span>
                  </div>

                  <div className="flex items-center gap-3 pt-2 border-t border-slate-100 text-xs">
                    <span className="text-emerald-700 font-medium flex items-center gap-1">
                      <span>✓</span> Coverage Pass {k.kit?.coverage?.passes || 1}
                    </span>
                    <div className="flex-1"></div>
                    <Link
                      href={`/kit/${k._id}`}
                      className="text-blue-600 hover:text-blue-800 font-semibold"
                    >
                      Open Builder →
                    </Link>
                    <Link
                      href={`/practice/${k._id}`}
                      className="text-indigo-600 hover:text-indigo-800 font-semibold"
                    >
                      Practice
                    </Link>
                    <button
                      onClick={() => handleDeleteKit(k._id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Real-time Generation Progress Modal */}
      {generating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Generating Your Prep Kit</h3>
            <p className="text-xs text-slate-500 mb-6">
              Our multi-step pipeline is analyzing the posting and crawling the company site...
            </p>

            {/* Progress Bar */}
            <div className="w-full bg-slate-100 rounded-full h-2.5 mb-6 overflow-hidden">
              <div
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${(progressStep / 7) * 100}%` }}
              ></div>
            </div>

            {/* Step text */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 mb-4 flex items-center gap-3">
              <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 font-bold flex items-center justify-center text-xs shrink-0">
                {progressStep}/7
              </span>
              <p className="text-xs font-medium text-slate-700 leading-snug">
                {progressText}
              </p>
            </div>

            <div className="text-[11px] text-slate-400 text-center">
              Please keep this window open while deterministic coverage checking runs.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
