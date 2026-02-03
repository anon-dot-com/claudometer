"use client";

import { useState } from "react";

export function GetStartedPage() {
  const [copiedItem, setCopiedItem] = useState<string | null>(null);

  const copyToClipboard = (text: string, item: string) => {
    navigator.clipboard.writeText(text);
    setCopiedItem(item);
    setTimeout(() => setCopiedItem(null), 2000);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h2 className="text-2xl font-bold text-white mb-2">Get Started</h2>
      <p className="text-zinc-400 mb-4">
        Track your Claude Code and Git activity. Choose your setup below.
      </p>

      {/* Update Banner */}
      <div className="mb-6 p-4 bg-amber-900/30 rounded-lg border border-amber-600/50">
        <div className="flex items-start gap-3">
          <span className="text-amber-500 text-lg">⚡</span>
          <div className="flex-1">
            <h4 className="text-sm font-medium text-amber-300 mb-1">
              Already installed? Make sure you&apos;re on the latest version
            </h4>
            <p className="text-xs text-zinc-400 mb-2">
              We&apos;ve added real-time metrics and improved accuracy. Update to get the latest features.
            </p>
            <div className="flex items-center gap-2">
              <code className="bg-zinc-800 px-3 py-1.5 rounded text-xs text-green-400 font-mono">
                npm update -g claudometer
              </code>
              <button
                onClick={() =>
                  copyToClipboard("npm update -g claudometer", "update-banner")
                }
                className="px-3 py-1.5 bg-amber-600 rounded text-white text-xs hover:bg-amber-700 transition-colors"
              >
                {copiedItem === "update-banner" ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Quickstart Options */}
      <div className="grid gap-6 md:grid-cols-2 mb-8">
        {/* Claude Code Only */}
        <div className="bg-zinc-900 rounded-lg p-6 border-2 border-purple-600">
          <div className="flex items-center gap-2 mb-3">
            <span className="px-2 py-0.5 rounded bg-purple-600 text-white text-xs font-medium">
              Quickstart
            </span>
          </div>
          <h3 className="text-lg font-bold text-white mb-2">Claude Code Only</h3>
          <p className="text-sm text-zinc-400 mb-4">
            Track usage on this machine only
          </p>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-zinc-500 mb-1">Run this command:</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-zinc-800 px-3 py-2 rounded text-xs text-green-400 font-mono overflow-x-auto">
                  npm i -g claudometer && claudometer login && claudometer collect
                </code>
                <button
                  onClick={() =>
                    copyToClipboard(
                      "npm i -g claudometer && claudometer login && claudometer collect",
                      "quick-local"
                    )
                  }
                  className="px-3 py-2 bg-purple-600 rounded text-white text-xs hover:bg-purple-700 transition-colors flex-shrink-0"
                >
                  {copiedItem === "quick-local" ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Claude Code + OpenClaw */}
        <div className="bg-zinc-900 rounded-lg p-6 border-2 border-teal-600">
          <div className="flex items-center gap-2 mb-3">
            <span className="px-2 py-0.5 rounded bg-teal-600 text-white text-xs font-medium">
              Quickstart
            </span>
          </div>
          <h3 className="text-lg font-bold text-white mb-2">Claude Code + OpenClaw</h3>
          <p className="text-sm text-zinc-400 mb-4">
            Track this machine + a server running OpenClaw
          </p>
          <div className="space-y-4">
            <div>
              <p className="text-xs text-zinc-500 mb-1">
                <span className="text-purple-400 font-medium">Step 1:</span> Run on this machine:
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-zinc-800 px-3 py-2 rounded text-xs text-green-400 font-mono overflow-x-auto">
                  npm i -g claudometer && claudometer login && claudometer link --generate
                </code>
                <button
                  onClick={() =>
                    copyToClipboard(
                      "npm i -g claudometer && claudometer login && claudometer link --generate",
                      "quick-primary"
                    )
                  }
                  className="px-3 py-2 bg-purple-600 rounded text-white text-xs hover:bg-purple-700 transition-colors flex-shrink-0"
                >
                  {copiedItem === "quick-primary" ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>
            <div>
              <p className="text-xs text-zinc-500 mb-1">
                <span className="text-teal-400 font-medium">Step 2:</span> Send this to your OpenClaw server (replace CODE):
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-zinc-800 px-3 py-2 rounded text-xs text-green-400 font-mono overflow-x-auto">
                  npm i -g claudometer && claudometer link --connect CODE && claudometer collect
                </code>
                <button
                  onClick={() =>
                    copyToClipboard(
                      "npm i -g claudometer && claudometer link --connect CODE && claudometer collect",
                      "quick-secondary"
                    )
                  }
                  className="px-3 py-2 bg-teal-600 rounded text-white text-xs hover:bg-teal-700 transition-colors flex-shrink-0"
                >
                  {copiedItem === "quick-secondary" ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Instructions - Collapsed by default */}
      <details className="group">
        <summary className="cursor-pointer text-zinc-400 hover:text-white transition-colors mb-4 flex items-center gap-2">
          <svg
            className="w-4 h-4 transition-transform group-open:rotate-90"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          View detailed step-by-step instructions
        </summary>

        <div className="bg-zinc-900 rounded-lg p-6 mb-6">
          <h3 className="text-lg font-bold text-white mb-4">Claude Code Setup (This Machine)</h3>
          <div className="space-y-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-purple-600 text-white text-sm font-bold">
                  1
                </span>
                <label className="text-base font-medium text-white">
                  Install the CLI
                </label>
              </div>
              <p className="text-sm text-zinc-500 mb-2 ml-8">
                Requires Node.js 18 or higher
              </p>
              <div className="ml-8 flex items-center gap-2">
                <code className="flex-1 bg-zinc-800 px-3 py-2 rounded text-sm text-green-400 font-mono">
                  npm install -g claudometer
                </code>
                <button
                  onClick={() =>
                    copyToClipboard("npm install -g claudometer", "install")
                  }
                  className="px-3 py-2 bg-zinc-800 rounded text-zinc-400 hover:text-white transition-colors text-sm"
                >
                  {copiedItem === "install" ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-purple-600 text-white text-sm font-bold">
                  2
                </span>
                <label className="text-base font-medium text-white">
                  Login to Claudometer
                </label>
              </div>
              <p className="text-sm text-zinc-500 mb-2 ml-8">
                Opens your browser to sign in
              </p>
              <div className="ml-8 flex items-center gap-2">
                <code className="flex-1 bg-zinc-800 px-3 py-2 rounded text-sm text-green-400 font-mono">
                  claudometer login
                </code>
                <button
                  onClick={() => copyToClipboard("claudometer login", "login")}
                  className="px-3 py-2 bg-zinc-800 rounded text-zinc-400 hover:text-white transition-colors text-sm"
                >
                  {copiedItem === "login" ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-purple-600 text-white text-sm font-bold">
                  3
                </span>
                <label className="text-base font-medium text-white">
                  Sync your metrics
                </label>
              </div>
              <p className="text-sm text-zinc-500 mb-2 ml-8">
                Upload your Claude Code and Git activity
              </p>
              <div className="ml-8 flex items-center gap-2">
                <code className="flex-1 bg-zinc-800 px-3 py-2 rounded text-sm text-green-400 font-mono">
                  claudometer collect
                </code>
                <button
                  onClick={() => copyToClipboard("claudometer collect", "collect")}
                  className="px-3 py-2 bg-zinc-800 rounded text-zinc-400 hover:text-white transition-colors text-sm"
                >
                  {copiedItem === "collect" ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-zinc-700 text-zinc-300 text-sm font-bold">
                  4
                </span>
                <label className="text-base font-medium text-zinc-300">
                  Enable auto-sync (optional)
                </label>
              </div>
              <p className="text-sm text-zinc-500 mb-2 ml-8">
                Automatically syncs every 30 minutes (macOS)
              </p>
              <div className="ml-8 flex items-center gap-2">
                <code className="flex-1 bg-zinc-800 px-3 py-2 rounded text-sm text-green-400 font-mono">
                  claudometer setup
                </code>
                <button
                  onClick={() => copyToClipboard("claudometer setup", "setup")}
                  className="px-3 py-2 bg-zinc-800 rounded text-zinc-400 hover:text-white transition-colors text-sm"
                >
                  {copiedItem === "setup" ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* OpenClaw Setup */}
        <div className="bg-zinc-900 rounded-lg p-6">
          <h3 className="text-lg font-bold text-white mb-2">OpenClaw / 3rd Party Setup</h3>
          <p className="text-sm text-zinc-400 mb-4">
            Link a secondary machine running OpenClaw, MoldBot, or other Claude tools.
          </p>
          <div className="space-y-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-teal-600 text-white text-sm font-bold">
                  A
                </span>
                <label className="text-base font-medium text-white">
                  Generate a linking code
                </label>
                <span className="text-xs text-zinc-500">(on this machine)</span>
              </div>
              <p className="text-sm text-zinc-500 mb-2 ml-8">
                Creates a 6-character code valid for 10 minutes
              </p>
              <div className="ml-8 flex items-center gap-2">
                <code className="flex-1 bg-zinc-800 px-3 py-2 rounded text-sm text-green-400 font-mono">
                  claudometer link --generate
                </code>
                <button
                  onClick={() =>
                    copyToClipboard("claudometer link --generate", "link-gen")
                  }
                  className="px-3 py-2 bg-zinc-800 rounded text-zinc-400 hover:text-white transition-colors text-sm"
                >
                  {copiedItem === "link-gen" ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-teal-600 text-white text-sm font-bold">
                  B
                </span>
                <label className="text-base font-medium text-white">
                  Install CLI on secondary machine
                </label>
              </div>
              <p className="text-sm text-zinc-500 mb-2 ml-8">
                SSH into your server or open terminal on the other device
              </p>
              <div className="ml-8 flex items-center gap-2">
                <code className="flex-1 bg-zinc-800 px-3 py-2 rounded text-sm text-green-400 font-mono">
                  npm install -g claudometer
                </code>
                <button
                  onClick={() =>
                    copyToClipboard("npm install -g claudometer", "install-2")
                  }
                  className="px-3 py-2 bg-zinc-800 rounded text-zinc-400 hover:text-white transition-colors text-sm"
                >
                  {copiedItem === "install-2" ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-teal-600 text-white text-sm font-bold">
                  C
                </span>
                <label className="text-base font-medium text-white">
                  Connect using the code
                </label>
                <span className="text-xs text-zinc-500">(on secondary machine)</span>
              </div>
              <p className="text-sm text-zinc-500 mb-2 ml-8">
                Replace ABC123 with your code from step A
              </p>
              <div className="ml-8 flex items-center gap-2">
                <code className="flex-1 bg-zinc-800 px-3 py-2 rounded text-sm text-green-400 font-mono">
                  claudometer link --connect ABC123
                </code>
                <button
                  onClick={() =>
                    copyToClipboard("claudometer link --connect ", "link-connect")
                  }
                  className="px-3 py-2 bg-zinc-800 rounded text-zinc-400 hover:text-white transition-colors text-sm"
                >
                  {copiedItem === "link-connect" ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-teal-600 text-white text-sm font-bold">
                  D
                </span>
                <label className="text-base font-medium text-white">
                  Sync OpenClaw metrics
                </label>
              </div>
              <p className="text-sm text-zinc-500 mb-2 ml-8">
                Reads from ~/.openclaw, ~/.moldbot, etc. and reports to your account
              </p>
              <div className="ml-8 flex items-center gap-2">
                <code className="flex-1 bg-zinc-800 px-3 py-2 rounded text-sm text-green-400 font-mono">
                  claudometer collect
                </code>
                <button
                  onClick={() => copyToClipboard("claudometer collect", "collect-2")}
                  className="px-3 py-2 bg-zinc-800 rounded text-zinc-400 hover:text-white transition-colors text-sm"
                >
                  {copiedItem === "collect-2" ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>
          </div>

          <div className="mt-6 p-4 bg-teal-900/20 rounded-lg border border-teal-800/50">
            <h4 className="text-sm font-medium text-teal-300 mb-1">
              How it works
            </h4>
            <p className="text-xs text-zinc-400">
              The linking code creates a device token that lets the secondary machine report metrics to your account without needing browser login. Your OpenClaw usage will appear as &quot;3rd party&quot; in the leaderboards alongside your Claude Code usage.
            </p>
          </div>
        </div>
      </details>

      {/* Update CLI */}
      <div className="mt-6 p-4 bg-zinc-900 rounded-lg border border-zinc-700">
        <h4 className="text-sm font-medium text-zinc-300 mb-2">
          Updating the CLI
        </h4>
        <p className="text-xs text-zinc-500 mb-3">
          To update to the latest version:
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 bg-zinc-800 px-3 py-2 rounded text-xs text-green-400 font-mono overflow-x-auto">
            npm update -g claudometer
          </code>
          <button
            onClick={() =>
              copyToClipboard("npm update -g claudometer", "update")
            }
            className="px-3 py-2 bg-zinc-800 rounded text-zinc-400 hover:text-white transition-colors text-sm flex-shrink-0"
          >
            {copiedItem === "update" ? "Copied!" : "Copy"}
          </button>
        </div>
        <p className="text-xs text-zinc-500 mt-2">
          Check your version with <code className="text-green-400">claudometer --version</code>
        </p>
      </div>
    </div>
  );
}
