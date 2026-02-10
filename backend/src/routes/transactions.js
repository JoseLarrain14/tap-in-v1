const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const router = express.Router();
const { getDb } = require('../database');
const { authenticateToken, requireActive } = require('../middleware/auth');

// Chilean RUT validation helper
function validateRut(rut) {
  if (!rut) return true; // Optional field
  const cleaned = rut.replace(/\./g, '').replace(/-/g, '').trim();
  if (cleaned.length < 2) return false;
  const body = cleaned.slice(0, -1);
  const verifier = cleaned.slice(-1).toUpperCase();
  if (!/^\d{1,8}$/.test(body)) return false;
  if (!/^[\dK]$/.test(verifier)) return false;
  let sum = 0;
  let multiplier = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }
  const remainder = 11 - (sum % 11);
  let expected;
  if (remainder === 11) expected = '0';
  else if (remainder === 10) expected = 'K';
  else expected = String(remainder);
  return verifier === expected;
}

// Configure multer for file uploads
const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'txn-attachment-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.pdf', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no permitido. Use JPG, PNG, GIF, PDF o WebP.'));
    }
  }
});

// All routes require authentication
router.use(authenticateToken);

// GET /api/transactions - List transactions with filters
router.get('/', (req, res) => {
  const db = getDb();
  const orgId = req.user.organization_id;
  const { type, category_id, from, to, search, amount_min, amount_max, sort_by, sort_order, page, limit: limitParam } = req.query;

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

  if (amount_min && !isNaN(parseInt(amount_min))) {
    query += ' AND t.amount >= ?';
    params.push(parseInt(amount_min));
  }

  if (amount_max && !isNaN(parseInt(amount_max))) {
    query += ' AND t.amount <= ?';
    params.push(parseInt(amount_max));
  }

  const trimmedSearch = (search || '').trim().slice(0, 500);
  if (trimmedSearch) {
    // Escape LIKE wildcards to prevent unexpected matching with special characters
    const escapedSearch = trimmedSearch.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
    const searchTerm = `%${escapedSearch}%`;
    query += " AND (t.description LIKE ? ESCAPE '\\' OR t.payer_name LIKE ? ESCAPE '\\' OR t.beneficiary LIKE ? ESCAPE '\\')";
    params.push(searchTerm, searchTerm, searchTerm);
  }

  // Sorting
  const validSortColumns = ['date', 'amount', 'created_at', 'description'];
  const sortColumn = validSortColumns.includes(sort_by) ? sort_by : 'date';
  const sortDirection = sort_order === 'asc' ? 'ASC' : 'DESC';
  query += ` ORDER BY t.${sortColumn} ${sortDirection}`;

  // Pagination - allow up to 10000 for exports
  const limit = Math.min(parseInt(limitParam) || 50, 10000);
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
  if (amount_min && !isNaN(parseInt(amount_min))) {
    countQuery += ' AND t.amount >= ?';
    countParams.push(parseInt(amount_min));
  }
  if (amount_max && !isNaN(parseInt(amount_max))) {
    countQuery += ' AND t.amount <= ?';
    countParams.push(parseInt(amount_max));
  }
  if (trimmedSearch) {
    const escapedSearch = trimmedSearch.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
    const searchTerm = `%${escapedSearch}%`;
    countQuery += " AND (t.description LIKE ? ESCAPE '\\' OR t.payer_name LIKE ? ESCAPE '\\' OR t.beneficiary LIKE ? ESCAPE '\\')";
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

  // Validate required fields with specific field errors
  const fieldErrors = {};
  if (!type) fieldErrors.type = 'El tipo es requerido';
  if (!date) fieldErrors.date = 'La fecha es requerida';
  if (amount === undefined || amount === null || amount === '') fieldErrors.amount = 'El monto es requerido';

  if (Object.keys(fieldErrors).length > 0) {
    return res.status(400).json({
      error: 'Campos requeridos faltantes',
      fields: fieldErrors
    });
  }

  if (!['ingreso', 'egreso'].includes(type)) {
    return res.status(400).json({ error: 'Tipo debe ser ingreso o egreso', fields: { type: 'Tipo debe ser ingreso o egreso' } });
  }

  if (typeof amount !== 'number' || isNaN(amount) || amount <= 0) {
    return res.status(400).json({ error: 'Monto debe ser un número positivo', fields: { amount: 'Monto debe ser un número positivo' } });
  }
  if (!Number.isInteger(amount)) {
    return res.status(400).json({ error: 'Monto debe ser un número entero (sin decimales)', fields: { amount: 'Monto debe ser un número entero (sin decimales)' } });
  }

  // Validate date format (YYYY-MM-DD) and actual calendar validity
  if (date) {
    const dateMatch = String(date).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!dateMatch) {
      return res.status(400).json({ error: 'Formato de fecha inválido (debe ser AAAA-MM-DD)', fields: { date: 'Formato de fecha inválido' } });
    }
    const y = parseInt(dateMatch[1]), m = parseInt(dateMatch[2]), d = parseInt(dateMatch[3]);
    if (m < 1 || m > 12 || d < 1 || d > 31) {
      return res.status(400).json({ error: 'La fecha ingresada no es válida', fields: { date: 'La fecha ingresada no es válida' } });
    }
    const dateObj = new Date(y, m - 1, d);
    if (dateObj.getFullYear() !== y || dateObj.getMonth() !== m - 1 || dateObj.getDate() !== d) {
      return res.status(400).json({ error: 'La fecha ingresada no es válida', fields: { date: 'La fecha ingresada no es válida' } });
    }
  }

  // Validate RUT format if provided
  if (payer_rut && payer_rut.trim() && !validateRut(payer_rut.trim())) {
    return res.status(400).json({ error: 'El RUT ingresado no es válido', fields: { payer_rut: 'El RUT ingresado no es válido. Formato: 12.345.678-9' } });
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

  // Deduplication: reject if same user created same type+amount+description within last 5 seconds
  const recentDup = db.prepare(`
    SELECT id FROM transactions
    WHERE organization_id = ? AND type = ? AND amount = ? AND description IS ? AND created_by = ?
      AND deleted_at IS NULL
      AND created_at > datetime('now', '-5 seconds')
    LIMIT 1
  `).get(orgId, type, amount, description || null, userId);

  if (recentDup) {
    return res.status(409).json({ error: 'Registro duplicado detectado. Por favor espere unos segundos antes de intentar nuevamente.' });
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

    // Validate RUT format if provided
    if (payer_rut && payer_rut.trim() && !validateRut(payer_rut.trim())) {
      return res.status(400).json({ error: 'El RUT ingresado no es válido. Formato: 12.345.678-9' });
    }

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

  // Clean up associated attachments
  const attachments = db.prepare(
    "SELECT id, file_path FROM attachments WHERE entity_type = 'transaction' AND entity_id = ? AND organization_id = ?"
  ).all(transactionId, orgId);

  for (const attachment of attachments) {
    // Delete physical file
    if (attachment.file_path) {
      const relativePath = attachment.file_path.startsWith('/') ? attachment.file_path.slice(1) : attachment.file_path;
      const fullPath = path.join(__dirname, '..', '..', relativePath);
      try {
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
        }
      } catch (err) {
        // Log but don't fail the delete operation
        console.error(`Failed to delete attachment file: ${fullPath}`, err.message);
      }
    }
  }

  // Delete attachment records from database
  if (attachments.length > 0) {
    db.prepare(
      "DELETE FROM attachments WHERE entity_type = 'transaction' AND entity_id = ? AND organization_id = ?"
    ).run(transactionId, orgId);
  }

  // Also clean up attachments for linked payment requests
  let prAttachmentsCount = 0;
  const linkedRequest = db.prepare(
    'SELECT id FROM payment_requests WHERE transaction_id = ? AND organization_id = ?'
  ).get(transactionId, orgId);

  if (linkedRequest) {
    const prAttachments = db.prepare(
      "SELECT id, file_path FROM attachments WHERE entity_type = 'payment_request' AND entity_id = ? AND organization_id = ?"
    ).all(linkedRequest.id, orgId);
    prAttachmentsCount = prAttachments.length;

    for (const attachment of prAttachments) {
      if (attachment.file_path) {
        const relativePath = attachment.file_path.startsWith('/') ? attachment.file_path.slice(1) : attachment.file_path;
      const fullPath = path.join(__dirname, '..', '..', relativePath);
        try {
          if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
          }
        } catch (err) {
          console.error(`Failed to delete attachment file: ${fullPath}`, err.message);
        }
      }
    }

    if (prAttachments.length > 0) {
      db.prepare(
        "DELETE FROM attachments WHERE entity_type = 'payment_request' AND entity_id = ? AND organization_id = ?"
      ).run(linkedRequest.id, orgId);
    }
  }

  // Audit log
  db.prepare(`
    INSERT INTO transaction_audit_log (transaction_id, action, user_id, changes, ip_address, user_agent)
    VALUES (?, 'deleted', ?, ?, ?, ?)
  `).run(transactionId, userId, JSON.stringify({ deleted: true, attachments_removed: attachments.length + prAttachmentsCount }), req.ip || null, req.headers['user-agent'] || null);

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

// POST /api/transactions/:id/attachments - Upload attachment to a transaction
router.post('/:id/attachments', requireActive, upload.single('file'), (req, res) => {
  const db = getDb();
  const orgId = req.user.organization_id;
  const userId = req.user.id;
  const transactionId = req.params.id;

  const transaction = db.prepare(
    'SELECT id FROM transactions WHERE id = ? AND organization_id = ? AND deleted_at IS NULL'
  ).get(transactionId, orgId);

  if (!transaction) {
    return res.status(404).json({ error: 'Transacción no encontrada' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'No se proporcionó ningún archivo' });
  }

  const relativePath = '/uploads/' + req.file.filename;
  const attachmentType = req.body.attachment_type || 'respaldo';

  const result = db.prepare(`
    INSERT INTO attachments (organization_id, entity_type, entity_id, file_name, file_path, file_type, file_size, attachment_type, uploaded_by)
    VALUES (?, 'transaction', ?, ?, ?, ?, ?, ?, ?)
  `).run(orgId, transactionId, req.file.originalname, relativePath, req.file.mimetype, req.file.size, attachmentType, userId);

  const attachment = db.prepare(
    'SELECT a.*, u.name as uploaded_by_name FROM attachments a LEFT JOIN users u ON a.uploaded_by = u.id WHERE a.id = ?'
  ).get(result.lastInsertRowid);

  res.status(201).json({ message: 'Archivo adjuntado exitosamente', attachment });
});

// GET /api/transactions/:id/attachments - Get attachments for a transaction
router.get('/:id/attachments', (req, res) => {
  const db = getDb();
  const orgId = req.user.organization_id;
  const transactionId = req.params.id;

  const transaction = db.prepare(
    'SELECT id FROM transactions WHERE id = ? AND organization_id = ?'
  ).get(transactionId, orgId);

  if (!transaction) {
    return res.status(404).json({ error: 'Transacción no encontrada' });
  }

  const attachments = db.prepare(`
    SELECT a.*, u.name as uploaded_by_name
    FROM attachments a
    LEFT JOIN users u ON a.uploaded_by = u.id
    WHERE a.entity_type = 'transaction' AND a.entity_id = ?
  `).all(transactionId);

  res.json(attachments);
});

module.exports = router;
