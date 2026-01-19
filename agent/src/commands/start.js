import chalk from 'chalk';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { getConfig, saveConfig } from '../config.js';

export async function startCommand(options) {
  const config = await getConfig();

  console.log(chalk.bold('\n🚀 Starting Claude Tracker\n'));

  // Check if already running
  if (config.daemon?.running && config.daemon?.pid) {
    try {
      process.kill(config.daemon.pid, 0); // Check if process exists
      console.log(chalk.yellow('Daemon is already running.'));
      console.log(`  PID: ${config.daemon.pid}`);
      console.log(`  Interval: Every ${config.daemon.interval} minutes`);
      console.log(`\nRun ${chalk.cyan('claudometer stop')} to stop it.\n`);
      return;
    } catch {
      // Process doesn't exist, continue to start new one
    }
  }

  // Check auth
  if (!config.token) {
    console.log(chalk.yellow('Not logged in.'));
    console.log(`Run ${chalk.cyan('claudometer login')} first to authenticate.\n`);
    return;
  }

  const interval = parseInt(options.interval, 10) || 30;

  // Start the daemon process
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const daemonPath = join(__dirname, '..', 'daemon.js');

  const child = spawn(process.execPath, [daemonPath, '--interval', interval.toString()], {
    detached: true,
    stdio: 'ignore',
    env: {
      ...process.env,
      CLAUDE_TRACKER_DAEMON: 'true',
    },
  });

  child.unref();

  // Save daemon info
  await saveConfig({
    ...config,
    daemon: {
      running: true,
      pid: child.pid,
      interval,
      startedAt: new Date().toISOString(),
    },
  });

  console.log(chalk.green('✓ Daemon started successfully'));
  console.log(`  PID: ${child.pid}`);
  console.log(`  Interval: Every ${interval} minutes`);
  console.log(`  Reporting to: ${config.apiUrl}`);
  console.log(`\nMetrics will be collected and sent automatically.`);
  console.log(`Run ${chalk.cyan('claudometer status')} to check progress.\n`);
}
