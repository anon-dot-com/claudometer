import chalk from 'chalk';
import ora from 'ora';
import open from 'open';
import { createServer } from 'http';
import { saveConfig, getConfig } from '../config.js';

const DEFAULT_API_URL = process.env.CLAUDOMETER_API_URL || 'https://api.claudometer.ai';
const DEFAULT_DASHBOARD_URL = process.env.CLAUDOMETER_DASHBOARD_URL || 'https://www.claudometer.ai';

export async function loginCommand() {
  console.log(chalk.bold('\n🔐 Claudometer Login\n'));

  const config = await getConfig();

  if (config.token) {
    console.log(chalk.yellow(`Already logged in as ${config.user?.email}`));
    console.log(`\nRun ${chalk.cyan('claudometer logout')} to sign out first.\n`);
    return;
  }

  // Start local server to receive OAuth callback
  const port = await findAvailablePort(9876);
  const callbackUrl = `http://localhost:${port}/callback`;

  console.log('Opening browser for authentication...');
  console.log(chalk.dim(`Callback URL: ${callbackUrl}\n`));

  const spinner = ora('Waiting for authentication...').start();

  try {
    const authResult = await waitForAuth(port);

    spinner.succeed('Authentication successful!');

    // Save the config
    await saveConfig({
      token: authResult.token,
      refreshToken: authResult.refreshToken || null,
      user: {
        id: authResult.user.id,
        email: authResult.user.email,
        name: authResult.user.name,
      },
      apiUrl: DEFAULT_API_URL,
    });

    console.log(chalk.green(`\n✓ Logged in as ${authResult.user.email}`));
    console.log(`\nRun ${chalk.cyan('claudometer collect')} to sync your metrics.\n`);
  } catch (error) {
    spinner.fail('Authentication failed');
    console.log(chalk.red(`\nError: ${error.message}`));
    console.log('Please try again.\n');
  }
}

async function waitForAuth(port) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      server.close();
      reject(new Error('Authentication timed out'));
    }, 120000); // 2 minute timeout

    const server = createServer((req, res) => {
      const url = new URL(req.url, `http://localhost:${port}`);

      if (url.pathname === '/callback') {
        const token = url.searchParams.get('token');
        const refreshToken = url.searchParams.get('refresh_token');
        const userJson = url.searchParams.get('user');
        const error = url.searchParams.get('error');

        if (error) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(getErrorHtml(error));
          clearTimeout(timeout);
          server.close();
          reject(new Error(error));
          return;
        }

        if (token && userJson) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(getSuccessHtml());
          clearTimeout(timeout);
          server.close();

          resolve({
            token,
            refreshToken,
            user: JSON.parse(decodeURIComponent(userJson)),
          });
        } else {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end(getErrorHtml('Missing authentication data'));
        }
      } else {
        res.writeHead(404);
        res.end('Not found');
      }
    });

    server.listen(port, () => {
      // Open the browser to the dashboard CLI auth page
      const loginUrl = `${DEFAULT_DASHBOARD_URL}/cli-auth?callback=${encodeURIComponent(
        `http://localhost:${port}/callback`
      )}`;
      open(loginUrl);
    });
  });
}

async function findAvailablePort(startPort) {
  const net = await import('net');

  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(startPort, () => {
      server.close(() => resolve(startPort));
    });
    server.on('error', () => {
      resolve(findAvailablePort(startPort + 1));
    });
  });
}

function getSuccessHtml() {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Claudometer - Login Successful</title>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #0f0f0f; color: #fff; }
    .container { text-align: center; }
    h1 { color: #22c55e; }
    p { color: #888; }
  </style>
</head>
<body>
  <div class="container">
    <h1>✓ Login Successful</h1>
    <p>You can close this window and return to your terminal.</p>
  </div>
</body>
</html>`;
}

function getErrorHtml(error) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Claudometer - Login Failed</title>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #0f0f0f; color: #fff; }
    .container { text-align: center; }
    h1 { color: #ef4444; }
    p { color: #888; }
  </style>
</head>
<body>
  <div class="container">
    <h1>✗ Login Failed</h1>
    <p>${error}</p>
    <p>Please close this window and try again.</p>
  </div>
</body>
</html>`;
}
