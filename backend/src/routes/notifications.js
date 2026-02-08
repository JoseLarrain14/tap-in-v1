const express = require('express');
const router = express.Router();
const { getDb } = require('../database');
const { authenticateToken } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// GET /api/notifications - List notifications for current user
router.get('/', (req, res) => {
  const db = getDb();
  const userId = req.user.id;
  const orgId = req.user.organization_id;
  const { is_read, limit: limitParam, page } = req.query;

  let query = `
    SELECT *
    FROM notifications
    WHERE user_id = ? AND organization_id = ?
  `;
  const params = [userId, orgId];

  if (is_read !== undefined) {
    query += ' AND is_read = ?';
    params.push(is_read === 'true' ? 1 : 0);
  }

  query += ' ORDER BY created_at DESC';

  // Pagination
  const limit = Math.min(parseInt(limitParam) || 50, 200);
  const offset = ((parseInt(page) || 1) - 1) * limit;
  query += ' LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const notifications = db.prepare(query).all(...params);

  // Get total count
  let countQuery = 'SELECT COUNT(*) as total FROM notifications WHERE user_id = ? AND organization_id = ?';
  const countParams = [userId, orgId];

  if (is_read !== undefined) {
    countQuery += ' AND is_read = ?';
    countParams.push(is_read === 'true' ? 1 : 0);
  }

  const { total } = db.prepare(countQuery).get(...countParams);

  // Get unread count
  const { unread_count } = db.prepare(
    'SELECT COUNT(*) as unread_count FROM notifications WHERE user_id = ? AND organization_id = ? AND is_read = 0'
  ).get(userId, orgId);

  res.json({
    notifications,
    unread_count,
    pagination: {
      total,
      page: parseInt(page) || 1,
      limit,
      pages: Math.ceil(total / limit)
    }
  });
});

// GET /api/notifications/unread-count - Get just the unread count (lightweight)
router.get('/unread-count', (req, res) => {
  const db = getDb();
  const userId = req.user.id;
  const orgId = req.user.organization_id;

  const { unread_count } = db.prepare(
    'SELECT COUNT(*) as unread_count FROM notifications WHERE user_id = ? AND organization_id = ? AND is_read = 0'
  ).get(userId, orgId);

  res.json({ unread_count });
});

// PUT /api/notifications/:id/read - Mark a single notification as read
router.put('/:id/read', (req, res) => {
  const db = getDb();
  const userId = req.user.id;
  const orgId = req.user.organization_id;

  const notification = db.prepare(
    'SELECT * FROM notifications WHERE id = ? AND user_id = ? AND organization_id = ?'
  ).get(req.params.id, userId, orgId);

  if (!notification) {
    return res.status(404).json({ error: 'Notificación no encontrada' });
  }

  db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(req.params.id);

  res.json({ success: true, id: parseInt(req.params.id) });
});

// PUT /api/notifications/read-all - Mark all notifications as read
router.put('/read-all', (req, res) => {
  const db = getDb();
  const userId = req.user.id;
  const orgId = req.user.organization_id;

  const result = db.prepare(
    'UPDATE notifications SET is_read = 1 WHERE user_id = ? AND organization_id = ? AND is_read = 0'
  ).run(userId, orgId);

  res.json({ success: true, updated: result.changes });
});

// POST /api/notifications - Create a notification (internal use, for testing)
router.post('/', (req, res) => {
  const db = getDb();
  const orgId = req.user.organization_id;
  const { user_id, type, title, message, reference_type, reference_id } = req.body;

  if (!user_id || !type || !title || !message) {
    return res.status(400).json({ error: 'user_id, type, title, y message son requeridos' });
  }

  const validTypes = ['solicitud_creada', 'solicitud_aprobada', 'solicitud_rechazada', 'solicitud_ejecutada', 'recordatorio'];
  if (!validTypes.includes(type)) {
    return res.status(400).json({ error: 'Tipo de notificación no válido' });
  }

  const result = db.prepare(`
    INSERT INTO notifications (organization_id, user_id, type, title, message, reference_type, reference_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(orgId, user_id, type, title, message, reference_type || null, reference_id || null);

  const created = db.prepare('SELECT * FROM notifications WHERE id = ?').get(result.lastInsertRowid);

  res.status(201).json(created);
});

module.exports = router;
