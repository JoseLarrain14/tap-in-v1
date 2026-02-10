const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { getDb } = require('../database');
const { authenticateToken, requireRole, requireActive } = require('../middleware/auth');

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
    cb(null, 'comprobante-' + uniqueSuffix + ext);
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

// GET /api/payment-requests - List payment requests (all roles can see everything)
router.get('/', (req, res) => {
  try {
  const db = getDb();
  const orgId = req.user.organization_id;
  const { status, created_by, category_id, from, to, search, beneficiary, sort_by, sort_order, page, limit: limitParam } = req.query;

  // Build shared WHERE conditions for both main query and count query
  let whereClause = ' WHERE pr.organization_id = ?';
  const filterParams = [orgId];

  if (status) {
    whereClause += ' AND pr.status = ?';
    filterParams.push(status);
  }

  if (created_by) {
    whereClause += ' AND pr.created_by = ?';
    filterParams.push(created_by);
  }

  if (category_id) {
    whereClause += ' AND pr.category_id = ?';
    filterParams.push(category_id);
  }

  if (beneficiary && beneficiary.trim()) {
    const trimmedBeneficiary = beneficiary.trim().slice(0, 500);
    const escapedBeneficiary = trimmedBeneficiary.replace(/%/g, '\\%').replace(/_/g, '\\_');
    whereClause += " AND pr.beneficiary LIKE ? ESCAPE '\\'";
    filterParams.push(`%${escapedBeneficiary}%`);
  }

  if (from) {
    whereClause += ' AND pr.created_at >= ?';
    filterParams.push(from);
  }

  if (to) {
    whereClause += ' AND pr.created_at <= ?';
    filterParams.push(to);
  }

  const trimmedSearch = (search || '').trim().slice(0, 500);
  if (trimmedSearch) {
    // Escape LIKE wildcards to prevent unexpected matching with special characters
    const escapedSearch = trimmedSearch.replace(/%/g, '\\%').replace(/_/g, '\\_');
    const searchTerm = `%${escapedSearch}%`;
    whereClause += " AND (pr.description LIKE ? ESCAPE '\\' OR pr.beneficiary LIKE ? ESCAPE '\\')";
    filterParams.push(searchTerm, searchTerm);
  }

  // Main query with JOINs
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
  ` + whereClause;

  // Sorting
  const validSortColumns = ['created_at', 'amount', 'status', 'description'];
  const sortColumn = validSortColumns.includes(sort_by) ? sort_by : 'created_at';
  const sortDirection = sort_order === 'asc' ? 'ASC' : 'DESC';
  query += ` ORDER BY pr.${sortColumn} ${sortDirection}`;

  // Pagination - allow up to 10000 for exports
  const limit = Math.min(parseInt(limitParam) || 50, 10000);
  const offset = ((parseInt(page) || 1) - 1) * limit;
  query += ' LIMIT ? OFFSET ?';
  const mainParams = [...filterParams, limit, offset];

  const requests = db.prepare(query).all(...mainParams);

  // Get total count using the same WHERE conditions
  const countQuery = 'SELECT COUNT(*) as total FROM payment_requests pr' + whereClause;
  const { total } = db.prepare(countQuery).get(...filterParams);

  res.json({
    payment_requests: requests,
    pagination: {
      total,
      page: parseInt(page) || 1,
      limit,
      pages: Math.ceil(total / limit)
    }
  });
  } catch (err) {
    console.error('Error listing payment requests:', err);
    res.status(500).json({ error: 'Error al obtener solicitudes' });
  }
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

// POST /api/payment-requests - Create payment request (delegado and presidente only)
router.post('/', requireActive, requireRole('delegado', 'presidente'), (req, res) => {
  const db = getDb();
  const orgId = req.user.organization_id;
  const userId = req.user.id;

  const { amount, category_id, description, beneficiary, status: reqStatus } = req.body;

  // Validate required fields with specific field errors
  const prFieldErrors = {};
  if (amount === undefined || amount === null || amount === '') prFieldErrors.amount = 'El monto es requerido';
  if (!description) prFieldErrors.description = 'La descripción es requerida';
  if (!beneficiary) prFieldErrors.beneficiary = 'El beneficiario es requerido';

  if (Object.keys(prFieldErrors).length > 0) {
    return res.status(400).json({
      error: 'Campos requeridos faltantes',
      fields: prFieldErrors
    });
  }

  if (typeof amount !== 'number' || amount <= 0) {
    return res.status(400).json({ error: 'Monto debe ser un número positivo', fields: { amount: 'Monto debe ser un número positivo' } });
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
  `).run(result.lastInsertRowid, initialStatus, userId, req.ip || null, req.headers['user-agent'] || null);

  // If created directly as pendiente, notify presidentes
  if (initialStatus === 'pendiente') {
    const presidentes = db.prepare(
      'SELECT id FROM users WHERE organization_id = ? AND role = ? AND is_active = 1'
    ).all(orgId, 'presidente');

    const creatorName = db.prepare('SELECT name FROM users WHERE id = ?').get(userId);
    const creatorDisplayName = creatorName ? creatorName.name : 'Un delegado';

    for (const pres of presidentes) {
      db.prepare(`
        INSERT INTO notifications (organization_id, user_id, type, title, message, reference_type, reference_id)
        VALUES (?, ?, 'solicitud_creada', 'Solicitud creada', ?, 'payment_request', ?)
      `).run(orgId, pres.id, `${creatorDisplayName} ha enviado la solicitud "${description}" para aprobación`, result.lastInsertRowid);
    }
  }

  const created = db.prepare(`
    SELECT pr.*, c.name as category_name, u.name as created_by_name
    FROM payment_requests pr
    LEFT JOIN categories c ON pr.category_id = c.id
    LEFT JOIN users u ON pr.created_by = u.id
    WHERE pr.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json(created);
});

// PUT /api/payment-requests/:id - Edit payment request (only creator, only drafts)
router.put('/:id', (req, res) => {
  const db = getDb();
  const orgId = req.user.organization_id;
  const userId = req.user.id;

  const request = db.prepare(
    'SELECT * FROM payment_requests WHERE id = ? AND organization_id = ?'
  ).get(req.params.id, orgId);

  if (!request) {
    return res.status(404).json({ error: 'Solicitud no encontrada' });
  }

  // Only drafts can be edited
  if (request.status !== 'borrador') {
    return res.status(400).json({ error: 'Solo se pueden editar borradores' });
  }

  // Only the creator can edit their own drafts
  if (request.created_by !== userId) {
    return res.status(403).json({ error: 'Solo el creador puede editar esta solicitud' });
  }

  const { amount, category_id, description, beneficiary } = req.body;

  // Validate required fields with specific field errors
  const fieldErrors = {};
  if (amount === undefined || amount === null || amount === '') fieldErrors.amount = 'El monto es requerido';
  if (!description) fieldErrors.description = 'La descripción es requerida';
  if (!beneficiary) fieldErrors.beneficiary = 'El beneficiario es requerido';

  if (Object.keys(fieldErrors).length > 0) {
    return res.status(400).json({
      error: 'Campos requeridos faltantes',
      fields: fieldErrors
    });
  }

  if (typeof amount !== 'number' || amount <= 0) {
    return res.status(400).json({ error: 'Monto debe ser un número positivo', fields: { amount: 'Monto debe ser un número positivo' } });
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

  db.prepare(`
    UPDATE payment_requests
    SET amount = ?, category_id = ?, description = ?, beneficiary = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(amount, category_id || null, description, beneficiary, req.params.id);

  // Create event for edit
  db.prepare(`
    INSERT INTO payment_events (payment_request_id, previous_status, new_status, user_id, comment, ip_address, user_agent)
    VALUES (?, 'borrador', 'borrador', ?, 'Solicitud editada', ?, ?)
  `).run(req.params.id, userId, req.ip || null, req.headers['user-agent'] || null);

  const updated = db.prepare(`
    SELECT pr.*, c.name as category_name, u.name as created_by_name
    FROM payment_requests pr
    LEFT JOIN categories c ON pr.category_id = c.id
    LEFT JOIN users u ON pr.created_by = u.id
    WHERE pr.id = ?
  `).get(req.params.id);

  res.json(updated);
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
  `).run(req.params.id, userId, req.ip || null, req.headers['user-agent'] || null);

  // Create notification for all presidentes in the organization
  const presidentes = db.prepare(
    'SELECT id FROM users WHERE organization_id = ? AND role = ? AND is_active = 1'
  ).all(orgId, 'presidente');

  const creatorName = db.prepare('SELECT name FROM users WHERE id = ?').get(userId);
  const creatorDisplayName = creatorName ? creatorName.name : 'Un delegado';

  for (const pres of presidentes) {
    db.prepare(`
      INSERT INTO notifications (organization_id, user_id, type, title, message, reference_type, reference_id)
      VALUES (?, ?, 'solicitud_creada', 'Solicitud creada', ?, 'payment_request', ?)
    `).run(orgId, pres.id, `${creatorDisplayName} ha enviado la solicitud "${request.description}" para aprobación`, req.params.id);
  }

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
  `).run(req.params.id, userId, comment || 'Solicitud aprobada', req.ip || null, req.headers['user-agent'] || null);

  // Create notification for the creator (delegado)
  db.prepare(`
    INSERT INTO notifications (organization_id, user_id, type, title, message, reference_type, reference_id)
    VALUES (?, ?, 'solicitud_aprobada', 'Solicitud aprobada', ?, 'payment_request', ?)
  `).run(orgId, request.created_by, `Tu solicitud "${request.description}" ha sido aprobada`, req.params.id);

  // Create notification for all secretarias in the organization
  const secretarias = db.prepare(
    'SELECT id FROM users WHERE organization_id = ? AND role = ? AND is_active = 1'
  ).all(orgId, 'secretaria');

  for (const sec of secretarias) {
    db.prepare(`
      INSERT INTO notifications (organization_id, user_id, type, title, message, reference_type, reference_id)
      VALUES (?, ?, 'solicitud_aprobada', 'Solicitud aprobada', ?, 'payment_request', ?)
    `).run(orgId, sec.id, `La solicitud "${request.description}" ha sido aprobada y está lista para ejecución`, req.params.id);
  }

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
  `).run(req.params.id, userId, comment, req.ip || null, req.headers['user-agent'] || null);

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
router.post('/:id/execute', requireRole('secretaria'), upload.single('comprobante'), (req, res) => {
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

  // Comprobante is required for execution
  if (!req.file) {
    return res.status(400).json({ error: 'El comprobante de pago es obligatorio para ejecutar la solicitud' });
  }

  const comment = req.body.comment;

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
  `).run(req.params.id, userId, comment || 'Pago ejecutado', req.ip || null, req.headers['user-agent'] || null);

  // Save attachment if file was uploaded
  if (req.file) {
    const relativePath = '/uploads/' + req.file.filename;
    db.prepare(`
      INSERT INTO attachments (organization_id, entity_type, entity_id, file_name, file_path, file_type, file_size, attachment_type, uploaded_by)
      VALUES (?, 'payment_request', ?, ?, ?, ?, ?, 'comprobante', ?)
    `).run(orgId, req.params.id, req.file.originalname, relativePath, req.file.mimetype, req.file.size, userId);
  }

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

  // Notify the presidente who approved it (if different from creator)
  if (request.approved_by && request.approved_by !== request.created_by) {
    db.prepare(`
      INSERT INTO notifications (organization_id, user_id, type, title, message, reference_type, reference_id)
      VALUES (?, ?, 'solicitud_ejecutada', 'Pago ejecutado', ?, 'payment_request', ?)
    `).run(orgId, request.approved_by, `La solicitud "${request.description}" que aprobaste ha sido ejecutada`, req.params.id);
  }

  // Also notify other presidentes in the organization (who haven't been notified yet)
  const notifiedIds = [request.created_by, request.approved_by || 0, userId];
  const otherPresidentes = db.prepare(
    `SELECT id FROM users WHERE organization_id = ? AND role = 'presidente' AND is_active = 1 AND id NOT IN (${notifiedIds.join(',')})`
  ).all(orgId);
  for (const pres of otherPresidentes) {
    db.prepare(`
      INSERT INTO notifications (organization_id, user_id, type, title, message, reference_type, reference_id)
      VALUES (?, ?, 'solicitud_ejecutada', 'Pago ejecutado', ?, 'payment_request', ?)
    `).run(orgId, pres.id, `La solicitud "${request.description}" ha sido ejecutada`, req.params.id);
  }

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

// POST /api/payment-requests/:id/attachments - Upload attachment to a payment request
router.post('/:id/attachments', upload.single('file'), (req, res) => {
  const db = getDb();
  const orgId = req.user.organization_id;
  const userId = req.user.id;

  const request = db.prepare(
    'SELECT id, status FROM payment_requests WHERE id = ? AND organization_id = ?'
  ).get(req.params.id, orgId);

  if (!request) {
    return res.status(404).json({ error: 'Solicitud no encontrada' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'No se proporcionó ningún archivo' });
  }

  const relativePath = '/uploads/' + req.file.filename;
  const attachmentType = req.body.attachment_type || 'respaldo';

  const result = db.prepare(`
    INSERT INTO attachments (organization_id, entity_type, entity_id, file_name, file_path, file_type, file_size, attachment_type, uploaded_by)
    VALUES (?, 'payment_request', ?, ?, ?, ?, ?, ?, ?)
  `).run(orgId, req.params.id, req.file.originalname, relativePath, req.file.mimetype, req.file.size, attachmentType, userId);

  const attachment = db.prepare('SELECT a.*, u.name as uploaded_by_name FROM attachments a LEFT JOIN users u ON a.uploaded_by = u.id WHERE a.id = ?').get(result.lastInsertRowid);

  res.status(201).json({ message: 'Archivo adjuntado exitosamente', attachment });
});

// GET /api/payment-requests/:id/attachments - Get attachments for a payment request
router.get('/:id/attachments', (req, res) => {
  const db = getDb();
  const orgId = req.user.organization_id;

  const request = db.prepare(
    'SELECT id FROM payment_requests WHERE id = ? AND organization_id = ?'
  ).get(req.params.id, orgId);

  if (!request) {
    return res.status(404).json({ error: 'Solicitud no encontrada' });
  }

  const attachments = db.prepare(`
    SELECT a.*, u.name as uploaded_by_name
    FROM attachments a
    LEFT JOIN users u ON a.uploaded_by = u.id
    WHERE a.entity_type = 'payment_request' AND a.entity_id = ?
  `).all(req.params.id);

  res.json(attachments);
});

module.exports = router;
