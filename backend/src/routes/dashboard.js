const express = require('express');
const router = express.Router();
const { getDb } = require('../database');
const { authenticateToken } = require('../middleware/auth');

// All dashboard routes require authentication
router.use(authenticateToken);

// GET /api/dashboard/summary - Get dashboard summary data (optimized: 3 queries instead of 8)
router.get('/summary', (req, res) => {
  const db = getDb();
  const orgId = req.user.organization_id;

  // Current month boundaries
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const monthStart = year + '-' + month + '-01';
  const nextMonth = now.getMonth() + 2;
  const nextYear = nextMonth > 12 ? year + 1 : year;
  const nextMonthStr = String(nextMonth > 12 ? 1 : nextMonth).padStart(2, '0');
  const monthEnd = nextYear + '-' + nextMonthStr + '-01';

  // Previous month boundaries
  const prevMonthDate = new Date(year, now.getMonth() - 1, 1);
  const prevYear = prevMonthDate.getFullYear();
  const prevMonth = String(prevMonthDate.getMonth() + 1).padStart(2, '0');
  const prevMonthStart = prevYear + '-' + prevMonth + '-01';
  const prevMonthEnd = monthStart;

  // Single query for all transaction sums using CASE expressions
  const txSummary = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN type = 'ingreso' THEN amount ELSE 0 END), 0) as income_total,
      COALESCE(SUM(CASE WHEN type = 'egreso' THEN amount ELSE 0 END), 0) as expense_total,
      COALESCE(SUM(CASE WHEN type = 'ingreso' AND date >= ? AND date < ? THEN amount ELSE 0 END), 0) as month_income,
      COALESCE(SUM(CASE WHEN type = 'egreso' AND date >= ? AND date < ? THEN amount ELSE 0 END), 0) as month_expense,
      COALESCE(SUM(CASE WHEN type = 'ingreso' AND date >= ? AND date < ? THEN amount ELSE 0 END), 0) as prev_month_income,
      COALESCE(SUM(CASE WHEN type = 'egreso' AND date >= ? AND date < ? THEN amount ELSE 0 END), 0) as prev_month_expense
    FROM transactions
    WHERE organization_id = ? AND deleted_at IS NULL
  `).get(monthStart, monthEnd, monthStart, monthEnd, prevMonthStart, prevMonthEnd, prevMonthStart, prevMonthEnd, orgId);

  // Single query for both pending counts
  const pendingCounts = db.prepare(`
    SELECT
      COALESCE(SUM(CASE WHEN status = 'pendiente' THEN 1 ELSE 0 END), 0) as pending_approval,
      COALESCE(SUM(CASE WHEN status = 'aprobado' THEN 1 ELSE 0 END), 0) as pending_execution
    FROM payment_requests
    WHERE organization_id = ?
  `).get(orgId);

  const balance = txSummary.income_total - txSummary.expense_total;

  res.json({
    balance,
    income_total: txSummary.income_total,
    expense_total: txSummary.expense_total,
    month_income: txSummary.month_income,
    month_expense: txSummary.month_expense,
    prev_month_income: txSummary.prev_month_income,
    prev_month_expense: txSummary.prev_month_expense,
    pending_approval: pendingCounts.pending_approval,
    pending_execution: pendingCounts.pending_execution
  });
});

// GET /api/dashboard/chart - Get chart data for last 6 months (optimized: 1 query instead of 12)
router.get('/chart', (req, res) => {
  const db = getDb();
  const orgId = req.user.organization_id;

  // Compute 6-month range boundaries
  const now = new Date();
  const startDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const startStr = startDate.getFullYear() + '-' + String(startDate.getMonth() + 1).padStart(2, '0') + '-01';

  const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const endStr = endDate.getFullYear() + '-' + String(endDate.getMonth() + 1).padStart(2, '0') + '-01';

  // Single query: group by year-month, sum by type
  const rows = db.prepare(`
    SELECT
      substr(date, 1, 7) as month_key,
      COALESCE(SUM(CASE WHEN type = 'ingreso' THEN amount ELSE 0 END), 0) as income,
      COALESCE(SUM(CASE WHEN type = 'egreso' THEN amount ELSE 0 END), 0) as expense
    FROM transactions
    WHERE organization_id = ? AND deleted_at IS NULL
      AND date >= ? AND date < ?
    GROUP BY month_key
  `).all(orgId, startStr, endStr);

  // Build a map for quick lookup
  const dataMap = {};
  for (const row of rows) {
    dataMap[row.month_key] = row;
  }

  // Build the 6-month array (fill in missing months with zeros)
  const months = [];
  for (var i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const key = year + '-' + month;
    const entry = dataMap[key];

    months.push({
      month: key,
      label: d.toLocaleDateString('es-CL', { month: 'short', year: 'numeric' }),
      income: entry ? entry.income : 0,
      expense: entry ? entry.expense : 0
    });
  }

  res.json({ months });
});

// GET /api/dashboard/categories - Get expense distribution by category (top 8)
router.get('/categories', (req, res) => {
  const db = getDb();
  const orgId = req.user.organization_id;

  const categories = db.prepare(`
    SELECT c.name, COALESCE(SUM(t.amount), 0) as total
    FROM categories c
    INNER JOIN transactions t ON t.category_id = c.id AND t.deleted_at IS NULL AND t.type = 'egreso'
    WHERE c.organization_id = ? AND c.type = 'egreso'
    GROUP BY c.id, c.name
    HAVING total > 0
    ORDER BY total DESC
    LIMIT 8
  `).all(orgId);

  res.json({ categories });
});

module.exports = router;
