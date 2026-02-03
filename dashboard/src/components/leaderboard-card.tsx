"use client";

import { RankBadge, getFunTitle } from "./rank-badge";
import { LastUpdated } from "./last-updated";

interface LeaderboardEntry {
  id: string;
  name: string;
  email: string;
  value: number;
  first_party?: number;
  third_party?: number;
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
            const firstParty = Number(entry.first_party) || 0;
            const thirdParty = Number(entry.third_party) || 0;
            const hasMultipleSources = firstParty > 0 && thirdParty > 0;
            const firstPartyPct = entry.value > 0 ? (firstParty / entry.value) * percentage : 0;
            const thirdPartyPct = entry.value > 0 ? (thirdParty / entry.value) * percentage : 0;

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

                {/* Stacked progress bar showing first-party vs third-party */}
                {/* Purple = Claude Code, Teal = 3rd party (consistent colors for all ranks) */}
                <div className="h-2 bg-zinc-800 rounded-full overflow-hidden flex">
                  {hasMultipleSources ? (
                    <>
                      {/* First-party (Claude Code) - always purple */}
                      <div
                        className="h-full bg-purple-500 transition-all duration-500"
                        style={{ width: `${firstPartyPct}%` }}
                      />
                      {/* Third-party (OpenClaw, etc.) - always teal */}
                      <div
                        className="h-full bg-teal-500 transition-all duration-500"
                        style={{ width: `${thirdPartyPct}%` }}
                      />
                    </>
                  ) : (
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        thirdParty > 0 ? "bg-teal-500" : "bg-purple-500"
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                  )}
                </div>

                {/* Source breakdown (only show if both sources have data) */}
                {hasMultipleSources && (
                  <div className="flex items-center gap-3 pl-10 text-xs">
                    <span className="text-zinc-400">
                      <span className="inline-block w-2 h-2 rounded-full bg-purple-500 mr-1" />
                      Claude Code: {formatValue(firstParty)}
                    </span>
                    <span className="text-zinc-400">
                      <span className="inline-block w-2 h-2 rounded-full bg-teal-500 mr-1" />
                      3rd party: {formatValue(thirdParty)}
                    </span>
                  </div>
                )}

                {/* Last updated (subtle) */}
                {entry.reported_at && !hasMultipleSources && (
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
