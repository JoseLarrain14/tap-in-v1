const path = require('path');
const initSqlJs = require(path.join(__dirname, 'backend', 'node_modules', 'sql.js'));
const fs = require('fs');
const bcrypt = require(path.join(__dirname, 'backend', 'node_modules', 'bcryptjs'));

const DB_PATH = path.join(__dirname, 'backend', 'data', 'tapin.db');

async function check() {
  const SQL = await initSqlJs();
  const fileBuffer = fs.readFileSync(DB_PATH);
  const db = new SQL.Database(fileBuffer);

  // Check user
  const stmt = db.prepare("SELECT id, email, password_hash, organization_id FROM users WHERE email = 'orgb_presidente@tapin.cl'");
  if (stmt.step()) {
    const user = stmt.getAsObject();
    console.log('User found:', user.id, user.email, 'org:', user.organization_id);
    console.log('Hash:', user.password_hash);
    console.log('Hash length:', user.password_hash.length);
    console.log('Password matches:', bcrypt.compareSync('password123', user.password_hash));
  } else {
    console.log('User NOT found in DB');
  }
  stmt.free();

  // Also check an existing user for comparison
  const stmt2 = db.prepare("SELECT id, email, password_hash FROM users WHERE email = 'delegado@tapin.cl'");
  if (stmt2.step()) {
    const user = stmt2.getAsObject();
    console.log('\nExisting user:', user.email);
    console.log('Hash:', user.password_hash);
    console.log('Hash length:', user.password_hash.length);
    console.log('Password matches:', bcrypt.compareSync('password123', user.password_hash));
  }
  stmt2.free();

  db.close();
}

check().catch(console.error);
