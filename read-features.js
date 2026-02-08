const Database = require('./backend/node_modules/sql.js');
const fs = require('fs');

async function main() {
  const SQL = await Database();
  const buf = fs.readFileSync('.autoforge/features.db');
  const db = new SQL.Database(buf);

  const ids = process.argv.slice(2).map(Number);

  if (ids.length === 0) {
    // Show schema
    const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table'");
    console.log('Tables:', JSON.stringify(tables));
    const cols = db.exec("PRAGMA table_info(features)");
    console.log('Columns:', JSON.stringify(cols));
  } else {
    for (const id of ids) {
      const result = db.exec('SELECT * FROM features WHERE id = ' + id);
      if (result.length > 0) {
        const cols = result[0].columns;
        const vals = result[0].values[0];
        const feature = {};
        cols.forEach((c, i) => feature[c] = vals[i]);
        console.log('=== Feature #' + id + ' ===');
        console.log(JSON.stringify(feature, null, 2));
      } else {
        console.log('Feature #' + id + ' not found');
      }
    }
  }

  db.close();
}
main().catch(console.error);
