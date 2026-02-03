import { homedir, platform } from 'os';
import { join } from 'path';
import { writeFile, mkdir, unlink, access } from 'fs/promises';
import { execSync } from 'child_process';
import chalk from 'chalk';
import ora from 'ora';

const PLIST_NAME = 'com.claudometer.daemon.plist';
const LAUNCH_AGENTS_DIR = join(homedir(), 'Library', 'LaunchAgents');
const PLIST_PATH = join(LAUNCH_AGENTS_DIR, PLIST_NAME);

function getClaudometerPath() {
  try {
    const result = execSync('which claudometer', { encoding: 'utf-8' }).trim();
    if (result) return result;
  } catch {
    // Not globally installed
  }
  return null;
}

function generatePlist(claudometerPath, intervalMinutes = 30) {
  const intervalSeconds = intervalMinutes * 60;

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.claudometer.daemon</string>
    <key>ProgramArguments</key>
    <array>
        <string>${claudometerPath}</string>
        <string>collect</string>
    </array>
    <key>StartInterval</key>
    <integer>${intervalSeconds}</integer>
    <key>RunAtLoad</key>
    <true/>
    <key>StandardOutPath</key>
    <string>${join(homedir(), '.claudometer', 'daemon.log')}</string>
    <key>StandardErrorPath</key>
    <string>${join(homedir(), '.claudometer', 'daemon.error.log')}</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin</string>
    </dict>
</dict>
</plist>`;
}

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

// Get current crontab entries
function getCurrentCrontab() {
  try {
    return execSync('crontab -l 2>/dev/null', { encoding: 'utf-8' });
  } catch {
    return '';
  }
}

// Check if claudometer cron entry exists
function hasCronEntry(crontab) {
  return crontab.includes('claudometer collect');
}

// macOS setup using LaunchAgent
async function setupMacOS(options, spinner) {
  if (options.uninstall) {
    spinner.start('Removing auto-start daemon...');

    try {
      try {
        execSync(`launchctl unload "${PLIST_PATH}" 2>/dev/null`);
      } catch {
        // Ignore errors if not loaded
      }

      if (await fileExists(PLIST_PATH)) {
        await unlink(PLIST_PATH);
        spinner.succeed('Auto-start daemon removed');
        console.log(chalk.gray(`  Deleted: ${PLIST_PATH}`));
      } else {
        spinner.info('Auto-start daemon was not installed');
      }
    } catch (error) {
      spinner.fail(`Failed to remove auto-start: ${error.message}`);
      process.exit(1);
    }
    return;
  }

  // Install the LaunchAgent
  spinner.start('Finding claudometer installation...');
  const claudometerPath = getClaudometerPath();

  if (!claudometerPath) {
    spinner.fail('claudometer not found in PATH');
    console.log(chalk.yellow('\nPlease install claudometer globally first:'));
    console.log(chalk.cyan('  npm install -g claudometer'));
    process.exit(1);
  }
  spinner.succeed(`Found claudometer at ${claudometerPath}`);

  // Create logs directory
  spinner.start('Creating log directory...');
  const logDir = join(homedir(), '.claudometer');
  await mkdir(logDir, { recursive: true });
  spinner.succeed('Log directory ready');

  // Create LaunchAgents directory if needed
  spinner.start('Creating LaunchAgent...');
  await mkdir(LAUNCH_AGENTS_DIR, { recursive: true });

  // Generate and write the plist
  const intervalMinutes = parseInt(options.interval) || 30;
  const plistContent = generatePlist(claudometerPath, intervalMinutes);
  await writeFile(PLIST_PATH, plistContent);
  spinner.succeed(`LaunchAgent created (syncs every ${intervalMinutes} minutes)`);

  // Unload existing agent if present
  try {
    execSync(`launchctl unload "${PLIST_PATH}" 2>/dev/null`);
  } catch {
    // Ignore errors
  }

  // Load the new agent
  spinner.start('Starting auto-sync daemon...');
  try {
    execSync(`launchctl load "${PLIST_PATH}"`);
    spinner.succeed('Auto-sync daemon started');
  } catch (error) {
    spinner.fail(`Failed to start daemon: ${error.message}`);
    console.log(chalk.yellow('\nYou may need to start it manually:'));
    console.log(chalk.cyan(`  launchctl load "${PLIST_PATH}"`));
  }

  const logDir2 = join(homedir(), '.claudometer');
  console.log(chalk.green('\n✨ Setup complete!\n'));
  console.log('Your metrics will now sync automatically every', chalk.cyan(`${intervalMinutes} minutes`));
  console.log(chalk.gray(`\nLogs: ${join(logDir2, 'daemon.log')}`));
  console.log(chalk.gray(`To uninstall: claudometer setup --uninstall`));
}

// Linux setup using cron
async function setupLinux(options, spinner) {
  const claudometerPath = getClaudometerPath();
  const logDir = join(homedir(), '.claudometer');
  const logFile = join(logDir, 'daemon.log');
  const intervalMinutes = parseInt(options.interval) || 30;

  if (options.uninstall) {
    spinner.start('Removing cron job...');

    try {
      const currentCrontab = getCurrentCrontab();

      if (!hasCronEntry(currentCrontab)) {
        spinner.info('Cron job was not installed');
        return;
      }

      // Remove claudometer entries from crontab
      const newCrontab = currentCrontab
        .split('\n')
        .filter(line => !line.includes('claudometer collect'))
        .join('\n');

      // Write new crontab
      execSync(`echo "${newCrontab}" | crontab -`, { encoding: 'utf-8' });
      spinner.succeed('Cron job removed');
    } catch (error) {
      spinner.fail(`Failed to remove cron job: ${error.message}`);
      process.exit(1);
    }
    return;
  }

  // Install cron job
  spinner.start('Finding claudometer installation...');

  if (!claudometerPath) {
    spinner.fail('claudometer not found in PATH');
    console.log(chalk.yellow('\nPlease install claudometer globally first:'));
    console.log(chalk.cyan('  npm install -g claudometer'));
    process.exit(1);
  }
  spinner.succeed(`Found claudometer at ${claudometerPath}`);

  // Create logs directory
  spinner.start('Creating log directory...');
  await mkdir(logDir, { recursive: true });
  spinner.succeed('Log directory ready');

  // Check if cron job already exists
  spinner.start('Setting up cron job...');
  const currentCrontab = getCurrentCrontab();

  if (hasCronEntry(currentCrontab)) {
    // Remove existing entry first
    const cleanedCrontab = currentCrontab
      .split('\n')
      .filter(line => !line.includes('claudometer collect'))
      .join('\n');

    // Add new entry
    const cronEntry = `*/${intervalMinutes} * * * * ${claudometerPath} collect >> ${logFile} 2>&1`;
    const newCrontab = cleanedCrontab.trim() + '\n' + cronEntry + '\n';

    execSync(`echo "${newCrontab}" | crontab -`, { encoding: 'utf-8' });
    spinner.succeed(`Cron job updated (syncs every ${intervalMinutes} minutes)`);
  } else {
    // Add new entry
    const cronEntry = `*/${intervalMinutes} * * * * ${claudometerPath} collect >> ${logFile} 2>&1`;
    const newCrontab = currentCrontab.trim() + '\n' + cronEntry + '\n';

    execSync(`echo "${newCrontab}" | crontab -`, { encoding: 'utf-8' });
    spinner.succeed(`Cron job created (syncs every ${intervalMinutes} minutes)`);
  }

  console.log(chalk.green('\n✨ Setup complete!\n'));
  console.log('Your metrics will now sync automatically every', chalk.cyan(`${intervalMinutes} minutes`));
  console.log(chalk.gray(`\nLogs: ${logFile}`));
  console.log(chalk.gray(`To uninstall: claudometer setup --uninstall`));
  console.log(chalk.gray(`To view cron jobs: crontab -l`));
}

export async function setupCommand(options) {
  const spinner = ora();
  const os = platform();

  console.log(chalk.bold('\n🚀 Setting up Claudometer auto-sync\n'));
  console.log(chalk.gray(`Detected OS: ${os}\n`));

  if (os === 'darwin') {
    await setupMacOS(options, spinner);
  } else if (os === 'linux') {
    await setupLinux(options, spinner);
  } else {
    console.log(chalk.yellow(`Auto-setup is not supported on ${os}.`));
    console.log(chalk.white('\nYou can manually set up a scheduled task to run:'));
    console.log(chalk.cyan('  claudometer collect'));
    console.log(chalk.white('\nRecommended: Run every 30 minutes.'));
    process.exit(1);
  }
}
