"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect, useState } from "react";
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
  week: "Last 7 Days",
  month: "Last 30 Days",
  all: "All Time",
};

// Leaderboard configuration
const leaderboards = [
  { metric: "claude_tokens", title: "Token Velocity" },
  { metric: "claude_messages", title: "Message Masters" },
  { metric: "git_commits", title: "Commit Champions" },
  { metric: "git_lines_added", title: "Line Leaders" },
];

export function GlobalDashboard() {
  const { getToken } = useAuth();
  const [period, setPeriod] = useState<Period>("week");
  const [data, setData] = useState<Record<string, LeaderboardEntry[]>>({});
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [initialLoad, setInitialLoad] = useState(true);

  useEffect(() => {
    async function loadLeaderboards() {
      const token = await getToken();
      if (!token) return;

      // Load all leaderboards in parallel
      const loadPromises = leaderboards.map(async ({ metric }) => {
        setLoading((prev) => ({ ...prev, [metric]: true }));
        try {
          const res = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/api/metrics/leaderboard?metric=${metric}&period=${period}&limit=10&scope=global`,
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
  }, [getToken, period]);

  // Check if all leaderboards are empty
  const allEmpty = !initialLoad && Object.values(data).every((entries) => entries.length === 0);
  const isLoading = initialLoad || Object.values(loading).some((l) => l);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header with title and period selector */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white">Global Leaderboard</h2>
          <p className="text-zinc-400 mt-1">
            See how you rank against all Claudometer users
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

      {/* Note about token counts */}
      <div className="mb-6 px-3 py-2 bg-zinc-900/50 border border-zinc-800 rounded-lg flex items-start gap-2">
        <svg className="w-4 h-4 text-zinc-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" strokeWidth="2" />
          <path strokeWidth="2" d="M12 16v-4M12 8h.01" />
        </svg>
        <p className="text-xs text-zinc-500">
          Token counts only include input/output tokens, not cache read/creation tokens.
        </p>
      </div>

      {/* Empty state */}
      {allEmpty && !isLoading ? (
        <div className="bg-zinc-900 rounded-lg p-12 text-center">
          <div className="text-5xl mb-4">🌍</div>
          <h3 className="text-xl font-semibold text-white mb-2">No global data yet</h3>
          <p className="text-zinc-400 mb-6 max-w-md mx-auto">
            Start syncing your metrics to appear on the global leaderboard.
          </p>
          <div className="bg-zinc-800 px-4 py-3 rounded-lg inline-block">
            <code className="text-sm text-green-400 font-mono">
              claudometer collect
            </code>
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
