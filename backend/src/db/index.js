import pg from 'pg';
import crypto from 'crypto';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

export const db = {
  query: (text, params) => pool.query(text, params),
  getClient: () => pool.connect(),
};

// Initialize database schema
export async function initializeDatabase() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const schemaPath = join(__dirname, 'schema.sql');

  try {
    const schema = await readFile(schemaPath, 'utf-8');
    await pool.query(schema);
    console.log('Database schema initialized');
  } catch (error) {
    console.error('Failed to initialize database:', error.message);
    throw error;
  }
}

// Organization queries
export async function findOrCreateOrg(id, name) {
  const result = await db.query(
    `INSERT INTO organizations (id, name)
     VALUES ($1, $2)
     ON CONFLICT (id) DO UPDATE SET name = $2, updated_at = NOW()
     RETURNING *`,
    [id, name]
  );
  return result.rows[0];
}

// User queries
export async function findOrCreateUser(id, email, name, orgId) {
  const result = await db.query(
    `INSERT INTO users (id, email, name, org_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (id) DO UPDATE SET email = $2, name = $3, org_id = $4, updated_at = NOW()
     RETURNING *`,
    [id, email, name, orgId]
  );
  return result.rows[0];
}

// Metrics queries
export async function saveMetricsSnapshot(userId, orgId, metrics, source = 'cli') {
  const result = await db.query(
    `INSERT INTO metrics_snapshots (
      user_id, org_id, reported_at, source,
      claude_sessions, claude_messages, claude_input_tokens, claude_output_tokens,
      claude_cache_read_tokens, claude_cache_creation_tokens, claude_tool_calls, claude_by_model,
      git_repos_scanned, git_repos_contributed, git_commits, git_lines_added,
      git_lines_deleted, git_files_changed, git_by_repo
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
    RETURNING id`,
    [
      userId,
      orgId,
      metrics.timestamp,
      source,
      metrics.claude?.totals?.sessions || 0,
      metrics.claude?.totals?.messages || 0,
      metrics.claude?.totals?.inputTokens || 0,
      metrics.claude?.totals?.outputTokens || 0,
      metrics.claude?.totals?.cacheReadTokens || 0,
      metrics.claude?.totals?.cacheCreationTokens || 0,
      metrics.claude?.totals?.toolCalls || 0,
      JSON.stringify(metrics.claude?.byModel || {}),
      metrics.git?.reposScanned || 0,
      metrics.git?.reposContributed || 0,
      metrics.git?.totals?.commits || 0,
      metrics.git?.totals?.linesAdded || 0,
      metrics.git?.totals?.linesDeleted || 0,
      metrics.git?.totals?.filesChanged || 0,
      JSON.stringify(metrics.git?.byRepo || []),
    ]
  );

  // Save daily metrics
  await saveDailyMetrics(userId, orgId, metrics, source);

  return result.rows[0];
}

// Save daily metrics from CLI data
async function saveDailyMetrics(userId, orgId, metrics, source = 'cli') {
  // Combine Claude daily data and Git daily data
  const dailyData = {};

  // Process Claude daily data
  for (const day of metrics.claude?.daily || []) {
    if (!day.date) continue;
    if (!dailyData[day.date]) {
      dailyData[day.date] = {
        claude_sessions: 0,
        claude_messages: 0,
        claude_input_tokens: 0,
        claude_output_tokens: 0,
        claude_tool_calls: 0,
        git_commits: 0,
        git_lines_added: 0,
      };
    }
    dailyData[day.date].claude_sessions += day.sessions || 0;
    dailyData[day.date].claude_messages += day.messages || 0;
    dailyData[day.date].claude_output_tokens += day.tokens || 0;
    dailyData[day.date].claude_tool_calls += day.toolCalls || 0;
  }

  // Process Git daily data
  for (const day of metrics.git?.dailyArray || []) {
    if (!day.date) continue;
    if (!dailyData[day.date]) {
      dailyData[day.date] = {
        claude_sessions: 0,
        claude_messages: 0,
        claude_input_tokens: 0,
        claude_output_tokens: 0,
        claude_tool_calls: 0,
        git_commits: 0,
        git_lines_added: 0,
      };
    }
    dailyData[day.date].git_commits += day.commits || 0;
    dailyData[day.date].git_lines_added += day.linesAdded || 0;
  }

  // Upsert daily metrics
  for (const [date, data] of Object.entries(dailyData)) {
    await db.query(
      `INSERT INTO daily_metrics (
        user_id, org_id, date,
        claude_sessions, claude_messages, claude_input_tokens, claude_output_tokens, claude_tool_calls,
        git_commits, git_lines_added
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (user_id, date) DO UPDATE SET
        claude_sessions = $4,
        claude_messages = $5,
        claude_input_tokens = $6,
        claude_output_tokens = $7,
        claude_tool_calls = $8,
        git_commits = $9,
        git_lines_added = $10,
        updated_at = NOW()`,
      [
        userId, orgId, date,
        data.claude_sessions,
        data.claude_messages,
        data.claude_input_tokens,
        data.claude_output_tokens,
        data.claude_tool_calls,
        data.git_commits,
        data.git_lines_added,
      ]
    );
  }
}

// Get user's latest metrics
export async function getUserLatestMetrics(userId) {
  const result = await db.query(
    `SELECT * FROM metrics_snapshots
     WHERE user_id = $1
     ORDER BY reported_at DESC
     LIMIT 1`,
    [userId]
  );
  return result.rows[0];
}

// Get org leaderboard with time period support
// Uses daily_metrics as the single source of truth for ALL periods
export async function getOrgLeaderboard(orgId, metric = 'claude_output_tokens', limit = 10, period = 'all') {
  const allowedMetrics = [
    'claude_output_tokens',
    'claude_messages',
    'git_commits',
    'git_lines_added',
  ];

  if (!allowedMetrics.includes(metric)) {
    metric = 'claude_output_tokens';
  }

  // Use Pacific timezone for date comparisons to match user's local time
  const localDate = "(NOW() AT TIME ZONE 'America/Los_Angeles')::date";

  let dateFilter;
  switch (period) {
    case 'today':
      dateFilter = `date = ${localDate}`;
      break;
    case 'week':
      dateFilter = `date >= ${localDate} - INTERVAL '7 days'`;
      break;
    case 'month':
      dateFilter = `date >= ${localDate} - INTERVAL '30 days'`;
      break;
    case 'all':
      dateFilter = 'TRUE'; // No date filter - sum everything
      break;
    default:
      dateFilter = `date >= ${localDate} - INTERVAL '30 days'`;
  }

  const result = await db.query(
    `SELECT
      u.id, u.name, u.email,
      COALESCE(SUM(d.${metric}), 0) as value,
      MAX(d.updated_at) as reported_at
     FROM daily_metrics d
     JOIN users u ON u.id = d.user_id
     WHERE d.org_id = $1 AND ${dateFilter}
     GROUP BY u.id, u.name, u.email
     HAVING COALESCE(SUM(d.${metric}), 0) > 0
     ORDER BY value DESC
     LIMIT $2`,
    [orgId, limit]
  );
  return result.rows;
}

// Get user metrics by period
// Uses daily_metrics as the single source of truth for ALL periods
export async function getUserMetricsByPeriod(userId, period = 'all') {
  // Use Pacific timezone for date comparisons to match user's local time
  const localDate = "(NOW() AT TIME ZONE 'America/Los_Angeles')::date";

  let dateFilter;
  switch (period) {
    case 'today':
      dateFilter = `date = ${localDate}`;
      break;
    case 'week':
      dateFilter = `date >= ${localDate} - INTERVAL '7 days'`;
      break;
    case 'month':
      dateFilter = `date >= ${localDate} - INTERVAL '30 days'`;
      break;
    case 'all':
      dateFilter = 'TRUE'; // No date filter - sum everything
      break;
    default:
      dateFilter = `date >= ${localDate} - INTERVAL '30 days'`;
  }

  const result = await db.query(
    `SELECT
      COALESCE(SUM(claude_sessions), 0) as claude_sessions,
      COALESCE(SUM(claude_messages), 0) as claude_messages,
      COALESCE(SUM(claude_input_tokens), 0) as claude_input_tokens,
      COALESCE(SUM(claude_output_tokens), 0) as claude_output_tokens,
      COALESCE(SUM(claude_tool_calls), 0) as claude_tool_calls,
      COALESCE(SUM(git_commits), 0) as git_commits,
      COALESCE(SUM(git_lines_added), 0) as git_lines_added,
      MAX(updated_at) as reported_at
     FROM daily_metrics
     WHERE user_id = $1 AND ${dateFilter}`,
    [userId]
  );
  return result.rows[0];
}

// Get org daily activity
export async function getOrgDailyActivity(orgId, days = 30) {
  const result = await db.query(
    `SELECT
      date,
      SUM(claude_messages) as claude_messages,
      SUM(claude_output_tokens) as claude_output_tokens,
      SUM(git_commits) as git_commits,
      SUM(git_lines_added) as git_lines_added
     FROM daily_metrics
     WHERE org_id = $1 AND date >= CURRENT_DATE - INTERVAL '${days} days'
     GROUP BY date
     ORDER BY date`,
    [orgId]
  );
  return result.rows;
}

// ============================================
// Device Token & Linking Code Functions
// ============================================

// Generate a 6-character alphanumeric code (excluding confusing chars)
function generateLinkingCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(crypto.randomInt(chars.length));
  }
  return code;
}

// Hash a token for secure storage
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Create a new linking code (valid for 15 minutes)
export async function createLinkingCode(userId, orgId, deviceName = null) {
  const code = generateLinkingCode();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  const result = await db.query(
    `INSERT INTO linking_codes (code, user_id, org_id, device_name, expires_at)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [code, userId, orgId, deviceName, expiresAt]
  );
  return result.rows[0];
}

// Consume a linking code and return user/org info
export async function consumeLinkingCode(code) {
  const result = await db.query(
    `UPDATE linking_codes
     SET consumed_at = NOW()
     WHERE code = $1
       AND consumed_at IS NULL
       AND expires_at > NOW()
     RETURNING user_id, org_id, device_name`,
    [code.toUpperCase()]
  );
  return result.rows[0] || null;
}

// Create a new device token
export async function createDeviceToken(userId, orgId, deviceName) {
  const id = crypto.randomUUID();
  const token = crypto.randomBytes(32).toString('base64url');
  const tokenHash = hashToken(token);

  await db.query(
    `INSERT INTO device_tokens (id, user_id, org_id, token_hash, name)
     VALUES ($1, $2, $3, $4, $5)`,
    [id, userId, orgId, tokenHash, deviceName]
  );

  return { id, token, name: deviceName };
}

// Verify a device token and return user/org info (also updates last_used_at)
export async function verifyDeviceToken(token) {
  const tokenHash = hashToken(token);

  const result = await db.query(
    `UPDATE device_tokens
     SET last_used_at = NOW()
     WHERE token_hash = $1 AND revoked_at IS NULL
     RETURNING id, user_id, org_id, name`,
    [tokenHash]
  );
  return result.rows[0] || null;
}

// List user's device tokens
export async function listDeviceTokens(userId) {
  const result = await db.query(
    `SELECT id, name, created_at, last_used_at, revoked_at
     FROM device_tokens
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId]
  );
  return result.rows;
}

// Revoke a device token
export async function revokeDeviceToken(tokenId, userId) {
  const result = await db.query(
    `UPDATE device_tokens
     SET revoked_at = NOW()
     WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL
     RETURNING id`,
    [tokenId, userId]
  );
  return result.rows[0] || null;
}

export default db;
