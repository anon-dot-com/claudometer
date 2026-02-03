import chalk from 'chalk';
import ora from 'ora';
import { getConfig } from '../config.js';

function formatNumber(num) {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toLocaleString();
}

export async function bragCommand() {
  const config = await getConfig();

  if (!config.deviceToken && !config.token) {
    console.log(chalk.yellow('\nNot connected. Run `claudometer link` or `claudometer login` first.\n'));
    process.exit(1);
  }

  const spinner = ora('Fetching stats...').start();

  try {
    // Use device token if available, otherwise use JWT token
    const authToken = config.deviceToken || config.token;
    const endpoint = config.deviceToken
      ? `${config.apiUrl}/api/metrics/external/me`
      : `${config.apiUrl}/api/metrics/me`;

    const response = await fetch(endpoint, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('Authentication expired. Run `claudometer login` or `claudometer link` again.');
      }
      throw new Error(`Server error: ${response.status}`);
    }

    const data = await response.json();
    spinner.stop();

    // Handle different response formats (external vs internal endpoint)
    const stats = data.metrics ? {
      user: 'You',
      org: 'Your Org',
      week: {
        tokens: data.metrics.claude_tokens || 0,
        messages: data.metrics.claude_messages || 0,
        sessions: data.metrics.claude_sessions || 0,
      },
      total: {
        tokens: data.metrics.claude_tokens || 0,
        messages: data.metrics.claude_messages || 0,
        sessions: data.metrics.claude_sessions || 0,
      },
      rank: null,
    } : data;

    console.log(chalk.bold.cyan('\n🏆 Agent Stats\n'));

    console.log(chalk.white(`   User: ${chalk.bold(stats.user)}`));
    if (stats.org) {
      console.log(chalk.white(`   Org:  ${stats.org}`));
    }
    console.log('');

    // Today
    if (stats.today && stats.today.tokens > 0) {
      console.log(chalk.gray('   Today'));
      console.log(chalk.white(`   ${chalk.bold(formatNumber(stats.today.tokens))} tokens across ${stats.today.sessions} sessions`));
      if (stats.today.first_party > 0 || stats.today.third_party > 0) {
        console.log(chalk.gray(`   └─ ${formatNumber(stats.today.first_party)} first-party, ${formatNumber(stats.today.third_party)} third-party`));
      }
      console.log('');
    }

    // This week
    if (stats.week && stats.week.tokens > 0) {
      console.log(chalk.gray('   This Week'));
      console.log(chalk.white(`   ${chalk.bold(formatNumber(stats.week.tokens))} tokens across ${stats.week.sessions} sessions`));
      if (stats.week.first_party > 0 || stats.week.third_party > 0) {
        console.log(chalk.gray(`   └─ ${formatNumber(stats.week.first_party)} first-party, ${formatNumber(stats.week.third_party)} third-party`));
      }
      console.log('');
    }

    // All time
    console.log(chalk.gray('   All Time'));
    console.log(chalk.white(`   ${chalk.bold(formatNumber(stats.total.tokens))} tokens, ${formatNumber(stats.total.messages)} messages`));
    if (stats.total.first_party > 0 || stats.total.third_party > 0) {
      console.log(chalk.gray(`   └─ ${formatNumber(stats.total.first_party)} first-party, ${formatNumber(stats.total.third_party)} third-party`));
    }
    console.log('');

    // Rank
    if (stats.rank) {
      console.log(chalk.yellow(`   🥇 Rank #${stats.rank} in ${stats.org}`));
      console.log('');
    }

    // Shareable summary
    console.log(chalk.gray('   ─────────────────────────────────'));
    console.log(chalk.gray('   Share this:'));
    const shareText = stats.week?.tokens > 0
      ? `This week: ${formatNumber(stats.week.tokens)} tokens across ${stats.week.sessions} sessions`
      : `All-time: ${formatNumber(stats.total.tokens)} tokens, ${formatNumber(stats.total.messages)} messages`;
    console.log(chalk.white(`   "${shareText}"`));
    console.log(chalk.gray('   📊 claudometer.ai'));
    console.log('');

  } catch (error) {
    spinner.fail(`Failed to fetch stats: ${error.message}`);
    process.exit(1);
  }
}
