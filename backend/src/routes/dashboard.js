const express = require('express');
const router = express.Router();
const { getDb } = require('../database');
const { authenticateToken } = require('../middleware/auth');

// All dashboard routes require authentication
router.use(authenticateToken);

// GET /api/dashboard/summary - Get dashboard summary data
router.get('/summary', (req, res) => {
  const db = getDb();
  const orgId = req.user.organization_id;

  // Current balance: total income - total executed expenses
  const incomeResult = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM transactions
    WHERE organization_id = ? AND type = 'ingreso' AND deleted_at IS NULL
  `).get(orgId);

  const expenseResult = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM transactions
    WHERE organization_id = ? AND type = 'egreso' AND deleted_at IS NULL
  `).get(orgId);

  const balance = incomeResult.total - expenseResult.total;

  // Current month flow
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const monthStart = year + '-' + month + '-01';
  const nextMonth = now.getMonth() + 2;
  const nextYear = nextMonth > 12 ? year + 1 : year;
  const nextMonthStr = String(nextMonth > 12 ? 1 : nextMonth).padStart(2, '0');
  const monthEnd = nextYear + '-' + nextMonthStr + '-01';

  const monthIncome = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM transactions
    WHERE organization_id = ? AND type = 'ingreso' AND deleted_at IS NULL
      AND date >= ? AND date < ?
  `).get(orgId, monthStart, monthEnd);

  const monthExpense = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM transactions
    WHERE organization_id = ? AND type = 'egreso' AND deleted_at IS NULL
      AND date >= ? AND date < ?
  `).get(orgId, monthStart, monthEnd);

  // Previous month for comparison
  const prevMonthDate = new Date(year, now.getMonth() - 1, 1);
  const prevYear = prevMonthDate.getFullYear();
  const prevMonth = String(prevMonthDate.getMonth() + 1).padStart(2, '0');
  const prevMonthStart = prevYear + '-' + prevMonth + '-01';
  const prevMonthEnd = monthStart;

  const prevMonthIncome = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM transactions
    WHERE organization_id = ? AND type = 'ingreso' AND deleted_at IS NULL
      AND date >= ? AND date < ?
  `).get(orgId, prevMonthStart, prevMonthEnd);

  const prevMonthExpense = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM transactions
    WHERE organization_id = ? AND type = 'egreso' AND deleted_at IS NULL
      AND date >= ? AND date < ?
  `).get(orgId, prevMonthStart, prevMonthEnd);

  // Pending approval count
  const pendingApproval = db.prepare(`
    SELECT COUNT(*) as count
    FROM payment_requests
    WHERE organization_id = ? AND status = 'pendiente'
  `).get(orgId);

  // Pending execution count
  const pendingExecution = db.prepare(`
    SELECT COUNT(*) as count
    FROM payment_requests
    WHERE organization_id = ? AND status = 'aprobado'
  `).get(orgId);

  res.json({
    balance,
    income_total: incomeResult.total,
    expense_total: expenseResult.total,
    month_income: monthIncome.total,
    month_expense: monthExpense.total,
    prev_month_income: prevMonthIncome.total,
    prev_month_expense: prevMonthExpense.total,
    pending_approval: pendingApproval.count,
    pending_execution: pendingExecution.count
  });
});

// GET /api/dashboard/chart - Get chart data for last 6 months
router.get('/chart', (req, res) => {
  const db = getDb();
  const orgId = req.user.organization_id;
  const months = [];

  for (var i = 5; i >= 0; i--) {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const start = year + '-' + month + '-01';

    const nextD = new Date(year, d.getMonth() + 1, 1);
    const end = nextD.getFullYear() + '-' + String(nextD.getMonth() + 1).padStart(2, '0') + '-01';

    const income = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM transactions
      WHERE organization_id = ? AND type = 'ingreso' AND deleted_at IS NULL
        AND date >= ? AND date < ?
    `).get(orgId, start, end);

    const expense = db.prepare(`
      SELECT COALESCE(SUM(amount), 0) as total
      FROM transactions
      WHERE organization_id = ? AND type = 'egreso' AND deleted_at IS NULL
        AND date >= ? AND date < ?
    `).get(orgId, start, end);

    months.push({
      month: year + '-' + month,
      label: d.toLocaleDateString('es-CL', { month: 'short', year: 'numeric' }),
      income: income.total,
      expense: expense.total
    });
  }

  res.json({ months });
});

// GET /api/dashboard/categories - Get expense distribution by category
router.get('/categories', (req, res) => {
  const db = getDb();
  const orgId = req.user.organization_id;

  const categories = db.prepare(`
    SELECT c.name, COALESCE(SUM(t.amount), 0) as total
    FROM categories c
    LEFT JOIN transactions t ON t.category_id = c.id AND t.deleted_at IS NULL AND t.type = 'egreso'
    WHERE c.organization_id = ? AND c.type = 'egreso'
    GROUP BY c.id, c.name
    HAVING total > 0
    ORDER BY total DESC
  `).all(orgId);

  res.json({ categories });
});

module.exports = router;
