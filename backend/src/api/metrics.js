import { Router } from 'express';
import {
  db,
  findOrCreateOrg,
  findOrCreateUser,
  saveMetricsSnapshot,
  getUserLatestMetrics,
  getUserMetricsByPeriod,
  getUserLatestSyncInfo,
  getOrgLeaderboard,
  getOrgDailyActivity,
  getUserDailyActivity,
  getUserDailyActivityBySource,
  syncOrgMembersFromClerk,
  validateDeviceToken,
  saveExternalMetrics,
  getUserMetricsBySource,
  upsertDailyMetricsIdempotent,
} from '../db/index.js';
import { clerk } from '../middleware/auth.js';

const router = Router();

// Normalize metrics from various sources to a common format
// Accepts:
//   - OpenClaw format: { input, output, cacheRead, cost: { total } }
//   - Claude Code format: { sessions, messages, inputTokens, outputTokens, cacheReadTokens, cacheCreationTokens, toolCalls }
//   - Legacy format: { usage: { sessions, messages, input_tokens, output_tokens, ... } }
function normalizeMetrics(rawMetrics) {
  // If already in the expected "usage" wrapper format
  if (rawMetrics.usage) {
    return {
      timestamp: rawMetrics.timestamp || new Date().toISOString(),
      usage: {
        sessions: rawMetrics.usage.sessions || 0,
        messages: rawMetrics.usage.messages || 0,
        input_tokens: rawMetrics.usage.input_tokens || rawMetrics.usage.inputTokens || 0,
        output_tokens: rawMetrics.usage.output_tokens || rawMetrics.usage.outputTokens || 0,
        cache_read_tokens: rawMetrics.usage.cache_read_tokens || rawMetrics.usage.cacheReadTokens || rawMetrics.usage.cacheRead || 0,
        cache_creation_tokens: rawMetrics.usage.cache_creation_tokens || rawMetrics.usage.cacheCreationTokens || rawMetrics.usage.cacheWrite || 0,
        tool_calls: rawMetrics.usage.tool_calls || rawMetrics.usage.toolCalls || 0,
        models: rawMetrics.usage.models || rawMetrics.usage.byModel || {},
      },
    };
  }

  // OpenClaw per-message format: { input, output, cacheRead, cost }
  if ('input' in rawMetrics || 'output' in rawMetrics) {
    return {
      timestamp: rawMetrics.timestamp || new Date().toISOString(),
      usage: {
        sessions: rawMetrics.sessions || 0,
        messages: rawMetrics.messages || 1, // At least 1 message if we have token data
        input_tokens: rawMetrics.input || 0,
        output_tokens: rawMetrics.output || 0,
        cache_read_tokens: rawMetrics.cacheRead || 0,
        cache_creation_tokens: rawMetrics.cacheWrite || 0,
        tool_calls: rawMetrics.toolCalls || 0,
        models: rawMetrics.models || rawMetrics.byModel || {},
      },
    };
  }

  // Claude Code totals format: { sessions, messages, inputTokens, outputTokens, ... }
  if ('inputTokens' in rawMetrics || 'outputTokens' in rawMetrics) {
    return {
      timestamp: rawMetrics.timestamp || rawMetrics.collectedAt || new Date().toISOString(),
      usage: {
        sessions: rawMetrics.sessions || 0,
        messages: rawMetrics.messages || 0,
        input_tokens: rawMetrics.inputTokens || 0,
        output_tokens: rawMetrics.outputTokens || 0,
        cache_read_tokens: rawMetrics.cacheReadTokens || 0,
        cache_creation_tokens: rawMetrics.cacheCreationTokens || 0,
        tool_calls: rawMetrics.toolCalls || 0,
        models: rawMetrics.models || rawMetrics.byModel || {},
      },
    };
  }

  // Fallback: assume snake_case flat format
  return {
    timestamp: rawMetrics.timestamp || new Date().toISOString(),
    usage: {
      sessions: rawMetrics.sessions || 0,
      messages: rawMetrics.messages || 0,
      input_tokens: rawMetrics.input_tokens || 0,
      output_tokens: rawMetrics.output_tokens || 0,
      cache_read_tokens: rawMetrics.cache_read_tokens || 0,
      cache_creation_tokens: rawMetrics.cache_creation_tokens || 0,
      tool_calls: rawMetrics.tool_calls || 0,
      models: rawMetrics.models || {},
    },
  };
}

// Separate router for external metrics (uses device token auth, not Clerk)
export const externalMetricsRouter = Router();

externalMetricsRouter.post('/', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing authorization header' });
    }

    const token = authHeader.split(' ')[1];

    // Validate device token
    const device = await validateDeviceToken(token);
    if (!device) {
      return res.status(401).json({ error: 'Invalid or revoked device token' });
    }

    // Normalize metrics from any supported format
    const normalizedMetrics = normalizeMetrics(req.body);
    const source = device.source || 'openclaw';

    // Ensure org and user exist
    await findOrCreateOrg(device.org_id, device.org_name);
    await findOrCreateUser(device.user_id, device.email, device.name, device.org_id);

    // Save the external metrics
    const snapshot = await saveExternalMetrics(device.user_id, device.org_id, source, normalizedMetrics);

    res.json({
      success: true,
      snapshotId: snapshot.id,
      source,
      message: 'External metrics received',
      normalized: normalizedMetrics.usage, // Return normalized data for debugging
    });
  } catch (error) {
    console.error('Failed to save external metrics:', error);
    res.status(500).json({ error: 'Failed to save external metrics' });
  }
});

// POST /api/metrics/external/daily - Idempotent daily metrics upsert
// This endpoint is used by Option A: reading from JSONL transcripts and sending daily summaries
// The (user_id, date, source) combination acts as an idempotency key
// Re-sending the same date replaces the values instead of accumulating
externalMetricsRouter.post('/daily', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing authorization header' });
    }

    const token = authHeader.split(' ')[1];

    // Validate device token
    const device = await validateDeviceToken(token);
    if (!device) {
      return res.status(401).json({ error: 'Invalid or revoked device token' });
    }

    const { date, usage } = req.body;

    if (!date) {
      return res.status(400).json({ error: 'Missing required field: date' });
    }

    // Validate date format (YYYY-MM-DD)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: 'Invalid date format. Expected YYYY-MM-DD' });
    }

    const source = device.source || 'openclaw';

    // Ensure org and user exist
    await findOrCreateOrg(device.org_id, device.org_name);
    await findOrCreateUser(device.user_id, device.email, device.name, device.org_id);

    // Upsert the daily metrics (replaces existing values for this date)
    const result = await upsertDailyMetricsIdempotent(
      device.user_id,
      device.org_id,
      source,
      date,
      usage || {}
    );

    res.json({
      success: true,
      date,
      source,
      message: 'Daily metrics saved (idempotent)',
      metrics: {
        sessions: result.claude_sessions,
        messages: result.claude_messages,
        tokens: result.claude_tokens,
        tool_calls: result.claude_tool_calls,
      },
    });
  } catch (error) {
    console.error('Failed to save daily metrics:', error);
    res.status(500).json({ error: 'Failed to save daily metrics' });
  }
});

// GET /api/metrics/external/me - Get stats for the authenticated device's user
// Returns combined stats (first-party + third-party) with breakdown
externalMetricsRouter.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing authorization header' });
    }

    const token = authHeader.split(' ')[1];

    // Validate device token
    const device = await validateDeviceToken(token);
    if (!device) {
      return res.status(401).json({ error: 'Invalid or revoked device token' });
    }

    const userId = device.user_id;
    const orgId = device.org_id;

    // Get today's stats
    const todayResult = await db.query(
      `SELECT
        COALESCE(SUM(claude_tokens), 0) as tokens,
        COALESCE(SUM(claude_messages), 0) as messages,
        COALESCE(SUM(claude_sessions), 0) as sessions,
        COALESCE(SUM(CASE WHEN source = 'claude_code' THEN claude_tokens ELSE 0 END), 0) as first_party,
        COALESCE(SUM(CASE WHEN source != 'claude_code' THEN claude_tokens ELSE 0 END), 0) as third_party
       FROM daily_metrics
       WHERE user_id = $1 AND date = CURRENT_DATE`,
      [userId]
    );

    // Get this week's stats (last 7 days)
    const weekResult = await db.query(
      `SELECT
        COALESCE(SUM(claude_tokens), 0) as tokens,
        COALESCE(SUM(claude_messages), 0) as messages,
        COALESCE(SUM(claude_sessions), 0) as sessions,
        COALESCE(SUM(CASE WHEN source = 'claude_code' THEN claude_tokens ELSE 0 END), 0) as first_party,
        COALESCE(SUM(CASE WHEN source != 'claude_code' THEN claude_tokens ELSE 0 END), 0) as third_party
       FROM daily_metrics
       WHERE user_id = $1 AND date >= CURRENT_DATE - INTERVAL '7 days'`,
      [userId]
    );

    // Get all-time stats
    const totalResult = await db.query(
      `SELECT
        COALESCE(SUM(claude_tokens), 0) as tokens,
        COALESCE(SUM(claude_messages), 0) as messages,
        COALESCE(SUM(claude_sessions), 0) as sessions,
        COALESCE(SUM(CASE WHEN source = 'claude_code' THEN claude_tokens ELSE 0 END), 0) as first_party,
        COALESCE(SUM(CASE WHEN source != 'claude_code' THEN claude_tokens ELSE 0 END), 0) as third_party
       FROM daily_metrics
       WHERE user_id = $1`,
      [userId]
    );

    // Get user's rank in org (by total tokens)
    const rankResult = await db.query(
      `SELECT rank FROM (
        SELECT user_id, RANK() OVER (ORDER BY SUM(claude_tokens) DESC) as rank
        FROM daily_metrics
        WHERE org_id = $1
        GROUP BY user_id
      ) ranked
      WHERE user_id = $2`,
      [orgId, userId]
    );

    const today = todayResult.rows[0];
    const week = weekResult.rows[0];
    const total = totalResult.rows[0];
    const rank = rankResult.rows[0]?.rank || null;

    res.json({
      user: device.name,
      org: device.org_name,
      today: {
        tokens: parseInt(today.tokens),
        messages: parseInt(today.messages),
        sessions: parseInt(today.sessions),
        first_party: parseInt(today.first_party),
        third_party: parseInt(today.third_party),
      },
      week: {
        tokens: parseInt(week.tokens),
        messages: parseInt(week.messages),
        sessions: parseInt(week.sessions),
        first_party: parseInt(week.first_party),
        third_party: parseInt(week.third_party),
      },
      total: {
        tokens: parseInt(total.tokens),
        messages: parseInt(total.messages),
        sessions: parseInt(total.sessions),
        first_party: parseInt(total.first_party),
        third_party: parseInt(total.third_party),
      },
      rank: rank ? parseInt(rank) : null,
    });
  } catch (error) {
    console.error('Failed to get external metrics:', error);
    res.status(500).json({ error: 'Failed to get metrics' });
  }
});

// Helper to verify user is a member of an organization
async function verifyOrgMembership(userId, orgId) {
  try {
    const memberships = await clerk.users.getOrganizationMembershipList({
      userId,
    });
    return memberships.data.some(m => m.organization.id === orgId);
  } catch (error) {
    console.error('Failed to verify org membership:', error.message);
    return false;
  }
}

// POST /api/metrics - Receive metrics from CLI
router.post('/', async (req, res) => {
  try {
    const { userId, email, name, orgId, orgName } = req.auth;
    const metrics = req.body;

    // Ensure org and user exist
    await findOrCreateOrg(orgId, orgName);
    await findOrCreateUser(userId, email, name, orgId);

    // Save the metrics snapshot
    const snapshot = await saveMetricsSnapshot(userId, orgId, metrics);

    res.json({
      success: true,
      snapshotId: snapshot.id,
      message: 'Metrics received',
    });
  } catch (error) {
    console.error('Failed to save metrics:', error);
    res.status(500).json({ error: 'Failed to save metrics' });
  }
});

// GET /api/metrics/me - Get current user's metrics
router.get('/me', async (req, res) => {
  try {
    const { userId } = req.auth;
    console.log('GET /me - userId:', userId);
    const { period = 'all' } = req.query;
    const metrics = await getUserMetricsByPeriod(userId, period);
    const syncInfo = await getUserLatestSyncInfo(userId);

    if (!metrics) {
      return res.json({ metrics: null, message: 'No metrics reported yet' });
    }

    res.json({
      metrics,
      period,
      lastSynced: syncInfo?.reported_at || null,
      statsCacheUpdatedAt: syncInfo?.stats_cache_updated_at || null,
    });
  } catch (error) {
    console.error('Failed to get metrics:', error);
    res.status(500).json({ error: 'Failed to get metrics' });
  }
});

// GET /api/metrics/leaderboard - Get leaderboard (org or global based on scope param)
router.get('/leaderboard', async (req, res) => {
  try {
    const { userId, orgId: tokenOrgId, orgName: tokenOrgName } = req.auth;
    const { metric = 'claude_tokens', limit = 10, period = 'all', scope = 'org', orgId: requestedOrgId } = req.query;

    // Use requested orgId if provided, otherwise fall back to token's org
    let orgId = requestedOrgId || tokenOrgId;
    let orgName = tokenOrgName;

    // If a different org was requested, verify membership
    if (requestedOrgId && requestedOrgId !== tokenOrgId) {
      const isMember = await verifyOrgMembership(userId, requestedOrgId);
      if (!isMember) {
        console.log(`[Leaderboard] User ${userId} is not a member of org ${requestedOrgId}`);
        return res.status(403).json({ error: 'Not a member of this organization' });
      }
      orgId = requestedOrgId;
      // Fetch org name for the requested org
      try {
        const org = await clerk.organizations.getOrganization({ organizationId: requestedOrgId });
        orgName = org.name;
      } catch {
        orgName = 'Unknown';
      }
    }

    console.log(`[Leaderboard] Querying for org: ${orgId} (${orgName}), metric: ${metric}, period: ${period}`);

    // Sync all org members from Clerk before querying
    // This ensures we have records for all team members, not just those who have synced
    if (scope === 'org' && orgId) {
      await syncOrgMembersFromClerk(orgId, orgName);
    }

    const leaderboard = await getOrgLeaderboard(orgId, metric, parseInt(limit), period, scope);

    // Prevent browser caching - response varies by auth token (org context)
    res.set('Cache-Control', 'no-store');
    res.json({ leaderboard, metric, period, scope });
  } catch (error) {
    console.error('Failed to get leaderboard:', error);
    res.status(500).json({ error: 'Failed to get leaderboard' });
  }
});

// GET /api/metrics/activity - Get org daily activity
router.get('/activity', async (req, res) => {
  try {
    const { orgId } = req.auth;
    const { days = 30 } = req.query;

    const activity = await getOrgDailyActivity(orgId, parseInt(days));

    res.json({ activity });
  } catch (error) {
    console.error('Failed to get activity:', error);
    res.status(500).json({ error: 'Failed to get activity' });
  }
});

// GET /api/metrics/my-activity - Get current user's daily activity
router.get('/my-activity', async (req, res) => {
  try {
    const { userId } = req.auth;
    const { days = 30 } = req.query;

    const activity = await getUserDailyActivity(userId, parseInt(days));

    res.json({ activity });
  } catch (error) {
    console.error('Failed to get user activity:', error);
    res.status(500).json({ error: 'Failed to get user activity' });
  }
});

// GET /api/metrics/my-activity-by-source - Get current user's daily activity by source
router.get('/my-activity-by-source', async (req, res) => {
  try {
    const { userId } = req.auth;
    const { days = 30 } = req.query;

    const activity = await getUserDailyActivityBySource(userId, parseInt(days));

    res.json({ activity });
  } catch (error) {
    console.error('Failed to get user activity by source:', error);
    res.status(500).json({ error: 'Failed to get user activity by source' });
  }
});

// DELETE /api/metrics/reset - Clear all daily metrics for the current user
// This allows re-syncing all data from scratch (e.g., after timezone fixes)
router.delete('/reset', async (req, res) => {
  try {
    const { userId } = req.auth;
    const { source } = req.query;

    // Delete daily metrics for this user (optionally filtered by source)
    let result;
    if (source) {
      result = await db.query(
        `DELETE FROM daily_metrics WHERE user_id = $1 AND source = $2 RETURNING id`,
        [userId, source]
      );
    } else {
      result = await db.query(
        `DELETE FROM daily_metrics WHERE user_id = $1 RETURNING id`,
        [userId]
      );
    }

    console.log(`[Reset] Deleted ${result.rowCount} daily_metrics rows for user ${userId}${source ? ` (source: ${source})` : ''}`);

    res.json({
      success: true,
      deleted: result.rowCount,
      source: source || 'all',
      message: `Deleted ${result.rowCount} daily metric entries. Run 'claudometer collect' to re-sync.`,
    });
  } catch (error) {
    console.error('Failed to reset metrics:', error);
    res.status(500).json({ error: 'Failed to reset metrics' });
  }
});

// GET /api/metrics/by-source - Get current user's metrics broken down by source
router.get('/by-source', async (req, res) => {
  try {
    const { userId } = req.auth;
    const { period = 'all' } = req.query;

    const bySource = await getUserMetricsBySource(userId, period);

    // Transform into a more usable format
    const sources = {};
    let totals = {
      claude_sessions: 0,
      claude_messages: 0,
      claude_tokens: 0,
      claude_tool_calls: 0,
    };

    for (const row of bySource) {
      sources[row.source] = {
        claude_sessions: parseInt(row.claude_sessions) || 0,
        claude_messages: parseInt(row.claude_messages) || 0,
        claude_tokens: parseInt(row.claude_tokens) || 0,
        claude_tool_calls: parseInt(row.claude_tool_calls) || 0,
      };
      totals.claude_sessions += sources[row.source].claude_sessions;
      totals.claude_messages += sources[row.source].claude_messages;
      totals.claude_tokens += sources[row.source].claude_tokens;
      totals.claude_tool_calls += sources[row.source].claude_tool_calls;
    }

    res.json({ sources, totals, period });
  } catch (error) {
    console.error('Failed to get metrics by source:', error);
    res.status(500).json({ error: 'Failed to get metrics by source' });
  }
});

export default router;
