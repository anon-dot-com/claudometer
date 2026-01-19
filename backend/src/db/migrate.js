import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function migrate() {
  console.log('Running database migrations...\n');

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Migration 1: Rename claude_output_tokens to claude_tokens in daily_metrics
    console.log('Checking daily_metrics schema...');

    const dailyColumns = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'daily_metrics'
    `);
    const dailyColumnNames = dailyColumns.rows.map(r => r.column_name);

    if (dailyColumnNames.includes('claude_output_tokens') && !dailyColumnNames.includes('claude_tokens')) {
      console.log('  Renaming claude_output_tokens to claude_tokens...');
      await client.query(`
        ALTER TABLE daily_metrics
        RENAME COLUMN claude_output_tokens TO claude_tokens
      `);
    }

    if (dailyColumnNames.includes('claude_input_tokens')) {
      console.log('  Dropping claude_input_tokens column...');
      await client.query(`
        ALTER TABLE daily_metrics
        DROP COLUMN IF EXISTS claude_input_tokens
      `);
    }

    if (!dailyColumnNames.includes('git_lines_deleted')) {
      console.log('  Adding git_lines_deleted column...');
      await client.query(`
        ALTER TABLE daily_metrics
        ADD COLUMN IF NOT EXISTS git_lines_deleted INTEGER DEFAULT 0
      `);
    }

    // Remove git_prs if it exists (never populated)
    if (dailyColumnNames.includes('git_prs')) {
      console.log('  Dropping unused git_prs column...');
      await client.query(`
        ALTER TABLE daily_metrics
        DROP COLUMN IF EXISTS git_prs
      `);
    }

    // Migration 2: Same for weekly_metrics
    console.log('\nChecking weekly_metrics schema...');

    const weeklyColumns = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'weekly_metrics'
    `);
    const weeklyColumnNames = weeklyColumns.rows.map(r => r.column_name);

    if (weeklyColumnNames.includes('claude_output_tokens') && !weeklyColumnNames.includes('claude_tokens')) {
      console.log('  Renaming claude_output_tokens to claude_tokens...');
      await client.query(`
        ALTER TABLE weekly_metrics
        RENAME COLUMN claude_output_tokens TO claude_tokens
      `);
    }

    if (weeklyColumnNames.includes('claude_input_tokens')) {
      console.log('  Dropping claude_input_tokens column...');
      await client.query(`
        ALTER TABLE weekly_metrics
        DROP COLUMN IF EXISTS claude_input_tokens
      `);
    }

    if (!weeklyColumnNames.includes('git_lines_deleted')) {
      console.log('  Adding git_lines_deleted column...');
      await client.query(`
        ALTER TABLE weekly_metrics
        ADD COLUMN IF NOT EXISTS git_lines_deleted INTEGER DEFAULT 0
      `);
    }

    if (weeklyColumnNames.includes('git_prs')) {
      console.log('  Dropping unused git_prs column...');
      await client.query(`
        ALTER TABLE weekly_metrics
        DROP COLUMN IF EXISTS git_prs
      `);
    }

    await client.query('COMMIT');
    console.log('\nMigrations completed successfully!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run if executed directly
migrate().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
