import { Router } from 'express';
import {
  findOrCreateOrg,
  findOrCreateUser,
  saveMetricsSnapshot,
  getUserLatestMetrics,
  getUserMetricsByPeriod,
  getUserLatestSyncInfo,
  getOrgLeaderboard,
  getOrgDailyActivity,
  getUserDailyActivity,
  syncOrgMembersFromClerk,
} from '../db/index.js';
import { clerk } from '../middleware/auth.js';

const router = Router();

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

export default router;
