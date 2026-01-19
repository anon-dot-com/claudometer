import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const STATS_CACHE_PATH = join(homedir(), '.claude', 'stats-cache.json');

export async function collectClaudeMetrics() {
  if (!existsSync(STATS_CACHE_PATH)) {
    return {
      available: false,
      error: 'Claude stats file not found. Is Claude Code installed?',
    };
  }

  try {
    const raw = await readFile(STATS_CACHE_PATH, 'utf-8');
    const stats = JSON.parse(raw);

    // Calculate totals from modelUsage
    const totals = calculateTotals(stats.modelUsage || {});

    // Extract relevant metrics
    const metrics = {
      available: true,
      collectedAt: new Date().toISOString(),

      // Totals
      totals: {
        sessions: stats.totalSessions || 0,
        messages: stats.totalMessages || 0,
        inputTokens: totals.inputTokens,
        outputTokens: totals.outputTokens,
        cacheReadTokens: totals.cacheReadTokens,
        cacheCreationTokens: totals.cacheCreationTokens,
        toolCalls: calculateTotalToolCalls(stats.dailyActivity || []),
      },

      // Per-model breakdown
      byModel: stats.modelUsage || {},

      // Daily stats (last 30 days)
      daily: extractDailyStats(stats),

      // Usage patterns
      patterns: {
        hourlyDistribution: stats.hourCounts || {},
      },

      // Metadata
      firstSessionDate: stats.firstSessionDate,
      lastComputedDate: stats.lastComputedDate,
    };

    return metrics;
  } catch (error) {
    return {
      available: false,
      error: `Failed to read Claude stats: ${error.message}`,
    };
  }
}

function calculateTotals(modelUsage) {
  let inputTokens = 0;
  let outputTokens = 0;
  let cacheReadTokens = 0;
  let cacheCreationTokens = 0;

  for (const model of Object.values(modelUsage)) {
    inputTokens += model.inputTokens || 0;
    outputTokens += model.outputTokens || 0;
    cacheReadTokens += model.cacheReadInputTokens || 0;
    cacheCreationTokens += model.cacheCreationInputTokens || 0;
  }

  return { inputTokens, outputTokens, cacheReadTokens, cacheCreationTokens };
}

function calculateTotalToolCalls(dailyActivity) {
  return dailyActivity.reduce((sum, day) => sum + (day.toolCallCount || 0), 0);
}

function extractDailyStats(stats) {
  const daily = [];

  // Use dailyActivity for messages/sessions/tools
  const activityByDate = {};
  for (const day of stats.dailyActivity || []) {
    activityByDate[day.date] = day;
  }

  // Use dailyModelTokens for token counts
  const tokensByDate = {};
  for (const day of stats.dailyModelTokens || []) {
    let totalTokens = 0;
    for (const tokens of Object.values(day.tokensByModel || {})) {
      totalTokens += tokens;
    }
    tokensByDate[day.date] = { totalTokens, byModel: day.tokensByModel };
  }

  // Merge all dates
  const allDates = new Set([
    ...Object.keys(activityByDate),
    ...Object.keys(tokensByDate),
  ]);

  for (const date of Array.from(allDates).sort().slice(-30)) {
    const activity = activityByDate[date] || {};
    const tokens = tokensByDate[date] || {};

    daily.push({
      date,
      messages: activity.messageCount || 0,
      sessions: activity.sessionCount || 0,
      toolCalls: activity.toolCallCount || 0,
      tokens: tokens.totalTokens || 0,
      tokensByModel: tokens.byModel || {},
    });
  }

  return daily;
}

// Get the raw stats file for debugging
export async function getRawClaudeStats() {
  if (!existsSync(STATS_CACHE_PATH)) {
    return null;
  }
  const raw = await readFile(STATS_CACHE_PATH, 'utf-8');
  return JSON.parse(raw);
}
