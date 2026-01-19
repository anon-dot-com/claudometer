import { getConfig, updateConfig } from './config.js';

export async function reportMetrics(metrics) {
  const config = await getConfig();

  if (!config.token) {
    throw new Error('Not authenticated. Run `claudometer login` first.');
  }

  const response = await fetch(`${config.apiUrl}/api/metrics`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.token}`,
    },
    body: JSON.stringify({
      timestamp: new Date().toISOString(),
      claude: metrics.claude,
      git: metrics.git,
    }),
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Authentication expired. Run `claudometer login` again.');
    }
    const error = await response.text();
    throw new Error(`Server error: ${response.status} ${error}`);
  }

  // Update last run time
  await updateConfig({
    daemon: {
      ...config.daemon,
      lastRun: new Date().toISOString(),
    },
  });

  return response.json();
}
