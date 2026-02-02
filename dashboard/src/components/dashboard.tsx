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

interface SourceMetrics {
  claude_sessions: number;
  claude_messages: number;
  claude_tokens: number;
  claude_tool_calls: number;
}

interface MetricsBySource {
  sources: Record<string, SourceMetrics>;
  totals: SourceMetrics;
}

type Period = "today" | "week" | "month" | "all";

const periodLabels: Record<Period, string> = {
  today: "Today",
  week: "Last 7 Days",
  month: "Last 30 Days",
  all: "All Time",
};

// Friendly names for sources
const sourceLabels: Record<string, string> = {
  claude_code: "First-party",
  openclaw: "Third-party",
};

function getSourceLabel(source: string): string {
  return sourceLabels[source] || source;
}

export function Dashboard() {
  const { getToken } = useAuth();
  const { user } = useUser();
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [metricsBySource, setMetricsBySource] = useState<MetricsBySource | null>(null);
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

        // Fetch both regular metrics and by-source breakdown
        const [metricsRes, bySourceRes] = await Promise.all([
          fetch(
            `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/api/metrics/me?period=${period}`,
            { headers: { Authorization: `Bearer ${token}` } }
          ),
          fetch(
            `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/api/metrics/by-source?period=${period}`,
            { headers: { Authorization: `Bearer ${token}` } }
          ),
        ]);

        if (metricsRes.ok) {
          const data = await metricsRes.json();
          setMetrics(data.metrics);
          setLastSynced(data.lastSynced);
          setStatsCacheUpdatedAt(data.statsCacheUpdatedAt);
        }

        if (bySourceRes.ok) {
          const data = await bySourceRes.json();
          setMetricsBySource(data);
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

  // Get first-party and third-party metrics
  const firstParty = metricsBySource?.sources?.claude_code || {
    claude_sessions: 0,
    claude_messages: 0,
    claude_tokens: 0,
    claude_tool_calls: 0,
  };

  // Aggregate all non-claude_code sources as third-party
  const thirdPartySources = Object.entries(metricsBySource?.sources || {}).filter(
    ([source]) => source !== "claude_code"
  );
  const thirdParty = thirdPartySources.reduce(
    (acc, [, metrics]) => ({
      claude_sessions: acc.claude_sessions + (metrics.claude_sessions || 0),
      claude_messages: acc.claude_messages + (metrics.claude_messages || 0),
      claude_tokens: acc.claude_tokens + (metrics.claude_tokens || 0),
      claude_tool_calls: acc.claude_tool_calls + (metrics.claude_tool_calls || 0),
    }),
    { claude_sessions: 0, claude_messages: 0, claude_tokens: 0, claude_tool_calls: 0 }
  );

  const hasThirdParty = thirdParty.claude_tokens > 0 || thirdParty.claude_messages > 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Welcome message and period selector */}
      <div className="flex items-center justify-between mb-4">
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

      {/* Note about Claude stats caching */}
      <div className="mb-6 px-3 py-2 bg-zinc-900/50 border border-zinc-800 rounded-lg flex items-start gap-2">
        <svg className="w-4 h-4 text-zinc-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" strokeWidth="2" />
          <path strokeWidth="2" d="M12 16v-4M12 8h.01" />
        </svg>
        <p className="text-xs text-zinc-500">
          Claude updates its usage stats on its own schedule — metrics may sometimes take a day or more to appear. Token counts only include input/output tokens, not cache read/creation tokens.
        </p>
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
          {/* Claude Tokens Card with First-party / Third-party breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* First-party Tokens (Claude Code) */}
            <div className="rounded-lg border p-6 bg-purple-500/10 border-purple-500/20">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-sm font-medium text-zinc-400">First-party Tokens</h3>
                <span className="text-xs px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300">Claude Code</span>
              </div>
              <p className="text-3xl font-bold mt-2 text-white">
                {Number(firstParty.claude_tokens || 0).toLocaleString()}
              </p>
              <p className="text-sm mt-1 text-purple-400">
                {Number(firstParty.claude_messages || 0).toLocaleString()} messages
              </p>
            </div>

            {/* Third-party Tokens (External tools) */}
            <div className="rounded-lg border p-6 bg-cyan-500/10 border-cyan-500/20">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-sm font-medium text-zinc-400">Third-party Tokens</h3>
                <span className="text-xs px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300">External Tools</span>
              </div>
              <p className="text-3xl font-bold mt-2 text-white">
                {Number(thirdParty.claude_tokens || 0).toLocaleString()}
              </p>
              <div className="text-sm mt-1 text-cyan-400">
                {hasThirdParty ? (
                  <span>{Number(thirdParty.claude_messages || 0).toLocaleString()} messages</span>
                ) : (
                  <span className="text-zinc-500">No external tools connected</span>
                )}
              </div>
              {thirdPartySources.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {thirdPartySources.map(([source, sourceMetrics]) => (
                    <span
                      key={source}
                      className="text-xs px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400"
                      title={`${Number(sourceMetrics.claude_tokens || 0).toLocaleString()} tokens`}
                    >
                      {source}: {Number(sourceMetrics.claude_tokens || 0).toLocaleString()}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Other metrics grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <MetricCard
              title="Total Messages"
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
