import cron from 'node-cron';
import { collectClaudeMetrics } from './collectors/claude.js';
import { collectGitMetrics } from './collectors/git.js';
import { reportMetrics } from './reporter.js';
import { getConfig, updateConfig } from './config.js';

// Parse command line args
const args = process.argv.slice(2);
const intervalIndex = args.indexOf('--interval');
const interval = intervalIndex !== -1 ? parseInt(args[intervalIndex + 1], 10) : 30;

console.log(`Claude Tracker daemon starting (interval: ${interval} minutes)`);

// Run immediately on start
runCollection();

// Schedule recurring collection
// Convert minutes to cron expression (e.g., every 30 minutes: */30 * * * *)
const cronExpression = `*/${interval} * * * *`;

cron.schedule(cronExpression, () => {
  runCollection();
});

async function runCollection() {
  console.log(`[${new Date().toISOString()}] Starting metrics collection...`);

  try {
    const config = await getConfig();

    if (!config.token) {
      console.log('Not authenticated. Skipping collection.');
      return;
    }

    // Collect metrics
    const claudeMetrics = await collectClaudeMetrics();
    const gitMetrics = await collectGitMetrics();

    console.log(
      `  Claude: ${claudeMetrics.available ? claudeMetrics.totals.outputTokens + ' tokens' : 'unavailable'}`
    );
    console.log(`  Git: ${gitMetrics.totals.commits} commits, +${gitMetrics.totals.linesAdded} lines`);

    // Report to server
    await reportMetrics({ claude: claudeMetrics, git: gitMetrics });
    console.log(`  ✓ Metrics reported successfully`);

    // Update last run
    await updateConfig({
      daemon: {
        ...config.daemon,
        lastRun: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error(`  ✗ Error: ${error.message}`);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('Daemon received SIGTERM, shutting down...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('Daemon received SIGINT, shutting down...');
  process.exit(0);
});
