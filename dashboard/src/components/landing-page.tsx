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
          <div className="flex items-center gap-4">
            <Link
              href="/sign-in"
              className="text-zinc-400 hover:text-white transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex items-center justify-center">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center py-20">
          <h1 className="text-5xl font-bold text-white mb-6">
            Measure your team&apos;s
            <span className="text-purple-500"> AI-assisted </span>
            development
          </h1>
          <p className="text-xl text-zinc-400 mb-8 max-w-2xl mx-auto">
            Track Claude Code usage and Git activity across your engineering team.
            See who&apos;s shipping the most code with AI assistance.
          </p>

          <div className="flex items-center justify-center gap-4 mb-12">
            <Link
              href="/sign-up"
              className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-lg font-medium"
            >
              Start tracking for free
            </Link>
            <a
              href="https://github.com/anon-dot-com/claudometer"
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 transition-colors text-lg font-medium"
            >
              View on GitHub
            </a>
          </div>

          {/* Feature highlights */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16">
            <div className="bg-zinc-900 rounded-lg p-6 text-left">
              <div className="text-3xl mb-3">🤖</div>
              <h3 className="text-lg font-semibold text-white mb-2">Claude Code Metrics</h3>
              <p className="text-zinc-400 text-sm">
                Track tokens, messages, and tool calls across your Claude Code sessions.
              </p>
            </div>
            <div className="bg-zinc-900 rounded-lg p-6 text-left">
              <div className="text-3xl mb-3">📈</div>
              <h3 className="text-lg font-semibold text-white mb-2">Git Activity</h3>
              <p className="text-zinc-400 text-sm">
                Monitor commits, lines of code, and contributions across all your repositories.
              </p>
            </div>
            <div className="bg-zinc-900 rounded-lg p-6 text-left">
              <div className="text-3xl mb-3">🏆</div>
              <h3 className="text-lg font-semibold text-white mb-2">Team Leaderboards</h3>
              <p className="text-zinc-400 text-sm">
                See who&apos;s leading in different metrics with fun, gamified leaderboards.
              </p>
            </div>
          </div>

          {/* Quick start */}
          <div className="mt-16 bg-zinc-900 rounded-lg p-8 text-left">
            <h3 className="text-lg font-semibold text-white mb-4">Quick Start</h3>
            <div className="bg-zinc-800 rounded-lg p-4">
              <code className="text-green-400 font-mono text-sm">
                npm i -g claudometer && claudometer login && claudometer collect
              </code>
            </div>
            <p className="text-zinc-500 text-sm mt-3">
              Install the CLI, authenticate with your organization, and start tracking.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-zinc-500 text-sm">
          Built for teams using Claude Code
        </div>
      </footer>
    </div>
  );
}
