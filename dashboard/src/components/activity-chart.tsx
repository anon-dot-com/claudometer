"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface ActivityData {
  date: string;
  claude_messages: number;
  claude_tokens: number;
  git_commits: number;
  git_lines_added: number;
}

type MetricType = "tokens" | "messages" | "commits" | "lines";

const metricConfig: Record<MetricType, { label: string; dataKey: string; color: string; name: string }> = {
  tokens: { label: "Tokens", dataKey: "claude_tokens", color: "#a855f7", name: "Tokens" },
  messages: { label: "Messages", dataKey: "claude_messages", color: "#3b82f6", name: "Messages" },
  commits: { label: "Commits", dataKey: "git_commits", color: "#22c55e", name: "Commits" },
  lines: { label: "Lines", dataKey: "git_lines_added", color: "#f97316", name: "Lines Added" },
};

export function ActivityChart() {
  const { getToken } = useAuth();
  const [data, setData] = useState<ActivityData[]>([]);
  const [loading, setLoading] = useState(true);
  const [metric, setMetric] = useState<MetricType>("tokens");

  useEffect(() => {
    async function loadActivity() {
      try {
        const token = await getToken();
        if (!token) return;

        const res = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/api/metrics/my-activity?days=30`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (res.ok) {
          const result = await res.json();
          setData(result.activity || []);
        }
      } catch (err) {
        console.error("Failed to load activity:", err);
      } finally {
        setLoading(false);
      }
    }

    loadActivity();
  }, [getToken]);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <div className="bg-zinc-900 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Activity (Last 30 Days)</h3>
        <div className="flex gap-1 flex-wrap">
          {(Object.keys(metricConfig) as MetricType[]).map((key) => {
            const config = metricConfig[key];
            const isActive = metric === key;
            return (
              <button
                key={key}
                onClick={() => setMetric(key)}
                className={`px-3 py-1 text-sm rounded transition-colors ${
                  isActive
                    ? "text-white"
                    : "bg-zinc-800 text-zinc-400 hover:text-zinc-300"
                }`}
                style={isActive ? { backgroundColor: `${config.color}33`, color: config.color } : {}}
              >
                {config.label}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div className="h-64 flex items-center justify-center text-zinc-400">
          Loading...
        </div>
      ) : data.length === 0 ? (
        <div className="h-64 flex items-center justify-center text-zinc-400">
          No activity data yet
        </div>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                {(Object.keys(metricConfig) as MetricType[]).map((key) => (
                  <linearGradient key={key} id={`color-${key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={metricConfig[key].color} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={metricConfig[key].color} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                stroke="#71717a"
                fontSize={12}
              />
              <YAxis stroke="#71717a" fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#18181b",
                  border: "1px solid #27272a",
                  borderRadius: "8px",
                }}
                labelFormatter={formatDate}
              />
              <Area
                type="monotone"
                dataKey={metricConfig[metric].dataKey}
                stroke={metricConfig[metric].color}
                fillOpacity={1}
                fill={`url(#color-${metric})`}
                name={metricConfig[metric].name}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
