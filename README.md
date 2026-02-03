# Claudometer

Track engineering productivity metrics across Claude Code usage and Git activity. See how your team uses AI-assisted development.

## Overview

Claudometer consists of three parts:

1. **Dashboard** - Web app at [claudometer.ai](https://claudometer.ai) showing your metrics and team leaderboards
2. **CLI** - Command-line tool that collects and syncs your local metrics
3. **API** - Backend service that stores and aggregates data

## Quick Start

### Option A: Claude Code Only (Single Machine)

```bash
npm i -g claudometer && claudometer login && claudometer setup
```

This installs, authenticates, and sets up auto-sync (every 30 minutes).

### Option B: Claude Code + OpenClaw (Multiple Machines)

**Step 1:** On your primary machine:
```bash
npm i -g claudometer && claudometer login && claudometer setup && claudometer link --generate
```

**Step 2:** On your OpenClaw server (replace CODE with the 6-character code):
```bash
npm i -g claudometer && claudometer link --connect CODE && claudometer setup
```

Both machines will now auto-sync every 30 minutes.

### How Auto-Sync Works

`claudometer setup` configures automatic syncing:
- **macOS**: Uses LaunchAgent
- **Linux**: Uses cron jobs

To manually sync once: `claudometer collect`

### View the Dashboard

Visit [claudometer.ai](https://claudometer.ai) to see your metrics and team leaderboards.

## Updating

To get the latest features and fixes:

```bash
npm update -g claudometer
```

Check your version:
```bash
claudometer --version
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `claudometer login` | Authenticate with your organization |
| `claudometer logout` | Sign out |
| `claudometer collect` | Run a one-time metrics collection and upload |
| `claudometer collect --dry-run` | Preview what would be collected without uploading |
| `claudometer collect --reset` | Clear stored metrics and re-sync from scratch |
| `claudometer setup` | Setup auto-sync every 30 minutes |
| `claudometer setup --uninstall` | Remove auto-sync |
| `claudometer status` | Show current tracking status |
| `claudometer link --generate` | Generate a code to link secondary devices |
| `claudometer link --connect <code>` | Connect a secondary device using a code |
| `claudometer link --list` | List linked devices |
| `claudometer link --revoke <id>` | Revoke a device token |

## Using with OpenClaw / Third-Party Tools

Track Claude usage from secondary machines running OpenClaw, MoldBot, or other Claude tools.

### Setup

1. **On your primary machine** (where you have browser access):
   ```bash
   claudometer link --generate
   ```
   This displays a 6-character code valid for 10 minutes.

2. **On the secondary machine** (SSH into your server):
   ```bash
   npm install -g claudometer
   claudometer link --connect ABC123  # Replace with your code
   claudometer collect
   ```

3. **Setup auto-sync** on the secondary machine:
   ```bash
   claudometer setup
   ```

### How It Works

- The CLI reads directly from OpenClaw's session transcripts (`~/.openclaw/`, `~/.moldbot/`, etc.)
- No plugins needed - just install the CLI and link with a code
- Usage appears as "3rd party" in leaderboards alongside your Claude Code (1st party) usage
- Real-time data collection from JSONL session files

### Managing Linked Devices

```bash
# List all linked devices
claudometer link --list

# Revoke a device token
claudometer link --revoke clm_abc123...
```

## What's Collected

### Claude Code Metrics (First-Party)
- Sessions and messages
- Input/output tokens
- Cache tokens (read and creation)
- Tool calls
- Usage by model
- Real-time data from `~/.claude/projects/` session transcripts

### OpenClaw Metrics (Third-Party)
- Messages and sessions
- Token usage
- Tool calls
- Usage by model
- Real-time data from `~/.openclaw/`, `~/.moldbot/`, etc.

### Git Metrics
- Commits authored by you (matched by git email)
- Lines added/deleted
- Files changed
- Activity by repository
- Scans: `~/Documents`, `~/Projects`, `~/Code`, `~/dev`, `~/repos`, `~/workspace`, `~/workspaces`, `~/Github`, `~/conductor`

## Privacy

- **Only your commits** are tracked (matched by your git email)
- **No code content** is ever collected - just aggregate statistics
- **Timestamps** are converted to your local timezone
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
- Claude Code or OpenClaw (for Claude metrics)

## Troubleshooting

### "Failed to report" error
Make sure you're logged in: `claudometer login`

### Metrics not appearing on dashboard
1. Run `claudometer collect` to sync manually
2. Refresh the dashboard
3. Check you're viewing the correct time period

### Missing Git repos
The CLI scans common directories. If your repos are elsewhere, they won't be found automatically.

### Login issues
1. Run `claudometer logout`
2. Run `claudometer login` again

### Version shows old number
Run `npm update -g claudometer` to get the latest version.

## License

MIT
