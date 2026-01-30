import chalk from 'chalk';
import ora from 'ora';
import { getConfig } from '../config.js';

const DEFAULT_API_URL = process.env.CLAUDOMETER_API_URL || 'https://api.claudometer.ai';

export async function linkCommand(options) {
  const config = await getConfig();

  if (!config.token) {
    console.log(chalk.red('\nNot logged in.'));
    console.log(`Run ${chalk.cyan('claudometer login')} first.\n`);
    return;
  }

  // Handle subcommands
  if (options.generate) {
    await generateLinkingCode(config);
  } else if (options.list) {
    await listDevices(config);
  } else if (options.revoke) {
    await revokeDevice(config, options.revoke);
  } else {
    // Show help
    console.log(chalk.bold('\n🔗 Claudometer Device Linking\n'));
    console.log('Link external tools (like OpenClaw) to your Claudometer account.\n');
    console.log('Commands:');
    console.log(`  ${chalk.cyan('claudometer link --generate')}     Generate a linking code`);
    console.log(`  ${chalk.cyan('claudometer link --list')}         List linked devices`);
    console.log(`  ${chalk.cyan('claudometer link --revoke <id>')}  Revoke a device token\n`);
    console.log('Example workflow:');
    console.log(`  1. Run ${chalk.cyan('claudometer link --generate')} to get a code`);
    console.log(`  2. In OpenClaw, run ${chalk.cyan('openclaw claudometer link <CODE>')}`);
    console.log(`  3. Verify with ${chalk.cyan('claudometer link --list')}\n`);
  }
}

async function generateLinkingCode(config) {
  console.log(chalk.bold('\n🔗 Generate Linking Code\n'));

  const spinner = ora('Generating code...').start();

  try {
    const apiUrl = config.apiUrl || DEFAULT_API_URL;
    const response = await fetch(`${apiUrl}/auth/link`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      spinner.fail('Failed to generate code');
      console.log(chalk.red(`\nError: ${error.error}`));
      return;
    }

    const data = await response.json();
    spinner.succeed('Code generated!');

    console.log(`\n${chalk.bold('Linking Code:')} ${chalk.green.bold(data.code)}`);
    console.log(`${chalk.dim(`Expires: ${new Date(data.expiresAt).toLocaleString()} (${data.expiresIn})`)}`);
    console.log(`\n${chalk.bold('To link OpenClaw:')}`);
    console.log(`  ${chalk.cyan(`openclaw claudometer link ${data.code}`)}`);
    console.log(`\n${chalk.dim('Or in OpenClaw chat:')}`);
    console.log(`  ${chalk.cyan(`/claudometer link ${data.code}`)}\n`);
  } catch (error) {
    spinner.fail('Failed to generate code');
    console.log(chalk.red(`\nError: ${error.message}`));
  }
}

async function listDevices(config) {
  console.log(chalk.bold('\n📱 Linked Devices\n'));

  const spinner = ora('Fetching devices...').start();

  try {
    const apiUrl = config.apiUrl || DEFAULT_API_URL;
    const response = await fetch(`${apiUrl}/auth/devices`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      spinner.fail('Failed to fetch devices');
      console.log(chalk.red(`\nError: ${error.error}`));
      return;
    }

    const data = await response.json();
    spinner.stop();

    if (data.devices.length === 0) {
      console.log(chalk.dim('No linked devices.\n'));
      console.log(`Run ${chalk.cyan('claudometer link --generate')} to create a linking code.\n`);
      return;
    }

    console.log(`Found ${data.devices.length} device(s):\n`);

    for (const device of data.devices) {
      const lastUsed = device.last_used_at
        ? new Date(device.last_used_at).toLocaleString()
        : 'Never';
      const created = new Date(device.created_at).toLocaleDateString();

      console.log(`  ${chalk.bold(device.device_name)}`);
      console.log(`    ID: ${chalk.dim(device.id)}`);
      console.log(`    Source: ${chalk.cyan(device.source)}`);
      console.log(`    Last used: ${lastUsed}`);
      console.log(`    Created: ${created}`);
      console.log();
    }

    console.log(`To revoke a device, run ${chalk.cyan('claudometer link --revoke <id>')}\n`);
  } catch (error) {
    spinner.fail('Failed to fetch devices');
    console.log(chalk.red(`\nError: ${error.message}`));
  }
}

async function revokeDevice(config, deviceId) {
  console.log(chalk.bold('\n🗑️  Revoke Device Token\n'));

  const spinner = ora('Revoking token...').start();

  try {
    const apiUrl = config.apiUrl || DEFAULT_API_URL;
    const response = await fetch(`${apiUrl}/auth/devices/${deviceId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${config.token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      spinner.fail('Failed to revoke token');
      console.log(chalk.red(`\nError: ${error.error}`));
      return;
    }

    spinner.succeed('Token revoked!');
    console.log(chalk.dim('\nThe device will no longer be able to sync metrics.'));
    console.log(`\nRun ${chalk.cyan('claudometer link --list')} to see remaining devices.\n`);
  } catch (error) {
    spinner.fail('Failed to revoke token');
    console.log(chalk.red(`\nError: ${error.message}`));
  }
}
