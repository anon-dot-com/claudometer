import { Router } from 'express';
import { createClerkClient } from '@clerk/backend';
import {
  createJoinRequest,
  getJoinRequestsForOrg,
  getJoinRequestByUserAndOrg,
  updateJoinRequestStatus,
  getOrgById,
} from '../db/index.js';

const router = Router();

const clerk = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

// POST /api/join-requests - Create a join request (requires auth)
router.post('/', async (req, res) => {
  try {
    const { orgId } = req.body;

    if (!orgId) {
      return res.status(400).json({ error: 'Organization ID is required' });
    }

    // Get the user from the auth middleware
    const userId = req.user.sub;
    const userEmail = req.user.email;
    const userName = req.user.name;

    // Check if org exists
    const org = await getOrgById(orgId);
    if (!org) {
      return res.status(404).json({ error: 'Organization not found' });
    }

    // Check if user is already a member via Clerk
    try {
      const memberships = await clerk.users.getOrganizationMembershipList({
        userId: userId,
      });
      const isMember = memberships.data.some(m => m.organization.id === orgId);
      if (isMember) {
        return res.status(400).json({ error: 'You are already a member of this organization' });
      }
    } catch (error) {
      // User might not exist in Clerk yet, continue
    }

    // Check for existing request
    const existingRequest = await getJoinRequestByUserAndOrg(userId, orgId);
    if (existingRequest && existingRequest.status === 'pending') {
      return res.status(400).json({ error: 'You already have a pending request to join this organization' });
    }
    if (existingRequest && existingRequest.status === 'approved') {
      return res.status(400).json({ error: 'Your request has already been approved' });
    }

    // Create the join request
    const joinRequest = await createJoinRequest(userId, userEmail, userName, orgId);

    res.status(201).json({
      success: true,
      request: {
        id: joinRequest.id,
        status: joinRequest.status,
        requestedAt: joinRequest.requested_at,
      },
    });
  } catch (error) {
    console.error('Error creating join request:', error);
    res.status(500).json({ error: 'Failed to create join request' });
  }
});

// GET /api/join-requests - Get pending requests for the user's org (admin only)
router.get('/', async (req, res) => {
  try {
    const orgId = req.user.orgId;
    const userId = req.user.sub;

    // Verify user is an admin of the org
    const memberships = await clerk.users.getOrganizationMembershipList({
      userId: userId,
    });

    const membership = memberships.data.find(m => m.organization.id === orgId);
    if (!membership || membership.role !== 'org:admin') {
      return res.status(403).json({ error: 'Only organization admins can view join requests' });
    }

    const status = req.query.status || 'pending';
    const requests = await getJoinRequestsForOrg(orgId, status);

    res.json({
      requests: requests.map(r => ({
        id: r.id,
        userId: r.user_id,
        email: r.user_email,
        name: r.user_name,
        status: r.status,
        requestedAt: r.requested_at,
        resolvedAt: r.resolved_at,
      })),
    });
  } catch (error) {
    console.error('Error fetching join requests:', error);
    res.status(500).json({ error: 'Failed to fetch join requests' });
  }
});

// GET /api/join-requests/status/:orgId - Check request status for current user
router.get('/status/:orgId', async (req, res) => {
  try {
    const { orgId } = req.params;
    const userId = req.user.sub;

    const request = await getJoinRequestByUserAndOrg(userId, orgId);

    if (!request) {
      return res.json({ status: 'none' });
    }

    res.json({
      status: request.status,
      requestedAt: request.requested_at,
      resolvedAt: request.resolved_at,
    });
  } catch (error) {
    console.error('Error checking join request status:', error);
    res.status(500).json({ error: 'Failed to check request status' });
  }
});

// POST /api/join-requests/:id/approve - Approve a join request (admin only)
router.post('/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user.sub;
    const orgId = req.user.orgId;

    // Verify user is an admin
    const memberships = await clerk.users.getOrganizationMembershipList({
      userId: adminId,
    });

    const membership = memberships.data.find(m => m.organization.id === orgId);
    if (!membership || membership.role !== 'org:admin') {
      return res.status(403).json({ error: 'Only organization admins can approve requests' });
    }

    // Update the request status
    const updatedRequest = await updateJoinRequestStatus(id, 'approved', adminId);

    if (!updatedRequest) {
      return res.status(404).json({ error: 'Join request not found' });
    }

    // Add user to org via Clerk
    try {
      await clerk.organizations.createOrganizationMembership({
        organizationId: orgId,
        userId: updatedRequest.user_id,
        role: 'org:member',
      });
    } catch (clerkError) {
      console.error('Error adding user to Clerk org:', clerkError);
      // Revert the status if Clerk fails
      await updateJoinRequestStatus(id, 'pending', null);
      return res.status(500).json({ error: 'Failed to add user to organization' });
    }

    res.json({
      success: true,
      request: {
        id: updatedRequest.id,
        status: updatedRequest.status,
        email: updatedRequest.user_email,
        name: updatedRequest.user_name,
      },
    });
  } catch (error) {
    console.error('Error approving join request:', error);
    res.status(500).json({ error: 'Failed to approve request' });
  }
});

// POST /api/join-requests/:id/deny - Deny a join request (admin only)
router.post('/:id/deny', async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user.sub;
    const orgId = req.user.orgId;

    // Verify user is an admin
    const memberships = await clerk.users.getOrganizationMembershipList({
      userId: adminId,
    });

    const membership = memberships.data.find(m => m.organization.id === orgId);
    if (!membership || membership.role !== 'org:admin') {
      return res.status(403).json({ error: 'Only organization admins can deny requests' });
    }

    const updatedRequest = await updateJoinRequestStatus(id, 'denied', adminId);

    if (!updatedRequest) {
      return res.status(404).json({ error: 'Join request not found' });
    }

    res.json({
      success: true,
      request: {
        id: updatedRequest.id,
        status: updatedRequest.status,
      },
    });
  } catch (error) {
    console.error('Error denying join request:', error);
    res.status(500).json({ error: 'Failed to deny request' });
  }
});

export default router;
