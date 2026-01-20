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
      <p className="text-zinc-400 mb-8">
        Install the CLI to start tracking your Claude Code and Git activity.
      </p>

      <div className="bg-zinc-900 rounded-lg p-6">
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

        <div className="mt-8 p-4 bg-zinc-800/50 rounded-lg border border-zinc-700">
          <h4 className="text-sm font-medium text-zinc-300 mb-2">
            Quick start
          </h4>
          <p className="text-xs text-zinc-500 mb-3">
            Run this single command to install, login, and sync:
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-zinc-800 px-3 py-2 rounded text-xs text-green-400 font-mono overflow-x-auto">
              npm i -g claudometer && claudometer login && claudometer collect
            </code>
            <button
              onClick={() =>
                copyToClipboard(
                  "npm i -g claudometer && claudometer login && claudometer collect",
                  "quick"
                )
              }
              className="px-3 py-2 bg-purple-600 rounded text-white text-sm hover:bg-purple-700 transition-colors flex-shrink-0"
            >
              {copiedItem === "quick" ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
