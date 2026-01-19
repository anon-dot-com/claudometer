"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect, useState } from "react";

interface LeaderboardEntry {
  id: string;
  name: string;
  email: string;
  value: number;
}

type Period = "today" | "week" | "month" | "all";

interface LeaderboardProps {
  period?: Period;
}

export function Leaderboard({ period: externalPeriod }: LeaderboardProps) {
  const { getToken } = useAuth();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [metric, setMetric] = useState("claude_output_tokens");
  const [period, setPeriod] = useState<Period>(externalPeriod || "week");

  useEffect(() => {
    if (externalPeriod) {
      setPeriod(externalPeriod);
    }
  }, [externalPeriod]);

  useEffect(() => {
    async function loadLeaderboard() {
      try {
        setLoading(true);
        const token = await getToken();
        if (!token) return;

        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/api/metrics/leaderboard?metric=${metric}&period=${period}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (res.ok) {
          const data = await res.json();
          setEntries(data.leaderboard || []);
        }
      } catch (err) {
        console.error("Failed to load leaderboard:", err);
      } finally {
        setLoading(false);
      }
    }

    loadLeaderboard();
  }, [getToken, metric, period]);

  const metricLabels: Record<string, string> = {
    claude_output_tokens: "Tokens",
    claude_messages: "Messages",
    git_commits: "Commits",
    git_lines_added: "Lines",
  };

  const periodLabels: Record<Period, string> = {
    today: "Today",
    week: "This Week",
    month: "This Month",
    all: "All Time",
  };

  return (
    <div className="bg-zinc-900 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Leaderboard</h3>
        <div className="flex gap-2">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as Period)}
            className="bg-zinc-800 text-sm text-zinc-300 rounded px-2 py-1 border border-zinc-700"
          >
            <option value="today">Today</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="all">All Time</option>
          </select>
          <select
            value={metric}
            onChange={(e) => setMetric(e.target.value)}
            className="bg-zinc-800 text-sm text-zinc-300 rounded px-2 py-1 border border-zinc-700"
          >
            <option value="claude_output_tokens">Tokens</option>
            <option value="claude_messages">Messages</option>
            <option value="git_commits">Commits</option>
            <option value="git_lines_added">Lines Added</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="text-zinc-400">Loading...</div>
      ) : entries.length === 0 ? (
        <div className="text-zinc-400 text-sm">No data yet</div>
      ) : (
        <div className="space-y-3">
          {entries.map((entry, index) => (
            <div
              key={entry.id}
              className="flex items-center justify-between py-2 border-b border-zinc-800 last:border-0"
            >
              <div className="flex items-center gap-3">
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                    index === 0
                      ? "bg-yellow-500/20 text-yellow-400"
                      : index === 1
                      ? "bg-zinc-400/20 text-zinc-300"
                      : index === 2
                      ? "bg-orange-500/20 text-orange-400"
                      : "bg-zinc-800 text-zinc-500"
                  }`}
                >
                  {index + 1}
                </span>
                <div>
                  <p className="text-sm font-medium text-white">
                    {entry.name || entry.email?.split("@")[0]}
                  </p>
                  <p className="text-xs text-zinc-500">{entry.email}</p>
                </div>
              </div>
              <span className="text-sm font-medium text-zinc-300">
                {Number(entry.value || 0).toLocaleString()} {metricLabels[metric]}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
