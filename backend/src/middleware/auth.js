import { createClerkClient, verifyToken } from '@clerk/backend';
import jwt from 'jsonwebtoken';

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
