"use client";

import { useAuth, useUser, useOrganization } from "@clerk/nextjs";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

function CLIAuthContent() {
  const { isLoaded, isSignedIn, getToken } = useAuth();
  const { user } = useUser();
  const { organization } = useOrganization();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function authorize() {
      const callback = searchParams.get("callback");

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
        const returnUrl = `/cli-auth?callback=${encodeURIComponent(callback)}`;
        router.push(`/sign-in?redirect_url=${encodeURIComponent(returnUrl)}`);
        return;
      }

      if (!user || !organization) {
        // User is signed in but org not loaded yet, or no org selected
        return;
      }

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
  }, [isLoaded, isSignedIn, user, organization, getToken, searchParams, router]);

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
