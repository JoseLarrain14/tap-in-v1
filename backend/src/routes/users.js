const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { getDb } = require('../database');
const { authenticateToken, requireRole } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// GET /api/users - List users in organization
router.get('/', (req, res) => {
  const db = getDb();
  const orgId = req.user.organization_id;

  const users = db.prepare(`
    SELECT id, organization_id, email, name, role, is_active, created_at, updated_at
    FROM users
    WHERE organization_id = ?
    ORDER BY created_at ASC
  `).all(orgId);

  res.json({ users });
});

// GET /api/users/:id - Get single user
router.get('/:id', (req, res) => {
  const db = getDb();
  const orgId = req.user.organization_id;

  const user = db.prepare(`
    SELECT id, organization_id, email, name, role, is_active, created_at, updated_at
    FROM users
    WHERE id = ? AND organization_id = ?
  `).get(req.params.id, orgId);

  if (!user) {
    return res.status(404).json({ error: 'Usuario no encontrado' });
  }

  res.json({ user });
});

// POST /api/users/invite - Invite a new user (ONLY presidente)
router.post('/invite', requireRole('presidente'), (req, res) => {
  const db = getDb();
  const orgId = req.user.organization_id;

  const { email, name, role } = req.body;

  if (!email || !name || !role) {
    return res.status(400).json({ error: 'Email, nombre y rol son requeridos' });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const trimmedEmail = email.trim();
  if (!emailRegex.test(trimmedEmail)) {
    return res.status(400).json({ error: 'El formato del email no es válido' });
  }

  // Validate role
  const validRoles = ['delegado', 'presidente', 'secretaria'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: 'Rol no v\u00e1lido. Debe ser: delegado, presidente o secretaria' });
  }

  // Check if email already exists
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(trimmedEmail);
  if (existing) {
    return res.status(409).json({ error: 'Ya existe un usuario con ese email' });
  }

  // Create user with a default password (they should change it on first login)
  const defaultPassword = 'password123';
  const passwordHash = bcrypt.hashSync(defaultPassword, 10);

  const result = db.prepare(`
    INSERT INTO users (organization_id, email, password_hash, name, role)
    VALUES (?, ?, ?, ?, ?)
  `).run(orgId, trimmedEmail, passwordHash, name, role);

  const newUser = db.prepare(`
    SELECT id, organization_id, email, name, role, is_active, created_at, updated_at
    FROM users
    WHERE id = ?
  `).get(result.lastInsertRowid);

  console.log(`[Users] New user invited: ${email} (${role}) by ${req.user.email}`);
  console.log(`[Users] Default password for ${email}: ${defaultPassword}`);

  res.status(201).json({
    user: newUser,
    message: `Usuario ${email} invitado exitosamente con rol ${role}`
  });
});

// PUT /api/users/:id/role - Update user role (ONLY presidente)
router.put('/:id/role', requireRole('presidente'), (req, res) => {
  const db = getDb();
  const orgId = req.user.organization_id;

  const { role } = req.body;
  const targetUserId = parseInt(req.params.id);

  // Cannot change own role
  if (targetUserId === req.user.id) {
    return res.status(400).json({ error: 'No puede cambiar su propio rol' });
  }

  const validRoles = ['delegado', 'presidente', 'secretaria'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: 'Rol no v\u00e1lido' });
  }

  const user = db.prepare(
    'SELECT id FROM users WHERE id = ? AND organization_id = ?'
  ).get(targetUserId, orgId);

  if (!user) {
    return res.status(404).json({ error: 'Usuario no encontrado' });
  }

  db.prepare('UPDATE users SET role = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(role, targetUserId);

  const updated = db.prepare(`
    SELECT id, organization_id, email, name, role, is_active, created_at, updated_at
    FROM users WHERE id = ?
  `).get(targetUserId);

  res.json({ user: updated });
});

// PUT /api/users/:id/deactivate - Deactivate user (ONLY presidente)
router.put('/:id/deactivate', requireRole('presidente'), (req, res) => {
  const db = getDb();
  const orgId = req.user.organization_id;
  const targetUserId = parseInt(req.params.id);

  // Cannot deactivate self
  if (targetUserId === req.user.id) {
    return res.status(400).json({ error: 'No puede desactivar su propia cuenta' });
  }

  const user = db.prepare(
    'SELECT id, email, name FROM users WHERE id = ? AND organization_id = ?'
  ).get(targetUserId, orgId);

  if (!user) {
    return res.status(404).json({ error: 'Usuario no encontrado' });
  }

  db.prepare('UPDATE users SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(targetUserId);

  const updated = db.prepare(`
    SELECT id, organization_id, email, name, role, is_active, created_at, updated_at
    FROM users WHERE id = ?
  `).get(targetUserId);

  console.log(`[Users] User deactivated: ${user.email} by ${req.user.email}`);

  res.json({ user: updated, message: `Usuario ${user.name} desactivado exitosamente` });
});

// PUT /api/users/:id/activate - Activate user (ONLY presidente)
router.put('/:id/activate', requireRole('presidente'), (req, res) => {
  const db = getDb();
  const orgId = req.user.organization_id;
  const targetUserId = parseInt(req.params.id);

  const user = db.prepare(
    'SELECT id, email, name FROM users WHERE id = ? AND organization_id = ?'
  ).get(targetUserId, orgId);

  if (!user) {
    return res.status(404).json({ error: 'Usuario no encontrado' });
  }

  db.prepare('UPDATE users SET is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(targetUserId);

  const updated = db.prepare(`
    SELECT id, organization_id, email, name, role, is_active, created_at, updated_at
    FROM users WHERE id = ?
  `).get(targetUserId);

  console.log(`[Users] User activated: ${user.email} by ${req.user.email}`);

  res.json({ user: updated, message: `Usuario ${user.name} activado exitosamente` });
});

module.exports = router;
