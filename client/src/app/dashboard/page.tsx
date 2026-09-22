'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '../../lib/api';
import { Plus, Trash2, ArrowRight, BookOpen, Layers, Sparkles, AlertCircle, FileText, CheckCircle2, Clock } from 'lucide-react';

export default function DashboardPage() {
  const [kits, setKits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // New kit form state
  const [activeTab, setActiveTab] = useState<'single' | 'batch'>('single');
  const [jd, setJd] = useState('');
  const [companyUrl, setCompanyUrl] = useState('');
  const [days, setDays] = useState(5);
  const [batchFile, setBatchFile] = useState<File | null>(null);

  // Generation status state
  const [generating, setGenerating] = useState(false);
  const [currentStep, setCurrentStep] = useState('');
  const [progressPercent, setProgressPercent] = useState(0);
  const [stepDetail, setStepDetail] = useState('');
  const [error, setError] = useState('');

  const fetchKits = async () => {
    try {
      setLoading(true);
      const res = await api.getKits();
      setKits(res.kits || []);
    } catch {
      setKits([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKits();
  }, []);

  const handleCreateSingle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jd.trim() || !companyUrl.trim()) return;

    setError('');
    setGenerating(true);
    setProgressPercent(15);
    setCurrentStep('Extracting Requirements');
    setStepDetail('Parsing technical, behavioural, and domain requirements from JD...');

    const timer1 = setTimeout(() => {
      setProgressPercent(40);
      setCurrentStep('Crawling Company Domain');
      setStepDetail('Respecting robots.txt, discovering /careers and engineering handbooks...');
    }, 1500);

    const timer2 = setTimeout(() => {
      setProgressPercent(70);
      setCurrentStep('Categorized Question Generation');
      setStepDetail('Generating technical, system design, behavioural, and company-fit questions...');
    }, 3500);

    const timer3 = setTimeout(() => {
      setProgressPercent(90);
      setCurrentStep('Coverage Gap Check & Second Pass');
      setStepDetail('Running deterministic code coverage verification and schedule allocation...');
    }, 5500);

    try {
      const res = await api.createKit({
        jd,
        company_url: companyUrl,
        days: Number(days)
      });

      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);

      setProgressPercent(100);
      setCurrentStep('Complete');
      setStepDetail('Prep kit generated successfully!');

      setTimeout(() => {
        setGenerating(false);
        setShowCreateModal(false);
        setJd('');
        setCompanyUrl('');
        window.location.href = `/kit/${res.id}`;
      }, 800);
    } catch (err: any) {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      setGenerating(false);
      setError(err.message || 'Generation failed. Please try again.');
    }
  };

  const handleBatchUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchFile) return;

    setError('');
    setGenerating(true);
    setCurrentStep('Processing Batch File');
    setProgressPercent(20);

    try {
      const fileText = await batchFile.text();
      const cases = JSON.parse(fileText);

      if (!Array.isArray(cases)) {
        throw new Error('Batch file must contain a JSON array of case objects.');
      }

      for (let i = 0; i < cases.length; i++) {
        const item = cases[i];
        setCurrentStep(`Generating Kit ${i + 1}/${cases.length}: ${item.id || 'case'}`);
        setProgressPercent(Math.round(((i + 1) / cases.length) * 100));
        await api.createKit({
          jd: item.jd,
          company_url: item.company_url,
          days: item.days || 5
        });
      }

      setGenerating(false);
      setShowCreateModal(false);
      setBatchFile(null);
      fetchKits();
    } catch (err: any) {
      setGenerating(false);
      setError(err.message || 'Failed to process batch upload.');
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!confirm('Are you sure you want to delete this kit?')) return;
    try {
      await api.deleteKit(id);
      setKits(prev => prev.filter(k => k.id !== id));
    } catch (err: any) {
      alert(err.message || 'Failed to delete kit');
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Interview Prep Studio</h1>
          <p className="text-sm text-slate-400 mt-1">
            Personalized prep kits with crawler intelligence, multi-pass coverage, and interactive study decks.
          </p>
        </div>

        <button
          onClick={() => {
            setShowCreateModal(true);
            setError('');
          }}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-4 py-2.5 rounded-xl shadow transition self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>New Prep Kit</span>
        </button>
      </div>

      {/* Kit Grid */}
      {loading ? (
        <div className="py-20 text-center text-slate-500 text-sm">
          Loading your preparation kits...
        </div>
      ) : kits.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-slate-800 rounded-2xl p-8 space-y-4 max-w-lg mx-auto">
          <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center mx-auto text-slate-500">
            <Layers className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-semibold text-white">No prep kits generated yet</h3>
          <p className="text-sm text-slate-400">
            Paste a job description and company URL to automatically crawl the company, verify question coverage, and build your custom kit.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium px-4 py-2 rounded-xl transition"
          >
            <Plus className="w-4 h-4" />
            <span>Generate First Kit</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {kits.map(kit => (
            <div
              key={kit.id}
              className="p-5 rounded-2xl border border-slate-800 bg-slate-900/40 hover:border-slate-700 transition flex flex-col justify-between space-y-4 group"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-medium text-emerald-400">{kit.company}</span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {kit.days} Days Schedule
                  </span>
                </div>
                <h3 className="text-lg font-bold text-white group-hover:text-emerald-300 transition line-clamp-1">
                  {kit.role}
                </h3>
                <p className="text-xs text-slate-500 line-clamp-1">{kit.company_url}</p>

                <div className="flex items-center gap-3 pt-2 text-xs text-slate-400">
                  <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700">
                    {kit.requirementsCount} Requirements
                  </span>
                  <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700">
                    {kit.questionsCount} Questions
                  </span>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/kit/${kit.id}`}
                    className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition"
                  >
                    <Layers className="w-3.5 h-3.5 text-emerald-400" />
                    Builder
                  </Link>
                  <Link
                    href={`/practice/${kit.id}`}
                    className="flex items-center gap-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 text-xs font-semibold px-3 py-1.5 rounded-lg transition"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    Practice
                  </Link>
                </div>

                <button
                  onClick={e => handleDelete(kit.id, e)}
                  className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg hover:bg-slate-800 transition"
                  title="Delete kit"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Generation Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-emerald-400" />
                Create New Interview Prep Kit
              </h3>
              {!generating && (
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-xs text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Mode Switch Tabs */}
            <div className="flex rounded-xl bg-slate-950 p-1 border border-slate-800 text-xs font-medium">
              <button
                type="button"
                onClick={() => setActiveTab('single')}
                className={`flex-1 py-1.5 rounded-lg transition ${
                  activeTab === 'single' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Single Job Description
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('batch')}
                className={`flex-1 py-1.5 rounded-lg transition ${
                  activeTab === 'batch' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Batch Upload (File)
              </button>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {generating ? (
              <div className="py-8 space-y-5 text-center">
                <div className="relative w-16 h-16 mx-auto">
                  <div className="absolute inset-0 rounded-full border-4 border-slate-800 border-t-emerald-500 animate-spin" />
                  <div className="absolute inset-0 flex items-center justify-center font-bold text-xs text-emerald-400">
                    {progressPercent}%
                  </div>
                </div>
                <div className="space-y-1">
                  <h4 className="text-sm font-semibold text-white">{currentStep}</h4>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">{stepDetail}</p>
                </div>
              </div>
            ) : activeTab === 'single' ? (
              <form onSubmit={handleCreateSingle} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                    Job Description (Pasted Text)
                  </label>
                  <textarea
                    required
                    rows={6}
                    value={jd}
                    onChange={e => setJd(e.target.value)}
                    placeholder="Paste the full job posting here (responsibilities, must-haves, nice-to-haves)..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                      Company Website URL
                    </label>
                    <input
                      type="text"
                      required
                      value={companyUrl}
                      onChange={e => setCompanyUrl(e.target.value)}
                      placeholder="https://company.com"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                      Days Until Interview (1-60)
                    </label>
                    <input
                      type="number"
                      required
                      min={1}
                      max={60}
                      value={days}
                      onChange={e => setDays(parseInt(e.target.value, 10))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 transition"
                    />
                  </div>
                </div>

                <div className="pt-2 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-5 py-2.5 rounded-xl shadow transition"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Run Research & Build Kit</span>
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleBatchUpload} className="space-y-4">
                <div className="p-6 border-2 border-dashed border-slate-800 rounded-2xl text-center space-y-3">
                  <FileText className="w-8 h-8 text-slate-500 mx-auto" />
                  <div className="text-xs text-slate-400">
                    Upload a JSON file containing an array of cases matching Appendix B:
                    <pre className="mt-2 text-[10px] bg-slate-950 p-2 rounded text-slate-300 text-left overflow-x-auto">
                      {`[ { "id": "case-01", "jd": "...", "company_url": "...", "days": 5 } ]`}
                    </pre>
                  </div>
                  <input
                    type="file"
                    accept=".json"
                    required
                    onChange={e => setBatchFile(e.target.files?.[0] || null)}
                    className="block w-full text-xs text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-white hover:file:bg-slate-700"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!batchFile}
                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold px-5 py-2.5 rounded-xl shadow transition"
                  >
                    <span>Process Batch Cases</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
