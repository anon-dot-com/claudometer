"use client";

import { useAuth, useUser, SignInButton, SignUpButton } from "@clerk/nextjs";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";

interface OrgInfo {
  id: string;
  name: string;
  imageUrl?: string;
  membersCount?: number;
}

type JoinStatus = "loading" | "not_signed_in" | "already_member" | "joining" | "joined" | "error";

export default function JoinPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = params.orgId as string;

  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { user } = useUser();

  const [org, setOrg] = useState<OrgInfo | null>(null);
  const [orgLoading, setOrgLoading] = useState(true);
  const [orgError, setOrgError] = useState<string | null>(null);

  const [joinStatus, setJoinStatus] = useState<JoinStatus>("loading");
  const [error, setError] = useState<string | null>(null);

  const hasAttemptedJoin = useRef(false);

  // Fetch organization info
  useEffect(() => {
    async function fetchOrg() {
      try {
        const response = await fetch(`/api/org/${orgId}`);
        if (!response.ok) {
          throw new Error("Organization not found");
        }
        const data = await response.json();
        setOrg(data);
      } catch (error) {
        setOrgError(error instanceof Error ? error.message : "Failed to load organization");
      } finally {
        setOrgLoading(false);
      }
    }

    if (orgId) {
      fetchOrg();
    }
  }, [orgId]);

  // Auto-join when user is signed in
  useEffect(() => {
    async function handleAutoJoin() {
      if (!isLoaded) return;

      if (!isSignedIn) {
        setJoinStatus("not_signed_in");
        return;
      }

      // Check if already a member
      const membership = user?.organizationMemberships?.find(
        (m) => m.organization.id === orgId
      );
      if (membership) {
        setJoinStatus("already_member");
        return;
      }

      // Prevent duplicate join attempts
      if (hasAttemptedJoin.current) return;
      hasAttemptedJoin.current = true;

      // Auto-join the organization
      setJoinStatus("joining");
      try {
        const token = await getToken();
        const response = await fetch(`/api/org/${orgId}/join`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to join organization");
        }

        setJoinStatus("joined");

        // Redirect to dashboard after a short delay
        setTimeout(() => {
          router.push("/dashboard");
        }, 2000);
      } catch (error) {
        setError(error instanceof Error ? error.message : "Failed to join organization");
        setJoinStatus("error");
        hasAttemptedJoin.current = false; // Allow retry
      }
    }

    handleAutoJoin();
  }, [isLoaded, isSignedIn, user, orgId, getToken, router]);

  if (orgLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-zinc-400">Loading...</div>
      </div>
    );
  }

  if (orgError || !org) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="bg-zinc-900 rounded-lg p-8 max-w-md text-center">
          <div className="text-4xl mb-4">🔍</div>
          <h1 className="text-xl font-semibold text-white mb-2">Organization Not Found</h1>
          <p className="text-zinc-400 mb-6">
            This organization doesn&apos;t exist or the link may be invalid.
          </p>
          <a
            href="/"
            className="inline-block px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            Go to Homepage
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="bg-zinc-900 rounded-xl p-8 max-w-md w-full">
        {/* Org Header */}
        <div className="text-center mb-8">
          {org.imageUrl ? (
            <img
              src={org.imageUrl}
              alt={org.name}
              className="w-20 h-20 rounded-full mx-auto mb-4 border-2 border-purple-500"
            />
          ) : (
            <div className="w-20 h-20 rounded-full mx-auto mb-4 bg-purple-600 flex items-center justify-center text-3xl font-bold text-white">
              {org.name.charAt(0).toUpperCase()}
            </div>
          )}
          <h1 className="text-2xl font-bold text-white mb-2">{org.name}</h1>
          <p className="text-zinc-400">
            {org.membersCount !== undefined && (
              <span>{org.membersCount} member{org.membersCount !== 1 ? "s" : ""}</span>
            )}
          </p>
        </div>

        {/* Content based on join status */}
        {joinStatus === "loading" || !isLoaded ? (
          <div className="text-center text-zinc-400">Loading...</div>
        ) : joinStatus === "not_signed_in" ? (
          <div className="space-y-4">
            <p className="text-center text-zinc-300 mb-6">
              Create an account to join {org.name} and start tracking your Claude Code activity.
            </p>
            <SignUpButton
              mode="modal"
              forceRedirectUrl={`/join/${orgId}`}
            >
              <button className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors">
                Sign Up to Join
              </button>
            </SignUpButton>
            <SignInButton
              mode="modal"
              forceRedirectUrl={`/join/${orgId}`}
            >
              <button className="w-full px-4 py-3 bg-zinc-800 text-white rounded-lg font-medium hover:bg-zinc-700 transition-colors">
                Already have an account? Sign In
              </button>
            </SignInButton>
          </div>
        ) : joinStatus === "joining" ? (
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-purple-500/20 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-purple-500 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-white mb-2">Joining {org.name}...</h2>
            <p className="text-zinc-400">Please wait a moment.</p>
          </div>
        ) : joinStatus === "joined" ? (
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-white mb-2">Welcome to {org.name}!</h2>
            <p className="text-zinc-400 mb-6">You&apos;ve successfully joined the team.</p>
            <p className="text-zinc-500 text-sm">Redirecting to dashboard...</p>
          </div>
        ) : joinStatus === "already_member" ? (
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-white mb-2">You&apos;re already a member!</h2>
            <p className="text-zinc-400 mb-6">You have access to {org.name}.</p>
            <button
              onClick={() => router.push("/dashboard")}
              className="px-6 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors"
            >
              Go to Dashboard
            </button>
          </div>
        ) : joinStatus === "error" ? (
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-white mb-2">Unable to Join</h2>
            <p className="text-zinc-400 mb-4">{error || "Something went wrong."}</p>
            <button
              onClick={() => {
                setJoinStatus("loading");
                hasAttemptedJoin.current = false;
              }}
              className="px-6 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
