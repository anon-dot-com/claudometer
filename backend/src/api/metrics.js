import { Router } from 'express';
import {
  findOrCreateOrg,
  findOrCreateUser,
  saveMetricsSnapshot,
  getUserLatestMetrics,
  getUserMetricsByPeriod,
  getOrgLeaderboard,
  getOrgDailyActivity,
} from '../db/index.js';

const router = Router();

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

    if (!metrics) {
      return res.json({ metrics: null, message: 'No metrics reported yet' });
    }

    res.json({ metrics, period });
  } catch (error) {
    console.error('Failed to get metrics:', error);
    res.status(500).json({ error: 'Failed to get metrics' });
  }
});

// GET /api/metrics/leaderboard - Get org leaderboard
router.get('/leaderboard', async (req, res) => {
  try {
    const { orgId } = req.auth;
    const { metric = 'claude_output_tokens', limit = 10, period = 'all' } = req.query;

    const leaderboard = await getOrgLeaderboard(orgId, metric, parseInt(limit), period);

    res.json({ leaderboard, metric, period });
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

export default router;
