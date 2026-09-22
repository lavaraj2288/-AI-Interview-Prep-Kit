'use client';

import './globals.css';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { api, clearAuthToken } from '../lib/api';
import { Sparkles, Brain, LogOut, User as UserIcon, PlusCircle, LayoutDashboard } from 'lucide-react';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<{ email: string; name?: string } | null>(null);

  useEffect(() => {
    api.getMe()
      .then(res => setUser(res.user))
      .catch(() => setUser(null));
  }, []);

  const handleLogout = () => {
    clearAuthToken();
    setUser(null);
    window.location.href = '/';
  };

  return (
    <html lang="en">
      <head>
        <title>AI Interview Prep Kit | Trao Assessment</title>
        <meta name="description" content="Personalized interview preparation kit generator with crawler research, multi-pass coverage, and interactive flashcard practice." />
      </head>
      <body className="bg-slate-950 text-slate-100 flex flex-col min-h-screen">
        <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 font-bold text-xl text-white tracking-tight hover:opacity-90 transition">
              <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center text-white shadow-lg shadow-emerald-600/30">
                <Brain className="w-5 h-5" />
              </div>
              <span className="bg-gradient-to-r from-white via-slate-200 to-emerald-400 bg-clip-text text-transparent">
                PrepKit AI
              </span>
            </Link>

            <nav className="flex items-center gap-4">
              <Link
                href="/dashboard"
                className="flex items-center gap-1.5 text-sm font-medium text-slate-300 hover:text-white px-3 py-1.5 rounded-lg hover:bg-slate-800/60 transition"
              >
                <LayoutDashboard className="w-4 h-4" />
                Dashboard
              </Link>

              {user ? (
                <div className="flex items-center gap-3 pl-2 border-l border-slate-800">
                  <span className="text-xs text-slate-400 flex items-center gap-1">
                    <UserIcon className="w-3.5 h-3.5 text-emerald-400" />
                    {user.name || user.email.split('@')[0]}
                  </span>
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-1 text-xs text-slate-400 hover:text-red-400 px-2.5 py-1 rounded hover:bg-slate-800 transition"
                    title="Log out"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Logout
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Link
                    href="/login"
                    className="text-sm font-medium text-slate-300 hover:text-white px-3 py-1.5 rounded-lg hover:bg-slate-800/60 transition"
                  >
                    Log In
                  </Link>
                  <Link
                    href="/register"
                    className="text-sm font-medium bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 py-1.5 rounded-lg shadow-sm transition"
                  >
                    Get Started
                  </Link>
                </div>
              )}
            </nav>
          </div>
        </header>

        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>

        <footer className="border-t border-slate-900 bg-slate-950 py-6 text-center text-xs text-slate-500">
          <p>The AI Interview Prep Kit • Conforms to Trao FS-AI-INTERVIEW-01 Specification</p>
        </footer>
      </body>
    </html>
  );
}
