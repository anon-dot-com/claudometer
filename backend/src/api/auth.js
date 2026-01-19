import { Router } from 'express';
import { createClerkClient, verifyToken } from '@clerk/backend';
import jwt from 'jsonwebtoken';

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

    const memberships = await clerk.users.getOrganizationMembershipList({
      userId: session.userId,
    });

    const orgMembership = memberships.data[0];

    if (!orgMembership) {
      const errorUrl = `${cli_callback}?error=${encodeURIComponent('User must belong to an organization')}`;
      return res.redirect(errorUrl);
    }

    const org = await clerk.organizations.getOrganization({
      organizationId: orgMembership.organization.id,
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

    // Get user's organization memberships
    const memberships = await clerk.users.getOrganizationMembershipList({
      userId: payload.sub,
    });

    const orgMembership = memberships.data[0];

    if (!orgMembership) {
      return res.status(403).json({ error: 'User must belong to an organization' });
    }

    const org = await clerk.organizations.getOrganization({
      organizationId: orgMembership.organization.id,
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

export default router;
