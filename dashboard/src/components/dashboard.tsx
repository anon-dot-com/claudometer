"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { MetricCard } from "./metric-card";
import { ActivityChart } from "./activity-chart";
import { LastUpdated } from "./last-updated";

interface Metrics {
  claude_sessions: number;
  claude_messages: number;
  claude_input_tokens: number;
  claude_output_tokens: number;
  claude_tool_calls: number;
  git_commits: number;
  git_lines_added: number;
  git_repos_contributed: number;
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
            {metrics?.reported_at && (
              <LastUpdated timestamp={metrics.reported_at} prefix="Stats last synced" />
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
        <div className="bg-zinc-900 rounded-lg p-8 text-center">
          <h3 className="text-lg font-medium text-white mb-2">No metrics yet</h3>
          <p className="text-zinc-400 mb-4">
            Install the CLI to start tracking your productivity
          </p>
          <code className="bg-zinc-800 px-4 py-2 rounded text-sm text-green-400">
            npm install -g claudometer && claudometer login
          </code>
        </div>
      ) : (
        <>
          {/* Metrics grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <MetricCard
              title="Claude Output Tokens"
              value={Number(metrics.claude_output_tokens || 0).toLocaleString()}
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
