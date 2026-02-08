const jwt = require('jsonwebtoken');
const { getDb } = require('../database');

const JWT_SECRET = process.env.JWT_SECRET || 'tapin-dev-secret-key-change-in-production';
const JWT_EXPIRY = '24h';

function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      organization_id: user.organization_id
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Token de autenticación requerido' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    // Verify user still exists and is active
    const db = getDb();
    const user = db.prepare(
      'SELECT id, organization_id, email, name, role, is_active FROM users WHERE id = ?'
    ).get(decoded.id);

    if (!user) {
      return res.status(401).json({ error: 'Usuario no encontrado' });
    }

    // Allow deactivated users to authenticate for read access
    // Write operations are blocked by requireActive middleware
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expirado' });
    }
    return res.status(401).json({ error: 'Token inválido' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'No autenticado' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'No tiene permisos para esta acción' });
    }
    next();
  };
}

// Middleware to block write operations for deactivated users
// Deactivated users can still read (GET) but cannot write (POST, PUT, DELETE)
function requireActive(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'No autenticado' });
  }
  if (!req.user.is_active) {
    return res.status(403).json({ error: 'Cuenta desactivada. No puede realizar esta acción.' });
  }
  next();
}

module.exports = {
  JWT_SECRET,
  generateToken,
  authenticateToken,
  requireRole,
  requireActive
};
