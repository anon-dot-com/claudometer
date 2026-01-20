"use client";

import { OrganizationProfile, useOrganization, useAuth } from "@clerk/nextjs";
import { useState, useEffect, useCallback } from "react";

interface JoinRequest {
  id: number;
  userId: string;
  email: string;
  name: string | null;
  status: string;
  requestedAt: string;
}

export function SettingsPage() {
  const { organization } = useOrganization();
  const { getToken } = useAuth();
  const [copiedItem, setCopiedItem] = useState<string | null>(null);
  const [pendingRequests, setPendingRequests] = useState<JoinRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<number | null>(null);

  const joinLink = organization?.id
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/join/${organization.id}`
    : "";

  const copyToClipboard = (text: string, item: string) => {
    navigator.clipboard.writeText(text);
    setCopiedItem(item);
    setTimeout(() => setCopiedItem(null), 2000);
  };

  const fetchPendingRequests = useCallback(async () => {
    if (!organization?.id) return;

    try {
      const token = await getToken();
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
      const response = await fetch(`${apiUrl}/api/join-requests?status=pending`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setPendingRequests(data.requests || []);
      }
    } catch (error) {
      console.error("Error fetching pending requests:", error);
    } finally {
      setRequestsLoading(false);
    }
  }, [organization?.id, getToken]);

  useEffect(() => {
    fetchPendingRequests();
  }, [fetchPendingRequests]);

  const handleApprove = async (requestId: number) => {
    setProcessingId(requestId);
    try {
      const token = await getToken();
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
      const response = await fetch(`${apiUrl}/api/join-requests/${requestId}/approve`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        setPendingRequests((prev) => prev.filter((r) => r.id !== requestId));
      }
    } catch (error) {
      console.error("Error approving request:", error);
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeny = async (requestId: number) => {
    setProcessingId(requestId);
    try {
      const token = await getToken();
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
      const response = await fetch(`${apiUrl}/api/join-requests/${requestId}/deny`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        setPendingRequests((prev) => prev.filter((r) => r.id !== requestId));
      }
    } catch (error) {
      console.error("Error denying request:", error);
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h2 className="text-2xl font-bold text-white mb-8">Settings</h2>

      {/* Prominent Invite Link Section */}
      <div className="bg-gradient-to-r from-purple-900/50 to-purple-800/30 rounded-lg p-6 mb-8 border border-purple-500/30">
        <div className="flex items-start justify-between gap-6">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-white mb-2 flex items-center gap-2">
              <span className="text-2xl">🔗</span>
              Invite your team to {organization?.name || "your organization"}
            </h3>
            <p className="text-zinc-300 text-sm mb-4">
              Share this link with anyone you want to join your team. They&apos;ll be able to request access, and you can approve them below.
            </p>
            <div className="flex items-center gap-3">
              <code className="flex-1 bg-zinc-900/80 px-4 py-3 rounded-lg text-sm text-purple-300 font-mono border border-purple-500/20">
                {joinLink || "Loading..."}
              </code>
              <button
                onClick={() => copyToClipboard(joinLink, "join-link")}
                disabled={!joinLink}
                className="px-5 py-3 bg-purple-600 rounded-lg text-white font-medium hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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
                    Copy Link
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Pending Join Requests */}
      {!requestsLoading && pendingRequests.length > 0 && (
        <div className="bg-zinc-900 rounded-lg p-6 mb-8 border border-yellow-500/30">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></div>
            <h3 className="text-lg font-semibold text-white">
              Pending Join Requests ({pendingRequests.length})
            </h3>
          </div>
          <p className="text-zinc-400 text-sm mb-4">
            These people have requested to join your team. Approve or deny their requests.
          </p>
          <div className="space-y-3">
            {pendingRequests.map((request) => (
              <div
                key={request.id}
                className="flex items-center justify-between bg-zinc-800 rounded-lg p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center text-white font-medium">
                    {(request.name || request.email).charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-white font-medium">
                      {request.name || "Unknown"}
                    </p>
                    <p className="text-zinc-400 text-sm">{request.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-zinc-500 text-xs mr-2">
                    {new Date(request.requestedAt).toLocaleDateString()}
                  </span>
                  <button
                    onClick={() => handleDeny(request.id)}
                    disabled={processingId === request.id}
                    className="px-3 py-1.5 bg-zinc-700 text-zinc-300 rounded-lg text-sm hover:bg-zinc-600 transition-colors disabled:opacity-50"
                  >
                    Deny
                  </button>
                  <button
                    onClick={() => handleApprove(request.id)}
                    disabled={processingId === request.id}
                    className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition-colors disabled:opacity-50"
                  >
                    {processingId === request.id ? "..." : "Approve"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
                Opens browser to authenticate and connect to your team
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
              Share with new team members
            </h4>
            <p className="text-xs text-zinc-400 mb-3">
              After approving a new member, share this command so they can start syncing:
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
                className="px-3 py-2 bg-zinc-700 rounded text-white text-sm hover:bg-zinc-600 transition-colors flex-shrink-0"
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
