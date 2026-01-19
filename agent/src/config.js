import Conf from 'conf';

// Production API URL - update this after deploying your backend
const PRODUCTION_API_URL = process.env.CLAUDOMETER_API_URL || 'https://api.claudometer.ai';

const config = new Conf({
  projectName: 'claudometer',
  schema: {
    token: { type: 'string' },
    refreshToken: { type: 'string', nullable: true },
    user: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        email: { type: 'string' },
        name: { type: 'string' },
      },
    },
    org: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
      },
    },
    apiUrl: { type: 'string', default: PRODUCTION_API_URL },
    daemon: {
      type: 'object',
      properties: {
        running: { type: 'boolean' },
        pid: { type: 'number' },
        interval: { type: 'number' },
        startedAt: { type: 'string' },
        stoppedAt: { type: 'string' },
        lastRun: { type: 'string' },
      },
    },
  },
});

export async function getConfig() {
  return config.store;
}

export async function saveConfig(newConfig) {
  config.store = newConfig;
}

export async function clearConfig() {
  config.clear();
}

export async function updateConfig(updates) {
  for (const [key, value] of Object.entries(updates)) {
    config.set(key, value);
  }
}

export function getConfigPath() {
  return config.path;
}
