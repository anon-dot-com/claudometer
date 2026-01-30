# @claudometer/openclaw-reporter

OpenClaw plugin to report usage metrics to [Claudometer](https://claudometer.ai) for team visibility and leaderboards.

## Installation

```bash
openclaw plugins install @claudometer/openclaw-reporter
```

## Setup

### 1. Generate a linking code

On any machine where the Claudometer CLI is installed and authenticated:

```bash
claudometer link --generate
```

This will display a 6-character code valid for 10 minutes.

### 2. Link OpenClaw to Claudometer

In OpenClaw, run:

```bash
openclaw claudometer link ABC123
```

Or use the chat command:

```
/claudometer link ABC123
```

### 3. Verify connection

```bash
openclaw claudometer status
```

## Usage

Once connected, metrics are automatically reported every 30 minutes (configurable).

### Chat Commands

| Command | Description |
|---------|-------------|
| `/claudometer` | Show sync status |
| `/claudometer status` | Detailed connection info |
| `/claudometer sync` | Manual sync |
| `/claudometer link <CODE>` | Connect to Claudometer |

### CLI Commands

```bash
openclaw claudometer status    # Show connection status
openclaw claudometer sync      # Manually sync metrics
openclaw claudometer unlink    # Remove connection
```

## Configuration

Add to your OpenClaw config (`~/.openclaw/openclaw.json`):

```json
{
  "plugins": {
    "entries": {
      "claudometer": {
        "enabled": true,
        "apiUrl": "https://claudometer.ai",
        "deviceToken": "clm_...",
        "reportIntervalMinutes": 30
      }
    }
  }
}
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | boolean | `true` | Enable automatic reporting |
| `apiUrl` | string | `https://claudometer.ai` | Claudometer API URL |
| `deviceToken` | string | - | Device token (required) |
| `reportIntervalMinutes` | number | `30` | Minutes between reports (5-1440) |

## What Gets Reported

- Message count
- Token usage (input/output)
- Session count
- Model breakdown
- Daily activity

**Note:** No message content is ever sent—only aggregate usage metrics.

## Troubleshooting

### "Invalid or expired code"

Linking codes expire after 10 minutes. Generate a new one with `claudometer link --generate`.

### "Token invalid or revoked"

Your device token may have been revoked. Re-link with a new code.

### Metrics not appearing

1. Check connection: `openclaw claudometer status`
2. Try manual sync: `openclaw claudometer sync`
3. Verify the plugin is enabled in config

## Development

```bash
# Clone the repo
git clone https://github.com/claudometer/openclaw-reporter
cd openclaw-reporter

# Install dependencies
npm install

# Build
npm run build

# Link for local development
openclaw plugins install -l .
```

## License

MIT
