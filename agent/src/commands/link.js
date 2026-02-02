import chalk from 'chalk';
import ora from 'ora';
import os from 'os';
import { getConfig, updateConfig } from '../config.js';

const DEFAULT_API_URL = process.env.CLAUDOMETER_API_URL || 'https://api.claudometer.ai';

export async function linkCommand(options) {
  const config = await getConfig();

  // Handle --connect (doesn't require existing login)
  if (options.connect) {
    await connectWithCode(config, options.connect);
    return;
  }

  // Other commands require being logged in
  if (!config.token) {
    console.log(chalk.red('\nNot logged in.'));
    console.log(`Run ${chalk.cyan('claudometer login')} first.\n`);
    console.log(chalk.dim('Or use --connect <CODE> to link with a code from another device.\n'));
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
    console.log('Link devices to your Claudometer account.\n');
    console.log('Commands:');
    console.log(`  ${chalk.cyan('claudometer link --generate')}        Generate a linking code`);
    console.log(`  ${chalk.cyan('claudometer link --connect <CODE>')}  Connect this device using a code`);
    console.log(`  ${chalk.cyan('claudometer link --list')}            List linked devices`);
    console.log(`  ${chalk.cyan('claudometer link --revoke <id>')}     Revoke a device token\n`);
    console.log('Example workflow for secondary devices (OpenClaw bots):');
    console.log(`  1. On primary device: ${chalk.cyan('claudometer link --generate')}`);
    console.log(`  2. On secondary device: ${chalk.cyan('claudometer link --connect <CODE>')}`);
    console.log(`  3. Run ${chalk.cyan('claudometer collect')} on either device\n`);
  }
}

/**
 * Connect this device using a linking code from another device
 */
async function connectWithCode(config, code) {
  console.log(chalk.bold('\n🔗 Connect Device\n'));

  const spinner = ora('Connecting...').start();

  try {
    const apiUrl = config.apiUrl || DEFAULT_API_URL;
    const deviceName = `Claudometer on ${os.hostname()}`;

    const response = await fetch(`${apiUrl}/auth/device`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code: code.toUpperCase(),
        deviceName,
        source: 'openclaw', // Third-party source
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      spinner.fail('Failed to connect');
      console.log(chalk.red(`\nError: ${error.error}`));
      if (error.error?.includes('expired') || error.error?.includes('invalid')) {
        console.log(chalk.dim('\nThe code may have expired. Generate a new one with:'));
        console.log(`  ${chalk.cyan('claudometer link --generate')}\n`);
      }
      return;
    }

    const data = await response.json();

    // Save the device token
    await updateConfig({
      deviceToken: data.token,
      linkedAccount: {
        email: data.user.email,
        orgName: data.org.name,
      },
    });

    spinner.succeed('Device connected!');
    console.log(`\nLinked to: ${chalk.cyan(data.user.email)} (${data.org.name})`);
    console.log(`Device: ${chalk.dim(deviceName)}\n`);
    console.log(`Now run ${chalk.cyan('claudometer collect')} to sync OpenClaw metrics.\n`);
  } catch (error) {
    spinner.fail('Failed to connect');
    console.log(chalk.red(`\nError: ${error.message}`));
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
