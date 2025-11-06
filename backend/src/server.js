const config = require('./config');
const { getDb } = require('./db');
const { runMigrations, seedAdmin } = require('./migrations');
const app = require('./app');

function bootstrap() {
  try {
    const db = getDb();
    runMigrations(db);
    seedAdmin(db);
    app.locals.db = db;
    app.listen(config.port, () => {
      console.log(`Loan API listening on port ${config.port}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

bootstrap();
