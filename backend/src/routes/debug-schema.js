const express = require('express');
const router = express.Router();
const { getDb } = require('../database');

// GET /api/debug/schema - Get full database schema info (development only)
router.get('/', (req, res) => {
  const db = getDb();

  const expectedTables = [
    'organizations', 'users', 'categories', 'transactions',
    'payment_requests', 'payment_events', 'attachments',
    'notifications', 'transaction_audit_log'
  ];

  const result = {};

  for (const table of expectedTables) {
    // Get table info
    const columns = db.prepare(`PRAGMA table_info(${table})`).all();
    // Get foreign keys
    const foreignKeys = db.prepare(`PRAGMA foreign_key_list(${table})`).all();

    result[table] = {
      exists: columns.length > 0,
      columns: columns.map(col => ({
        name: col.name,
        type: col.type,
        notNull: col.notnull === 1,
        defaultValue: col.dflt_value,
        primaryKey: col.pk === 1
      })),
      foreignKeys: foreignKeys.map(fk => ({
        from: fk.from,
        table: fk.table,
        to: fk.to
      })),
      columnCount: columns.length
    };
  }

  res.json(result);
});

module.exports = router;
