/**
 * Configuration types for Claudometer plugin
 */

export interface ClaudometerConfig {
  /**
   * Claudometer API URL
   * @default "https://claudometer.ai"
   */
  apiUrl?: string;

  /**
   * Device token for authentication
   * Obtain via 'claudometer link --generate' command
   */
  deviceToken?: string;

  /**
   * Minutes between automatic reports
   * @default 30
   */
  reportIntervalMinutes?: number;

  /**
   * Enable automatic reporting
   * @default true
   */
  enabled?: boolean;
}

export const config = {
  /**
   * Default configuration values
   */
  defaults: {
    apiUrl: 'https://claudometer.ai',
    reportIntervalMinutes: 30,
    enabled: true,
  } as ClaudometerConfig,

  /**
   * Validate configuration
   */
  validate(cfg: Partial<ClaudometerConfig>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (cfg.reportIntervalMinutes !== undefined) {
      if (cfg.reportIntervalMinutes < 5) {
        errors.push('reportIntervalMinutes must be at least 5');
      }
      if (cfg.reportIntervalMinutes > 1440) {
        errors.push('reportIntervalMinutes must be at most 1440 (24 hours)');
      }
    }

    if (cfg.apiUrl && !cfg.apiUrl.startsWith('http')) {
      errors.push('apiUrl must be a valid HTTP(S) URL');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  },
};
