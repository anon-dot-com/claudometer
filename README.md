# Claudometer

Track engineering productivity metrics across Claude Code usage and Git activity. See how your team uses AI-assisted development.

## Overview

Claudometer consists of three parts:

1. **Dashboard** - Web app at [claudometer.ai](https://claudometer.ai) showing your metrics and team leaderboards
2. **CLI** - Command-line tool that collects and syncs your local metrics
3. **API** - Backend service that stores and aggregates data

## Quick Start for Team Members

### 1. Install the CLI

```bash
npm install -g claudometer
```

### 2. Login to your organization

```bash
claudometer login
```

This opens your browser to authenticate with your team's Claudometer dashboard.

### 3. Sync your metrics

```bash
claudometer collect
```

This collects your Claude Code usage and Git activity from the last 30 days and uploads it.

### 4. Setup automatic syncing (recommended)

```bash
claudometer setup
```

This configures your system to automatically sync metrics every 30 minutes using a LaunchAgent (macOS).

### 5. View the dashboard

Visit [claudometer.ai](https://claudometer.ai) to see your metrics and team leaderboards.

## CLI Commands

| Command | Description |
|---------|-------------|
| `claudometer login` | Authenticate with your organization |
| `claudometer logout` | Sign out |
| `claudometer collect` | Run a one-time metrics collection and upload |
| `claudometer setup` | Setup auto-sync every 30 minutes |
| `claudometer setup --uninstall` | Remove auto-sync |
| `claudometer status` | Show current tracking status |
| `claudometer link --generate` | Generate a code to link external tools |
| `claudometer link --list` | List linked devices |
| `claudometer link --revoke <id>` | Revoke a device token |

## Using with OpenClaw (Moltbot)

If your team uses [OpenClaw](https://openclaw.ai) (formerly Moltbot/Clawdbot) alongside Claude Code, you can track both in Claudometer.

### Setup

1. **Install the OpenClaw plugin** on the machine running OpenClaw:

   ```bash
   openclaw plugins install @claudometer/openclaw-reporter
   ```

2. **Generate a linking code** from any machine with Claudometer CLI:

   ```bash
   claudometer link --generate
   ```

   This displays a 6-character code valid for 10 minutes.

3. **Link OpenClaw** using the code:

   ```bash
   openclaw claudometer link ABC123
   ```

   Or use the chat command: `/claudometer link ABC123`

4. **Verify the connection**:

   ```bash
   openclaw claudometer status
   ```

### How It Works

- The plugin automatically syncs usage every 30 minutes (configurable)
- Metrics appear in your Claudometer dashboard alongside Claude Code usage
- Use `/claudometer` in OpenClaw chat to check sync status

### Managing Devices

```bash
# List all linked devices
claudometer link --list

# Revoke a device token
claudometer link --revoke clm_abc123...
```

## What's Collected

### Claude Code Metrics
- Sessions and messages
- Input/output tokens
- Tool calls
- Usage by model

### External Tools (OpenClaw, etc.)
- Messages and sessions
- Token usage
- Usage by model
- Tracked separately with source breakdown

### Git Metrics
- Commits authored by you
- Lines added/deleted
- Files changed
- Activity by repository

## Privacy

- **Only your commits** are tracked (matched by your git email)
- **No code content** is ever collected - just aggregate statistics
- Data is sent to your organization's Claudometer instance
- All data belongs to your organization

## Self-Hosting

Claudometer can be self-hosted. See the deployment guides:

- [Backend (Railway/Docker)](./backend/README.md)
- [Dashboard (Vercel/Next.js)](./dashboard/README.md)

### Environment Variables

**Backend (Railway)**
- `DATABASE_URL` - PostgreSQL connection string
- `CLERK_SECRET_KEY` - Clerk secret key for auth
- `FRONTEND_URL` - Dashboard URL for CORS

**Dashboard (Vercel)**
- `NEXT_PUBLIC_API_URL` - Backend API URL
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` - Clerk publishable key
- `CLERK_SECRET_KEY` - Clerk secret key

## Requirements

- Node.js >= 18.0.0
- macOS, Linux, or Windows
- Git (for repository metrics)
- Claude Code (for Claude metrics)

## Troubleshooting

### "Failed to report" error
Make sure you're logged in: `claudometer login`

### Metrics not appearing on dashboard
1. Run `claudometer collect` to sync manually
2. Refresh the dashboard
3. Check you're viewing the correct time period

### Login issues
1. Run `claudometer logout`
2. Run `claudometer login` again

## License

MIT

