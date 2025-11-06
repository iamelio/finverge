const { getDb } = require('./db');
const { runMigrations, seedAdmin } = require('./migrations');

try {
  const db = getDb();
  runMigrations(db);
  seedAdmin(db);
  console.log('Migrations applied successfully.');
  process.exit(0);
} catch (err) {
  console.error('Migration failed:', err);
  process.exit(1);
}
