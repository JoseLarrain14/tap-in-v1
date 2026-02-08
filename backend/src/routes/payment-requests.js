const express = require('express');
const router = express.Router();
const { getDb } = require('../database');
const { authenticateToken, requireRole } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// GET /api/payment-requests - List payment requests (all roles can see everything)
router.get('/', (req, res) => {
  const db = getDb();
  const orgId = req.user.organization_id;
  const { status, created_by, category_id, from, to, search, sort_by, sort_order, page, limit: limitParam } = req.query;

  let query = `
    SELECT pr.*,
      c.name as category_name,
      cu.name as created_by_name,
      au.name as approved_by_name,
      ru.name as rejected_by_name,
      eu.name as executed_by_name
    FROM payment_requests pr
    LEFT JOIN categories c ON pr.category_id = c.id
    LEFT JOIN users cu ON pr.created_by = cu.id
    LEFT JOIN users au ON pr.approved_by = au.id
    LEFT JOIN users ru ON pr.rejected_by = ru.id
    LEFT JOIN users eu ON pr.executed_by = eu.id
    WHERE pr.organization_id = ?
  `;
  const params = [orgId];

  if (status) {
    query += ' AND pr.status = ?';
    params.push(status);
  }

  if (created_by) {
    query += ' AND pr.created_by = ?';
    params.push(created_by);
  }

  if (category_id) {
    query += ' AND pr.category_id = ?';
    params.push(category_id);
  }

  if (from) {
    query += ' AND pr.created_at >= ?';
    params.push(from);
  }

  if (to) {
    query += ' AND pr.created_at <= ?';
    params.push(to);
  }

  if (search) {
    query += ' AND (pr.description LIKE ? OR pr.beneficiary LIKE ?)';
    const searchTerm = `%${search}%`;
    params.push(searchTerm, searchTerm);
  }

  // Sorting
  const validSortColumns = ['created_at', 'amount', 'status', 'description'];
  const sortColumn = validSortColumns.includes(sort_by) ? sort_by : 'created_at';
  const sortDirection = sort_order === 'asc' ? 'ASC' : 'DESC';
  query += ` ORDER BY pr.${sortColumn} ${sortDirection}`;

  // Pagination
  const limit = Math.min(parseInt(limitParam) || 50, 200);
  const offset = ((parseInt(page) || 1) - 1) * limit;
  query += ' LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const requests = db.prepare(query).all(...params);

  // Get total count
  let countQuery = 'SELECT COUNT(*) as total FROM payment_requests pr WHERE pr.organization_id = ?';
  const countParams = [orgId];

  if (status) {
    countQuery += ' AND pr.status = ?';
    countParams.push(status);
  }
  if (created_by) {
    countQuery += ' AND pr.created_by = ?';
    countParams.push(created_by);
  }

  const { total } = db.prepare(countQuery).get(...countParams);

  res.json({
    payment_requests: requests,
    pagination: {
      total,
      page: parseInt(page) || 1,
      limit,
      pages: Math.ceil(total / limit)
    }
  });
});

// GET /api/payment-requests/:id - Get single payment request
router.get('/:id', (req, res) => {
  const db = getDb();
  const orgId = req.user.organization_id;

  const request = db.prepare(`
    SELECT pr.*,
      c.name as category_name,
      cu.name as created_by_name,
      au.name as approved_by_name,
      ru.name as rejected_by_name,
      eu.name as executed_by_name
    FROM payment_requests pr
    LEFT JOIN categories c ON pr.category_id = c.id
    LEFT JOIN users cu ON pr.created_by = cu.id
    LEFT JOIN users au ON pr.approved_by = au.id
    LEFT JOIN users ru ON pr.rejected_by = ru.id
    LEFT JOIN users eu ON pr.executed_by = eu.id
    WHERE pr.id = ? AND pr.organization_id = ?
  `).get(req.params.id, orgId);

  if (!request) {
    return res.status(404).json({ error: 'Solicitud de pago no encontrada' });
  }

  // Get events timeline
  const events = db.prepare(`
    SELECT pe.*, u.name as user_name
    FROM payment_events pe
    LEFT JOIN users u ON pe.user_id = u.id
    WHERE pe.payment_request_id = ?
    ORDER BY pe.created_at ASC
  `).all(req.params.id);

  // Get attachments
  const attachments = db.prepare(`
    SELECT a.*, u.name as uploaded_by_name
    FROM attachments a
    LEFT JOIN users u ON a.uploaded_by = u.id
    WHERE a.entity_type = 'payment_request' AND a.entity_id = ?
    ORDER BY a.created_at ASC
  `).all(req.params.id);

  res.json({ ...request, events, attachments });
});

// POST /api/payment-requests - Create payment request (delegado, presidente, secretaria can create)
router.post('/', (req, res) => {
  const db = getDb();
  const orgId = req.user.organization_id;
  const userId = req.user.id;

  const { amount, category_id, description, beneficiary, status: reqStatus } = req.body;

  if (!amount || !description || !beneficiary) {
    return res.status(400).json({ error: 'Monto, descripci\u00f3n y beneficiario son requeridos' });
  }

  if (typeof amount !== 'number' || amount <= 0) {
    return res.status(400).json({ error: 'Monto debe ser un n\u00famero positivo' });
  }

  // Validate category belongs to organization
  if (category_id) {
    const category = db.prepare(
      'SELECT id FROM categories WHERE id = ? AND organization_id = ?'
    ).get(category_id, orgId);
    if (!category) {
      return res.status(400).json({ error: 'Categor\u00eda no v\u00e1lida' });
    }
  }

  // Determine initial status
  const initialStatus = reqStatus === 'pendiente' ? 'pendiente' : 'borrador';

  const result = db.prepare(`
    INSERT INTO payment_requests (organization_id, amount, category_id, description, beneficiary, status, created_by, period_year)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(orgId, amount, category_id || null, description, beneficiary, initialStatus, userId, new Date().getFullYear());

  // Create event for creation
  db.prepare(`
    INSERT INTO payment_events (payment_request_id, previous_status, new_status, user_id, comment, ip_address, user_agent)
    VALUES (?, NULL, ?, ?, 'Solicitud creada', ?, ?)
  `).run(result.lastInsertRowid, initialStatus, userId, req.ip, req.headers['user-agent']);

  const created = db.prepare(`
    SELECT pr.*, c.name as category_name, u.name as created_by_name
    FROM payment_requests pr
    LEFT JOIN categories c ON pr.category_id = c.id
    LEFT JOIN users u ON pr.created_by = u.id
    WHERE pr.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json(created);
});

// POST /api/payment-requests/:id/submit - Submit draft to pending
router.post('/:id/submit', (req, res) => {
  const db = getDb();
  const orgId = req.user.organization_id;
  const userId = req.user.id;

  const request = db.prepare(
    'SELECT * FROM payment_requests WHERE id = ? AND organization_id = ?'
  ).get(req.params.id, orgId);

  if (!request) {
    return res.status(404).json({ error: 'Solicitud no encontrada' });
  }

  if (request.status !== 'borrador') {
    return res.status(400).json({ error: 'Solo se pueden enviar borradores' });
  }

  // Only the creator can submit
  if (request.created_by !== userId) {
    return res.status(403).json({ error: 'Solo el creador puede enviar esta solicitud' });
  }

  db.prepare(`
    UPDATE payment_requests SET status = 'pendiente', updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(req.params.id);

  db.prepare(`
    INSERT INTO payment_events (payment_request_id, previous_status, new_status, user_id, comment, ip_address, user_agent)
    VALUES (?, 'borrador', 'pendiente', ?, 'Solicitud enviada para aprobaci\u00f3n', ?, ?)
  `).run(req.params.id, userId, req.ip, req.headers['user-agent']);

  const updated = db.prepare(`
    SELECT pr.*, c.name as category_name, u.name as created_by_name
    FROM payment_requests pr
    LEFT JOIN categories c ON pr.category_id = c.id
    LEFT JOIN users u ON pr.created_by = u.id
    WHERE pr.id = ?
  `).get(req.params.id);

  res.json(updated);
});

// POST /api/payment-requests/:id/approve - Approve (ONLY presidente)
router.post('/:id/approve', requireRole('presidente'), (req, res) => {
  const db = getDb();
  const orgId = req.user.organization_id;
  const userId = req.user.id;

  const request = db.prepare(
    'SELECT * FROM payment_requests WHERE id = ? AND organization_id = ?'
  ).get(req.params.id, orgId);

  if (!request) {
    return res.status(404).json({ error: 'Solicitud no encontrada' });
  }

  if (request.status !== 'pendiente') {
    return res.status(400).json({ error: 'Solo se pueden aprobar solicitudes pendientes' });
  }

  const { comment } = req.body;

  db.prepare(`
    UPDATE payment_requests SET
      status = 'aprobado',
      approved_by = ?,
      approved_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(userId, req.params.id);

  db.prepare(`
    INSERT INTO payment_events (payment_request_id, previous_status, new_status, user_id, comment, ip_address, user_agent)
    VALUES (?, 'pendiente', 'aprobado', ?, ?, ?, ?)
  `).run(req.params.id, userId, comment || 'Solicitud aprobada', req.ip, req.headers['user-agent']);

  // Create notification for the creator
  db.prepare(`
    INSERT INTO notifications (organization_id, user_id, type, title, message, reference_type, reference_id)
    VALUES (?, ?, 'solicitud_aprobada', 'Solicitud aprobada', ?, 'payment_request', ?)
  `).run(orgId, request.created_by, `Tu solicitud "${request.description}" ha sido aprobada`, req.params.id);

  const updated = db.prepare(`
    SELECT pr.*, c.name as category_name, u.name as created_by_name, au.name as approved_by_name
    FROM payment_requests pr
    LEFT JOIN categories c ON pr.category_id = c.id
    LEFT JOIN users u ON pr.created_by = u.id
    LEFT JOIN users au ON pr.approved_by = au.id
    WHERE pr.id = ?
  `).get(req.params.id);

  res.json(updated);
});

// POST /api/payment-requests/:id/reject - Reject (ONLY presidente)
router.post('/:id/reject', requireRole('presidente'), (req, res) => {
  const db = getDb();
  const orgId = req.user.organization_id;
  const userId = req.user.id;

  const request = db.prepare(
    'SELECT * FROM payment_requests WHERE id = ? AND organization_id = ?'
  ).get(req.params.id, orgId);

  if (!request) {
    return res.status(404).json({ error: 'Solicitud no encontrada' });
  }

  if (request.status !== 'pendiente') {
    return res.status(400).json({ error: 'Solo se pueden rechazar solicitudes pendientes' });
  }

  const { comment } = req.body;

  // Comment is mandatory for rejection
  if (!comment || !comment.trim()) {
    return res.status(400).json({ error: 'El comentario es obligatorio al rechazar una solicitud' });
  }

  db.prepare(`
    UPDATE payment_requests SET
      status = 'rechazado',
      rejected_by = ?,
      rejected_at = CURRENT_TIMESTAMP,
      rejection_comment = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(userId, comment, req.params.id);

  db.prepare(`
    INSERT INTO payment_events (payment_request_id, previous_status, new_status, user_id, comment, ip_address, user_agent)
    VALUES (?, 'pendiente', 'rechazado', ?, ?, ?, ?)
  `).run(req.params.id, userId, comment, req.ip, req.headers['user-agent']);

  // Create notification for the creator
  db.prepare(`
    INSERT INTO notifications (organization_id, user_id, type, title, message, reference_type, reference_id)
    VALUES (?, ?, 'solicitud_rechazada', 'Solicitud rechazada', ?, 'payment_request', ?)
  `).run(orgId, request.created_by, `Tu solicitud "${request.description}" ha sido rechazada: ${comment}`, req.params.id);

  const updated = db.prepare(`
    SELECT pr.*, c.name as category_name, u.name as created_by_name, ru.name as rejected_by_name
    FROM payment_requests pr
    LEFT JOIN categories c ON pr.category_id = c.id
    LEFT JOIN users u ON pr.created_by = u.id
    LEFT JOIN users ru ON pr.rejected_by = ru.id
    WHERE pr.id = ?
  `).get(req.params.id);

  res.json(updated);
});

// POST /api/payment-requests/:id/execute - Execute payment (ONLY secretaria)
router.post('/:id/execute', requireRole('secretaria'), (req, res) => {
  const db = getDb();
  const orgId = req.user.organization_id;
  const userId = req.user.id;

  const request = db.prepare(
    'SELECT * FROM payment_requests WHERE id = ? AND organization_id = ?'
  ).get(req.params.id, orgId);

  if (!request) {
    return res.status(404).json({ error: 'Solicitud no encontrada' });
  }

  if (request.status !== 'aprobado') {
    return res.status(400).json({ error: 'Solo se pueden ejecutar solicitudes aprobadas' });
  }

  const { comment } = req.body;

  db.prepare(`
    UPDATE payment_requests SET
      status = 'ejecutado',
      executed_by = ?,
      executed_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(userId, req.params.id);

  db.prepare(`
    INSERT INTO payment_events (payment_request_id, previous_status, new_status, user_id, comment, ip_address, user_agent)
    VALUES (?, 'aprobado', 'ejecutado', ?, ?, ?, ?)
  `).run(req.params.id, userId, comment || 'Pago ejecutado', req.ip, req.headers['user-agent']);

  // Create the corresponding egreso transaction
  const txResult = db.prepare(`
    INSERT INTO transactions (organization_id, type, amount, category_id, description, date, beneficiary, source, created_by, period_year)
    VALUES (?, 'egreso', ?, ?, ?, date('now'), ?, 'solicitud', ?, ?)
  `).run(orgId, request.amount, request.category_id, request.description, request.beneficiary, userId, new Date().getFullYear());

  // Link transaction to payment request
  db.prepare('UPDATE payment_requests SET transaction_id = ? WHERE id = ?').run(txResult.lastInsertRowid, req.params.id);

  // Create notification for the creator
  db.prepare(`
    INSERT INTO notifications (organization_id, user_id, type, title, message, reference_type, reference_id)
    VALUES (?, ?, 'solicitud_ejecutada', 'Pago ejecutado', ?, 'payment_request', ?)
  `).run(orgId, request.created_by, `El pago de tu solicitud "${request.description}" ha sido ejecutado`, req.params.id);

  const updated = db.prepare(`
    SELECT pr.*, c.name as category_name, u.name as created_by_name, eu.name as executed_by_name
    FROM payment_requests pr
    LEFT JOIN categories c ON pr.category_id = c.id
    LEFT JOIN users u ON pr.created_by = u.id
    LEFT JOIN users eu ON pr.executed_by = eu.id
    WHERE pr.id = ?
  `).get(req.params.id);

  res.json(updated);
});

module.exports = router;
