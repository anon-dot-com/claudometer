#!/usr/bin/env node

import { program } from 'commander';
import chalk from 'chalk';
import { loginCommand } from '../src/commands/login.js';
import { logoutCommand } from '../src/commands/logout.js';
import { startCommand } from '../src/commands/start.js';
import { statusCommand } from '../src/commands/status.js';
import { stopCommand } from '../src/commands/stop.js';
import { collectCommand } from '../src/commands/collect.js';
import { setupCommand } from '../src/commands/setup.js';

program
  .name('claudometer')
  .description('Measure engineering productivity across Claude and Git')
  .version('0.1.0');

program
  .command('login')
  .description('Authenticate with your organization')
  .option('--org <orgId>', 'Organization ID to join')
  .action(loginCommand);

program
  .command('logout')
  .description('Sign out from your organization')
  .action(logoutCommand);

program
  .command('start')
  .description('Start the metrics collection daemon')
  .option('-i, --interval <minutes>', 'Collection interval in minutes', '30')
  .action(startCommand);

program
  .command('stop')
  .description('Stop the metrics collection daemon')
  .action(stopCommand);

program
  .command('status')
  .description('Show current tracking status and recent metrics')
  .action(statusCommand);

program
  .command('collect')
  .description('Run a one-time metrics collection')
  .option('--dry-run', 'Show metrics without sending to server')
  .action(collectCommand);

program
  .command('setup')
  .description('Setup auto-sync daemon (macOS LaunchAgent)')
  .option('-i, --interval <minutes>', 'Sync interval in minutes', '30')
  .option('--uninstall', 'Remove the auto-sync daemon')
  .action(setupCommand);

program.parse();
