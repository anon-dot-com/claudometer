import { getConfig, updateConfig } from './config.js';

/**
 * Reset daily metrics for the current user
 * This deletes all daily_metrics rows and allows re-syncing from scratch
 */
export async function resetMetrics(source = null) {
  const config = await getConfig();

  if (!config.token) {
    throw new Error('Not authenticated. Run `claudometer login` first.');
  }

  const url = new URL(`${config.apiUrl}/api/metrics/reset`);
  if (source) {
    url.searchParams.set('source', source);
  }

  const response = await fetch(url.toString(), {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${config.token}`,
    },
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Authentication expired. Run `claudometer login` again.');
    }
    const error = await response.text();
    throw new Error(`Server error: ${response.status} ${error}`);
  }

  return response.json();
}

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

/**
 * Report OpenClaw metrics using device token auth
 * Sends daily summaries to the idempotent endpoint for accurate tracking
 */
export async function reportOpenClawMetrics(openclawMetrics) {
  const config = await getConfig();

  if (!config.deviceToken) {
    throw new Error('No device token. Run `claudometer link` first.');
  }

  if (!openclawMetrics.daily || openclawMetrics.daily.length === 0) {
    console.log('No OpenClaw daily metrics to report');
    return;
  }

  let successCount = 0;
  let errorCount = 0;

  // Report each day's metrics via idempotent endpoint
  for (const day of openclawMetrics.daily) {
    try {
      const response = await fetch(`${config.apiUrl}/api/metrics/external/daily`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.deviceToken}`,
        },
        body: JSON.stringify({
          date: day.date,
          usage: {
            sessions: day.sessions || 0,
            messages: day.messages || 0,
            input_tokens: day.tokens || 0, // Combined tokens
            output_tokens: 0, // Already combined in day.tokens
            tool_calls: day.toolCalls || 0,
          },
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Device token invalid. Run `claudometer link` again.');
        }
        errorCount++;
        continue;
      }

      successCount++;
    } catch (error) {
      errorCount++;
      console.warn(`Failed to report ${day.date}:`, error.message);
    }
  }

  if (errorCount > 0 && successCount === 0) {
    throw new Error(`Failed to report any daily metrics (${errorCount} errors)`);
  }

  // Update last run time
  await updateConfig({
    daemon: {
      ...config.daemon,
      lastOpenClawRun: new Date().toISOString(),
    },
  });

  return { successCount, errorCount, total: openclawMetrics.daily.length };
}
