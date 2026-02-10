const express = require('express');
const router = express.Router();
const { getDb } = require('../database');
const { authenticateToken, requireRole } = require('../middleware/auth');

// All routes require authentication
router.use(authenticateToken);

// GET /api/categories - List categories (all roles can see)
router.get('/', (req, res) => {
  const db = getDb();
  const orgId = req.user.organization_id;
  const { type } = req.query;

  let query = 'SELECT * FROM categories WHERE organization_id = ?';
  const params = [orgId];

  if (type && ['ingreso', 'egreso'].includes(type)) {
    query += ' AND type = ?';
    params.push(type);
  }

  query += ' ORDER BY type ASC, name ASC';

  const categories = db.prepare(query).all(...params);
  res.json({ categories });
});

// GET /api/categories/:id - Get single category
router.get('/:id', (req, res) => {
  const db = getDb();
  const orgId = req.user.organization_id;

  const category = db.prepare(
    'SELECT * FROM categories WHERE id = ? AND organization_id = ?'
  ).get(req.params.id, orgId);

  if (!category) {
    return res.status(404).json({ error: 'Categoría no encontrada' });
  }

  res.json({ category });
});

// POST /api/categories - Create category (ONLY presidente)
router.post('/', requireRole('presidente'), (req, res) => {
  const db = getDb();
  const orgId = req.user.organization_id;

  const { name, type } = req.body;

  if (!name || !type) {
    return res.status(400).json({ error: 'Nombre y tipo son requeridos' });
  }

  if (!['ingreso', 'egreso'].includes(type)) {
    return res.status(400).json({ error: 'Tipo debe ser ingreso o egreso' });
  }

  // Check for duplicate name within org and type
  const existing = db.prepare(
    'SELECT id FROM categories WHERE organization_id = ? AND name = ? AND type = ?'
  ).get(orgId, name, type);

  if (existing) {
    return res.status(409).json({ error: 'Ya existe una categoría con ese nombre y tipo' });
  }

  const result = db.prepare(
    'INSERT INTO categories (organization_id, name, type) VALUES (?, ?, ?)'
  ).run(orgId, name, type);

  const created = db.prepare('SELECT * FROM categories WHERE id = ?').get(result.lastInsertRowid);

  console.log(`[Categories] Created: ${name} (${type}) by ${req.user.email}`);

  res.status(201).json({ category: created });
});

// PUT /api/categories/:id - Update category (ONLY presidente)
router.put('/:id', requireRole('presidente'), (req, res) => {
  const db = getDb();
  const orgId = req.user.organization_id;

  const category = db.prepare(
    'SELECT * FROM categories WHERE id = ? AND organization_id = ?'
  ).get(req.params.id, orgId);

  if (!category) {
    return res.status(404).json({ error: 'Categoría no encontrada' });
  }

  const { name, type } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Nombre es requerido' });
  }

  // Category type cannot be changed after creation
  if (type && type !== category.type) {
    return res.status(400).json({ error: 'No se puede cambiar el tipo de una categoría existente' });
  }

  const currentType = category.type;

  // Check for duplicate name within org and type (exclude current)
  const existing = db.prepare(
    'SELECT id FROM categories WHERE organization_id = ? AND name = ? AND type = ? AND id != ?'
  ).get(orgId, name, currentType, req.params.id);

  if (existing) {
    return res.status(409).json({ error: 'Ya existe una categoría con ese nombre y tipo' });
  }

  db.prepare(
    'UPDATE categories SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
  ).run(name, req.params.id);

  const updated = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);

  console.log(`[Categories] Updated: ${name} (${currentType}) by ${req.user.email}`);

  res.json({ category: updated });
});

// DELETE /api/categories/:id - Delete category (ONLY presidente)
router.delete('/:id', requireRole('presidente'), (req, res) => {
  const db = getDb();
  const orgId = req.user.organization_id;

  const category = db.prepare(
    'SELECT * FROM categories WHERE id = ? AND organization_id = ?'
  ).get(req.params.id, orgId);

  if (!category) {
    return res.status(404).json({ error: 'Categoría no encontrada' });
  }

  // Check if category is in use by transactions or payment requests
  const inUseByTx = db.prepare(
    'SELECT COUNT(*) as count FROM transactions WHERE category_id = ? AND deleted_at IS NULL'
  ).get(req.params.id);

  const inUseByPr = db.prepare(
    'SELECT COUNT(*) as count FROM payment_requests WHERE category_id = ?'
  ).get(req.params.id);

  if (inUseByTx.count > 0 || inUseByPr.count > 0) {
    return res.status(400).json({
      error: 'No se puede eliminar una categoría en uso. Tiene transacciones o solicitudes asociadas.'
    });
  }

  db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);

  console.log(`[Categories] Deleted: ${category.name} (${category.type}) by ${req.user.email}`);

  res.json({ message: 'Categoría eliminada exitosamente' });
});

module.exports = router;
