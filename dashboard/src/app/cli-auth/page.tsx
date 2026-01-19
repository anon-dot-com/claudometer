"use client";

import { useAuth, useUser, useOrganization, useOrganizationList } from "@clerk/nextjs";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useEffect, useState, useRef } from "react";

function CLIAuthContent() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  const { organization } = useOrganization();
  const { setActive, userMemberships, isLoaded: isOrgListLoaded } = useOrganizationList({
    userMemberships: { infinite: true },
  });
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [isSettingOrg, setIsSettingOrg] = useState(false);
  const hasProcessedRef = useRef(false);

  useEffect(() => {
    async function authorize() {
      const callback = searchParams.get("callback");
      const requestedOrgId = searchParams.get("org");

      if (!callback) {
        setError("Missing callback URL");
        setStatus("error");
        return;
      }

      // Wait for Clerk to load
      if (!isLoaded) {
        return;
      }

      // Redirect to sign-in if not authenticated
      if (!isSignedIn) {
        let returnUrl = `/cli-auth?callback=${encodeURIComponent(callback)}`;
        if (requestedOrgId) {
          returnUrl += `&org=${encodeURIComponent(requestedOrgId)}`;
        }
        router.push(`/sign-in?redirect_url=${encodeURIComponent(returnUrl)}`);
        return;
      }

      // Don't re-process if we've already handled this request or hit an error
      if (hasProcessedRef.current || status === "error" || status === "success") {
        return;
      }

      // Wait for user data
      if (!user) {
        return;
      }

      // If org ID was requested, validate membership first
      if (requestedOrgId) {
        // Wait for organization list to fully load
        if (!isOrgListLoaded || !userMemberships?.data) {
          return;
        }

        // Check if user is a member of the requested org
        const membership = userMemberships.data.find(
          (m) => m.organization.id === requestedOrgId
        );

        if (!membership) {
          // User is not a member - they need to be invited via Clerk first
          hasProcessedRef.current = true;
          setError(`You're not a member of this organization. Please ask an admin to invite you via the Claudometer dashboard, then try again.`);
          setStatus("error");
          return;
        }

        // User is a member, switch to that org if not already active
        if (organization?.id !== requestedOrgId) {
          if (!isSettingOrg && setActive) {
            setIsSettingOrg(true);
            await setActive({ organization: requestedOrgId });
          }
          return; // Will re-run effect after org switch
        }
      }

      // At this point, either no org was requested, or we're in the right org
      if (!organization) {
        // User has no organization - they need to create one or be invited
        if (!requestedOrgId) {
          // No specific org requested but user has no org
          hasProcessedRef.current = true;
          setError("No organization found. Please create an organization or ask to be invited to one.");
          setStatus("error");
        }
        return;
      }

      // Mark as processed to prevent duplicate API calls
      hasProcessedRef.current = true;

      try {
        // Get a session token from Clerk
        const clerkToken = await getToken();

        if (!clerkToken) {
          setError("Failed to get authentication token");
          setStatus("error");
          return;
        }

        // Exchange Clerk token for long-lived CLI token
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
        const tokenResponse = await fetch(`${apiUrl}/auth/token`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${clerkToken}`,
            "Content-Type": "application/json",
          },
        });

        if (!tokenResponse.ok) {
          const error = await tokenResponse.json();
          setError(error.error || "Failed to exchange token");
          setStatus("error");
          return;
        }

        const tokenData = await tokenResponse.json();

        // Build the callback URL with auth data
        const userJson = encodeURIComponent(JSON.stringify(tokenData.user));
        const orgJson = encodeURIComponent(JSON.stringify(tokenData.org));

        const callbackUrl = `${callback}?token=${tokenData.token}&user=${userJson}&org=${orgJson}`;

        setStatus("success");

        // Redirect to the CLI callback
        setTimeout(() => {
          window.location.href = callbackUrl;
        }, 1000);
      } catch (err) {
        console.error("Auth error:", err);
        setError(err instanceof Error ? err.message : "Authentication failed");
        setStatus("error");
      }
    }

    authorize();
  }, [isLoaded, isSignedIn, user, organization, getToken, searchParams, router, setActive, userMemberships, isSettingOrg, isOrgListLoaded, status]);

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="bg-zinc-900 rounded-lg p-8 max-w-md text-center">
        {status === "loading" && (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
            <h1 className="text-xl font-semibold text-white mb-2">
              Authorizing CLI...
            </h1>
            <p className="text-zinc-400">
              Please wait while we connect your CLI to Claudometer.
            </p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="text-green-500 text-5xl mb-4">✓</div>
            <h1 className="text-xl font-semibold text-white mb-2">
              CLI Authorized!
            </h1>
            <p className="text-zinc-400">
              Redirecting back to your terminal...
            </p>
          </>
        )}

        {status === "error" && (
          <>
            <div className="text-red-500 text-5xl mb-4">✗</div>
            <h1 className="text-xl font-semibold text-white mb-2">
              Authorization Failed
            </h1>
            <p className="text-red-400">{error}</p>
            <p className="text-zinc-400 mt-4">
              Please close this window and try again.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

export default function CLIAuthPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
          <div className="bg-zinc-900 rounded-lg p-8 max-w-md text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
            <h1 className="text-xl font-semibold text-white mb-2">Loading...</h1>
          </div>
        </div>
      }
    >
      <CLIAuthContent />
    </Suspense>
  );
}
