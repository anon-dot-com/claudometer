"use client";

import { OrganizationProfile, useOrganization } from "@clerk/nextjs";
import { useState } from "react";

export function SettingsPage() {
  const { organization } = useOrganization();
  const [copiedItem, setCopiedItem] = useState<string | null>(null);

  const joinLink = organization?.id
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/join/${organization.id}`
    : "";

  const copyToClipboard = (text: string, item: string) => {
    navigator.clipboard.writeText(text);
    setCopiedItem(item);
    setTimeout(() => setCopiedItem(null), 2000);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h2 className="text-2xl font-bold text-white mb-2">Settings</h2>
      <p className="text-zinc-400 mb-8">
        Invite team members and manage your organization.
      </p>

      {/* Invite Link Section */}
      <div className="bg-gradient-to-r from-purple-900/50 to-purple-800/30 rounded-lg p-6 mb-6 border border-purple-500/30">
        <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
          <span className="text-xl">🔗</span>
          Invite your team
        </h3>
        <p className="text-zinc-300 text-sm mb-4">
          Share this link with anyone you want to join. They&apos;ll be automatically added to your team.
        </p>
        <div className="flex items-center gap-3">
          <code className="flex-1 bg-zinc-900/80 px-4 py-3 rounded-lg text-sm text-purple-300 font-mono border border-purple-500/20 overflow-x-auto">
            {joinLink || "Loading..."}
          </code>
          <button
            onClick={() => copyToClipboard(joinLink, "join-link")}
            disabled={!joinLink}
            className="px-4 py-3 bg-purple-600 rounded-lg text-white font-medium hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 flex-shrink-0"
          >
            {copiedItem === "join-link" ? (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Copied!
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy
              </>
            )}
          </button>
        </div>
      </div>

      {/* Team Management */}
      <div className="bg-zinc-900 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4">
          Team Management
        </h3>

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
  );
}
