"use client";

import { useMemo, useState } from "react";

interface LastUpdatedProps {
  timestamp: string | null | undefined;
  prefix?: string;
  tooltip?: string;
}

function formatRelativeTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) {
    return "just now";
  } else if (diffMins < 60) {
    return `${diffMins} minute${diffMins === 1 ? "" : "s"} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  } else if (diffDays < 7) {
    return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  } else {
    return date.toLocaleDateString();
  }
}

export function LastUpdated({ timestamp, prefix = "Last synced", tooltip }: LastUpdatedProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const formattedTime = useMemo(() => {
    if (!timestamp) return null;
    return formatRelativeTime(timestamp);
  }, [timestamp]);

  if (!formattedTime) {
    return null;
  }

  return (
    <span className="text-xs text-zinc-500 inline-flex items-center gap-1.5">
      {prefix} {formattedTime}
      {tooltip && (
        <span className="relative inline-block">
          <button
            type="button"
            className="text-zinc-500 hover:text-zinc-400 transition-colors"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            onClick={() => setShowTooltip(!showTooltip)}
            aria-label="More info"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" strokeWidth="2" />
              <path strokeWidth="2" d="M12 16v-4M12 8h.01" />
            </svg>
          </button>
          {showTooltip && (
            <span className="absolute z-50 left-1/2 -translate-x-1/2 bottom-full mb-2 w-64 p-2 text-xs text-zinc-300 bg-zinc-800 border border-zinc-700 rounded-lg shadow-lg">
              {tooltip}
              <span className="absolute left-1/2 -translate-x-1/2 top-full w-2 h-2 bg-zinc-800 border-r border-b border-zinc-700 rotate-45 -mt-1" />
            </span>
          )}
        </span>
      )}
    </span>
  );
}
