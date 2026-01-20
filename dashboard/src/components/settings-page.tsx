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
          Share this link with anyone you want to join. They&apos;ll request access and you can approve them below.
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

      {/* Pending Join Requests */}
      {!requestsLoading && pendingRequests.length > 0 && (
        <div className="bg-zinc-900 rounded-lg p-6 mb-6 border border-yellow-500/30">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></div>
            <h3 className="text-lg font-semibold text-white">
              Pending Requests ({pendingRequests.length})
            </h3>
          </div>
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
