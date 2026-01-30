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
  org_id TEXT REFERENCES organizations(id),  -- Last synced org (for backwards compatibility)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User org memberships (tracks which orgs a user belongs to)
CREATE TABLE IF NOT EXISTS user_org_memberships (
  user_id TEXT REFERENCES users(id) NOT NULL,
  org_id TEXT REFERENCES organizations(id) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, org_id)
);

-- Metrics snapshots (raw data from CLI reports)
CREATE TABLE IF NOT EXISTS metrics_snapshots (
  id SERIAL PRIMARY KEY,
  user_id TEXT REFERENCES users(id) NOT NULL,
  org_id TEXT REFERENCES organizations(id) NOT NULL,
  reported_at TIMESTAMPTZ NOT NULL,
  stats_cache_updated_at TIMESTAMPTZ,          -- When stats-cache.json was last updated by Claude
  source TEXT DEFAULT 'claude_code',           -- Source: claude_code, openclaw, cursor, etc.

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
  source TEXT DEFAULT 'claude_code',       -- Source: claude_code, openclaw, cursor, etc.

  -- Claude metrics (deltas for the day)
  claude_sessions INTEGER DEFAULT 0,
  claude_messages INTEGER DEFAULT 0,
  claude_tokens BIGINT DEFAULT 0,          -- Combined tokens (input+output not tracked separately daily)
  claude_tool_calls INTEGER DEFAULT 0,

  -- Git metrics (deltas for the day)
  git_commits INTEGER DEFAULT 0,
  git_lines_added INTEGER DEFAULT 0,
  git_lines_deleted INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, date, source)            -- Allow multiple sources per user per day
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
  claude_tokens BIGINT DEFAULT 0,          -- Combined tokens (input+output not tracked separately daily)
  claude_tool_calls INTEGER DEFAULT 0,

  git_commits INTEGER DEFAULT 0,
  git_lines_added INTEGER DEFAULT 0,
  git_lines_deleted INTEGER DEFAULT 0,
  git_repos_contributed INTEGER DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id, week_start)
);

-- Join requests (for users requesting to join an organization)
CREATE TABLE IF NOT EXISTS join_requests (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,                  -- Clerk user ID (may not be in users table yet)
  user_email TEXT NOT NULL,
  user_name TEXT,
  org_id TEXT REFERENCES organizations(id) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, denied
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT,                       -- Clerk user ID of admin who resolved

  UNIQUE(user_id, org_id)
);

-- Device tokens (for external tools like OpenClaw to authenticate)
CREATE TABLE IF NOT EXISTS device_tokens (
  id TEXT PRIMARY KEY,                      -- Token ID (clm_...)
  user_id TEXT REFERENCES users(id) NOT NULL,
  org_id TEXT REFERENCES organizations(id) NOT NULL,
  device_name TEXT NOT NULL,                -- e.g., "OpenClaw on MacBook Pro"
  source TEXT NOT NULL DEFAULT 'openclaw',  -- Tool type: openclaw, cursor, etc.
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  revoked_at TIMESTAMPTZ                    -- NULL if active, timestamp if revoked
);

-- Linking codes (temporary codes for pairing devices)
CREATE TABLE IF NOT EXISTS linking_codes (
  code TEXT PRIMARY KEY,                    -- 6-character code
  user_id TEXT REFERENCES users(id) NOT NULL,
  org_id TEXT REFERENCES organizations(id) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,                      -- NULL if unused
  device_token_id TEXT REFERENCES device_tokens(id),  -- Set when code is used
  created_at TIMESTAMPTZ DEFAULT NOW()
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

CREATE INDEX IF NOT EXISTS idx_user_org_memberships_org
  ON user_org_memberships(org_id);

CREATE INDEX IF NOT EXISTS idx_join_requests_org_status
  ON join_requests(org_id, status);

CREATE INDEX IF NOT EXISTS idx_device_tokens_user
  ON device_tokens(user_id);

CREATE INDEX IF NOT EXISTS idx_linking_codes_expires
  ON linking_codes(expires_at) WHERE used_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_daily_metrics_source
  ON daily_metrics(source);
