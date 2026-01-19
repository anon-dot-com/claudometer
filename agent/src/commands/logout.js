import chalk from 'chalk';
import { clearConfig, getConfig } from '../config.js';

export async function logoutCommand() {
  const config = await getConfig();

  if (!config.token) {
    console.log(chalk.yellow('\nNot logged in.\n'));
    return;
  }

  const email = config.user?.email;

  await clearConfig();

  console.log(chalk.green(`\n✓ Logged out from ${email}\n`));
}
