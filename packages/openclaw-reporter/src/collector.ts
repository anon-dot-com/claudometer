/**
 * Usage Collector for Claudometer
 *
 * Collects usage metrics from OpenClaw's JSONL session transcripts.
 * Reads directly from the OpenClaw agents directory for accurate
 * per-message tracking with timestamps.
 *
 * Path: ~/.openclaw/agents/{agentId}/sessions/{sessionId}.jsonl
 *
 * This approach mirrors how Claude Code's stats-cache.json works,
 * giving us reliable daily aggregation for side-by-side comparison.
 */

import { readdir, readFile, stat } from 'fs/promises';
import { existsSync } from 'fs';
import { homedir } from 'os';
import { join, basename } from 'path';
import * as readline from 'readline';
import { createReadStream } from 'fs';

// Legacy and current OpenClaw paths
const OPENCLAW_PATHS = [
  join(homedir(), '.openclaw', 'agents'),
  join(homedir(), '.clawdbot', 'agents'),
  join(homedir(), '.moltbot', 'agents'),
  join(homedir(), '.moldbot', 'agents'),
];

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

// JSONL message structure from OpenClaw transcripts
interface TranscriptMessage {
  type: 'user' | 'assistant' | 'system' | 'tool_use' | 'tool_result';
  timestamp?: string;
  message?: {
    model?: string;
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
      cache_read_input_tokens?: number;
      cache_creation_input_tokens?: number;
    };
  };
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
    cache_read_tokens: number;
    cache_creation_tokens: number;
    tool_calls: number;
  }>;
}

class Collector {
  /**
   * Collect usage metrics from OpenClaw
   *
   * Primary method: Read JSONL transcripts directly from disk for accurate
   * per-message tracking with timestamps. This is the most reliable approach.
   *
   * Fallback: Use OpenClaw's runtime APIs if available.
   */
  async collect(api: PluginApi): Promise<CollectedMetrics> {
    // Primary: Read JSONL transcripts directly from disk
    try {
      const metrics = await this.collectFromJsonlTranscripts();
      if (metrics.usage.messages > 0 || metrics.daily.length > 0) {
        console.log(`[Claudometer] Collected ${metrics.usage.messages} messages from JSONL transcripts`);
        return metrics;
      }
    } catch (error) {
      console.warn('[Claudometer] Failed to read JSONL transcripts:', error);
    }

    // Fallback: Try OpenClaw's usage API
    if (api.runtime.usage) {
      try {
        const stats = await api.runtime.usage.getStats();
        console.log('[Claudometer] Using OpenClaw runtime API');
        return this.transformStats(stats);
      } catch (error) {
        console.warn('[Claudometer] Failed to get usage stats from API:', error);
      }
    }

    // Fallback: Try session logs API
    if (api.runtime.logs) {
      try {
        const logs = await api.runtime.logs.getSessionLogs();
        console.log('[Claudometer] Using session logs API');
        return this.parseSessionLogs(logs);
      } catch (error) {
        console.warn('[Claudometer] Failed to parse session logs from API:', error);
      }
    }

    console.log('[Claudometer] No metrics sources available');
    return this.emptyMetrics();
  }

  /**
   * Collect metrics by reading JSONL transcripts directly from disk.
   * This is the most reliable method for accurate per-message tracking.
   */
  private async collectFromJsonlTranscripts(): Promise<CollectedMetrics> {
    // Find all JSONL files across OpenClaw paths
    const jsonlFiles: string[] = [];

    for (const basePath of OPENCLAW_PATHS) {
      if (!existsSync(basePath)) continue;

      try {
        const agentDirs = await readdir(basePath);
        for (const agentDir of agentDirs) {
          const sessionsPath = join(basePath, agentDir, 'sessions');
          if (!existsSync(sessionsPath)) continue;

          const files = await readdir(sessionsPath);
          for (const file of files) {
            if (file.endsWith('.jsonl')) {
              jsonlFiles.push(join(sessionsPath, file));
            }
          }
        }
      } catch {
        // Ignore permission errors, etc.
      }
    }

    if (jsonlFiles.length === 0) {
      console.log('[Claudometer] No JSONL transcript files found');
      return this.emptyMetrics();
    }

    console.log(`[Claudometer] Found ${jsonlFiles.length} JSONL transcript files`);

    // Parse all JSONL files and aggregate by date
    const dailyMap = new Map<string, {
      sessions: Set<string>;
      messages: number;
      input_tokens: number;
      output_tokens: number;
      cache_read_tokens: number;
      cache_creation_tokens: number;
      tool_calls: number;
    }>();

    const modelUsage: Record<string, { input: number; output: number }> = {};
    let totalMessages = 0;
    let totalInput = 0;
    let totalOutput = 0;
    let totalCacheRead = 0;
    let totalCacheCreation = 0;
    let totalToolCalls = 0;
    const allSessions = new Set<string>();

    for (const filePath of jsonlFiles) {
      const sessionId = basename(filePath, '.jsonl');
      allSessions.add(sessionId);

      try {
        const messages = await this.parseJsonlFile(filePath);

        for (const msg of messages) {
          if (!msg.timestamp || !msg.message?.usage) continue;

          const date = msg.timestamp.split('T')[0];
          const usage = msg.message.usage;
          const model = msg.message.model || 'unknown';

          // Get or create daily entry
          let daily = dailyMap.get(date);
          if (!daily) {
            daily = {
              sessions: new Set<string>(),
              messages: 0,
              input_tokens: 0,
              output_tokens: 0,
              cache_read_tokens: 0,
              cache_creation_tokens: 0,
              tool_calls: 0,
            };
            dailyMap.set(date, daily);
          }

          // Add session to this day
          daily.sessions.add(sessionId);

          // Accumulate token counts
          const inputTokens = usage.input_tokens || 0;
          const outputTokens = usage.output_tokens || 0;
          const cacheReadTokens = usage.cache_read_input_tokens || 0;
          const cacheCreationTokens = usage.cache_creation_input_tokens || 0;

          daily.messages++;
          daily.input_tokens += inputTokens;
          daily.output_tokens += outputTokens;
          daily.cache_read_tokens += cacheReadTokens;
          daily.cache_creation_tokens += cacheCreationTokens;

          // Track tool calls (type === 'tool_use' or 'tool_result')
          if (msg.type === 'tool_use' || msg.type === 'tool_result') {
            daily.tool_calls++;
            totalToolCalls++;
          }

          // Update totals
          totalMessages++;
          totalInput += inputTokens;
          totalOutput += outputTokens;
          totalCacheRead += cacheReadTokens;
          totalCacheCreation += cacheCreationTokens;

          // Update model usage
          if (!modelUsage[model]) {
            modelUsage[model] = { input: 0, output: 0 };
          }
          modelUsage[model].input += inputTokens;
          modelUsage[model].output += outputTokens;
        }
      } catch (error) {
        console.warn(`[Claudometer] Failed to parse ${filePath}:`, error);
      }
    }

    // Convert daily map to sorted array (last 30 days)
    const daily = Array.from(dailyMap.entries())
      .map(([date, stats]) => ({
        date,
        sessions: stats.sessions.size,
        messages: stats.messages,
        input_tokens: stats.input_tokens,
        output_tokens: stats.output_tokens,
        cache_read_tokens: stats.cache_read_tokens,
        cache_creation_tokens: stats.cache_creation_tokens,
        tool_calls: stats.tool_calls,
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30);

    return {
      timestamp: new Date().toISOString(),
      usage: {
        sessions: allSessions.size,
        messages: totalMessages,
        input_tokens: totalInput,
        output_tokens: totalOutput,
        cache_read_tokens: totalCacheRead,
        cache_creation_tokens: totalCacheCreation,
        tool_calls: totalToolCalls,
        models: modelUsage,
      },
      daily,
    };
  }

  /**
   * Parse a single JSONL file and extract messages with usage data
   */
  private async parseJsonlFile(filePath: string): Promise<TranscriptMessage[]> {
    const messages: TranscriptMessage[] = [];

    const fileStream = createReadStream(filePath, { encoding: 'utf-8' });
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    for await (const line of rl) {
      if (!line.trim()) continue;

      try {
        const msg = JSON.parse(line) as TranscriptMessage;
        // Only include messages with usage data (assistant responses)
        if (msg.type === 'assistant' && msg.message?.usage) {
          messages.push(msg);
        }
        // Also track tool use messages
        if (msg.type === 'tool_use' || msg.type === 'tool_result') {
          messages.push(msg);
        }
      } catch {
        // Skip malformed lines
      }
    }

    return messages;
  }

  /**
   * Transform OpenClaw usage stats to Claudometer format (fallback)
   */
  private transformStats(stats: UsageStats): CollectedMetrics {
    return {
      timestamp: new Date().toISOString(),
      usage: {
        sessions: stats.sessionCount || 0,
        messages: stats.messageCount || 0,
        input_tokens: stats.totalInputTokens || 0,
        output_tokens: stats.totalOutputTokens || 0,
        cache_read_tokens: 0,
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
        cache_read_tokens: 0,
        cache_creation_tokens: 0,
        tool_calls: 0,
      })),
    };
  }

  /**
   * Parse session logs to extract usage metrics (fallback)
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
      const date = log.timestamp.split('T')[0];

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

      if (log.model) {
        if (!modelUsage[log.model]) {
          modelUsage[log.model] = { input: 0, output: 0 };
        }
        modelUsage[log.model].input += log.inputTokens || 0;
        modelUsage[log.model].output += log.outputTokens || 0;
      }

      totalInput += log.inputTokens || 0;
      totalOutput += log.outputTokens || 0;
      totalMessages++;
    }

    const daily = Array.from(dailyMap.entries()).map(([date, stats]) => ({
      date,
      sessions: 1,
      messages: stats.messages,
      input_tokens: stats.input_tokens,
      output_tokens: stats.output_tokens,
      cache_read_tokens: 0,
      cache_creation_tokens: 0,
      tool_calls: 0,
    }));

    return {
      timestamp: new Date().toISOString(),
      usage: {
        sessions: dailyMap.size,
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
