const bcrypt = require('bcryptjs');
const config = require('./config');

const migrations = [
  `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      phone TEXT,
      employment TEXT,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );`,
  `CREATE TABLE IF NOT EXISTS loan_applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      amount INTEGER NOT NULL,
      tenure INTEGER NOT NULL,
      income INTEGER NOT NULL,
      employment TEXT NOT NULL,
      purpose TEXT NOT NULL,
      collateral TEXT,
      notes TEXT,
      annual_rate REAL NOT NULL,
      monthly_emi INTEGER NOT NULL,
      eligible_preview INTEGER NOT NULL,
      preview_reasons TEXT,
      status TEXT NOT NULL DEFAULT 'Pending',
      admin_notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );`,
  `CREATE TABLE IF NOT EXISTS loan_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      application_id INTEGER NOT NULL,
      actor_id INTEGER,
      actor_role TEXT,
      event_type TEXT NOT NULL,
      detail TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (application_id) REFERENCES loan_applications(id) ON DELETE CASCADE,
      FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL
    );`,
  `CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);`,
  `CREATE INDEX IF NOT EXISTS idx_loans_user_id ON loan_applications(user_id);`,
  `CREATE INDEX IF NOT EXISTS idx_loans_status_created ON loan_applications(status, created_at);`,
  `CREATE INDEX IF NOT EXISTS idx_events_application_id ON loan_events(application_id, created_at);`
];

function runMigrations(db) {
  db.exec('BEGIN');
  try {
    migrations.forEach((sql) => db.exec(sql));
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

function seedAdmin(db) {
  const { adminSeedEmail, adminSeedPassword } = config;
  if (!adminSeedEmail || !adminSeedPassword) {
    return;
  }
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(adminSeedEmail.toLowerCase());
  if (existing) {
    return;
  }
  const hash = bcrypt.hashSync(adminSeedPassword, 10);
  db.prepare(`INSERT INTO users (name, email, phone, employment, password_hash, role)
              VALUES (@name, @email, @phone, @employment, @password_hash, @role)`).run({
    name: 'Administrator',
    email: adminSeedEmail.toLowerCase(),
    phone: null,
    employment: 'administrator',
    password_hash: hash,
    role: 'admin',
  });
  console.log(`Seeded admin user: ${adminSeedEmail.toLowerCase()}`);
}

module.exports = {
  runMigrations,
  seedAdmin,
};
