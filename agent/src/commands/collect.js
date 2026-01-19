import chalk from 'chalk';
import ora from 'ora';
import { collectClaudeMetrics } from '../collectors/claude.js';
import { collectGitMetrics } from '../collectors/git.js';
import { reportMetrics } from '../reporter.js';
import { getConfig } from '../config.js';

export async function collectCommand(options) {
  console.log(chalk.bold('\n📊 Collecting metrics...\n'));

  // Collect Claude metrics
  const claudeSpinner = ora('Collecting Claude Code usage...').start();
  const claudeMetrics = await collectClaudeMetrics();

  if (claudeMetrics.available) {
    claudeSpinner.succeed(
      `Claude Code: ${claudeMetrics.totals.inputTokens.toLocaleString()} input tokens, ${claudeMetrics.totals.outputTokens.toLocaleString()} output tokens`
    );
  } else {
    claudeSpinner.warn(`Claude Code: ${claudeMetrics.error}`);
  }

  // Collect Git metrics
  const gitSpinner = ora('Scanning Git repositories...').start();
  const gitMetrics = await collectGitMetrics();

  gitSpinner.succeed(
    `Git: ${gitMetrics.totals.commits} commits, ${gitMetrics.totals.linesAdded.toLocaleString()} lines added across ${gitMetrics.reposContributed} repos`
  );

  // Summary
  console.log(chalk.bold('\n📈 Summary (last 30 days)\n'));

  console.log(chalk.cyan('Claude Code Usage:'));
  if (claudeMetrics.available) {
    console.log(`  Sessions:       ${claudeMetrics.totals.sessions}`);
    console.log(`  Messages:       ${claudeMetrics.totals.messages.toLocaleString()}`);
    console.log(`  Input tokens:   ${claudeMetrics.totals.inputTokens.toLocaleString()}`);
    console.log(`  Output tokens:  ${claudeMetrics.totals.outputTokens.toLocaleString()}`);
    console.log(`  Tool calls:     ${claudeMetrics.totals.toolCalls.toLocaleString()}`);
  } else {
    console.log(`  ${chalk.yellow('Not available')}`);
  }

  console.log(chalk.cyan('\nGit Activity:'));
  console.log(`  Repos scanned:      ${gitMetrics.reposScanned}`);
  console.log(`  Repos contributed:  ${gitMetrics.reposContributed}`);
  console.log(`  Total commits:      ${gitMetrics.totals.commits}`);
  console.log(`  Lines added:        ${gitMetrics.totals.linesAdded.toLocaleString()}`);
  console.log(`  Lines deleted:      ${gitMetrics.totals.linesDeleted.toLocaleString()}`);
  console.log(`  Files changed:      ${gitMetrics.totals.filesChanged.toLocaleString()}`);

  if (gitMetrics.byRepo.length > 0) {
    console.log(chalk.cyan('\nTop Repositories:'));
    const topRepos = gitMetrics.byRepo
      .sort((a, b) => b.commits - a.commits)
      .slice(0, 5);

    for (const repo of topRepos) {
      console.log(
        `  ${repo.name}: ${repo.commits} commits, +${repo.linesAdded.toLocaleString()} lines`
      );
    }
  }

  // Report to server (unless dry run)
  if (options.dryRun) {
    console.log(chalk.yellow('\n--dry-run: Metrics not sent to server\n'));
  } else {
    const config = await getConfig();
    if (config.token) {
      const reportSpinner = ora('Sending metrics to server...').start();
      try {
        await reportMetrics({ claude: claudeMetrics, git: gitMetrics });
        reportSpinner.succeed('Metrics reported successfully');
      } catch (error) {
        reportSpinner.fail(`Failed to report: ${error.message}`);
      }
    } else {
      console.log(
        chalk.yellow('\nNot logged in. Run `claudometer login` to sync with your organization.\n')
      );
    }
  }
}
