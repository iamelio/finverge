const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const config = require('./config');

let instance;

function getDb() {
  if (!instance) {
    fs.mkdirSync(path.dirname(config.databasePath), { recursive: true });
    instance = new Database(config.databasePath);
    instance.pragma('journal_mode = WAL');
    instance.pragma('foreign_keys = ON');
  }
  return instance;
}

module.exports = {
  getDb,
};
