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
      limit: 100,
    });

    console.log(`[Clerk Sync] ${orgName} (${orgId}): Clerk returned ${memberships.data.length} members (totalCount: ${memberships.totalCount})`);

    // Ensure org exists
    await db.query(
      `INSERT INTO organizations (id, name)
       VALUES ($1, $2)
       ON CONFLICT (id) DO UPDATE SET name = $2, updated_at = NOW()`,
      [orgId, orgName || 'Unknown Organization']
    );

    let synced = 0;
    let skipped = 0;
    const syncedUserIds = [];

    // Create/update user and membership for each member
    for (const membership of memberships.data) {
      const userId = membership.publicUserData?.userId;
      if (!userId) {
        skipped++;
        console.log(`[Clerk Sync] Skipping member with no userId:`, JSON.stringify(membership.publicUserData));
        continue;
      }

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

      synced++;
      syncedUserIds.push(userId);
    }

    console.log(`[Clerk Sync] ${orgName}: synced ${synced}/${memberships.totalCount} members, skipped ${skipped}`);
    console.log(`[Clerk Sync] ${orgName}: user IDs synced: ${syncedUserIds.join(', ')}`);

    // Verify memberships in database
    const dbCheck = await db.query(
      `SELECT COUNT(*) as count FROM user_org_memberships WHERE org_id = $1`,
      [orgId]
    );
    console.log(`[Clerk Sync] ${orgName}: ${dbCheck.rows[0].count} memberships in database for this org`);
  } catch (error) {
    console.error('[Clerk Sync] Failed:', error.message);
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

  // Upsert daily metrics (source defaults to 'claude_code')
  for (const [date, data] of Object.entries(dailyData)) {
    await db.query(
      `INSERT INTO daily_metrics (
        user_id, org_id, date, source,
        claude_sessions, claude_messages, claude_tokens, claude_tool_calls,
        git_commits, git_lines_added, git_lines_deleted
      ) VALUES ($1, $2, $3, 'claude_code', $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (user_id, date, source) DO UPDATE SET
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
// Returns total value plus breakdown by source (first_party = claude_code, third_party = openclaw, etc.)
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
        COALESCE(SUM(CASE WHEN d.source = 'claude_code' THEN d.${metric} ELSE 0 END), 0) as first_party,
        COALESCE(SUM(CASE WHEN d.source != 'claude_code' THEN d.${metric} ELSE 0 END), 0) as third_party,
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

  // Org scope: find users who are either:
  // 1. Clerk members of this org (from user_org_memberships - populated by syncOrgMembersFromClerk)
  // 2. Have synced metrics for this org (from daily_metrics - fallback if Clerk sync fails)
  // 3. Have current org_id set to this org (from users table - covers most common case)

  // Debug: check each source
  const membershipCount = await db.query(
    `SELECT COUNT(*) as count FROM user_org_memberships WHERE org_id = $1`,
    [orgId]
  );
  const metricsCount = await db.query(
    `SELECT COUNT(DISTINCT user_id) as count FROM daily_metrics WHERE org_id = $1`,
    [orgId]
  );
  const usersCount = await db.query(
    `SELECT COUNT(*) as count FROM users WHERE org_id = $1`,
    [orgId]
  );
  console.log(`[Leaderboard] User sources for ${orgId}: memberships=${membershipCount.rows[0].count}, metrics=${metricsCount.rows[0].count}, users=${usersCount.rows[0].count}`);

  const result = await db.query(
    `SELECT
      u.id, u.name, u.email,
      COALESCE(SUM(d.${metric}), 0) as value,
      COALESCE(SUM(CASE WHEN d.source = 'claude_code' THEN d.${metric} ELSE 0 END), 0) as first_party,
      COALESCE(SUM(CASE WHEN d.source != 'claude_code' THEN d.${metric} ELSE 0 END), 0) as third_party,
      MAX(d.updated_at) as reported_at
     FROM users u
     LEFT JOIN daily_metrics d ON u.id = d.user_id AND ${dateFilter}
     WHERE u.id IN (
       SELECT user_id FROM user_org_memberships WHERE org_id = $1
       UNION
       SELECT DISTINCT user_id FROM daily_metrics WHERE org_id = $1
       UNION
       SELECT id FROM users WHERE org_id = $1
     )
     GROUP BY u.id, u.name, u.email
     ORDER BY value DESC
     LIMIT $2`,
    [orgId, limit]
  );

  console.log(`[Leaderboard] Query returned ${result.rows.length} users for org ${orgId}`);
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

  // First check if user has any data at all (ignoring date filter)
  // This ensures we show the dashboard with zeros rather than the empty state
  // if the user has historical data but none for the selected period
  const countResult = await db.query(
    `SELECT COUNT(*) as count FROM daily_metrics WHERE user_id = $1`,
    [userId]
  );

  if (parseInt(countResult.rows[0].count) === 0) {
    return null;
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

// Get user daily activity broken down by source (first-party vs third-party)
export async function getUserDailyActivityBySource(userId, days = 30) {
  const result = await db.query(
    `SELECT
      date,
      source,
      COALESCE(SUM(claude_messages), 0) as claude_messages,
      COALESCE(SUM(claude_tokens), 0) as claude_tokens,
      COALESCE(SUM(git_commits), 0) as git_commits,
      COALESCE(SUM(git_lines_added), 0) as git_lines_added
     FROM daily_metrics
     WHERE user_id = $1 AND date >= CURRENT_DATE - INTERVAL '${days} days'
     GROUP BY date, source
     ORDER BY date, source`,
    [userId]
  );

  // Transform into a more useful format: { date, first_party: {...}, third_party: {...} }
  const byDate = {};
  for (const row of result.rows) {
    const dateStr = row.date.toISOString().split('T')[0];
    if (!byDate[dateStr]) {
      byDate[dateStr] = {
        date: dateStr,
        first_party: { claude_messages: 0, claude_tokens: 0, git_commits: 0, git_lines_added: 0 },
        third_party: { claude_messages: 0, claude_tokens: 0, git_commits: 0, git_lines_added: 0 },
        total: { claude_messages: 0, claude_tokens: 0, git_commits: 0, git_lines_added: 0 },
      };
    }

    const isFirstParty = row.source === 'claude_code';
    const target = isFirstParty ? 'first_party' : 'third_party';

    byDate[dateStr][target].claude_messages += parseInt(row.claude_messages) || 0;
    byDate[dateStr][target].claude_tokens += parseInt(row.claude_tokens) || 0;
    byDate[dateStr][target].git_commits += parseInt(row.git_commits) || 0;
    byDate[dateStr][target].git_lines_added += parseInt(row.git_lines_added) || 0;

    // Also update totals
    byDate[dateStr].total.claude_messages += parseInt(row.claude_messages) || 0;
    byDate[dateStr].total.claude_tokens += parseInt(row.claude_tokens) || 0;
    byDate[dateStr].total.git_commits += parseInt(row.git_commits) || 0;
    byDate[dateStr].total.git_lines_added += parseInt(row.git_lines_added) || 0;
  }

  return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
}

// Join request queries
export async function createJoinRequest(userId, userEmail, userName, orgId) {
  const result = await db.query(
    `INSERT INTO join_requests (user_id, user_email, user_name, org_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, org_id) DO UPDATE SET
       user_email = $2,
       user_name = $3,
       status = CASE WHEN join_requests.status = 'denied' THEN 'pending' ELSE join_requests.status END,
       requested_at = CASE WHEN join_requests.status = 'denied' THEN NOW() ELSE join_requests.requested_at END
     RETURNING *`,
    [userId, userEmail, userName, orgId]
  );
  return result.rows[0];
}

export async function getJoinRequestsForOrg(orgId, status = 'pending') {
  const result = await db.query(
    `SELECT * FROM join_requests
     WHERE org_id = $1 AND status = $2
     ORDER BY requested_at DESC`,
    [orgId, status]
  );
  return result.rows;
}

export async function getJoinRequestByUserAndOrg(userId, orgId) {
  const result = await db.query(
    `SELECT * FROM join_requests
     WHERE user_id = $1 AND org_id = $2`,
    [userId, orgId]
  );
  return result.rows[0];
}

export async function updateJoinRequestStatus(requestId, status, resolvedBy) {
  const result = await db.query(
    `UPDATE join_requests
     SET status = $2, resolved_at = NOW(), resolved_by = $3
     WHERE id = $1
     RETURNING *`,
    [requestId, status, resolvedBy]
  );
  return result.rows[0];
}

export async function getOrgById(orgId) {
  const result = await db.query(
    `SELECT * FROM organizations WHERE id = $1`,
    [orgId]
  );
  return result.rows[0];
}

// Device token functions for external tool authentication

// Generate a random token ID
function generateTokenId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'clm_';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Generate a 6-character linking code
function generateLinkingCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Excluded ambiguous chars: 0, O, I, 1
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Create a linking code for device pairing
export async function createLinkingCode(userId, orgId) {
  const code = generateLinkingCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  await db.query(
    `INSERT INTO linking_codes (code, user_id, org_id, expires_at)
     VALUES ($1, $2, $3, $4)`,
    [code, userId, orgId, expiresAt]
  );

  return { code, expiresAt };
}

// Validate and consume a linking code, creating a device token
export async function consumeLinkingCode(code, deviceName, source = 'openclaw') {
  // Find valid, unused code
  const codeResult = await db.query(
    `SELECT * FROM linking_codes
     WHERE code = $1
       AND used_at IS NULL
       AND expires_at > NOW()`,
    [code.toUpperCase()]
  );

  if (codeResult.rows.length === 0) {
    return { error: 'Invalid or expired code' };
  }

  const linkingCode = codeResult.rows[0];

  // Create device token
  const tokenId = generateTokenId();
  await db.query(
    `INSERT INTO device_tokens (id, user_id, org_id, device_name, source)
     VALUES ($1, $2, $3, $4, $5)`,
    [tokenId, linkingCode.user_id, linkingCode.org_id, deviceName, source]
  );

  // Mark code as used
  await db.query(
    `UPDATE linking_codes
     SET used_at = NOW(), device_token_id = $2
     WHERE code = $1`,
    [code.toUpperCase(), tokenId]
  );

  // Get user info to return
  const userResult = await db.query(
    `SELECT u.email, u.name, o.name as org_name
     FROM users u
     JOIN organizations o ON u.org_id = o.id
     WHERE u.id = $1`,
    [linkingCode.user_id]
  );

  return {
    token: tokenId,
    userId: linkingCode.user_id,
    orgId: linkingCode.org_id,
    email: userResult.rows[0]?.email,
    name: userResult.rows[0]?.name,
    orgName: userResult.rows[0]?.org_name,
  };
}

// Validate a device token and return user/org info
export async function validateDeviceToken(tokenId) {
  const result = await db.query(
    `SELECT dt.*, u.email, u.name, o.name as org_name
     FROM device_tokens dt
     JOIN users u ON dt.user_id = u.id
     JOIN organizations o ON dt.org_id = o.id
     WHERE dt.id = $1 AND dt.revoked_at IS NULL`,
    [tokenId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  // Update last_used_at
  await db.query(
    `UPDATE device_tokens SET last_used_at = NOW() WHERE id = $1`,
    [tokenId]
  );

  return result.rows[0];
}

// List device tokens for a user
export async function listDeviceTokens(userId) {
  const result = await db.query(
    `SELECT id, device_name, source, last_used_at, created_at
     FROM device_tokens
     WHERE user_id = $1 AND revoked_at IS NULL
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
     RETURNING *`,
    [tokenId, userId]
  );
  return result.rows[0];
}

// Save external metrics (from OpenClaw, Cursor, etc.)
export async function saveExternalMetrics(userId, orgId, source, metrics) {
  const result = await db.query(
    `INSERT INTO metrics_snapshots (
      user_id, org_id, reported_at, source,
      claude_sessions, claude_messages, claude_input_tokens, claude_output_tokens,
      claude_cache_read_tokens, claude_cache_creation_tokens, claude_tool_calls, claude_by_model
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    RETURNING id`,
    [
      userId,
      orgId,
      metrics.timestamp || new Date().toISOString(),
      source,
      metrics.usage?.sessions || 0,
      metrics.usage?.messages || 0,
      metrics.usage?.input_tokens || 0,
      metrics.usage?.output_tokens || 0,
      metrics.usage?.cache_read_tokens || 0,
      metrics.usage?.cache_creation_tokens || 0,
      metrics.usage?.tool_calls || 0,
      JSON.stringify(metrics.usage?.models || {}),
    ]
  );

  // Save daily metrics with source
  await saveExternalDailyMetrics(userId, orgId, source, metrics);

  return result.rows[0];
}

// Save external daily metrics
async function saveExternalDailyMetrics(userId, orgId, source, metrics) {
  // Process daily data if provided
  for (const day of metrics.daily || []) {
    if (!day.date) continue;

    const tokens = (day.input_tokens || 0) + (day.output_tokens || 0);

    await db.query(
      `INSERT INTO daily_metrics (
        user_id, org_id, date, source,
        claude_sessions, claude_messages, claude_tokens, claude_tool_calls
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (user_id, date, source) DO UPDATE SET
        claude_sessions = daily_metrics.claude_sessions + $5,
        claude_messages = daily_metrics.claude_messages + $6,
        claude_tokens = daily_metrics.claude_tokens + $7,
        claude_tool_calls = daily_metrics.claude_tool_calls + $8,
        updated_at = NOW()`,
      [
        userId, orgId, day.date, source,
        day.sessions || 0,
        day.messages || 0,
        tokens,
        day.tool_calls || 0,
      ]
    );
  }

  // If no daily data provided, create/update today's entry with totals
  if (!metrics.daily || metrics.daily.length === 0) {
    const today = new Date().toISOString().split('T')[0];
    const tokens = (metrics.usage?.input_tokens || 0) + (metrics.usage?.output_tokens || 0);

    await db.query(
      `INSERT INTO daily_metrics (
        user_id, org_id, date, source,
        claude_sessions, claude_messages, claude_tokens, claude_tool_calls
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (user_id, date, source) DO UPDATE SET
        claude_sessions = $5,
        claude_messages = $6,
        claude_tokens = $7,
        claude_tool_calls = $8,
        updated_at = NOW()`,
      [
        userId, orgId, today, source,
        metrics.usage?.sessions || 0,
        metrics.usage?.messages || 0,
        tokens,
        metrics.usage?.tool_calls || 0,
      ]
    );
  }
}

// Get user metrics by source
export async function getUserMetricsBySource(userId, period = 'all') {
  const dateFilter = buildDateFilter(period).replace('d.date', 'date');

  const result = await db.query(
    `SELECT
      source,
      COALESCE(SUM(claude_sessions), 0) as claude_sessions,
      COALESCE(SUM(claude_messages), 0) as claude_messages,
      COALESCE(SUM(claude_tokens), 0) as claude_tokens,
      COALESCE(SUM(claude_tool_calls), 0) as claude_tool_calls
     FROM daily_metrics
     WHERE user_id = $1 AND ${dateFilter}
     GROUP BY source`,
    [userId]
  );
  return result.rows;
}

// Upsert daily metrics idempotently (replaces values instead of accumulating)
// This is used for Option A: reading from source (JSONL transcripts) and sending daily summaries
// The key is (user_id, date, source) - if the same date is reported twice, it replaces the values
export async function upsertDailyMetricsIdempotent(userId, orgId, source, date, metrics) {
  const tokens = (metrics.input_tokens || 0) + (metrics.output_tokens || 0);

  const result = await db.query(
    `INSERT INTO daily_metrics (
      user_id, org_id, date, source,
      claude_sessions, claude_messages, claude_tokens, claude_tool_calls
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT (user_id, date, source) DO UPDATE SET
      org_id = $2,
      claude_sessions = $5,
      claude_messages = $6,
      claude_tokens = $7,
      claude_tool_calls = $8,
      updated_at = NOW()
    RETURNING *`,
    [
      userId,
      orgId,
      date,
      source,
      metrics.sessions || 0,
      metrics.messages || 0,
      tokens,
      metrics.tool_calls || 0,
    ]
  );
  return result.rows[0];
}

export default db;
