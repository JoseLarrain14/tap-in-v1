const Database = require('./backend/node_modules/sql.js');
const fs = require('fs');

async function main() {
  const SQL = await Database();
  const buf = fs.readFileSync('.autoforge/features.db');
  const db = new SQL.Database(buf);

  const featureId = parseInt(process.argv[2]);
  const action = process.argv[3] || 'in_progress';

  if (action === 'in_progress') {
    db.run('UPDATE features SET in_progress = 1 WHERE id = ?', [featureId]);
    console.log('Feature #' + featureId + ' marked as in_progress');
  } else if (action === 'passing') {
    db.run('UPDATE features SET passes = 1, in_progress = 0 WHERE id = ?', [featureId]);
    console.log('Feature #' + featureId + ' marked as passing');
  } else if (action === 'failing') {
    db.run('UPDATE features SET passes = 0, in_progress = 0 WHERE id = ?', [featureId]);
    console.log('Feature #' + featureId + ' marked as failing');
  }

  // Save back
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync('.autoforge/features.db', buffer);
  db.close();
}
main().catch(console.error);
