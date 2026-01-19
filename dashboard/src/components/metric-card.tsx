"use client";

interface MetricCardProps {
  title: string;
  value: string;
  subtitle: string;
  color: "purple" | "blue" | "green" | "orange";
}

const colorClasses = {
  purple: "bg-purple-500/10 border-purple-500/20 text-purple-400",
  blue: "bg-blue-500/10 border-blue-500/20 text-blue-400",
  green: "bg-green-500/10 border-green-500/20 text-green-400",
  orange: "bg-orange-500/10 border-orange-500/20 text-orange-400",
};

export function MetricCard({ title, value, subtitle, color }: MetricCardProps) {
  return (
    <div className={`rounded-lg border p-6 ${colorClasses[color]}`}>
      <h3 className="text-sm font-medium text-zinc-400">{title}</h3>
      <p className="text-3xl font-bold mt-2 text-white">{value}</p>
      <p className="text-sm mt-1">{subtitle}</p>
    </div>
  );
}
