-- Organizations (maps to Clerk organizations)
CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,                    -- Clerk org ID
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users (maps to Clerk users)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,                    -- Clerk user ID
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  org_id TEXT REFERENCES organizations(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Metrics snapshots (raw data from CLI reports)
CREATE TABLE IF NOT EXISTS metrics_snapshots (
  id SERIAL PRIMARY KEY,
  user_id TEXT REFERENCES users(id) NOT NULL,
  org_id TEXT REFERENCES organizations(id) NOT NULL,
  reported_at TIMESTAMPTZ NOT NULL,

  -- Claude metrics
  claude_sessions INTEGER DEFAULT 0,
  claude_messages INTEGER DEFAULT 0,
  claude_input_tokens BIGINT DEFAULT 0,
  claude_output_tokens BIGINT DEFAULT 0,
  claude_cache_read_tokens BIGINT DEFAULT 0,
  claude_cache_creation_tokens BIGINT DEFAULT 0,
  claude_tool_calls INTEGER DEFAULT 0,
  claude_by_model JSONB DEFAULT '{}',

  -- Git metrics
  git_repos_scanned INTEGER DEFAULT 0,
  git_repos_contributed INTEGER DEFAULT 0,
  git_commits INTEGER DEFAULT 0,
  git_lines_added INTEGER DEFAULT 0,
  git_lines_deleted INTEGER DEFAULT 0,
  git_files_changed INTEGER DEFAULT 0,
  git_by_repo JSONB DEFAULT '[]',

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Daily aggregates (rolled up for faster queries)
CREATE TABLE IF NOT EXISTS daily_metrics (
  id SERIAL PRIMARY KEY,
  user_id TEXT REFERENCES users(id) NOT NULL,
  org_id TEXT REFERENCES organizations(id) NOT NULL,
  date DATE NOT NULL,

  -- Claude metrics (deltas for the day)
  claude_sessions INTEGER DEFAULT 0,
  claude_messages INTEGER DEFAULT 0,
  claude_input_tokens BIGINT DEFAULT 0,
  claude_output_tokens BIGINT DEFAULT 0,
  claude_tool_calls INTEGER DEFAULT 0,

  -- Git metrics (deltas for the day)
  git_commits INTEGER DEFAULT 0,
  git_lines_added INTEGER DEFAULT 0,
  git_prs INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, date)
);

-- Weekly aggregates
CREATE TABLE IF NOT EXISTS weekly_metrics (
  id SERIAL PRIMARY KEY,
  user_id TEXT REFERENCES users(id) NOT NULL,
  org_id TEXT REFERENCES organizations(id) NOT NULL,
  week_start DATE NOT NULL,               -- Monday of the week

  -- Totals for the week
  claude_sessions INTEGER DEFAULT 0,
  claude_messages INTEGER DEFAULT 0,
  claude_input_tokens BIGINT DEFAULT 0,
  claude_output_tokens BIGINT DEFAULT 0,
  claude_tool_calls INTEGER DEFAULT 0,

  git_commits INTEGER DEFAULT 0,
  git_lines_added INTEGER DEFAULT 0,
  git_prs INTEGER DEFAULT 0,
  git_repos_contributed INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, week_start)
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_metrics_snapshots_user_reported
  ON metrics_snapshots(user_id, reported_at DESC);

CREATE INDEX IF NOT EXISTS idx_metrics_snapshots_org_reported
  ON metrics_snapshots(org_id, reported_at DESC);

CREATE INDEX IF NOT EXISTS idx_daily_metrics_user_date
  ON daily_metrics(user_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_daily_metrics_org_date
  ON daily_metrics(org_id, date DESC);

CREATE INDEX IF NOT EXISTS idx_weekly_metrics_org_week
  ON weekly_metrics(org_id, week_start DESC);

-- Device tokens for external bots/tools
CREATE TABLE IF NOT EXISTS device_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) NOT NULL,
  org_id TEXT REFERENCES organizations(id) NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_device_tokens_user
  ON device_tokens(user_id);

CREATE INDEX IF NOT EXISTS idx_device_tokens_hash
  ON device_tokens(token_hash) WHERE revoked_at IS NULL;

-- One-time linking codes for pairing devices
CREATE TABLE IF NOT EXISTS linking_codes (
  id SERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  user_id TEXT REFERENCES users(id) NOT NULL,
  org_id TEXT REFERENCES organizations(id) NOT NULL,
  device_name TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_linking_codes_code
  ON linking_codes(code) WHERE consumed_at IS NULL;

-- Add source column to metrics tables for tracking origin (cli, bot, external tool)
ALTER TABLE metrics_snapshots ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'cli';
ALTER TABLE daily_metrics ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'cli';

CREATE INDEX IF NOT EXISTS idx_metrics_snapshots_source
  ON metrics_snapshots(source);
CREATE INDEX IF NOT EXISTS idx_daily_metrics_source
  ON daily_metrics(source);
