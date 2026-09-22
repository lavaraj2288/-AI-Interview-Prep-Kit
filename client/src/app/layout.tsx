import './globals.css';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'AI Interview Prep Kit | Trao',
  description: 'Turn any job description into an intelligent, structured interview preparation kit.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col bg-slate-50 text-slate-900 selection:bg-blue-100 selection:text-blue-900">
        <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 font-bold text-xl text-blue-600 tracking-tight">
              <span className="p-1.5 bg-blue-600 text-white rounded-lg shadow-sm">🎯</span>
              <span>AI PrepKit</span>
            </Link>
            <nav className="flex items-center gap-4 text-sm font-medium">
              <Link href="/dashboard" className="text-slate-600 hover:text-blue-600 transition">
                Dashboard
              </Link>
              <Link href="/login" className="text-slate-600 hover:text-blue-600 transition">
                Sign In
              </Link>
              <Link
                href="/register"
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition"
              >
                Get Started
              </Link>
            </nav>
          </div>
        </header>

        <main className="flex-1 flex flex-col">{children}</main>

        <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-500 bg-white">
          <p>© 2026 AI Interview Prep Kit. Trao Assessment Candidate Submission.</p>
        </footer>
      </body>
    </html>
  );
}
