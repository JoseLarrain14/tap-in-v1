// Script to create Organization B for data isolation testing
const path = require('path');
const initSqlJs = require(path.join(__dirname, 'backend', 'node_modules', 'sql.js'));
const fs = require('fs');
const bcrypt = require(path.join(__dirname, 'backend', 'node_modules', 'bcryptjs'));

const DB_PATH = path.join(__dirname, 'backend', 'data', 'tapin.db');

async function setup() {
  const SQL = await initSqlJs();
  const fileBuffer = fs.readFileSync(DB_PATH);
  const db = new SQL.Database(fileBuffer);

  // Check if Org B already exists
  const stmt = db.prepare("SELECT id FROM organizations WHERE name = 'CPP Org B Test'");
  if (stmt.step()) {
    const row = stmt.getAsObject();
    console.log('Organization B already exists with ID:', row.id);
    stmt.free();

    // Check if user exists
    const userStmt = db.prepare("SELECT id, email FROM users WHERE email = 'orgb_presidente@tapin.cl'");
    if (userStmt.step()) {
      const user = userStmt.getAsObject();
      console.log('Org B user already exists:', user.email, 'ID:', user.id);
      userStmt.free();
    } else {
      userStmt.free();
    }
    return;
  }
  stmt.free();

  // Create Organization B
  db.run("INSERT INTO organizations (name, school_name) VALUES ('CPP Org B Test', 'Colegio Test B')");

  // Get the new org ID
  const orgStmt = db.prepare("SELECT id FROM organizations WHERE name = 'CPP Org B Test'");
  orgStmt.step();
  const orgB = orgStmt.getAsObject();
  orgStmt.free();
  console.log('Created Organization B with ID:', orgB.id);

  // Create a user for Org B
  const passwordHash = bcrypt.hashSync('password123', 10);
  db.run(
    "INSERT INTO users (organization_id, email, password_hash, name, role) VALUES (?, 'orgb_presidente@tapin.cl', ?, 'Pedro OrgB', 'presidente')",
    [orgB.id, passwordHash]
  );
  console.log('Created user orgb_presidente@tapin.cl for Org B');

  // Create some categories for Org B
  db.run("INSERT INTO categories (organization_id, name, type) VALUES (?, 'Cuota OrgB', 'ingreso')", [orgB.id]);
  db.run("INSERT INTO categories (organization_id, name, type) VALUES (?, 'Materiales OrgB', 'egreso')", [orgB.id]);
  console.log('Created categories for Org B');

  // Save to disk
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
  console.log('Database saved to disk');

  db.close();
  console.log('Done!');
}

setup().catch(console.error);
