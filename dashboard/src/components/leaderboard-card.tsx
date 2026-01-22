"use client";

import { RankBadge, getFunTitle } from "./rank-badge";
import { LastUpdated } from "./last-updated";

interface LeaderboardEntry {
  id: string;
  name: string;
  email: string;
  value: number;
  reported_at?: string;
}

interface LeaderboardCardProps {
  title: string;
  metric: string;
  entries: LeaderboardEntry[];
  loading?: boolean;
}

// Map metric to display unit
const metricUnits: Record<string, string> = {
  claude_tokens: "tokens",
  claude_messages: "messages",
  git_commits: "commits",
  git_lines_added: "lines",
};

// Format large numbers
function formatValue(value: number): string {
  if (value >= 1000000000) {
    return `${(value / 1000000000).toFixed(1)}B`;
  } else if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  } else if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toLocaleString();
}

export function LeaderboardCard({ title, metric, entries, loading }: LeaderboardCardProps) {
  const maxValue = entries.length > 0 ? entries[0].value : 0;
  const unit = metricUnits[metric] || "units";
  const funTitle = getFunTitle(metric);

  return (
    <div className="bg-zinc-900 rounded-lg p-6">
      {/* Header with title and fun badge */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        {entries.length > 0 && funTitle && (
          <span className="text-xs text-purple-400 bg-purple-500/10 px-2 py-1 rounded-full">
            {funTitle}
          </span>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col items-center py-8">
          <div className="text-zinc-400">Loading...</div>
        </div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center py-8">
          <div className="text-zinc-500 text-sm">No data yet</div>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.slice(0, 10).map((entry, index) => {
            const percentage = maxValue > 0 ? (entry.value / maxValue) * 100 : 0;

            return (
              <div key={entry.id} className="space-y-1.5">
                {/* User info row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <RankBadge rank={index + 1} metric={index === 0 ? metric : undefined} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {entry.name || entry.email?.split("@")[0]}
                      </p>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className="text-sm font-medium text-zinc-300">
                      {formatValue(entry.value)}
                    </span>
                    <span className="text-xs text-zinc-500 ml-1">{unit}</span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      index === 0
                        ? "bg-gradient-to-r from-purple-600 to-purple-400"
                        : index === 1
                        ? "bg-zinc-500"
                        : index === 2
                        ? "bg-orange-600/70"
                        : "bg-zinc-600"
                    }`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>

                {/* Last updated (subtle) */}
                {entry.reported_at && (
                  <div className="pl-10">
                    <LastUpdated timestamp={entry.reported_at} prefix="" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
