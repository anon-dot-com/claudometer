"use client";

import { useAuth, useUser, SignInButton, SignUpButton } from "@clerk/nextjs";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

interface OrgInfo {
  id: string;
  name: string;
  imageUrl?: string;
  membersCount?: number;
}

type RequestStatus = "none" | "pending" | "approved" | "denied" | "member" | "loading";

export default function JoinPage() {
  const params = useParams();
  const router = useRouter();
  const orgId = params.orgId as string;

  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { user } = useUser();

  const [org, setOrg] = useState<OrgInfo | null>(null);
  const [orgLoading, setOrgLoading] = useState(true);
  const [orgError, setOrgError] = useState<string | null>(null);

  const [requestStatus, setRequestStatus] = useState<RequestStatus>("loading");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

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

  // Check if user is already a member or has a pending request
  useEffect(() => {
    async function checkMembership() {
      if (!isLoaded || !isSignedIn || !user) {
        setRequestStatus("none");
        return;
      }

      // Check if user is already a member of this org
      const membership = user.organizationMemberships?.find(
        (m) => m.organization.id === orgId
      );
      if (membership) {
        setRequestStatus("member");
        return;
      }

      // Check for existing join request
      try {
        const token = await getToken();
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
        const response = await fetch(`${apiUrl}/api/join-requests/status/${orgId}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setRequestStatus(data.status as RequestStatus);
        } else {
          setRequestStatus("none");
        }
      } catch (error) {
        console.error("Error checking request status:", error);
        setRequestStatus("none");
      }
    }

    checkMembership();
  }, [isLoaded, isSignedIn, user, orgId, getToken]);

  const handleRequestJoin = async () => {
    if (!isSignedIn) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const token = await getToken();
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
      const response = await fetch(`${apiUrl}/api/join-requests`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ orgId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to submit request");
      }

      setRequestStatus("pending");
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to submit request");
    } finally {
      setSubmitting(false);
    }
  };

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

        {/* Content based on auth state and request status */}
        {!isLoaded ? (
          <div className="text-center text-zinc-400">Loading...</div>
        ) : !isSignedIn ? (
          /* Not signed in */
          <div className="space-y-4">
            <p className="text-center text-zinc-300 mb-6">
              Sign in or create an account to request to join this team.
            </p>
            <SignUpButton mode="modal">
              <button className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors">
                Sign Up to Join
              </button>
            </SignUpButton>
            <SignInButton mode="modal">
              <button className="w-full px-4 py-3 bg-zinc-800 text-white rounded-lg font-medium hover:bg-zinc-700 transition-colors">
                Already have an account? Sign In
              </button>
            </SignInButton>
          </div>
        ) : requestStatus === "loading" ? (
          <div className="text-center text-zinc-400">Checking membership...</div>
        ) : requestStatus === "member" ? (
          /* Already a member */
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-white mb-2">You&apos;re already a member!</h2>
            <p className="text-zinc-400 mb-6">You have access to this organization.</p>
            <button
              onClick={() => router.push("/")}
              className="px-6 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors"
            >
              Go to Dashboard
            </button>
          </div>
        ) : requestStatus === "pending" ? (
          /* Request pending */
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-yellow-500/20 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-white mb-2">Request Pending</h2>
            <p className="text-zinc-400 mb-6">
              Your request to join {org.name} is waiting for admin approval.
            </p>
            <p className="text-zinc-500 text-sm">
              You&apos;ll be able to access the team once an admin approves your request.
            </p>
          </div>
        ) : requestStatus === "approved" ? (
          /* Request approved */
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-white mb-2">Request Approved!</h2>
            <p className="text-zinc-400 mb-6">
              Welcome to {org.name}! You can now access the team dashboard.
            </p>
            <button
              onClick={() => router.push("/")}
              className="px-6 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors"
            >
              Go to Dashboard
            </button>
          </div>
        ) : requestStatus === "denied" ? (
          /* Request denied - allow resubmission */
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-white mb-2">Request Not Approved</h2>
            <p className="text-zinc-400 mb-6">
              Your previous request was not approved. You can submit a new request if you&apos;d like.
            </p>
            <button
              onClick={handleRequestJoin}
              disabled={submitting}
              className="px-6 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Submitting..." : "Request Again"}
            </button>
          </div>
        ) : (
          /* No request yet */
          <div className="text-center">
            <p className="text-zinc-300 mb-6">
              Request to join {org.name} and start tracking your Claude Code activity with the team.
            </p>
            {submitError && (
              <p className="text-red-400 text-sm mb-4">{submitError}</p>
            )}
            <button
              onClick={handleRequestJoin}
              disabled={submitting}
              className="w-full px-6 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Submitting Request..." : "Request to Join"}
            </button>
            <p className="text-zinc-500 text-sm mt-4">
              An admin will review your request and approve or deny it.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
