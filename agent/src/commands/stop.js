import chalk from 'chalk';
import { getConfig, saveConfig } from '../config.js';

export async function stopCommand() {
  const config = await getConfig();

  console.log(chalk.bold('\n🛑 Stopping Claude Tracker\n'));

  if (!config.daemon?.running || !config.daemon?.pid) {
    console.log(chalk.yellow('Daemon is not running.\n'));
    return;
  }

  try {
    process.kill(config.daemon.pid, 'SIGTERM');

    // Update config
    await saveConfig({
      ...config,
      daemon: {
        ...config.daemon,
        running: false,
        stoppedAt: new Date().toISOString(),
      },
    });

    console.log(chalk.green('✓ Daemon stopped successfully'));
    console.log(`  PID ${config.daemon.pid} terminated\n`);
  } catch (error) {
    if (error.code === 'ESRCH') {
      // Process doesn't exist
      await saveConfig({
        ...config,
        daemon: {
          ...config.daemon,
          running: false,
        },
      });
      console.log(chalk.yellow('Daemon was not running (process not found).\n'));
    } else {
      console.log(chalk.red(`Failed to stop daemon: ${error.message}\n`));
    }
  }
}
