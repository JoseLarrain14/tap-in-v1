const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { getDb } = require('../database');
const { generateToken, authenticateToken } = require('../middleware/auth');

// POST /api/auth/login
router.post('/login', (req, res) => {
  const rawEmail = req.body.email;
  const password = req.body.password;
  const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';

  if (!email || !password) {
    return res.status(400).json({ error: 'Email y contraseña son requeridos' });
  }

  const db = getDb();
  const user = db.prepare(
    'SELECT id, organization_id, email, password_hash, name, role, is_active FROM users WHERE LOWER(TRIM(email)) = ?'
  ).get(email);

  if (!user) {
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }

  // Deactivated users can still login for read access
  // Write operations are blocked by requireActive middleware

  const validPassword = bcrypt.compareSync(password, user.password_hash);
  if (!validPassword) {
    return res.status(401).json({ error: 'Credenciales inválidas' });
  }

  const token = generateToken(user);

  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      organization_id: user.organization_id,
      is_active: user.is_active
    }
  });
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  // JWT is stateless, client should remove the token
  res.json({ message: 'Sesión cerrada exitosamente' });
});

// GET /api/auth/me - Get current user
router.get('/me', authenticateToken, (req, res) => {
  const db = getDb();
  const user = db.prepare(
    'SELECT u.id, u.email, u.name, u.role, u.organization_id, u.is_active, o.name as organization_name, o.school_name FROM users u JOIN organizations o ON u.organization_id = o.id WHERE u.id = ?'
  ).get(req.user.id);

  if (!user) {
    return res.status(404).json({ error: 'Usuario no encontrado' });
  }

  res.json({ user });
});

// POST /api/auth/refresh - Refresh token
router.post('/refresh', authenticateToken, (req, res) => {
  const token = generateToken(req.user);
  res.json({ token });
});

module.exports = router;
