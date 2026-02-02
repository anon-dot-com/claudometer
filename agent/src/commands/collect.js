import chalk from 'chalk';
import ora from 'ora';
import { collectClaudeMetrics } from '../collectors/claude.js';
import { collectOpenClawMetrics, isOpenClawAvailable } from '../collectors/openclaw.js';
import { collectGitMetrics } from '../collectors/git.js';
import { reportMetrics, reportOpenClawMetrics } from '../reporter.js';
import { getConfig } from '../config.js';

export async function collectCommand(options) {
  console.log(chalk.bold('\n📊 Collecting metrics...\n'));

  // Collect Claude Code metrics (first-party)
  const claudeSpinner = ora('Collecting Claude Code usage...').start();
  const claudeMetrics = await collectClaudeMetrics();

  if (claudeMetrics.available) {
    claudeSpinner.succeed(
      `Claude Code: ${claudeMetrics.totals.inputTokens.toLocaleString()} input tokens, ${claudeMetrics.totals.outputTokens.toLocaleString()} output tokens`
    );
  } else {
    claudeSpinner.warn(`Claude Code: ${claudeMetrics.error}`);
  }

  // Collect OpenClaw metrics (third-party) if available
  let openclawMetrics = null;
  if (isOpenClawAvailable()) {
    const openclawSpinner = ora('Collecting OpenClaw usage...').start();
    openclawMetrics = await collectOpenClawMetrics();

    if (openclawMetrics.available) {
      openclawSpinner.succeed(
        `OpenClaw: ${openclawMetrics.totals.inputTokens.toLocaleString()} input tokens, ${openclawMetrics.totals.outputTokens.toLocaleString()} output tokens`
      );
    } else {
      openclawSpinner.warn(`OpenClaw: ${openclawMetrics.error}`);
    }
  }

  // Collect Git metrics
  const gitSpinner = ora('Scanning Git repositories...').start();
  const gitMetrics = await collectGitMetrics();

  gitSpinner.succeed(
    `Git: ${gitMetrics.totals.commits} commits, ${gitMetrics.totals.linesAdded.toLocaleString()} lines added across ${gitMetrics.reposContributed} repos`
  );

  // Summary
  console.log(chalk.bold('\n📈 Summary (last 30 days)\n'));

  console.log(chalk.cyan('Claude Code Usage (First-party):'));
  if (claudeMetrics.available) {
    console.log(`  Sessions:       ${claudeMetrics.totals.sessions}`);
    console.log(`  Messages:       ${claudeMetrics.totals.messages.toLocaleString()}`);
    console.log(`  Input tokens:   ${claudeMetrics.totals.inputTokens.toLocaleString()}`);
    console.log(`  Output tokens:  ${claudeMetrics.totals.outputTokens.toLocaleString()}`);
    console.log(`  Tool calls:     ${claudeMetrics.totals.toolCalls.toLocaleString()}`);
  } else {
    console.log(`  ${chalk.yellow('Not available')}`);
  }

  if (openclawMetrics) {
    console.log(chalk.cyan('\nOpenClaw Usage (Third-party):'));
    if (openclawMetrics.available) {
      console.log(`  Sessions:       ${openclawMetrics.totals.sessions}`);
      console.log(`  Messages:       ${openclawMetrics.totals.messages.toLocaleString()}`);
      console.log(`  Input tokens:   ${openclawMetrics.totals.inputTokens.toLocaleString()}`);
      console.log(`  Output tokens:  ${openclawMetrics.totals.outputTokens.toLocaleString()}`);
      console.log(`  Tool calls:     ${openclawMetrics.totals.toolCalls.toLocaleString()}`);
    } else {
      console.log(`  ${chalk.yellow('Not available')}`);
    }
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
    return;
  }

  const config = await getConfig();

  // Report Claude Code metrics (first-party) via Clerk auth
  if (claudeMetrics.available && config.token) {
    const reportSpinner = ora('Sending Claude Code metrics...').start();
    try {
      await reportMetrics({ claude: claudeMetrics, git: gitMetrics });
      reportSpinner.succeed('Claude Code metrics reported');
    } catch (error) {
      reportSpinner.fail(`Failed to report Claude metrics: ${error.message}`);
    }
  } else if (claudeMetrics.available && !config.token) {
    console.log(
      chalk.yellow('\nClaude Code: Not logged in. Run `claudometer login` to sync.\n')
    );
  }

  // Report OpenClaw metrics (third-party) via device token
  if (openclawMetrics?.available && config.deviceToken) {
    const openclawReportSpinner = ora('Sending OpenClaw metrics...').start();
    try {
      await reportOpenClawMetrics(openclawMetrics);
      openclawReportSpinner.succeed('OpenClaw metrics reported');
    } catch (error) {
      openclawReportSpinner.fail(`Failed to report OpenClaw metrics: ${error.message}`);
    }
  } else if (openclawMetrics?.available && !config.deviceToken) {
    console.log(
      chalk.yellow('\nOpenClaw: No device token. Run `claudometer link` to connect.\n')
    );
  }

  if (!config.token && !config.deviceToken) {
    console.log(
      chalk.yellow('\nNot authenticated. Run `claudometer login` or `claudometer link` to sync.\n')
    );
  }
}
