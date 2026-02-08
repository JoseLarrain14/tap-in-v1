const express = require('express');
const router = express.Router();
const { getDb } = require('../database');
const { authenticateToken, requireActive } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// GET /api/transactions - List transactions with filters
router.get('/', (req, res) => {
  const db = getDb();
  const orgId = req.user.organization_id;
  const { type, category_id, from, to, search, sort_by, sort_order, page, limit: limitParam } = req.query;

  let query = `
    SELECT t.*, c.name as category_name, u.name as created_by_name, eu.name as edited_by_name
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    LEFT JOIN users u ON t.created_by = u.id
    LEFT JOIN users eu ON t.edited_by = eu.id
    WHERE t.organization_id = ? AND t.deleted_at IS NULL
  `;
  const params = [orgId];

  if (type) {
    query += ' AND t.type = ?';
    params.push(type);
  }

  if (category_id) {
    query += ' AND t.category_id = ?';
    params.push(category_id);
  }

  if (from) {
    query += ' AND t.date >= ?';
    params.push(from);
  }

  if (to) {
    query += ' AND t.date <= ?';
    params.push(to);
  }

  if (search) {
    query += ' AND (t.description LIKE ? OR t.payer_name LIKE ? OR t.beneficiary LIKE ?)';
    const searchTerm = `%${search}%`;
    params.push(searchTerm, searchTerm, searchTerm);
  }

  // Sorting
  const validSortColumns = ['date', 'amount', 'created_at', 'description'];
  const sortColumn = validSortColumns.includes(sort_by) ? sort_by : 'date';
  const sortDirection = sort_order === 'asc' ? 'ASC' : 'DESC';
  query += ` ORDER BY t.${sortColumn} ${sortDirection}`;

  // Pagination
  const limit = Math.min(parseInt(limitParam) || 50, 200);
  const offset = ((parseInt(page) || 1) - 1) * limit;
  query += ' LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const transactions = db.prepare(query).all(...params);

  // Get total count for pagination
  let countQuery = `
    SELECT COUNT(*) as total FROM transactions t
    WHERE t.organization_id = ? AND t.deleted_at IS NULL
  `;
  const countParams = [orgId];

  if (type) {
    countQuery += ' AND t.type = ?';
    countParams.push(type);
  }
  if (category_id) {
    countQuery += ' AND t.category_id = ?';
    countParams.push(category_id);
  }
  if (from) {
    countQuery += ' AND t.date >= ?';
    countParams.push(from);
  }
  if (to) {
    countQuery += ' AND t.date <= ?';
    countParams.push(to);
  }
  if (search) {
    countQuery += ' AND (t.description LIKE ? OR t.payer_name LIKE ? OR t.beneficiary LIKE ?)';
    const searchTerm = `%${search}%`;
    countParams.push(searchTerm, searchTerm, searchTerm);
  }

  const { total } = db.prepare(countQuery).get(...countParams);

  res.json({
    transactions,
    pagination: {
      total,
      page: parseInt(page) || 1,
      limit,
      pages: Math.ceil(total / limit)
    }
  });
});

// POST /api/transactions - Create a transaction (income)
router.post('/', requireActive, (req, res) => {
  const db = getDb();
  const orgId = req.user.organization_id;
  const userId = req.user.id;

  const { type, amount, category_id, description, date, payer_name, payer_rut, beneficiary, period_year } = req.body;

  // Validate required fields
  if (!type || !amount || !date) {
    return res.status(400).json({ error: 'Tipo, monto y fecha son requeridos' });
  }

  if (!['ingreso', 'egreso'].includes(type)) {
    return res.status(400).json({ error: 'Tipo debe ser ingreso o egreso' });
  }

  if (typeof amount !== 'number' || amount <= 0) {
    return res.status(400).json({ error: 'Monto debe ser un número positivo' });
  }

  // Validate category belongs to organization
  if (category_id) {
    const category = db.prepare(
      'SELECT id FROM categories WHERE id = ? AND organization_id = ?'
    ).get(category_id, orgId);
    if (!category) {
      return res.status(400).json({ error: 'Categoría no válida' });
    }
  }

  const result = db.prepare(`
    INSERT INTO transactions (organization_id, type, amount, category_id, description, date, payer_name, payer_rut, beneficiary, source, created_by, period_year)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual', ?, ?)
  `).run(orgId, type, amount, category_id || null, description || null, date, payer_name || null, payer_rut || null, beneficiary || null, userId, period_year || new Date(date).getFullYear());

  const transaction = db.prepare(`
    SELECT t.*, c.name as category_name, u.name as created_by_name
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    LEFT JOIN users u ON t.created_by = u.id
    WHERE t.id = ?
  `).get(result.lastInsertRowid);

  // Create audit log entry
  db.prepare(`
    INSERT INTO transaction_audit_log (transaction_id, action, user_id, changes, ip_address, user_agent)
    VALUES (?, 'created', ?, ?, ?, ?)
  `).run(
    result.lastInsertRowid,
    userId,
    JSON.stringify({ type, amount, category_id, description, date }),
    req.ip || null,
    req.headers['user-agent'] || null
  );

  res.status(201).json(transaction);
});

// PUT /api/transactions/:id - Edit a transaction
router.put('/:id', requireActive, (req, res) => {
  try {
    const db = getDb();
    const orgId = req.user.organization_id;
    const userId = req.user.id;
    const transactionId = req.params.id;

    // Verify transaction exists and belongs to org
    const existing = db.prepare(
      'SELECT * FROM transactions WHERE id = ? AND organization_id = ? AND deleted_at IS NULL'
    ).get(transactionId, orgId);

    if (!existing) {
      return res.status(404).json({ error: 'Transacción no encontrada' });
    }

    const { amount, category_id, description, date, payer_name, payer_rut, beneficiary } = req.body;

    // Track changes for audit
    const changes = {};
    if (amount !== undefined && amount !== existing.amount) changes.amount = { from: existing.amount, to: amount };
    if (description !== undefined && description !== existing.description) changes.description = { from: existing.description, to: description };
    if (date !== undefined && date !== existing.date) changes.date = { from: existing.date, to: date };
    if (category_id !== undefined && category_id !== existing.category_id) changes.category_id = { from: existing.category_id, to: category_id };
    if (payer_name !== undefined && payer_name !== existing.payer_name) changes.payer_name = { from: existing.payer_name, to: payer_name };
    if (payer_rut !== undefined && payer_rut !== existing.payer_rut) changes.payer_rut = { from: existing.payer_rut, to: payer_rut };

    // Use explicit values - convert undefined to null for sql.js compatibility
    const newAmount = (amount !== undefined && amount !== null) ? amount : null;
    const newCategoryId = (category_id !== undefined && category_id !== null) ? category_id : null;
    const newDescription = (description !== undefined && description !== null && description !== '') ? description : null;
    const newDate = (date !== undefined && date !== null) ? date : null;
    const newPayerName = (payer_name !== undefined && payer_name !== null && payer_name !== '') ? payer_name : null;
    const newPayerRut = (payer_rut !== undefined && payer_rut !== null && payer_rut !== '') ? payer_rut : null;
    const newBeneficiary = (beneficiary !== undefined && beneficiary !== null && beneficiary !== '') ? beneficiary : null;

    db.prepare(`
      UPDATE transactions SET
        amount = COALESCE(?, amount),
        category_id = COALESCE(?, category_id),
        description = COALESCE(?, description),
        date = COALESCE(?, date),
        payer_name = COALESCE(?, payer_name),
        payer_rut = COALESCE(?, payer_rut),
        beneficiary = COALESCE(?, beneficiary),
        edited_by = ?,
        edited_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND organization_id = ?
    `).run(
      newAmount, newCategoryId, newDescription, newDate,
      newPayerName, newPayerRut, newBeneficiary,
      userId, transactionId, orgId
    );

    // Create audit log
    db.prepare(`
      INSERT INTO transaction_audit_log (transaction_id, action, user_id, changes, ip_address, user_agent)
      VALUES (?, 'edited', ?, ?, ?, ?)
    `).run(transactionId, userId, JSON.stringify(changes), req.ip || null, req.headers['user-agent'] || null);

    const updated = db.prepare(`
      SELECT t.*, c.name as category_name, u.name as created_by_name
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN users u ON t.created_by = u.id
      WHERE t.id = ?
    `).get(transactionId);

    res.json(updated);
  } catch (err) {
    console.error('[PUT /transactions/:id ERROR]', err);
    res.status(500).json({ error: 'Error al actualizar transacción' });
  }
});

// DELETE /api/transactions/:id - Soft delete a transaction
router.delete('/:id', requireActive, (req, res) => {
  const db = getDb();
  const orgId = req.user.organization_id;
  const userId = req.user.id;
  const transactionId = req.params.id;

  const existing = db.prepare(
    'SELECT * FROM transactions WHERE id = ? AND organization_id = ? AND deleted_at IS NULL'
  ).get(transactionId, orgId);

  if (!existing) {
    return res.status(404).json({ error: 'Transacción no encontrada' });
  }

  db.prepare(`
    UPDATE transactions SET deleted_at = CURRENT_TIMESTAMP, deleted_by = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND organization_id = ?
  `).run(userId, transactionId, orgId);

  // Audit log
  db.prepare(`
    INSERT INTO transaction_audit_log (transaction_id, action, user_id, changes, ip_address, user_agent)
    VALUES (?, 'deleted', ?, ?, ?, ?)
  `).run(transactionId, userId, JSON.stringify({ deleted: true }), req.ip || null, req.headers['user-agent'] || null);

  res.json({ message: 'Transacción eliminada' });
});

// GET /api/transactions/:id/audit - Get audit trail for a transaction
router.get('/:id/audit', (req, res) => {
  const db = getDb();
  const orgId = req.user.organization_id;
  const transactionId = req.params.id;

  // Verify transaction belongs to org
  const transaction = db.prepare(
    'SELECT id FROM transactions WHERE id = ? AND organization_id = ?'
  ).get(transactionId, orgId);

  if (!transaction) {
    return res.status(404).json({ error: 'Transacción no encontrada' });
  }

  const auditLog = db.prepare(`
    SELECT tal.*, u.name as user_name
    FROM transaction_audit_log tal
    LEFT JOIN users u ON tal.user_id = u.id
    WHERE tal.transaction_id = ?
    ORDER BY tal.created_at ASC
  `).all(transactionId);

  res.json(auditLog);
});

module.exports = router;
