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
import { linkCommand } from '../src/commands/link.js';

program
  .name('claudometer')
  .description('Measure engineering productivity across Claude and Git')
  .version('0.1.0');

program
  .command('login')
  .description('Authenticate with Claudometer')
  .action(loginCommand);

program
  .command('logout')
  .description('Sign out from Claudometer')
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

program
  .command('link')
  .description('Link external tools (OpenClaw, etc.) to your account')
  .option('-g, --generate', 'Generate a new linking code')
  .option('-c, --connect <code>', 'Connect this device using a linking code')
  .option('-l, --list', 'List linked devices')
  .option('-r, --revoke <id>', 'Revoke a device token')
  .action(linkCommand);

program.parse();
