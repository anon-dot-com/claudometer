import { Router } from 'express';
import { createClerkClient, verifyToken } from '@clerk/backend';
import jwt from 'jsonwebtoken';
import {
  createLinkingCode,
  consumeLinkingCode,
  validateDeviceToken,
  listDeviceTokens,
  revokeDeviceToken,
  findOrCreateOrg,
  findOrCreateUser,
} from '../db/index.js';

const router = Router();

const clerk = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

// Secret for our own JWT tokens (use CLERK_SECRET_KEY as fallback)
const JWT_SECRET = process.env.JWT_SECRET || process.env.CLERK_SECRET_KEY;
const CLI_TOKEN_EXPIRY = '90d'; // CLI tokens last 90 days

// GET /auth/cli - Redirect to Clerk login for CLI auth
router.get('/cli', (req, res) => {
  const { callback } = req.query;

  if (!callback) {
    return res.status(400).json({ error: 'Missing callback URL' });
  }

  // Store callback in session/cookie for after auth
  // For now, pass it through the Clerk redirect
  const clerkSignInUrl = process.env.CLERK_SIGN_IN_URL || 'http://localhost:3000/sign-in';

  // Redirect to the dashboard's sign-in page with the CLI callback
  const redirectUrl = `${clerkSignInUrl}?redirect_url=${encodeURIComponent(
    `${process.env.API_URL || 'http://localhost:3001'}/auth/cli/callback?cli_callback=${encodeURIComponent(callback)}`
  )}`;

  res.redirect(redirectUrl);
});

// GET /auth/cli/callback - Handle OAuth callback and redirect to CLI
router.get('/cli/callback', async (req, res) => {
  const { cli_callback } = req.query;

  // Get the session from Clerk (set by middleware after sign-in)
  const sessionId = req.cookies?.__session;

  if (!sessionId) {
    const errorUrl = `${cli_callback}?error=${encodeURIComponent('No session found')}`;
    return res.redirect(errorUrl);
  }

  try {
    // Verify the session and get user/org details
    const session = await clerk.sessions.getSession(sessionId);
    const user = await clerk.users.getUser(session.userId);

    // Use the session's active org if available, otherwise fall back to first membership
    let orgId = session.lastActiveOrganizationId;

    if (!orgId) {
      const memberships = await clerk.users.getOrganizationMembershipList({
        userId: session.userId,
      });

      const orgMembership = memberships.data[0];
      if (!orgMembership) {
        const errorUrl = `${cli_callback}?error=${encodeURIComponent('User must belong to an organization')}`;
        return res.redirect(errorUrl);
      }
      orgId = orgMembership.organization.id;
    }

    const org = await clerk.organizations.getOrganization({
      organizationId: orgId,
    });

    // Create a token for the CLI
    const token = await clerk.sessions.createSessionToken(sessionId);

    // Build callback URL with auth data
    const userJson = encodeURIComponent(
      JSON.stringify({
        id: user.id,
        email: user.emailAddresses[0]?.emailAddress,
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
      })
    );

    const orgJson = encodeURIComponent(
      JSON.stringify({
        id: org.id,
        name: org.name,
      })
    );

    const callbackUrl = `${cli_callback}?token=${token}&user=${userJson}&org=${orgJson}`;
    res.redirect(callbackUrl);
  } catch (error) {
    console.error('CLI auth callback error:', error);
    const errorUrl = `${cli_callback}?error=${encodeURIComponent(error.message)}`;
    res.redirect(errorUrl);
  }
});

// POST /auth/token - Exchange Clerk token for long-lived CLI token
router.post('/token', async (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }

  const clerkToken = authHeader.split(' ')[1];

  try {
    // Verify the Clerk session token
    const payload = await verifyToken(clerkToken, {
      secretKey: process.env.CLERK_SECRET_KEY,
    });

    if (!payload || !payload.sub) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Get user details
    const user = await clerk.users.getUser(payload.sub);

    // Clerk token includes org_id if user has an active organization
    // Use that instead of blindly taking the first membership
    let orgId = payload.org_id;

    if (!orgId) {
      // No active org in token, fall back to first membership
      const memberships = await clerk.users.getOrganizationMembershipList({
        userId: payload.sub,
      });

      const orgMembership = memberships.data[0];
      if (!orgMembership) {
        return res.status(403).json({ error: 'User must belong to an organization' });
      }
      orgId = orgMembership.organization.id;
    }

    const org = await clerk.organizations.getOrganization({
      organizationId: orgId,
    });

    // Generate our own long-lived token
    const cliToken = jwt.sign(
      {
        sub: user.id,
        email: user.emailAddresses[0]?.emailAddress,
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
        orgId: org.id,
        orgName: org.name,
        type: 'cli',
      },
      JWT_SECRET,
      { expiresIn: CLI_TOKEN_EXPIRY }
    );

    res.json({
      token: cliToken,
      expiresIn: CLI_TOKEN_EXPIRY,
      user: {
        id: user.id,
        email: user.emailAddresses[0]?.emailAddress,
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
      },
      org: {
        id: org.id,
        name: org.name,
      },
    });
  } catch (error) {
    console.error('Token exchange error:', error.message);
    return res.status(401).json({ error: 'Authentication failed' });
  }
});

// Helper middleware to verify CLI token
async function verifyCliAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }

  const token = authHeader.split(' ')[1];

  try {
    // Try CLI token first
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.type === 'cli') {
      req.auth = {
        userId: payload.sub,
        email: payload.email,
        name: payload.name,
        orgId: payload.orgId,
        orgName: payload.orgName,
      };
      return next();
    }
  } catch {
    // Not a CLI token, try Clerk
  }

  try {
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
    });

    if (!payload || !payload.sub) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const user = await clerk.users.getUser(payload.sub);
    let orgId = payload.org_id;

    if (!orgId) {
      const memberships = await clerk.users.getOrganizationMembershipList({
        userId: payload.sub,
      });
      const orgMembership = memberships.data[0];
      if (!orgMembership) {
        return res.status(403).json({ error: 'User must belong to an organization' });
      }
      orgId = orgMembership.organization.id;
    }

    const org = await clerk.organizations.getOrganization({ organizationId: orgId });

    req.auth = {
      userId: user.id,
      email: user.emailAddresses[0]?.emailAddress,
      name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
      orgId: org.id,
      orgName: org.name,
    };
    next();
  } catch (error) {
    console.error('Auth error:', error.message);
    return res.status(401).json({ error: 'Authentication failed' });
  }
}

// POST /auth/link - Generate a linking code for device pairing (requires auth)
router.post('/link', verifyCliAuth, async (req, res) => {
  try {
    const { userId, orgId, orgName } = req.auth;

    // Ensure user and org exist in database
    await findOrCreateOrg(orgId, orgName);
    await findOrCreateUser(userId, req.auth.email, req.auth.name, orgId);

    const { code, expiresAt } = await createLinkingCode(userId, orgId);

    res.json({
      code,
      expiresAt: expiresAt.toISOString(),
      expiresIn: '10 minutes',
      instructions: 'Enter this code in OpenClaw: openclaw claudometer link ' + code,
    });
  } catch (error) {
    console.error('Failed to create linking code:', error);
    res.status(500).json({ error: 'Failed to create linking code' });
  }
});

// POST /auth/device - Consume linking code and create device token (no auth required)
router.post('/device', async (req, res) => {
  try {
    const { code, deviceName, source = 'openclaw' } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Missing code' });
    }

    if (!deviceName) {
      return res.status(400).json({ error: 'Missing deviceName' });
    }

    const result = await consumeLinkingCode(code, deviceName, source);

    if (result.error) {
      return res.status(400).json({ error: result.error });
    }

    res.json({
      success: true,
      token: result.token,
      user: {
        email: result.email,
        name: result.name,
      },
      org: {
        id: result.orgId,
        name: result.orgName,
      },
    });
  } catch (error) {
    console.error('Failed to create device token:', error);
    res.status(500).json({ error: 'Failed to create device token' });
  }
});

// GET /auth/devices - List user's device tokens (requires auth)
router.get('/devices', verifyCliAuth, async (req, res) => {
  try {
    const { userId } = req.auth;
    const devices = await listDeviceTokens(userId);

    res.json({ devices });
  } catch (error) {
    console.error('Failed to list devices:', error);
    res.status(500).json({ error: 'Failed to list devices' });
  }
});

// DELETE /auth/devices/:id - Revoke a device token (requires auth)
router.delete('/devices/:id', verifyCliAuth, async (req, res) => {
  try {
    const { userId } = req.auth;
    const { id } = req.params;

    const device = await revokeDeviceToken(id, userId);

    if (!device) {
      return res.status(404).json({ error: 'Device not found' });
    }

    res.json({ success: true, message: 'Device token revoked' });
  } catch (error) {
    console.error('Failed to revoke device:', error);
    res.status(500).json({ error: 'Failed to revoke device' });
  }
});

// POST /auth/device/validate - Validate a device token (used by external tools)
router.post('/device/validate', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing authorization header' });
    }

    const token = authHeader.split(' ')[1];
    const device = await validateDeviceToken(token);

    if (!device) {
      return res.status(401).json({ error: 'Invalid or revoked token' });
    }

    res.json({
      valid: true,
      user: {
        id: device.user_id,
        email: device.email,
        name: device.name,
      },
      org: {
        id: device.org_id,
        name: device.org_name,
      },
      device: {
        name: device.device_name,
        source: device.source,
      },
    });
  } catch (error) {
    console.error('Failed to validate device:', error);
    res.status(500).json({ error: 'Failed to validate device' });
  }
});

export default router;
