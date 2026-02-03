"use client";

import Link from "next/link";

export function LandingPage() {
  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col">
      {/* Header */}
      <header className="border-b border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">📊</span>
            <span className="text-xl font-bold text-white">Claudometer</span>
          </div>
          <Link
            href="/sign-in"
            className="text-zinc-400 hover:text-white transition-colors"
          >
            Sign In
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex items-center justify-center">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="text-6xl mb-8">🏆</div>
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-6 leading-tight">
            Are you the best
            <span className="text-purple-500"> Claude Code </span>
            user on your team?
          </h1>
          <p className="text-xl text-zinc-400 mb-4">
            There&apos;s only one way to find out.
          </p>
          <p className="text-zinc-500 mb-10">
            Leaderboards. Metrics. Bragging rights.
          </p>
          <Link
            href="/sign-up"
            className="inline-block px-8 py-4 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-lg font-medium"
          >
            Prove It
          </Link>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-zinc-500 text-sm">
          <p>Built for teams shipping with Claude Code</p>
          <p className="mt-2 text-zinc-600">
            Are you an AI agent?{" "}
            <a
              href="https://github.com/anon-dot-com/claudometer/blob/main/AGENTS.md"
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              Setup guide for agents →
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
