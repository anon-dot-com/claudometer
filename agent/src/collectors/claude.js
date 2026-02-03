import { readdir } from 'fs/promises';
import { existsSync, createReadStream } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import * as readline from 'readline';

// Claude Code stores session transcripts in ~/.claude/projects/{project-path}/*.jsonl
const CLAUDE_PROJECTS_PATH = join(homedir(), '.claude', 'projects');

export async function collectClaudeMetrics() {
  if (!existsSync(CLAUDE_PROJECTS_PATH)) {
    return {
      available: false,
      error: 'Claude Code projects directory not found. Is Claude Code installed?',
    };
  }

  try {
    // Find all JSONL files across all projects
    const jsonlFiles = [];
    const projectDirs = await readdir(CLAUDE_PROJECTS_PATH);

    for (const projectDir of projectDirs) {
      const projectPath = join(CLAUDE_PROJECTS_PATH, projectDir);
      try {
        const files = await readdir(projectPath);
        for (const file of files) {
          if (file.endsWith('.jsonl')) {
            jsonlFiles.push(join(projectPath, file));
          }
        }
      } catch {
        // Ignore permission errors, etc.
      }
    }

    if (jsonlFiles.length === 0) {
      return {
        available: false,
        error: 'No Claude Code session files found.',
      };
    }

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
      // Session ID is the filename without .jsonl
      const sessionId = filePath.split('/').pop().replace('.jsonl', '');
      allSessions.add(sessionId);

      try {
        const messages = await parseJsonlFile(filePath);

        for (const msg of messages) {
          if (!msg.timestamp || !msg.message?.usage) continue;

          const date = msg.timestamp.split('T')[0];
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

          // Accumulate token counts
          const inputTokens = usage.input_tokens || 0;
          const outputTokens = usage.output_tokens || 0;
          const cacheReadTokens = usage.cache_read_input_tokens || 0;
          const cacheCreationTokens = usage.cache_creation_input_tokens || 0;

          daily.messages++;
          daily.inputTokens += inputTokens;
          daily.outputTokens += outputTokens;
          daily.cacheReadTokens += cacheReadTokens;
          daily.cacheCreationTokens += cacheCreationTokens;

          // Track tool calls (count tool_use content blocks in assistant messages)
          if (msg.message?.content && Array.isArray(msg.message.content)) {
            for (const block of msg.message.content) {
              if (block.type === 'tool_use') {
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
        // Skip files we can't parse
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
        tokensByModel: {},
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30);

    return {
      available: true,
      collectedAt: new Date().toISOString(),
      source: 'claude_code',

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
      error: `Failed to read Claude Code stats: ${error.message}`,
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
      // Claude Code format: type='assistant' with message.role='assistant' and message.usage
      if (msg.type === 'assistant' && msg.message?.usage) {
        messages.push(msg);
      }
    } catch {
      // Skip malformed lines
    }
  }

  return messages;
}

// Check if Claude Code is available
export function isClaudeCodeAvailable() {
  return existsSync(CLAUDE_PROJECTS_PATH);
}
