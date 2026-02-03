import { readdir } from 'fs/promises';
import { existsSync, createReadStream } from 'fs';
import { homedir } from 'os';
import { join, basename } from 'path';
import * as readline from 'readline';

// Legacy and current OpenClaw paths
const OPENCLAW_PATHS = [
  join(homedir(), '.openclaw', 'agents'),
  join(homedir(), '.clawdbot', 'agents'),
  join(homedir(), '.moltbot', 'agents'),
  join(homedir(), '.moldbot', 'agents'),
];

export async function collectOpenClawMetrics() {
  // Find all JSONL files across OpenClaw paths
  const jsonlFiles = [];

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
    return {
      available: false,
      error: 'No OpenClaw session files found. Is OpenClaw installed?',
    };
  }

  try {
    // Parse all JSONL files and aggregate by date
    const dailyMap = new Map();
    const modelUsage = {};
    let totalMessages = 0;
    let totalInput = 0;
    let totalOutput = 0;
    let totalCacheRead = 0;
    let totalCacheCreation = 0;
    let totalToolCalls = 0;
    const allSessions = new Set();

    for (const filePath of jsonlFiles) {
      const sessionId = basename(filePath, '.jsonl');
      allSessions.add(sessionId);

      try {
        const messages = await parseJsonlFile(filePath);

        for (const msg of messages) {
          if (!msg.timestamp || !msg.message?.usage) continue;

          // Convert UTC timestamp to local date
          const date = new Date(msg.timestamp).toLocaleDateString('en-CA');
          const usage = msg.message.usage;
          const model = msg.message.model || 'unknown';

          // Get or create daily entry
          let daily = dailyMap.get(date);
          if (!daily) {
            daily = {
              sessions: new Set(),
              messages: 0,
              inputTokens: 0,
              outputTokens: 0,
              cacheReadTokens: 0,
              cacheCreationTokens: 0,
              toolCalls: 0,
            };
            dailyMap.set(date, daily);
          }

          // Add session to this day
          daily.sessions.add(sessionId);

          // Accumulate token counts (OpenClaw uses 'input'/'output', not 'input_tokens'/'output_tokens')
          const inputTokens = usage.input || usage.input_tokens || 0;
          const outputTokens = usage.output || usage.output_tokens || 0;
          const cacheReadTokens = usage.cacheRead || usage.cache_read_input_tokens || 0;
          const cacheCreationTokens = usage.cacheWrite || usage.cache_creation_input_tokens || 0;

          daily.messages++;
          daily.inputTokens += inputTokens;
          daily.outputTokens += outputTokens;
          daily.cacheReadTokens += cacheReadTokens;
          daily.cacheCreationTokens += cacheCreationTokens;

          // Track tool calls (count toolCall content blocks in assistant messages)
          if (msg.message?.content && Array.isArray(msg.message.content)) {
            for (const block of msg.message.content) {
              if (block.type === 'toolCall' || block.type === 'tool_use') {
                daily.toolCalls++;
                totalToolCalls++;
              }
            }
          }

          // Update totals
          totalMessages++;
          totalInput += inputTokens;
          totalOutput += outputTokens;
          totalCacheRead += cacheReadTokens;
          totalCacheCreation += cacheCreationTokens;

          // Update model usage
          if (!modelUsage[model]) {
            modelUsage[model] = { inputTokens: 0, outputTokens: 0 };
          }
          modelUsage[model].inputTokens += inputTokens;
          modelUsage[model].outputTokens += outputTokens;
        }
      } catch (error) {
        console.warn(`Failed to parse ${filePath}:`, error.message);
      }
    }

    // Convert daily map to sorted array (last 30 days)
    const daily = Array.from(dailyMap.entries())
      .map(([date, stats]) => ({
        date,
        sessions: stats.sessions.size,
        messages: stats.messages,
        tokens: stats.inputTokens + stats.outputTokens,
        toolCalls: stats.toolCalls,
        tokensByModel: {}, // Could aggregate per day if needed
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30);

    return {
      available: true,
      collectedAt: new Date().toISOString(),
      source: 'openclaw',

      totals: {
        sessions: allSessions.size,
        messages: totalMessages,
        inputTokens: totalInput,
        outputTokens: totalOutput,
        cacheReadTokens: totalCacheRead,
        cacheCreationTokens: totalCacheCreation,
        toolCalls: totalToolCalls,
      },

      byModel: modelUsage,
      daily,
    };
  } catch (error) {
    return {
      available: false,
      error: `Failed to read OpenClaw stats: ${error.message}`,
    };
  }
}

async function parseJsonlFile(filePath) {
  const messages = [];

  const fileStream = createReadStream(filePath, { encoding: 'utf-8' });
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (!line.trim()) continue;

    try {
      const msg = JSON.parse(line);
      // OpenClaw format: type='message' with message.role='assistant' and message.usage
      if (msg.type === 'message' && msg.message?.role === 'assistant' && msg.message?.usage) {
        messages.push(msg);
      }
      // Also track tool results
      if (msg.type === 'message' && msg.message?.role === 'toolResult') {
        messages.push({ ...msg, isToolResult: true });
      }
    } catch {
      // Skip malformed lines
    }
  }

  return messages;
}

// Check if OpenClaw is available
export function isOpenClawAvailable() {
  for (const basePath of OPENCLAW_PATHS) {
    if (existsSync(basePath)) {
      return true;
    }
  }
  return false;
}
