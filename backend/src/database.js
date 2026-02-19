const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

// Ensure data directory exists
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const DB_PATH = path.join(dataDir, 'tapin.db');

let db = null;
let SQL = null;

// Save database to disk
function saveDatabase() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  }
}

// Auto-save interval (every 5 seconds)
let saveInterval = null;

// Compatibility wrapper that mimics better-sqlite3 API
// so that route files can use db.prepare(sql).get(...), .all(...), .run(...)
function createPreparedStatement(sql) {
  return {
    get(...params) {
      console.log('[SQL]', sql.trim().substring(0, 120), params.length ? JSON.stringify(params).substring(0, 100) : '');
      try {
        const stmt = db.prepare(sql);
        if (params.length > 0) {
          stmt.bind(params);
        }
        if (stmt.step()) {
          const row = stmt.getAsObject();
          stmt.free();
          return row;
        }
        stmt.free();
        return undefined;
      } catch (err) {
        console.error('[SQL ERROR]', err.message);
        throw err;
      }
    },
    all(...params) {
      console.log('[SQL]', sql.trim().substring(0, 120), params.length ? JSON.stringify(params).substring(0, 100) : '');
      try {
        const stmt = db.prepare(sql);
        if (params.length > 0) {
          stmt.bind(params);
        }
        const results = [];
        while (stmt.step()) {
          results.push(stmt.getAsObject());
        }
        stmt.free();
        return results;
      } catch (err) {
        console.error('[SQL ERROR]', err.message);
        throw err;
      }
    },
    run(...params) {
      console.log('[SQL]', sql.trim().substring(0, 120), params.length ? JSON.stringify(params).substring(0, 100) : '');
      try {
        db.run(sql, params);
        // Get last insert rowid
        const lastIdResult = db.exec('SELECT last_insert_rowid() as id');
        const lastInsertRowid = lastIdResult.length > 0 ? lastIdResult[0].values[0][0] : 0;
        // Get changes count
        const changesResult = db.exec('SELECT changes() as c');
        const changes = changesResult.length > 0 ? changesResult[0].values[0][0] : 0;
        // Save to disk after write operations
        saveDatabase();
        return { lastInsertRowid, changes };
      } catch (err) {
        console.error('[SQL ERROR]', err.message);
        throw err;
      }
    }
  };
}

// Database wrapper that mimics better-sqlite3 interface
function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return {
    prepare(sql) {
      return createPreparedStatement(sql);
    },
    exec(sql) {
      console.log('[SQL EXEC]', sql.trim().substring(0, 120));
      db.exec(sql);
      saveDatabase();
    },
    pragma(pragmaStr) {
      db.run(`PRAGMA ${pragmaStr}`);
    }
  };
}

async function initializeDatabase() {
  SQL = await initSqlJs();

  // Load existing database or create new one
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
    console.log(`[Database] SQLite connected at ${DB_PATH}`);
  } else {
    db = new SQL.Database();
    console.log('[Database] Created new database');
  }

  // Enable foreign keys
  db.run('PRAGMA foreign_keys = ON;');

  // Set up auto-save
  saveInterval = setInterval(saveDatabase, 5000);

  return db;
}

function initializeSchema() {
  if (!db) throw new Error('Database not initialized');

  db.run(`
    CREATE TABLE IF NOT EXISTS organizations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      school_name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_id INTEGER NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('delegado', 'presidente', 'secretaria')),
      is_active BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (organization_id) REFERENCES organizations(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('ingreso', 'egreso')),
      is_default BOOLEAN DEFAULT 0,
      version INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (organization_id) REFERENCES organizations(id)
    )
  `);

  // Add version column if it doesn't exist (migration for existing databases)
  try {
    db.run('ALTER TABLE categories ADD COLUMN version INTEGER DEFAULT 1');
    console.log('[Database] Added version column to categories table');
  } catch (e) {
    // Column already exists, ignore
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_id INTEGER NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('ingreso', 'egreso')),
      amount INTEGER NOT NULL,
      category_id INTEGER,
      description TEXT,
      date DATE NOT NULL,
      payer_name TEXT,
      payer_rut TEXT,
      beneficiary TEXT,
      source TEXT DEFAULT 'manual',
      external_id TEXT,
      raw_metadata TEXT,
      created_by INTEGER NOT NULL,
      edited_by INTEGER,
      edited_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      deleted_at DATETIME,
      deleted_by INTEGER,
      period_year INTEGER,
      FOREIGN KEY (organization_id) REFERENCES organizations(id),
      FOREIGN KEY (category_id) REFERENCES categories(id),
      FOREIGN KEY (created_by) REFERENCES users(id),
      FOREIGN KEY (edited_by) REFERENCES users(id),
      FOREIGN KEY (deleted_by) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS payment_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_id INTEGER NOT NULL,
      transaction_id INTEGER,
      amount INTEGER NOT NULL,
      category_id INTEGER,
      description TEXT NOT NULL,
      beneficiary TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'borrador' CHECK(status IN ('borrador', 'pendiente', 'aprobado', 'rechazado', 'ejecutado')),
      created_by INTEGER NOT NULL,
      approved_by INTEGER,
      approved_at DATETIME,
      rejected_by INTEGER,
      rejected_at DATETIME,
      rejection_comment TEXT,
      executed_by INTEGER,
      executed_at DATETIME,
      source TEXT DEFAULT 'manual',
      external_id TEXT,
      raw_metadata TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      period_year INTEGER,
      FOREIGN KEY (organization_id) REFERENCES organizations(id),
      FOREIGN KEY (transaction_id) REFERENCES transactions(id),
      FOREIGN KEY (category_id) REFERENCES categories(id),
      FOREIGN KEY (created_by) REFERENCES users(id),
      FOREIGN KEY (approved_by) REFERENCES users(id),
      FOREIGN KEY (rejected_by) REFERENCES users(id),
      FOREIGN KEY (executed_by) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS payment_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payment_request_id INTEGER NOT NULL,
      previous_status TEXT,
      new_status TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      comment TEXT,
      ip_address TEXT,
      user_agent TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (payment_request_id) REFERENCES payment_requests(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_id INTEGER NOT NULL,
      entity_type TEXT NOT NULL CHECK(entity_type IN ('transaction', 'payment_request')),
      entity_id INTEGER NOT NULL,
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_type TEXT,
      file_size INTEGER,
      attachment_type TEXT CHECK(attachment_type IN ('respaldo', 'comprobante')),
      uploaded_by INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (organization_id) REFERENCES organizations(id),
      FOREIGN KEY (uploaded_by) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      organization_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('solicitud_creada', 'solicitud_aprobada', 'solicitud_rechazada', 'solicitud_ejecutada', 'recordatorio')),
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      reference_type TEXT,
      reference_id INTEGER,
      is_read BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (organization_id) REFERENCES organizations(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS transaction_audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_id INTEGER NOT NULL,
      action TEXT NOT NULL CHECK(action IN ('created', 'edited', 'deleted')),
      user_id INTEGER NOT NULL,
      changes TEXT,
      ip_address TEXT,
      user_agent TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (transaction_id) REFERENCES transactions(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // Performance indexes for common query patterns
  // Dashboard & transaction queries
  db.run(`CREATE INDEX IF NOT EXISTS idx_transactions_org_type_deleted ON transactions(organization_id, type, deleted_at)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_transactions_org_type_date ON transactions(organization_id, type, deleted_at, date)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_transactions_org_deleted_date ON transactions(organization_id, deleted_at, date)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id, deleted_at, type)`);
  // Payment request queries
  db.run(`CREATE INDEX IF NOT EXISTS idx_payment_requests_org_status ON payment_requests(organization_id, status)`);
  // Notification queries
  db.run(`CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read)`);
  // Audit log queries
  db.run(`CREATE INDEX IF NOT EXISTS idx_audit_transaction ON transaction_audit_log(transaction_id)`);
  // Attachment queries
  db.run(`CREATE INDEX IF NOT EXISTS idx_attachments_entity ON attachments(entity_type, entity_id)`);

  saveDatabase();
  console.log('[Database] Schema initialized successfully (with indexes)');
}

function seedDefaultData() {
  if (!db) throw new Error('Database not initialized');

  const userCountResult = db.exec('SELECT COUNT(*) as count FROM users');
  const userCount = userCountResult[0].values[0][0];
  if (userCount > 0) {
    console.log('[Database] Users already exist, skipping seed');
    return;
  }

  // Need to create default org, categories, and users
  let orgId;
  const orgResult = db.exec('SELECT COUNT(*) as count FROM organizations');
  const orgCount = orgResult[0].values[0][0];
  if (orgCount > 0) {
    const firstOrg = db.exec('SELECT id FROM organizations LIMIT 1');
    orgId = firstOrg[0].values[0][0];
    console.log('[Database] Organization exists but no users; creating default users for org', orgId);
  } else {
    db.run("INSERT INTO organizations (name, school_name) VALUES ('CPP Demo', 'Colegio Demo Santiago')");
    const orgIdResult = db.exec('SELECT last_insert_rowid() as id');
    orgId = orgIdResult[0].values[0][0];
    const incomeCategories = ['Cuota Mensual', 'Evento', 'Taller', 'Donación', 'Otro'];
    for (const cat of incomeCategories) {
      db.run('INSERT INTO categories (organization_id, name, type, is_default) VALUES (?, ?, ?, ?)', [orgId, cat, 'ingreso', 1]);
    }
    const expenseCategories = ['Materiales', 'Servicios', 'Eventos', 'Infraestructura', 'Otro'];
    for (const cat of expenseCategories) {
      db.run('INSERT INTO categories (organization_id, name, type, is_default) VALUES (?, ?, ?, ?)', [orgId, cat, 'egreso', 1]);
    }
  }

  const bcrypt = require('bcryptjs');
  const passwordHash = bcrypt.hashSync('password123', 10);
  const users = [
    { email: 'presidente@tapin.cl', name: 'María González', role: 'presidente' },
    { email: 'secretaria@tapin.cl', name: 'Ana Martínez', role: 'secretaria' },
    { email: 'delegado@tapin.cl', name: 'Carlos López', role: 'delegado' },
  ];
  for (const user of users) {
    db.run(
      'INSERT INTO users (organization_id, email, password_hash, name, role) VALUES (?, ?, ?, ?, ?)',
      [orgId, user.email, passwordHash, user.name, user.role]
    );
  }

  saveDatabase();
  console.log('[Database] Default data seeded successfully');
  console.log('[Database] Test users created:');
  console.log('  - presidente@tapin.cl / password123 (Presidente)');
  console.log('  - secretaria@tapin.cl / password123 (Secretaria)');
  console.log('  - delegado@tapin.cl / password123 (Delegado)');
}

function checkDatabaseHealth() {
  try {
    if (!db) {
      return { connected: false, error: 'Database not initialized' };
    }

    // Quick query to check connection
    const result = db.exec('SELECT 1 as ok');

    // Get table list
    const tablesResult = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
    const tables = tablesResult.length > 0 ? tablesResult[0].values.map(v => v[0]) : [];

    return {
      connected: true,
      path: DB_PATH,
      tables: tables,
      tableCount: tables.length
    };
  } catch (error) {
    return {
      connected: false,
      error: error.message
    };
  }
}

function closeDb() {
  if (saveInterval) {
    clearInterval(saveInterval);
    saveInterval = null;
  }
  if (db) {
    saveDatabase();
    db.close();
    db = null;
    console.log('[Database] Connection closed');
  }
}

module.exports = {
  initializeDatabase,
  getDb,
  initializeSchema,
  seedDefaultData,
  checkDatabaseHealth,
  closeDb
};
