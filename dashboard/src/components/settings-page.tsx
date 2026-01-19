"use client";

import { OrganizationProfile, useOrganization } from "@clerk/nextjs";
import { useState } from "react";

export function SettingsPage() {
  const { organization } = useOrganization();
  const [copiedItem, setCopiedItem] = useState<string | null>(null);

  const copyToClipboard = (text: string, item: string) => {
    navigator.clipboard.writeText(text);
    setCopiedItem(item);
    setTimeout(() => setCopiedItem(null), 2000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h2 className="text-2xl font-bold text-white mb-8">Settings</h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Team Setup Instructions */}
        <div className="bg-zinc-900 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-white mb-2">
            Get Started with Claudometer
          </h3>
          <p className="text-zinc-400 text-sm mb-6">
            Install the CLI to start tracking your Claude Code and Git activity.
            Share these instructions with your team.
          </p>

          <div className="space-y-5">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-purple-600 text-white text-xs font-bold">1</span>
                <label className="text-sm font-medium text-white">
                  Install the CLI
                </label>
              </div>
              <p className="text-xs text-zinc-500 mb-2 ml-7">
                Requires Node.js 18 or higher
              </p>
              <div className="ml-7 flex items-center gap-2">
                <code className="flex-1 bg-zinc-800 px-3 py-2 rounded text-sm text-green-400 font-mono">
                  npm install -g claudometer
                </code>
                <button
                  onClick={() => copyToClipboard("npm install -g claudometer", "install")}
                  className="px-3 py-2 bg-zinc-800 rounded text-zinc-400 hover:text-white transition-colors text-sm"
                >
                  {copiedItem === "install" ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-purple-600 text-white text-xs font-bold">2</span>
                <label className="text-sm font-medium text-white">
                  Login to {organization?.name || "your organization"}
                </label>
              </div>
              <p className="text-xs text-zinc-500 mb-2 ml-7">
                Opens browser to authenticate and join your team
              </p>
              <div className="ml-7 flex items-center gap-2">
                <code className="flex-1 bg-zinc-800 px-3 py-2 rounded text-sm text-green-400 font-mono overflow-x-auto">
                  claudometer login --org {organization?.id || "<org_id>"}
                </code>
                <button
                  onClick={() => copyToClipboard(`claudometer login --org ${organization?.id || "<org_id>"}`, "login")}
                  className="px-3 py-2 bg-zinc-800 rounded text-zinc-400 hover:text-white transition-colors text-sm"
                >
                  {copiedItem === "login" ? "Copied!" : "Copy"}
                </button>
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-purple-600 text-white text-xs font-bold">3</span>
                <label className="text-sm font-medium text-white">
                  Sync your metrics
                </label>
              </div>
              <p className="text-xs text-zinc-500 mb-2 ml-7">
                Upload your Claude Code and Git activity
              </p>
              <div className="ml-7 flex items-center gap-2">
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
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-zinc-700 text-zinc-300 text-xs font-bold">4</span>
                <label className="text-sm font-medium text-zinc-300">
                  Enable auto-sync (optional)
                </label>
              </div>
              <p className="text-xs text-zinc-500 mb-2 ml-7">
                Automatically syncs every 30 minutes (macOS)
              </p>
              <div className="ml-7 flex items-center gap-2">
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

          <div className="mt-6 p-4 bg-purple-500/10 rounded-lg border border-purple-500/20">
            <h4 className="text-sm font-medium text-purple-400 mb-2">
              Share with your team
            </h4>
            <p className="text-xs text-zinc-400 mb-2">
              Copy this command to invite team members to {organization?.name || "your organization"}:
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-zinc-800 px-3 py-2 rounded text-xs text-green-400 font-mono overflow-x-auto">
                npm i -g claudometer && claudometer login --org {organization?.id || "<org_id>"} && claudometer collect
              </code>
              <button
                onClick={() =>
                  copyToClipboard(
                    `npm i -g claudometer && claudometer login --org ${organization?.id || "<org_id>"} && claudometer collect`,
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
