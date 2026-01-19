"use client";

import { OrganizationProfile, useOrganization } from "@clerk/nextjs";
import { useState } from "react";

export function SettingsPage() {
  const { organization } = useOrganization();
  const [copied, setCopied] = useState(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h2 className="text-2xl font-bold text-white mb-8">Settings</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Team Setup Instructions */}
        <div className="bg-zinc-900 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4">
            Setup Instructions for Team
          </h3>
          <p className="text-zinc-400 text-sm mb-6">
            Share these instructions with your team members to get them started
            with Claudometer.
          </p>

          <div className="space-y-4">
            <div>
              <label className="text-xs text-zinc-500 uppercase tracking-wide">
                Step 1: Install CLI
              </label>
              <div className="mt-1 flex items-center gap-2">
                <code className="flex-1 bg-zinc-800 px-3 py-2 rounded text-sm text-green-400 font-mono">
                  npm install -g claudometer
                </code>
                <button
                  onClick={() => copyToClipboard("npm install -g claudometer")}
                  className="px-3 py-2 bg-zinc-800 rounded text-zinc-400 hover:text-white transition-colors text-sm"
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs text-zinc-500 uppercase tracking-wide">
                Step 2: Login
              </label>
              <div className="mt-1">
                <code className="block bg-zinc-800 px-3 py-2 rounded text-sm text-green-400 font-mono">
                  claudometer login
                </code>
              </div>
              <p className="text-xs text-zinc-500 mt-1">
                Opens browser to authenticate with {organization?.name || "your organization"}
              </p>
            </div>

            <div>
              <label className="text-xs text-zinc-500 uppercase tracking-wide">
                Step 3: Enable Auto-Sync
              </label>
              <div className="mt-1">
                <code className="block bg-zinc-800 px-3 py-2 rounded text-sm text-green-400 font-mono">
                  claudometer setup
                </code>
              </div>
              <p className="text-xs text-zinc-500 mt-1">
                Automatically syncs metrics every 30 minutes
              </p>
            </div>
          </div>

          <div className="mt-6 p-4 bg-purple-500/10 rounded-lg border border-purple-500/20">
            <h4 className="text-sm font-medium text-purple-400 mb-2">
              Quick Share
            </h4>
            <p className="text-xs text-zinc-400">
              Copy and share this one-liner with your team:
            </p>
            <div className="mt-2 flex items-center gap-2">
              <code className="flex-1 bg-zinc-800 px-3 py-2 rounded text-xs text-green-400 font-mono overflow-x-auto">
                npm i -g claudometer && claudometer login && claudometer setup
              </code>
              <button
                onClick={() =>
                  copyToClipboard(
                    "npm i -g claudometer && claudometer login && claudometer setup"
                  )
                }
                className="px-3 py-2 bg-purple-600 rounded text-white text-sm hover:bg-purple-700 transition-colors flex-shrink-0"
              >
                Copy
              </button>
            </div>
          </div>
        </div>

        {/* Organization Management */}
        <div className="bg-zinc-900 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-4">
            Team Management
          </h3>
          <p className="text-zinc-400 text-sm mb-6">
            Invite team members and manage your organization settings.
          </p>

          <OrganizationProfile
            appearance={{
              elements: {
                rootBox: "w-full",
                card: "bg-transparent shadow-none",
                navbar: "hidden",
                pageScrollBox: "p-0",
                profileSection__organizationProfile: "hidden",
                profileSection__organizationDanger: "hidden",
              },
              variables: {
                colorBackground: "#18181b",
                colorInputBackground: "#27272a",
                colorText: "#ffffff",
                colorTextSecondary: "#a1a1aa",
                colorPrimary: "#a855f7",
              },
            }}
          />
        </div>
      </div>
    </div>
  );
}
