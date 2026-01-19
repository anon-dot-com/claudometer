"use client";

import { useMemo } from "react";

interface LastUpdatedProps {
  timestamp: string | null | undefined;
  prefix?: string;
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

export function LastUpdated({ timestamp, prefix = "Last synced" }: LastUpdatedProps) {
  const formattedTime = useMemo(() => {
    if (!timestamp) return null;
    return formatRelativeTime(timestamp);
  }, [timestamp]);

  if (!formattedTime) {
    return null;
  }

  return (
    <span className="text-xs text-zinc-500">
      {prefix} {formattedTime}
    </span>
  );
}
