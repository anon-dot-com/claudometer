"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import Link from "next/link";
import { MetricCard } from "./metric-card";
import { ActivityChart } from "./activity-chart";
import { LastUpdated } from "./last-updated";

interface Metrics {
  claude_sessions: number;
  claude_messages: number;
  claude_tokens: number;
  claude_tool_calls: number;
  git_commits: number;
  git_lines_added: number;
  git_lines_deleted: number;
  reported_at: string;
}

type Period = "today" | "week" | "month" | "all";

const periodLabels: Record<Period, string> = {
  today: "Today",
  week: "This Week",
  month: "This Month",
  all: "All Time",
};

export function Dashboard() {
  const { getToken } = useAuth();
  const { user } = useUser();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [statsCacheUpdatedAt, setStatsCacheUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>("week");

  useEffect(() => {
    async function loadMetrics() {
      try {
        setLoading(true);
        const token = await getToken();
        if (!token) return;

        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/api/metrics/me?period=${period}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (res.ok) {
          const data = await res.json();
          setMetrics(data.metrics);
          setLastSynced(data.lastSynced);
          setStatsCacheUpdatedAt(data.statsCacheUpdatedAt);
        }
      } catch (err) {
        setError("Failed to load metrics");
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    loadMetrics();
  }, [getToken, period]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Welcome message and period selector */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white">
            Welcome back, {user?.firstName || "there"}
          </h2>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-zinc-400">
              Here&apos;s your engineering productivity overview
            </p>
            {lastSynced && (
              <LastUpdated timestamp={lastSynced} prefix="Last synced" />
            )}
            {statsCacheUpdatedAt && (
              <>
                <span className="text-zinc-600">•</span>
                <LastUpdated timestamp={statsCacheUpdatedAt} prefix="Cache updated" />
              </>
            )}
          </div>
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

      {loading ? (
        <div className="text-zinc-400">Loading metrics...</div>
      ) : error ? (
        <div className="text-red-400">{error}</div>
      ) : !metrics ? (
        <div className="bg-zinc-900 rounded-lg p-12 text-center">
          <div className="text-5xl mb-4">📊</div>
          <h3 className="text-xl font-semibold text-white mb-2">No metrics yet</h3>
          <p className="text-zinc-400 mb-6 max-w-md mx-auto">
            Install the Claudometer CLI to start tracking your Claude Code usage and Git activity.
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
              View setup instructions
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* Metrics grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <MetricCard
              title="Claude Tokens"
              value={Number(metrics.claude_tokens || 0).toLocaleString()}
              subtitle={periodLabels[period]}
              color="purple"
            />
            <MetricCard
              title="Claude Messages"
              value={Number(metrics.claude_messages || 0).toLocaleString()}
              subtitle={`${Number(metrics.claude_sessions || 0).toLocaleString()} sessions`}
              color="blue"
            />
            <MetricCard
              title="Git Commits"
              value={Number(metrics.git_commits || 0).toLocaleString()}
              subtitle={periodLabels[period]}
              color="green"
            />
            <MetricCard
              title="Lines Added"
              value={Number(metrics.git_lines_added || 0).toLocaleString()}
              subtitle={periodLabels[period]}
              color="orange"
            />
          </div>

          {/* Activity Chart - full width */}
          <ActivityChart />
        </>
      )}
    </div>
  );
}
