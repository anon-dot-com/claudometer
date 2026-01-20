import pg from 'pg';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { clerk } from '../middleware/auth.js';

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

    // Migrate existing org memberships from users and daily_metrics
    await migrateOrgMemberships();
  } catch (error) {
    console.error('Failed to initialize database:', error.message);
    throw error;
  }
}

// Migrate existing data to user_org_memberships table
async function migrateOrgMemberships() {
  try {
    // Insert memberships from users.org_id (current org)
    await db.query(`
      INSERT INTO user_org_memberships (user_id, org_id)
      SELECT id, org_id FROM users WHERE org_id IS NOT NULL
      ON CONFLICT (user_id, org_id) DO NOTHING
    `);

    // Insert memberships from daily_metrics (historical orgs where user recorded data)
    await db.query(`
      INSERT INTO user_org_memberships (user_id, org_id)
      SELECT DISTINCT user_id, org_id FROM daily_metrics
      ON CONFLICT (user_id, org_id) DO NOTHING
    `);

    console.log('Org memberships migrated');
  } catch (error) {
    console.error('Failed to migrate org memberships:', error.message);
    // Don't throw - this is a best-effort migration
  }
}

// Ensure user org membership exists (for users who haven't synced yet)
export async function ensureOrgMembership(userId, orgId) {
  if (!userId || !orgId) return;
  await db.query(
    `INSERT INTO user_org_memberships (user_id, org_id)
     VALUES ($1, $2)
     ON CONFLICT (user_id, org_id) DO NOTHING`,
    [userId, orgId]
  );
}

// Sync all org members from Clerk to database
// This ensures we have records for all org members, even if they haven't synced metrics yet
export async function syncOrgMembersFromClerk(orgId, orgName) {
  if (!orgId) return;

  try {
    // Fetch all org members from Clerk
    const memberships = await clerk.organizations.getOrganizationMembershipList({
      organizationId: orgId,
      limit: 100, // Clerk's max per page
    });

    // Ensure org exists
    await db.query(
      `INSERT INTO organizations (id, name)
       VALUES ($1, $2)
       ON CONFLICT (id) DO UPDATE SET name = $2, updated_at = NOW()`,
      [orgId, orgName || 'Unknown Organization']
    );

    // Create/update user and membership for each member
    for (const membership of memberships.data) {
      const userId = membership.publicUserData?.userId;
      if (!userId) continue;

      const email = membership.publicUserData?.identifier || '';
      const firstName = membership.publicUserData?.firstName || '';
      const lastName = membership.publicUserData?.lastName || '';
      const name = `${firstName} ${lastName}`.trim() || email.split('@')[0];

      // Create/update user
      await db.query(
        `INSERT INTO users (id, email, name, org_id)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO UPDATE SET
           email = COALESCE(NULLIF($2, ''), users.email),
           name = COALESCE(NULLIF($3, ''), users.name),
           updated_at = NOW()`,
        [userId, email, name, orgId]
      );

      // Create membership
      await db.query(
        `INSERT INTO user_org_memberships (user_id, org_id)
         VALUES ($1, $2)
         ON CONFLICT (user_id, org_id) DO NOTHING`,
        [userId, orgId]
      );
    }

    console.log(`Synced ${memberships.data.length} members for org ${orgId}`);
  } catch (error) {
    console.error('Failed to sync org members from Clerk:', error.message);
    // Don't throw - this is a best-effort sync
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

  // Also add org membership (if not already exists)
  if (orgId) {
    await db.query(
      `INSERT INTO user_org_memberships (user_id, org_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, org_id) DO NOTHING`,
      [id, orgId]
    );
  }

  return result.rows[0];
}

// Metrics queries
export async function saveMetricsSnapshot(userId, orgId, metrics) {
  const result = await db.query(
    `INSERT INTO metrics_snapshots (
      user_id, org_id, reported_at, stats_cache_updated_at,
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
      metrics.claude?.lastComputedDate || null,
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
  await saveDailyMetrics(userId, orgId, metrics);

  return result.rows[0];
}

// Save daily metrics from CLI data
async function saveDailyMetrics(userId, orgId, metrics) {
  // Combine Claude daily data and Git daily data
  const dailyData = {};

  // Process Claude daily data
  for (const day of metrics.claude?.daily || []) {
    if (!day.date) continue;
    if (!dailyData[day.date]) {
      dailyData[day.date] = {
        claude_sessions: 0,
        claude_messages: 0,
        claude_tokens: 0,
        claude_tool_calls: 0,
        git_commits: 0,
        git_lines_added: 0,
        git_lines_deleted: 0,
      };
    }
    dailyData[day.date].claude_sessions += day.sessions || 0;
    dailyData[day.date].claude_messages += day.messages || 0;
    dailyData[day.date].claude_tokens += day.tokens || 0;
    dailyData[day.date].claude_tool_calls += day.toolCalls || 0;
  }

  // Process Git daily data
  for (const day of metrics.git?.dailyArray || []) {
    if (!day.date) continue;
    if (!dailyData[day.date]) {
      dailyData[day.date] = {
        claude_sessions: 0,
        claude_messages: 0,
        claude_tokens: 0,
        claude_tool_calls: 0,
        git_commits: 0,
        git_lines_added: 0,
        git_lines_deleted: 0,
      };
    }
    dailyData[day.date].git_commits += day.commits || 0;
    dailyData[day.date].git_lines_added += day.linesAdded || 0;
    dailyData[day.date].git_lines_deleted += day.linesDeleted || 0;
  }

  // Upsert daily metrics
  for (const [date, data] of Object.entries(dailyData)) {
    await db.query(
      `INSERT INTO daily_metrics (
        user_id, org_id, date,
        claude_sessions, claude_messages, claude_tokens, claude_tool_calls,
        git_commits, git_lines_added, git_lines_deleted
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (user_id, date) DO UPDATE SET
        claude_sessions = $4,
        claude_messages = $5,
        claude_tokens = $6,
        claude_tool_calls = $7,
        git_commits = $8,
        git_lines_added = $9,
        git_lines_deleted = $10,
        updated_at = NOW()`,
      [
        userId, orgId, date,
        data.claude_sessions,
        data.claude_messages,
        data.claude_tokens,
        data.claude_tool_calls,
        data.git_commits,
        data.git_lines_added,
        data.git_lines_deleted,
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

// Get user's latest sync info (for displaying timestamps)
export async function getUserLatestSyncInfo(userId) {
  const result = await db.query(
    `SELECT reported_at, stats_cache_updated_at, created_at
     FROM metrics_snapshots
     WHERE user_id = $1
     ORDER BY reported_at DESC
     LIMIT 1`,
    [userId]
  );
  return result.rows[0];
}

// Helper to build date filter for metrics queries
function buildDateFilter(period) {
  const localDate = "(NOW() AT TIME ZONE 'America/Los_Angeles')::date";

  switch (period) {
    case 'today':
      return `d.date = ${localDate}`;
    case 'week':
      return `d.date >= ${localDate} - INTERVAL '7 days'`;
    case 'month':
      return `d.date >= ${localDate} - INTERVAL '30 days'`;
    case 'all':
      return 'TRUE';
    default:
      return `d.date >= ${localDate} - INTERVAL '30 days'`;
  }
}

// Get org leaderboard with time period support
// Uses daily_metrics as the single source of truth for ALL periods
export async function getOrgLeaderboard(orgId, metric = 'claude_tokens', limit = 10, period = 'all', scope = 'org') {
  const allowedMetrics = [
    'claude_tokens',
    'claude_messages',
    'git_commits',
    'git_lines_added',
  ];

  if (!allowedMetrics.includes(metric)) {
    metric = 'claude_tokens';
  }

  const dateFilter = buildDateFilter(period);

  // Global scope: query all users across all orgs
  if (scope === 'global') {
    const result = await db.query(
      `SELECT
        u.id, u.name, u.email,
        COALESCE(SUM(d.${metric}), 0) as value,
        MAX(d.updated_at) as reported_at
       FROM users u
       LEFT JOIN daily_metrics d ON u.id = d.user_id AND ${dateFilter}
       GROUP BY u.id, u.name, u.email
       HAVING COALESCE(SUM(d.${metric}), 0) > 0
       ORDER BY value DESC
       LIMIT $1`,
      [limit]
    );
    return result.rows;
  }

  // Org scope: find users who are members of this org, then sum ALL their metrics
  // Shows all org members, including those who haven't synced yet (with 0 values)
  const result = await db.query(
    `SELECT
      u.id, u.name, u.email,
      COALESCE(SUM(d.${metric}), 0) as value,
      MAX(d.updated_at) as reported_at
     FROM user_org_memberships m
     JOIN users u ON u.id = m.user_id
     LEFT JOIN daily_metrics d ON u.id = d.user_id AND ${dateFilter}
     WHERE m.org_id = $1
     GROUP BY u.id, u.name, u.email
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
      COALESCE(SUM(claude_tokens), 0) as claude_tokens,
      COALESCE(SUM(claude_tool_calls), 0) as claude_tool_calls,
      COALESCE(SUM(git_commits), 0) as git_commits,
      COALESCE(SUM(git_lines_added), 0) as git_lines_added,
      COALESCE(SUM(git_lines_deleted), 0) as git_lines_deleted,
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
      SUM(claude_tokens) as claude_tokens,
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

// Get user daily activity (for My Usage page)
export async function getUserDailyActivity(userId, days = 30) {
  const result = await db.query(
    `SELECT
      date,
      claude_messages,
      claude_tokens,
      git_commits,
      git_lines_added
     FROM daily_metrics
     WHERE user_id = $1 AND date >= CURRENT_DATE - INTERVAL '${days} days'
     ORDER BY date`,
    [userId]
  );
  return result.rows;
}

export default db;
