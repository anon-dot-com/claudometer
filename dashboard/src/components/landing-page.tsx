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
      <main className="flex-1">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 text-center py-16 sm:py-24">
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

        {/* Features */}
        <div className="border-t border-zinc-800 py-16 sm:py-20">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold text-white text-center mb-12">
              What you get
            </h2>
            <div className="grid gap-8 md:grid-cols-3">
              <div className="text-center">
                <div className="text-4xl mb-4">📈</div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  Track Everything
                </h3>
                <p className="text-zinc-400 text-sm">
                  Tokens, messages, sessions, and tool calls. See exactly how much you&apos;re shipping with Claude.
                </p>
              </div>
              <div className="text-center">
                <div className="text-4xl mb-4">🥇</div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  Team Leaderboards
                </h3>
                <p className="text-zinc-400 text-sm">
                  Compete with your teammates. Daily, weekly, and all-time rankings to fuel your friendly rivalry.
                </p>
              </div>
              <div className="text-center">
                <div className="text-4xl mb-4">🔗</div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  Multi-Device Support
                </h3>
                <p className="text-zinc-400 text-sm">
                  Track Claude Code on your laptop, OpenClaw on your server, and see it all in one place.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* How it works */}
        <div className="border-t border-zinc-800 py-16 sm:py-20 bg-zinc-900/50">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold text-white text-center mb-12">
              Setup in 60 seconds
            </h2>
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white font-bold">
                  1
                </div>
                <div>
                  <h3 className="text-white font-medium mb-1">Install the CLI</h3>
                  <code className="text-sm text-green-400 bg-zinc-800 px-2 py-1 rounded">
                    npm install -g claudometer
                  </code>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white font-bold">
                  2
                </div>
                <div>
                  <h3 className="text-white font-medium mb-1">Login and sync</h3>
                  <code className="text-sm text-green-400 bg-zinc-800 px-2 py-1 rounded">
                    claudometer login && claudometer setup
                  </code>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center text-white font-bold">
                  3
                </div>
                <div>
                  <h3 className="text-white font-medium mb-1">Check your rank</h3>
                  <p className="text-zinc-400 text-sm">
                    Your metrics sync automatically. Come back here to see where you stand.
                  </p>
                </div>
              </div>
            </div>
            <div className="text-center mt-10">
              <Link
                href="/sign-up"
                className="inline-block px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
              >
                Get Started
              </Link>
            </div>
          </div>
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
