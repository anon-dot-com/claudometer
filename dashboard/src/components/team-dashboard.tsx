"use client";

import { useAuth, useOrganization } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import Link from "next/link";
import { LeaderboardCard } from "./leaderboard-card";

interface LeaderboardEntry {
  id: string;
  name: string;
  email: string;
  value: number;
  reported_at?: string;
}

type Period = "today" | "week" | "month" | "all";

const periodLabels: Record<Period, string> = {
  today: "Today",
  week: "This Week",
  month: "This Month",
  all: "All Time",
};

// Leaderboard configuration
const leaderboards = [
  { metric: "claude_tokens", title: "Token Velocity" },
  { metric: "claude_messages", title: "Message Masters" },
  { metric: "git_commits", title: "Commit Champions" },
  { metric: "git_lines_added", title: "Line Leaders" },
];

export function TeamDashboard() {
  const { getToken, orgId } = useAuth();
  const { organization } = useOrganization();
  const [period, setPeriod] = useState<Period>("week");
  const [data, setData] = useState<Record<string, LeaderboardEntry[]>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [initialLoad, setInitialLoad] = useState(true);

  useEffect(() => {
    // Reset data when organization changes
    setData({});
    setInitialLoad(true);

    async function loadLeaderboards() {
      // Wait until session's active org matches the selected org
      // (OrganizationSwitcher calls setActive which updates both, but there can be a race)
      if (organization?.id && orgId !== organization.id) {
        console.log(`[TeamDashboard] Waiting for org sync: session=${orgId}, selected=${organization.id}`);
        return;
      }

      const token = await getToken();
      if (!token) return;

      // Load all leaderboards in parallel
      const loadPromises = leaderboards.map(async ({ metric }) => {
        setLoading((prev) => ({ ...prev, [metric]: true }));
        try {
          const res = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/api/metrics/leaderboard?metric=${metric}&period=${period}&limit=10`,
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          );

          if (res.ok) {
            const result = await res.json();
            setData((prev) => ({ ...prev, [metric]: result.leaderboard || [] }));
          }
        } catch (err) {
          console.error(`Failed to load ${metric} leaderboard:`, err);
        } finally {
          setLoading((prev) => ({ ...prev, [metric]: false }));
        }
      });

      await Promise.all(loadPromises);
      setInitialLoad(false);
    }

    loadLeaderboards();
    // Re-fetch when organization changes
    // orgId = session's active org, organization?.id = UI selected org
    // Both need to match before we fetch (handles race condition after org switch)
  }, [getToken, period, organization?.id, orgId]);

  // Check if all leaderboards are empty
  const allEmpty = !initialLoad && Object.values(data).every((entries) => entries.length === 0);
  const isLoading = initialLoad || Object.values(loading).some((l) => l);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header with title and period selector */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white">Team Claudometer</h2>
          <p className="text-zinc-400 mt-1">
            See how your team is performing across key metrics
          </p>
        </div>
        <div className="flex gap-1 bg-zinc-900 rounded-lg p-1">
          {(["today", "week", "month", "all"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                period === p
                  ? "bg-purple-600 text-white"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              {periodLabels[p]}
            </button>
          ))}
        </div>
      </div>

      {/* Empty state */}
      {allEmpty && !isLoading ? (
        <div className="bg-zinc-900 rounded-lg p-12 text-center">
          <div className="text-5xl mb-4">👥</div>
          <h3 className="text-xl font-semibold text-white mb-2">No team data yet</h3>
          <p className="text-zinc-400 mb-6 max-w-md mx-auto">
            Invite your team members and have them install the Claudometer CLI to see leaderboards.
          </p>
          <div className="bg-zinc-800 px-4 py-3 rounded-lg inline-block mb-6">
            <code className="text-sm text-green-400 font-mono">
              npm i -g claudometer && claudometer login && claudometer collect
            </code>
          </div>
          <div>
            <Link
              href="/settings"
              className="inline-flex items-center gap-2 text-purple-400 hover:text-purple-300 transition-colors"
            >
              Invite team members
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      ) : (
        /* 2x2 Leaderboard Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {leaderboards.map(({ metric, title }) => (
            <LeaderboardCard
              key={metric}
              title={title}
              metric={metric}
              entries={data[metric] || []}
              loading={loading[metric]}
            />
          ))}
        </div>
      )}
    </div>
  );
}
