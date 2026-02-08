const path = require('path');
const fs = require('fs');

async function run() {
  console.log('=== Feature #30: Password is hashed in database ===\n');

  // Use sql.js from backend's node_modules
  const backendDir = path.join(__dirname, 'backend');
  const initSqlJs = require(path.join(backendDir, 'node_modules', 'sql.js'));

  const dbPath = path.join(backendDir, 'data', 'tapin.db');
  const SQL = await initSqlJs();
  const fileBuffer = fs.readFileSync(dbPath);
  const db = new SQL.Database(fileBuffer);

  // Query password hashes
  const result = db.exec('SELECT id, email, password_hash FROM users LIMIT 10');

  if (result.length === 0) {
    console.log('FAIL: No users found in database');
    return;
  }

  const rows = result[0].values;

  console.log('Users in database:');
  console.log('---');

  let allHashed = true;
  const plainPasswords = ['password123', 'password', 'admin', '12345', 'test'];

  for (const row of rows) {
    const id = row[0];
    const email = row[1];
    const hash = row[2];

    console.log('User #' + id + ': ' + email);
    console.log('  password_hash: ' + hash);

    // Check 1: hash starts with $2a$ or $2b$ (bcrypt prefix)
    const isBcrypt = typeof hash === 'string' && (hash.startsWith('$2a$') || hash.startsWith('$2b$'));
    console.log('  Is bcrypt format: ' + (isBcrypt ? 'YES' : 'NO'));

    // Check 2: hash length is typical bcrypt (60 chars)
    const correctLength = typeof hash === 'string' && hash.length === 60;
    console.log('  Hash length: ' + (hash ? hash.length : 0) + ' (expected 60)');

    // Check 3: hash does NOT contain plain text passwords
    let containsPlain = false;
    for (const plain of plainPasswords) {
      if (typeof hash === 'string' && hash.toLowerCase().includes(plain.toLowerCase())) {
        containsPlain = true;
        console.log('  WARNING: Hash contains plain text "' + plain + '"!');
      }
    }

    const userPass = isBcrypt && correctLength && !containsPlain;
    console.log('  RESULT: ' + (userPass ? 'PASS (properly hashed)' : 'FAIL'));
    console.log('');

    if (!userPass) allHashed = false;
  }

  // Additional: verify that bcrypt comparison works
  const bcrypt = require(path.join(backendDir, 'node_modules', 'bcryptjs'));
  const firstHash = rows[0][2];
  const matchesCorrectPassword = bcrypt.compareSync('password123', firstHash);
  const matchesWrongPassword = bcrypt.compareSync('wrongpassword', firstHash);

  console.log('Bcrypt verification:');
  console.log('  "password123" matches hash: ' + matchesCorrectPassword + ' (expected true)');
  console.log('  "wrongpassword" matches hash: ' + matchesWrongPassword + ' (expected false)');
  console.log('  RESULT: ' + (matchesCorrectPassword && !matchesWrongPassword ? 'PASS' : 'FAIL'));

  const overall = allHashed && matchesCorrectPassword && !matchesWrongPassword;
  console.log('\n=== OVERALL: ' + (overall ? 'ALL PASS' : 'SOME FAILED') + ' ===');

  db.close();
}

run().catch(console.error);
