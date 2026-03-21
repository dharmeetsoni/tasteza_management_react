const fs = require('fs');
const path = require('path');
const db = require('./config/db');

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

// ── Ensure the tracking table exists ──────────────────────
async function ensureTrackingTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id           INT AUTO_INCREMENT PRIMARY KEY,
      filename     VARCHAR(255) NOT NULL UNIQUE,
      status       ENUM('success','failed') NOT NULL DEFAULT 'success',
      error        TEXT         DEFAULT NULL,
      executed_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
}

// ── Get list of already-run migrations ────────────────────
async function getRanMigrations() {
  const [rows] = await db.query(
    `SELECT filename, status FROM _migrations`
  );
  // Return a map: filename → status
  return Object.fromEntries(rows.map((r) => [r.filename, r.status]));
}

// ── Run a single .sql file ────────────────────────────────
async function runMigration(filename, filePath) {
  const sql = fs.readFileSync(filePath, 'utf8');

  // Split on semicolons to support multi-statement files
  const statements = sql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith('--'));

  // Skip entirely empty files
  if (statements.length === 0) {
    console.log(`  ⏭️  ${filename} — empty file, skipping`);
    await db.query(
      `INSERT INTO _migrations (filename, status) VALUES (?, 'success')
       ON DUPLICATE KEY UPDATE status = 'success', error = NULL, executed_at = NOW()`,
      [filename]
    );
    return;
  }

  const conn = await db.getConnection();
  try {
    // Disable FK checks for the duration of this migration
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    await conn.beginTransaction();
    for (const stmt of statements) {
      await conn.query(stmt);
    }
    await conn.commit();
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');

    await db.query(
      `INSERT INTO _migrations (filename, status) VALUES (?, 'success')
       ON DUPLICATE KEY UPDATE status = 'success', error = NULL, executed_at = NOW()`,
      [filename]
    );

    console.log(`  ✅  ${filename}`);
  } catch (err) {
    await conn.rollback();
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');

    await db.query(
      `INSERT INTO _migrations (filename, status, error) VALUES (?, 'failed', ?)
       ON DUPLICATE KEY UPDATE status = 'failed', error = ?, executed_at = NOW()`,
      [filename, err.message, err.message]
    );

    console.error(`  ❌  ${filename} — ${err.message}`);
    // Don't throw — let other migrations continue
  } finally {
    conn.release();
  }
}

// ── Main entry point ──────────────────────────────────────
async function runMigrations() {
  console.log('\n🗄️  Running database migrations…');

  await ensureTrackingTable();

  const ran = await getRanMigrations();

  // Get all .sql files sorted by name (001_, 002_, …)
  const files = fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.log('   No migration files found.\n');
    return;
  }

  let skipped = 0;
  let executed = 0;
  let failed = 0;

  for (const filename of files) {
    const prevStatus = ran[filename];

    if (prevStatus === 'success') {
      skipped++;
      continue; // already ran successfully
    }

    // Run if never ran OR previously failed
    if (prevStatus === 'failed') {
      console.log(`  ♻️  Retrying: ${filename}`);
    }

    await runMigration(filename, path.join(MIGRATIONS_DIR, filename));

    // Re-check status after run
    const [[row]] = await db.query(
      'SELECT status FROM _migrations WHERE filename = ?', [filename]
    );
    row?.status === 'success' ? executed++ : failed++;
  }

  console.log(
    `   Done — ${executed} executed, ${skipped} skipped, ${failed} failed.\n`
  );
}

module.exports = runMigrations;
