import { createClerkClient, verifyToken } from '@clerk/backend';
import jwt from 'jsonwebtoken';
import { verifyDeviceToken } from '../db/index.js';

const clerk = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
});

// Secret for our own JWT tokens
const JWT_SECRET = process.env.JWT_SECRET || process.env.CLERK_SECRET_KEY;

// Verify our own CLI JWT token
function verifyCliToken(token) {
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.type === 'cli') {
      return payload;
    }
    return null;
  } catch {
    return null;
  }
}

// Verify JWT token from CLI or web app
export async function authenticateRequest(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization header' });
  }

  const token = authHeader.split(' ')[1];

  // First, try to verify as our own CLI token (fast path)
  const cliPayload = verifyCliToken(token);
  if (cliPayload) {
    req.auth = {
      userId: cliPayload.sub,
      email: cliPayload.email,
      name: cliPayload.name,
      orgId: cliPayload.orgId,
      orgName: cliPayload.orgName,
      tokenType: 'cli',
    };
    return next();
  }

  // Try device token (opaque token verified by hash)
  const devicePayload = await verifyDeviceToken(token);
  if (devicePayload) {
    req.auth = {
      userId: devicePayload.user_id,
      orgId: devicePayload.org_id,
      deviceId: devicePayload.id,
      deviceName: devicePayload.name,
      tokenType: 'device',
    };
    return next();
  }

  // Fall back to Clerk token verification
  try {
    // Verify the session token with Clerk
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
    });

    if (!payload || !payload.sub) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Get user details
    const user = await clerk.users.getUser(payload.sub);

    // Get user's organization memberships
    const memberships = await clerk.users.getOrganizationMembershipList({
      userId: payload.sub,
    });

    // Use the first org or the one specified in the token
    const orgMembership = memberships.data[0];

    if (!orgMembership) {
      return res.status(403).json({ error: 'User must belong to an organization' });
    }

    const org = await clerk.organizations.getOrganization({
      organizationId: orgMembership.organization.id,
    });

    // Attach to request
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

// Smart auth: try Clerk first, fall back to dev auth only if no token provided
export async function devAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const isDev = process.env.NODE_ENV === 'development' && process.env.DEV_AUTH === 'true';

  // If there's a Bearer token, try Clerk auth
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];

    // Skip dev token, use real Clerk auth
    if (token !== 'dev_token') {
      // In dev mode, authenticate with Clerk but override org to dev org
      if (isDev) {
        try {
          const cliPayload = verifyCliToken(token);
          if (cliPayload) {
            req.auth = {
              userId: cliPayload.sub,
              email: cliPayload.email,
              name: cliPayload.name,
              orgId: 'org_anthropic', // Override to dev org
              orgName: 'Anthropic',
              tokenType: 'cli',
            };
            return next();
          }

          // Try device token
          const devicePayload = await verifyDeviceToken(token);
          if (devicePayload) {
            req.auth = {
              userId: devicePayload.user_id,
              orgId: 'org_anthropic', // Override to dev org
              deviceId: devicePayload.id,
              deviceName: devicePayload.name,
              tokenType: 'device',
            };
            return next();
          }

          // Verify Clerk token but use dev org
          const payload = await verifyToken(token, {
            secretKey: process.env.CLERK_SECRET_KEY,
          });

          if (payload && payload.sub) {
            const user = await clerk.users.getUser(payload.sub);
            req.auth = {
              userId: user.id,
              email: user.emailAddresses[0]?.emailAddress,
              name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
              orgId: 'org_anthropic', // Override to dev org
              orgName: 'Anthropic',
            };
            return next();
          }
        } catch (error) {
          console.error('Dev auth error:', error.message);
        }
      }
      return authenticateRequest(req, res, next);
    }
  }

  // Fall back to dev auth only in development mode
  if (isDev) {
    req.auth = {
      userId: 'user_38P0EZbTtZzeXb0l251IJLM1kxk',
      email: 'daniel@anthropic.com',
      name: 'Daniel Mason',
      orgId: 'org_anthropic',
      orgName: 'Anthropic',
    };
    return next();
  }

  return authenticateRequest(req, res, next);
}
