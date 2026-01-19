# Claudometer CLI

Track your engineering productivity metrics across Claude Code usage and Git activity.

## Installation

```bash
npm install -g claudometer
```

## Quick Start

### 1. Login to your organization
```bash
claudometer login
```
This opens your browser to authenticate with your team's Claudometer dashboard.

### 2. Setup automatic syncing
```bash
claudometer setup
```
This configures your system to automatically sync metrics every 30 minutes.

### 3. View your stats
```bash
claudometer status
```

## Commands

| Command | Description |
|---------|-------------|
| `claudometer login` | Authenticate with your organization |
| `claudometer logout` | Sign out |
| `claudometer setup` | Setup auto-sync daemon (macOS LaunchAgent) |
| `claudometer setup --uninstall` | Remove auto-sync daemon |
| `claudometer collect` | Run a one-time metrics collection |
| `claudometer status` | Show current tracking status |
| `claudometer start` | Start background daemon (alternative to setup) |
| `claudometer stop` | Stop background daemon |

## What's Collected

### Claude Code Metrics
- Sessions and messages
- Input/output tokens
- Tool calls

### Git Metrics
- Commits (by you)
- Lines added/deleted
- Files changed
- Activity by repository

## Configuration

The CLI stores configuration in:
- macOS: `~/Library/Preferences/claudometer-nodejs/config.json`
- Linux: `~/.config/claudometer-nodejs/config.json`
- Windows: `%APPDATA%/claudometer-nodejs/config.json`

### Custom API URL

If your team runs a self-hosted Claudometer server:
```bash
export CLAUDOMETER_API_URL=https://your-api.example.com
claudometer login
```

## Requirements

- Node.js >= 18.0.0
- macOS, Linux, or Windows
- Git (for repository metrics)

## Privacy

- Only your own commits are tracked (matched by git email)
- Data is sent to your organization's Claudometer server
- No code content is ever collected

## License

MIT
