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

// POST /api/debug/schema/simulate-age - Set a payment request's updated_at to simulate aging
// Development only - used for testing reminder notifications
router.post('/simulate-age', (req, res) => {
  const db = getDb();
  const { payment_request_id, days_ago } = req.body;

  if (!payment_request_id || !days_ago) {
    return res.status(400).json({ error: 'payment_request_id and days_ago are required' });
  }

  const pr = db.prepare('SELECT id, status, updated_at FROM payment_requests WHERE id = ?').get(payment_request_id);
  if (!pr) {
    return res.status(404).json({ error: 'Payment request not found' });
  }

  db.prepare(
    "UPDATE payment_requests SET updated_at = datetime('now', ? || ' days') WHERE id = ?"
  ).run(-Math.abs(days_ago), payment_request_id);

  const updated = db.prepare('SELECT id, status, updated_at FROM payment_requests WHERE id = ?').get(payment_request_id);
  res.json({
    success: true,
    payment_request_id: payment_request_id,
    old_updated_at: pr.updated_at,
    new_updated_at: updated.updated_at,
    simulated_days_ago: days_ago
  });
});

module.exports = router;
