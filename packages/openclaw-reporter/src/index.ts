/**
 * Claudometer Reporter Plugin for OpenClaw
 *
 * Reports usage metrics to Claudometer for team visibility and leaderboards.
 *
 * Installation:
 *   openclaw plugins install @claudometer/openclaw-reporter
 *
 * Setup:
 *   1. Run `claudometer link --generate` on a machine with Claudometer CLI
 *   2. Run `openclaw claudometer link <CODE>` to connect
 *
 * Usage:
 *   - Metrics are automatically reported every 30 minutes (configurable)
 *   - Use `/claudometer` in chat to see sync status
 *   - Use `openclaw claudometer sync` for manual sync
 */

import { collector } from './collector.js';
import { reporter } from './reporter.js';
import { config, ClaudometerConfig } from './config.js';

// Types for OpenClaw Plugin API
interface PluginApi {
  config: ClaudometerConfig;
  registerService(service: {
    name: string;
    start: () => Promise<void>;
    stop: () => Promise<void>;
  }): void;
  registerCli(cli: {
    name: string;
    description: string;
    handler: (args: string[]) => Promise<{ text: string }>;
  }): void;
  registerCommand(command: {
    name: string;
    description: string;
    handler: (ctx: { channel: string }) => { text: string } | Promise<{ text: string }>;
  }): void;
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

// Plugin state
let reportInterval: NodeJS.Timeout | null = null;
let lastSyncTime: Date | null = null;
let lastSyncStatus: 'success' | 'error' | null = null;
let lastSyncError: string | null = null;
let pluginApi: PluginApi | null = null;

// Export for testing
export { lastSyncTime, lastSyncStatus };

/**
 * Main plugin entry point
 */
export default function register(api: PluginApi) {
  pluginApi = api;

  // Register background service for periodic reporting
  api.registerService({
    name: 'claudometer-reporter',
    start: async () => {
      const cfg = api.config;

      if (!cfg.enabled) {
        console.log('[Claudometer] Plugin disabled');
        return;
      }

      if (!cfg.deviceToken) {
        console.log('[Claudometer] No device token configured. Run: openclaw claudometer link <CODE>');
        return;
      }

      const intervalMs = (cfg.reportIntervalMinutes || 30) * 60 * 1000;

      console.log(`[Claudometer] Starting reporter (interval: ${cfg.reportIntervalMinutes || 30} minutes)`);

      // Initial sync
      await syncMetrics(api);

      // Schedule periodic syncs
      reportInterval = setInterval(() => syncMetrics(api), intervalMs);
    },
    stop: async () => {
      if (reportInterval) {
        clearInterval(reportInterval);
        reportInterval = null;
      }
      console.log('[Claudometer] Reporter stopped');
    },
  });

  // Register CLI command
  api.registerCli({
    name: 'claudometer',
    description: 'Manage Claudometer integration',
    handler: async (args: string[]) => {
      const subcommand = args[0];

      switch (subcommand) {
        case 'link':
          return handleLink(args.slice(1), api);
        case 'status':
          return handleStatus(api);
        case 'sync':
          return handleSync(api);
        case 'unlink':
          return handleUnlink(api);
        default:
          return {
            text: `Claudometer CLI

Usage:
  openclaw claudometer link <CODE>   Link to Claudometer account
  openclaw claudometer status        Show connection status
  openclaw claudometer sync          Manually sync metrics
  openclaw claudometer unlink        Remove connection

Get a linking code by running 'claudometer link --generate' on any
machine where the Claudometer CLI is installed and authenticated.`,
          };
      }
    },
  });

  // Register chat command
  api.registerCommand({
    name: 'claudometer',
    description: 'Show Claudometer sync status',
    handler: () => {
      const cfg = api.config;

      if (!cfg.deviceToken) {
        return {
          text: `Claudometer: Not connected

To connect, run: openclaw claudometer link <CODE>
Get a code by running 'claudometer link --generate' on a machine with Claudometer CLI.`,
        };
      }

      const statusIcon = lastSyncStatus === 'success' ? 'OK' : lastSyncStatus === 'error' ? 'ERR' : '?';
      const lastSync = lastSyncTime ? lastSyncTime.toLocaleString() : 'Never';

      let text = `Claudometer: Connected [${statusIcon}]
Last sync: ${lastSync}`;

      if (lastSyncError) {
        text += `\nLast error: ${lastSyncError}`;
      }

      text += `\nInterval: Every ${cfg.reportIntervalMinutes || 30} minutes`;

      return { text };
    },
  });
}

/**
 * Sync metrics to Claudometer
 */
async function syncMetrics(api: PluginApi): Promise<void> {
  const cfg = api.config;

  if (!cfg.deviceToken) {
    return;
  }

  try {
    // Collect usage data
    const usage = await collector.collect(api);

    // Report to Claudometer
    await reporter.report(cfg, usage);

    lastSyncTime = new Date();
    lastSyncStatus = 'success';
    lastSyncError = null;

    console.log(`[Claudometer] Sync successful: ${usage.usage.messages} messages, ${usage.usage.input_tokens + usage.usage.output_tokens} tokens`);
  } catch (error) {
    lastSyncStatus = 'error';
    lastSyncError = error instanceof Error ? error.message : String(error);
    console.error('[Claudometer] Sync failed:', lastSyncError);
  }
}

/**
 * Handle 'link' subcommand
 */
async function handleLink(args: string[], api: PluginApi): Promise<{ text: string }> {
  const code = args[0];

  if (!code) {
    return {
      text: `Usage: openclaw claudometer link <CODE>

To get a linking code:
1. On a machine with Claudometer CLI installed and authenticated
2. Run: claudometer link --generate
3. Enter the code here within 10 minutes`,
    };
  }

  try {
    const cfg = api.config;
    const apiUrl = cfg.apiUrl || 'https://claudometer.ai';
    const deviceName = `OpenClaw on ${process.platform}`;

    const response = await fetch(`${apiUrl}/auth/device`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: code.toUpperCase(),
        deviceName,
        source: 'openclaw',
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { text: `Failed to link: ${data.error || 'Unknown error'}` };
    }

    // Store the token (this would need OpenClaw's config API)
    // For now, instruct user to set it manually
    return {
      text: `Successfully linked to Claudometer!

Account: ${data.user.email} (${data.org.name})

To complete setup, add this to your OpenClaw config:

plugins:
  entries:
    claudometer:
      deviceToken: "${data.token}"

Or set the environment variable:
  OPENCLAW_PLUGIN_CLAUDOMETER_DEVICETOKEN="${data.token}"

Metrics will sync automatically every 30 minutes.`,
    };
  } catch (error) {
    return {
      text: `Failed to link: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Handle 'status' subcommand
 */
async function handleStatus(api: PluginApi): Promise<{ text: string }> {
  const cfg = api.config;

  if (!cfg.deviceToken) {
    return {
      text: `Claudometer: Not connected

To connect, run: openclaw claudometer link <CODE>`,
    };
  }

  // Validate token with server
  try {
    const apiUrl = cfg.apiUrl || 'https://claudometer.ai';
    const response = await fetch(`${apiUrl}/auth/device/validate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${cfg.deviceToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return {
        text: `Claudometer: Token invalid or revoked

Run 'openclaw claudometer link <CODE>' to reconnect.`,
      };
    }

    const data = await response.json();

    let text = `Claudometer: Connected

Account: ${data.user.email}
Organization: ${data.org.name}
Device: ${data.device.name}
Last sync: ${lastSyncTime ? lastSyncTime.toLocaleString() : 'Never'}
Status: ${lastSyncStatus === 'success' ? 'OK' : lastSyncStatus === 'error' ? 'Error' : 'Unknown'}`;

    if (lastSyncError) {
      text += `\nLast error: ${lastSyncError}`;
    }

    return { text };
  } catch (error) {
    return {
      text: `Claudometer: Connection error

${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Handle 'sync' subcommand
 */
async function handleSync(api: PluginApi): Promise<{ text: string }> {
  const cfg = api.config;

  if (!cfg.deviceToken) {
    return {
      text: `Claudometer: Not connected

To connect, run: openclaw claudometer link <CODE>`,
    };
  }

  try {
    await syncMetrics(api);

    if (lastSyncStatus === 'success') {
      return { text: `Claudometer: Sync successful at ${lastSyncTime?.toLocaleString()}` };
    } else {
      return { text: `Claudometer: Sync failed - ${lastSyncError}` };
    }
  } catch (error) {
    return {
      text: `Claudometer: Sync failed - ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Handle 'unlink' subcommand
 */
async function handleUnlink(api: PluginApi): Promise<{ text: string }> {
  const cfg = api.config;

  if (!cfg.deviceToken) {
    return { text: 'Claudometer: Not connected' };
  }

  return {
    text: `To unlink from Claudometer, remove the deviceToken from your config:

plugins:
  entries:
    claudometer:
      deviceToken: null

Or unset the environment variable:
  unset OPENCLAW_PLUGIN_CLAUDOMETER_DEVICETOKEN`,
  };
}
