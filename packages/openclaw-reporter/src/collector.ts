/**
 * Usage Collector for Claudometer
 *
 * Collects usage metrics from OpenClaw's internal tracking.
 */

interface PluginApi {
  runtime: {
    usage?: {
      getStats(): Promise<UsageStats>;
    };
    logs?: {
      getSessionLogs(): Promise<SessionLog[]>;
    };
  };
}

interface UsageStats {
  totalInputTokens: number;
  totalOutputTokens: number;
  messageCount: number;
  sessionCount: number;
  toolCalls: number;
  byModel: Record<string, { input: number; output: number }>;
  daily: DailyUsage[];
}

interface DailyUsage {
  date: string;
  inputTokens: number;
  outputTokens: number;
  messages: number;
  sessions: number;
}

interface SessionLog {
  timestamp: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

export interface CollectedMetrics {
  timestamp: string;
  usage: {
    sessions: number;
    messages: number;
    input_tokens: number;
    output_tokens: number;
    cache_read_tokens: number;
    cache_creation_tokens: number;
    tool_calls: number;
    models: Record<string, { input: number; output: number }>;
  };
  daily: Array<{
    date: string;
    sessions: number;
    messages: number;
    input_tokens: number;
    output_tokens: number;
    tool_calls: number;
  }>;
}

class Collector {
  /**
   * Collect usage metrics from OpenClaw
   */
  async collect(api: PluginApi): Promise<CollectedMetrics> {
    // Try to get stats from OpenClaw's usage API
    if (api.runtime.usage) {
      try {
        const stats = await api.runtime.usage.getStats();
        return this.transformStats(stats);
      } catch (error) {
        console.warn('[Claudometer] Failed to get usage stats:', error);
      }
    }

    // Fallback: try to parse session logs
    if (api.runtime.logs) {
      try {
        const logs = await api.runtime.logs.getSessionLogs();
        return this.parseSessionLogs(logs);
      } catch (error) {
        console.warn('[Claudometer] Failed to parse session logs:', error);
      }
    }

    // Return empty metrics if nothing available
    return this.emptyMetrics();
  }

  /**
   * Transform OpenClaw usage stats to Claudometer format
   */
  private transformStats(stats: UsageStats): CollectedMetrics {
    return {
      timestamp: new Date().toISOString(),
      usage: {
        sessions: stats.sessionCount || 0,
        messages: stats.messageCount || 0,
        input_tokens: stats.totalInputTokens || 0,
        output_tokens: stats.totalOutputTokens || 0,
        cache_read_tokens: 0, // OpenClaw may not track this separately
        cache_creation_tokens: 0,
        tool_calls: stats.toolCalls || 0,
        models: stats.byModel || {},
      },
      daily: (stats.daily || []).map(day => ({
        date: day.date,
        sessions: day.sessions || 0,
        messages: day.messages || 0,
        input_tokens: day.inputTokens || 0,
        output_tokens: day.outputTokens || 0,
        tool_calls: 0,
      })),
    };
  }

  /**
   * Parse session logs to extract usage metrics
   */
  private parseSessionLogs(logs: SessionLog[]): CollectedMetrics {
    const dailyMap = new Map<string, {
      sessions: number;
      messages: number;
      input_tokens: number;
      output_tokens: number;
    }>();

    const modelUsage: Record<string, { input: number; output: number }> = {};
    let totalInput = 0;
    let totalOutput = 0;
    let totalMessages = 0;

    for (const log of logs) {
      // Parse date from timestamp
      const date = log.timestamp.split('T')[0];

      // Update daily stats
      const existing = dailyMap.get(date) || {
        sessions: 0,
        messages: 0,
        input_tokens: 0,
        output_tokens: 0,
      };

      existing.messages++;
      existing.input_tokens += log.inputTokens || 0;
      existing.output_tokens += log.outputTokens || 0;
      dailyMap.set(date, existing);

      // Update model usage
      if (log.model) {
        if (!modelUsage[log.model]) {
          modelUsage[log.model] = { input: 0, output: 0 };
        }
        modelUsage[log.model].input += log.inputTokens || 0;
        modelUsage[log.model].output += log.outputTokens || 0;
      }

      // Update totals
      totalInput += log.inputTokens || 0;
      totalOutput += log.outputTokens || 0;
      totalMessages++;
    }

    // Convert daily map to array
    const daily = Array.from(dailyMap.entries()).map(([date, stats]) => ({
      date,
      sessions: 1, // Estimate 1 session per day
      messages: stats.messages,
      input_tokens: stats.input_tokens,
      output_tokens: stats.output_tokens,
      tool_calls: 0,
    }));

    return {
      timestamp: new Date().toISOString(),
      usage: {
        sessions: dailyMap.size, // Estimate sessions as unique days
        messages: totalMessages,
        input_tokens: totalInput,
        output_tokens: totalOutput,
        cache_read_tokens: 0,
        cache_creation_tokens: 0,
        tool_calls: 0,
        models: modelUsage,
      },
      daily,
    };
  }

  /**
   * Return empty metrics
   */
  private emptyMetrics(): CollectedMetrics {
    return {
      timestamp: new Date().toISOString(),
      usage: {
        sessions: 0,
        messages: 0,
        input_tokens: 0,
        output_tokens: 0,
        cache_read_tokens: 0,
        cache_creation_tokens: 0,
        tool_calls: 0,
        models: {},
      },
      daily: [],
    };
  }
}

export const collector = new Collector();
