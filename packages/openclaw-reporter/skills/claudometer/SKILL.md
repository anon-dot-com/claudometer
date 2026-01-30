# Claudometer

Show your Claudometer sync status and manage your connection.

## Commands

- `/claudometer` - Show current sync status
- `/claudometer link <CODE>` - Connect to Claudometer
- `/claudometer sync` - Manually sync metrics now
- `/claudometer status` - Show detailed connection info

## Getting Started

1. **Get a linking code** from any machine with Claudometer CLI:
   ```
   claudometer link --generate
   ```

2. **Link OpenClaw** using the code:
   ```
   /claudometer link ABC123
   ```

3. **Verify connection**:
   ```
   /claudometer status
   ```

## What Gets Reported

Claudometer tracks your usage of Claude through OpenClaw:
- Messages sent
- Tokens used (input and output)
- Sessions
- Usage by model

This data appears on your Claudometer dashboard alongside your Claude Code usage.

## Privacy

- Only aggregate usage metrics are sent (no message content)
- Data is associated with your Claudometer account
- You can unlink at any time
