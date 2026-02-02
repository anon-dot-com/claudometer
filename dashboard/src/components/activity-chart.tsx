"use client";

import { useAuth } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface SourceData {
  claude_messages: number;
  claude_tokens: number;
  git_commits: number;
  git_lines_added: number;
}

interface ActivityData {
  date: string;
  first_party: SourceData;
  third_party: SourceData;
  total: SourceData;
}

type MetricType = "tokens" | "messages";

const metricConfig: Record<MetricType, { label: string; key: keyof SourceData }> = {
  tokens: { label: "Tokens", key: "claude_tokens" },
  messages: { label: "Messages", key: "claude_messages" },
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
          `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/api/metrics/my-activity-by-source?days=30`,
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

  // Transform data for the chart
  const chartData = data.map((day) => ({
    date: day.date,
    "First-party": day.first_party[metricConfig[metric].key] || 0,
    "Third-party": day.third_party[metricConfig[metric].key] || 0,
  }));

  // Check if there's any third-party data
  const hasThirdParty = data.some(
    (day) => day.third_party.claude_tokens > 0 || day.third_party.claude_messages > 0
  );

  return (
    <div className="bg-zinc-900 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white">Daily Activity (Last 30 Days)</h3>
          <p className="text-xs text-zinc-500 mt-1">
            First-party = Claude Code • Third-party = External tools
          </p>
        </div>
        <div className="flex gap-1">
          {(Object.keys(metricConfig) as MetricType[]).map((key) => {
            const config = metricConfig[key];
            const isActive = metric === key;
            return (
              <button
                key={key}
                onClick={() => setMetric(key)}
                className={`px-3 py-1 text-sm rounded transition-colors ${
                  isActive
                    ? "bg-purple-600 text-white"
                    : "bg-zinc-800 text-zinc-400 hover:text-zinc-300"
                }`}
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
            <BarChart data={chartData} barCategoryGap="20%">
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
                formatter={(value: number) => [value.toLocaleString(), undefined]}
              />
              <Legend
                wrapperStyle={{ paddingTop: "10px" }}
                formatter={(value) => <span className="text-zinc-300 text-sm">{value}</span>}
              />
              <Bar
                dataKey="First-party"
                stackId="a"
                fill="#a855f7"
                radius={[0, 0, 0, 0]}
              />
              {hasThirdParty && (
                <Bar
                  dataKey="Third-party"
                  stackId="a"
                  fill="#06b6d4"
                  radius={[4, 4, 0, 0]}
                />
              )}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Legend explanation */}
      <div className="mt-4 flex gap-6 text-xs text-zinc-500">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-purple-500"></div>
          <span>First-party (Claude Code)</span>
        </div>
        {hasThirdParty && (
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-cyan-500"></div>
            <span>Third-party (External tools)</span>
          </div>
        )}
      </div>
    </div>
  );
}
