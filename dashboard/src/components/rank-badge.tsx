"use client";

interface RankBadgeProps {
  rank: number;
  metric?: string;
}

// Fun titles for #1 in each category
const funTitles: Record<string, string> = {
  claude_output_tokens: "Token Titan",
  claude_messages: "Conversation Commander",
  git_commits: "Commit Champion",
  git_lines_added: "Line Legend",
};

export function RankBadge({ rank, metric }: RankBadgeProps) {
  // Position badge styles
  const getBadgeStyle = () => {
    switch (rank) {
      case 1:
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      case 2:
        return "bg-zinc-400/20 text-zinc-300 border-zinc-400/30";
      case 3:
        return "bg-orange-500/20 text-orange-400 border-orange-500/30";
      default:
        return "bg-zinc-800 text-zinc-500 border-zinc-700";
    }
  };

  // Get ordinal suffix
  const getOrdinal = (n: number) => {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  return (
    <div className="flex items-center gap-2">
      <span
        className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border ${getBadgeStyle()}`}
      >
        {rank}
      </span>
      {rank === 1 && metric && funTitles[metric] && (
        <span className="text-xs font-medium text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full">
          {funTitles[metric]}
        </span>
      )}
    </div>
  );
}

// Export fun titles for use in other components
export function getFunTitle(metric: string): string | undefined {
  return funTitles[metric];
}
