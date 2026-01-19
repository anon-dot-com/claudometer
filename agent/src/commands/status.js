import chalk from 'chalk';
import { getConfig } from '../config.js';
import { collectClaudeMetrics } from '../collectors/claude.js';
import { collectGitMetrics } from '../collectors/git.js';

export async function statusCommand() {
  const config = await getConfig();

  console.log(chalk.bold('\n🔍 Claude Tracker Status\n'));

  // Auth status
  console.log(chalk.cyan('Authentication:'));
  if (config.token) {
    console.log(`  Status:       ${chalk.green('Logged in')}`);
    console.log(`  User:         ${config.user?.email || 'Unknown'}`);
    console.log(`  Organization: ${config.org?.name || 'Unknown'}`);
  } else {
    console.log(`  Status:       ${chalk.yellow('Not logged in')}`);
    console.log(`  Run ${chalk.cyan('claudometer login')} to authenticate`);
  }

  // Daemon status
  console.log(chalk.cyan('\nDaemon:'));
  if (config.daemon?.running) {
    console.log(`  Status:       ${chalk.green('Running')}`);
    console.log(`  PID:          ${config.daemon.pid}`);
    console.log(`  Interval:     Every ${config.daemon.interval} minutes`);
    console.log(`  Last run:     ${config.daemon.lastRun || 'Never'}`);
  } else {
    console.log(`  Status:       ${chalk.yellow('Stopped')}`);
    console.log(`  Run ${chalk.cyan('claudometer start')} to begin tracking`);
  }

  // Quick metrics preview
  console.log(chalk.cyan('\nCurrent Metrics (last 30 days):'));

  const claudeMetrics = await collectClaudeMetrics();
  if (claudeMetrics.available) {
    console.log(
      `  Claude:       ${claudeMetrics.totals.outputTokens.toLocaleString()} tokens output, ${claudeMetrics.totals.sessions} sessions`
    );
  } else {
    console.log(`  Claude:       ${chalk.yellow('Not available')}`);
  }

  const gitMetrics = await collectGitMetrics();
  console.log(
    `  Git:          ${gitMetrics.totals.commits} commits, +${gitMetrics.totals.linesAdded.toLocaleString()} lines`
  );

  console.log('');
}
