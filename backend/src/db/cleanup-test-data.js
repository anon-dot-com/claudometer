import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function cleanupTestData() {
  console.log('Starting test data cleanup...\n');

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Find test user IDs (hardcoded dev auth user)
    const testUserIds = [
      'user_38P0EZbTtZzeXb0l251IJLM1kxk', // Hardcoded dev auth user
    ];

    // Find test org IDs
    const testOrgIds = [
      'org_anthropic', // Dev auth org
    ];

    // Delete from daily_metrics
    const dailyResult = await client.query(
      `DELETE FROM daily_metrics
       WHERE user_id = ANY($1) OR org_id = ANY($2)
       RETURNING id`,
      [testUserIds, testOrgIds]
    );
    console.log(`Deleted ${dailyResult.rowCount} rows from daily_metrics`);

    // Delete from metrics_snapshots
    const snapshotResult = await client.query(
      `DELETE FROM metrics_snapshots
       WHERE user_id = ANY($1) OR org_id = ANY($2)
       RETURNING id`,
      [testUserIds, testOrgIds]
    );
    console.log(`Deleted ${snapshotResult.rowCount} rows from metrics_snapshots`);

    // Delete from weekly_metrics
    const weeklyResult = await client.query(
      `DELETE FROM weekly_metrics
       WHERE user_id = ANY($1) OR org_id = ANY($2)
       RETURNING id`,
      [testUserIds, testOrgIds]
    );
    console.log(`Deleted ${weeklyResult.rowCount} rows from weekly_metrics`);

    // Delete test users
    const userResult = await client.query(
      `DELETE FROM users
       WHERE id = ANY($1) OR org_id = ANY($2)
       RETURNING id, email`,
      [testUserIds, testOrgIds]
    );
    console.log(`Deleted ${userResult.rowCount} users:`);
    for (const row of userResult.rows) {
      console.log(`  - ${row.email} (${row.id})`);
    }

    // Delete test orgs
    const orgResult = await client.query(
      `DELETE FROM organizations
       WHERE id = ANY($1)
       RETURNING id, name`,
      [testOrgIds]
    );
    console.log(`Deleted ${orgResult.rowCount} organizations:`);
    for (const row of orgResult.rows) {
      console.log(`  - ${row.name} (${row.id})`);
    }

    await client.query('COMMIT');
    console.log('\nCleanup completed successfully!');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Cleanup failed:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run if executed directly
cleanupTestData().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
