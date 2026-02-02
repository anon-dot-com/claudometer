import chalk from 'chalk';
import ora from 'ora';
import { getConfig } from '../config.js';

export async function linkCommand(options) {
  const config = await getConfig();

  if (!config.token) {
    console.log(chalk.red('\nNot logged in. Run `claudometer login` first.\n'));
    return;
  }

  if (options.generate) {
    await generateLinkingCode(config, options.name);
  } else if (options.list) {
    await listDevices(config);
  } else if (options.revoke) {
    await revokeDevice(config, options.revoke);
  } else {
    // Show help
    console.log(chalk.bold('\n🔗 Claudometer Device Linking\n'));
    console.log('Link external bots and tools to report metrics to your account.\n');
    console.log('Commands:');
    console.log(`  ${chalk.cyan('claudometer link --generate')}          Generate a linking code`);
    console.log(`  ${chalk.cyan('claudometer link --generate --name "My Bot"')}  Generate with device name`);
    console.log(`  ${chalk.cyan('claudometer link --list')}              List linked devices`);
    console.log(`  ${chalk.cyan('claudometer link --revoke <id>')}       Revoke a device\n`);
    console.log('Flow:');
    console.log(`  1. Run ${chalk.cyan('claudometer link --generate')} to get a 6-character code`);
    console.log(`  2. On your bot, POST to /auth/device with the code to get a device token`);
    console.log(`  3. Use the device token to POST metrics to /api/metrics/external\n`);
  }
}

async function generateLinkingCode(config, deviceName) {
  console.log(chalk.bold('\n🔗 Generate Linking Code\n'));

  const spinner = ora('Generating linking code...').start();

  try {
    const response = await fetch(`${config.apiUrl}/auth/link`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.token}`,
      },
      body: JSON.stringify({ deviceName }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `Server error: ${response.status}`);
    }

    const data = await response.json();
    spinner.succeed('Linking code generated!');

    console.log(`\n  Code: ${chalk.bold.green(data.code)}`);
    console.log(`  Expires: ${chalk.dim(data.expiresIn)}`);
    console.log(chalk.dim('\n  Use this code to link an external device or bot.'));
    console.log(chalk.dim('  The device should POST to /auth/device with this code.\n'));

    console.log(chalk.cyan('Example request from your bot:\n'));
    console.log(chalk.dim(`  curl -X POST ${config.apiUrl}/auth/device \\`));
    console.log(chalk.dim(`    -H "Content-Type: application/json" \\`));
    console.log(chalk.dim(`    -d '{"code": "${data.code}", "deviceName": "My Bot"}'\n`));
  } catch (error) {
    spinner.fail('Failed to generate linking code');
    console.log(chalk.red(`\nError: ${error.message}\n`));
  }
}

async function listDevices(config) {
  console.log(chalk.bold('\n🔗 Linked Devices\n'));

  const spinner = ora('Fetching devices...').start();

  try {
    const response = await fetch(`${config.apiUrl}/auth/devices`, {
      headers: { Authorization: `Bearer ${config.token}` },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `Server error: ${response.status}`);
    }

    const { devices } = await response.json();
    spinner.stop();

    if (devices.length === 0) {
      console.log(chalk.dim('  No linked devices.\n'));
      console.log(`  Run ${chalk.cyan('claudometer link --generate')} to create a linking code.\n`);
      return;
    }

    for (const device of devices) {
      const status = device.revoked_at
        ? chalk.red('revoked')
        : chalk.green('active');
      const lastUsed = device.last_used_at
        ? new Date(device.last_used_at).toLocaleDateString()
        : 'never';

      console.log(`  ${chalk.bold(device.name)} [${status}]`);
      console.log(`    ID: ${chalk.dim(device.id)}`);
      console.log(`    Created: ${new Date(device.created_at).toLocaleDateString()}`);
      console.log(`    Last used: ${lastUsed}\n`);
    }
  } catch (error) {
    spinner.fail('Failed to fetch devices');
    console.log(chalk.red(`\nError: ${error.message}\n`));
  }
}

async function revokeDevice(config, deviceId) {
  console.log(chalk.bold('\n🔗 Revoke Device\n'));

  const spinner = ora('Revoking device...').start();

  try {
    const response = await fetch(`${config.apiUrl}/auth/devices/${deviceId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${config.token}` },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `Server error: ${response.status}`);
    }

    spinner.succeed('Device revoked!');
    console.log(chalk.dim('\n  The device can no longer report metrics.\n'));
  } catch (error) {
    spinner.fail('Failed to revoke device');
    console.log(chalk.red(`\nError: ${error.message}\n`));
  }
}
