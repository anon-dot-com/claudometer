/**
 * Metrics Reporter for Claudometer
 *
 * Sends collected metrics to the Claudometer backend.
 */

import { ClaudometerConfig } from './config.js';
import { CollectedMetrics } from './collector.js';

class Reporter {
  /**
   * Report metrics to Claudometer
   */
  async report(config: ClaudometerConfig, metrics: CollectedMetrics): Promise<void> {
    const apiUrl = config.apiUrl || 'https://claudometer.ai';
    const deviceToken = config.deviceToken;

    if (!deviceToken) {
      throw new Error('No device token configured');
    }

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
