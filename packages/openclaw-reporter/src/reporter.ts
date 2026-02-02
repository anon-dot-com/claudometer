/**
 * Metrics Reporter for Claudometer
 *
 * Sends collected metrics to the Claudometer backend.
 * Supports daily summaries with idempotency for accurate side-by-side comparison.
 */

import { ClaudometerConfig } from './config.js';
import { CollectedMetrics } from './collector.js';

class Reporter {
  /**
   * Report metrics to Claudometer
   *
   * Uses Option A approach: sends each day's data separately with the date as
   * an idempotency key. This ensures accurate daily tracking even if the same
   * data is reported multiple times.
   *
   * The daily endpoint replaces values (not accumulates), so re-running is safe.
   * This mirrors how Claude Code's stats-cache.json is processed.
   */
  async report(config: ClaudometerConfig, metrics: CollectedMetrics): Promise<void> {
    const apiUrl = config.apiUrl || 'https://claudometer.ai';
    const deviceToken = config.deviceToken;

    if (!deviceToken) {
      throw new Error('No device token configured');
    }

    if (metrics.daily.length === 0) {
      console.log('[Claudometer] No daily metrics to report');
      return;
    }

    // Report daily summaries individually for idempotency
    // This allows re-running without double-counting
    let successCount = 0;
    let errorCount = 0;

    for (const day of metrics.daily) {
      try {
        await this.reportDailySummary(apiUrl, deviceToken, day);
        successCount++;
      } catch (error) {
        errorCount++;
        console.warn(`[Claudometer] Failed to report ${day.date}:`, error);
      }
    }

    console.log(`[Claudometer] Reported ${successCount}/${metrics.daily.length} days (${errorCount} errors)`);

    if (errorCount > 0 && successCount === 0) {
      throw new Error(`Failed to report any daily metrics (${errorCount} errors)`);
    }
  }

  /**
   * Report a single day's summary with the date as idempotency key
   */
  private async reportDailySummary(
    apiUrl: string,
    deviceToken: string,
    day: {
      date: string;
      sessions: number;
      messages: number;
      input_tokens: number;
      output_tokens: number;
      cache_read_tokens: number;
      cache_creation_tokens: number;
      tool_calls: number;
    }
  ): Promise<void> {
    const payload = {
      timestamp: `${day.date}T23:59:59Z`, // End of day
      date: day.date, // Idempotency key
      usage: {
        sessions: day.sessions,
        messages: day.messages,
        input_tokens: day.input_tokens,
        output_tokens: day.output_tokens,
        cache_read_tokens: day.cache_read_tokens,
        cache_creation_tokens: day.cache_creation_tokens,
        tool_calls: day.tool_calls,
      },
    };

    const response = await fetch(`${apiUrl}/api/metrics/external/daily`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${deviceToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'claudometer-openclaw-reporter/1.0.0',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      // Don't throw on 409 Conflict (idempotent retry)
      if (response.status !== 409) {
        console.warn(`[Claudometer] Failed to report daily summary for ${day.date}: ${error.error || response.statusText}`);
      }
    }
  }

  /**
   * Report cumulative totals (backwards compatibility)
   */
  private async reportTotals(
    apiUrl: string,
    deviceToken: string,
    metrics: CollectedMetrics
  ): Promise<void> {
    const response = await fetch(`${apiUrl}/api/metrics/external`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${deviceToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'claudometer-openclaw-reporter/1.0.0',
      },
      body: JSON.stringify(metrics),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(`Failed to report metrics: ${error.error || response.statusText}`);
    }

    const result = await response.json();

    if (!result.success) {
      throw new Error(`Report failed: ${result.error || 'Unknown error'}`);
    }
  }

  /**
   * Validate device token with server
   */
  async validateToken(config: ClaudometerConfig): Promise<{
    valid: boolean;
    user?: { email: string; name: string };
    org?: { id: string; name: string };
    error?: string;
  }> {
    const apiUrl = config.apiUrl || 'https://claudometer.ai';
    const deviceToken = config.deviceToken;

    if (!deviceToken) {
      return { valid: false, error: 'No device token configured' };
    }

    try {
      const response = await fetch(`${apiUrl}/auth/device/validate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${deviceToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        return { valid: false, error: 'Invalid or revoked token' };
      }

      const data = await response.json();

      return {
        valid: true,
        user: data.user,
        org: data.org,
      };
    } catch (error) {
      return {
        valid: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}

export const reporter = new Reporter();
