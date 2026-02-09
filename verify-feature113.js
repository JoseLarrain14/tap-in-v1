// Feature #113: Dashboard metrics match API response
const { chromium } = require('playwright');
const http = require('http');
const path = require('path');

const FRONTEND = 'http://localhost:5175';
const BACKEND = 'http://localhost:3001';
const DIR = __dirname;
let TOKEN = '';

function apiReq(method, urlPath) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BACKEND);
    const opts = {
      hostname: url.hostname, port: url.port,
      path: url.pathname + url.search, method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (TOKEN) opts.headers['Authorization'] = `Bearer ${TOKEN}`;
    const req = http.request(opts, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch (e) { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function formatCLP(amount) {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(amount || 0);
}

async function run() {
  // Login
  const loginRes = await apiReq('POST', '/api/auth/login');
  // Need to pass body for login
  TOKEN = await new Promise((resolve, reject) => {
    const opts = {
      hostname: 'localhost', port: 3001, path: '/api/auth/login',
      method: 'POST', headers: { 'Content-Type': 'application/json' }
    };
    const req = http.request(opts, res => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => resolve(JSON.parse(data).token));
    });
    req.on('error', reject);
    req.write(JSON.stringify({ email: 'presidente@tapin.cl', password: 'password123' }));
    req.end();
  });
  process.stdout.write('Login: OK\n');

  // STEP 1: Call GET /api/dashboard/summary and note values
  const summaryRes = await apiReq('GET', '/api/dashboard/summary');
  const api = summaryRes.body;
  process.stdout.write('\nSTEP 1: API Response:\n');
  process.stdout.write('  balance: ' + api.balance + ' -> ' + formatCLP(api.balance) + '\n');
  process.stdout.write('  income_total: ' + api.income_total + ' -> ' + formatCLP(api.income_total) + '\n');
  process.stdout.write('  expense_total: ' + api.expense_total + ' -> ' + formatCLP(api.expense_total) + '\n');
  process.stdout.write('  month_income: ' + api.month_income + ' -> ' + formatCLP(api.month_income) + '\n');
  process.stdout.write('  month_expense: ' + api.month_expense + ' -> ' + formatCLP(api.month_expense) + '\n');
  process.stdout.write('  pending_approval: ' + api.pending_approval + '\n');
  process.stdout.write('  pending_execution: ' + api.pending_execution + '\n');

  // STEP 2: Navigate to Dashboard
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(FRONTEND + '/login');
  await page.evaluate((token) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify({"id":1,"email":"presidente@tapin.cl","name":"Maria Gonzalez","role":"presidente","organization_id":1}));
  }, TOKEN);

  await page.goto(FRONTEND + '/');
  await page.waitForTimeout(3000);

  await page.screenshot({ path: path.join(DIR, 'feat113-dashboard.png') });

  // STEP 3: Extract values from the UI
  const bodyText = await page.textContent('body');

  // Format expected values for comparison
  const expectedBalance = formatCLP(api.balance);
  const expectedMonthIncome = formatCLP(api.month_income);
  const expectedMonthExpense = formatCLP(api.month_expense);
  const expectedIncomeTotal = formatCLP(api.income_total);
  const expectedExpenseTotal = formatCLP(api.expense_total);

  process.stdout.write('\nSTEP 3-6: UI Verification:\n');

  // Check saldo matches
  const saldoMatch = bodyText.includes(expectedBalance);
  process.stdout.write('  Saldo "' + expectedBalance + '": ' + (saldoMatch ? 'MATCH' : 'NO MATCH') + '\n');

  // Check monthly income matches
  const monthIncomeMatch = bodyText.includes(expectedMonthIncome);
  process.stdout.write('  Month Income "' + expectedMonthIncome + '": ' + (monthIncomeMatch ? 'MATCH' : 'NO MATCH') + '\n');

  // Check monthly expense matches
  const monthExpenseMatch = bodyText.includes(expectedMonthExpense);
  process.stdout.write('  Month Expense "' + expectedMonthExpense + '": ' + (monthExpenseMatch ? 'MATCH' : 'NO MATCH') + '\n');

  // Check pending approval count (data-testid)
  const approvalEl = page.locator('[data-testid="pending-approval-count"]');
  const approvalText = await approvalEl.textContent().catch(() => '?');
  const approvalMatch = approvalText.trim() === String(api.pending_approval);
  process.stdout.write('  Pending Approval: UI="' + approvalText.trim() + '" API="' + api.pending_approval + '": ' + (approvalMatch ? 'MATCH' : 'NO MATCH') + '\n');

  // Check pending execution count (data-testid)
  const executionEl = page.locator('[data-testid="pending-execution-count"]');
  const executionText = await executionEl.textContent().catch(() => '?');
  const executionMatch = executionText.trim() === String(api.pending_execution);
  process.stdout.write('  Pending Execution: UI="' + executionText.trim() + '" API="' + api.pending_execution + '": ' + (executionMatch ? 'MATCH' : 'NO MATCH') + '\n');

  // Also check the income_total and expense_total sub-text
  const incomeTotalMatch = bodyText.includes(expectedIncomeTotal);
  const expenseTotalMatch = bodyText.includes(expectedExpenseTotal);
  process.stdout.write('  Income Total "' + expectedIncomeTotal + '": ' + (incomeTotalMatch ? 'MATCH' : 'NO MATCH') + '\n');
  process.stdout.write('  Expense Total "' + expectedExpenseTotal + '": ' + (expenseTotalMatch ? 'MATCH' : 'NO MATCH') + '\n');

  // Summary
  const allPass = saldoMatch && monthIncomeMatch && monthExpenseMatch && approvalMatch && executionMatch;
  process.stdout.write('\n=== FEATURE #113 SUMMARY ===\n');
  process.stdout.write('1. Saldo matches API: ' + (saldoMatch ? 'PASS' : 'FAIL') + '\n');
  process.stdout.write('2. Monthly income matches: ' + (monthIncomeMatch ? 'PASS' : 'FAIL') + '\n');
  process.stdout.write('3. Monthly expenses matches: ' + (monthExpenseMatch ? 'PASS' : 'FAIL') + '\n');
  process.stdout.write('4. Pending approval count: ' + (approvalMatch ? 'PASS' : 'FAIL') + '\n');
  process.stdout.write('5. Pending execution count: ' + (executionMatch ? 'PASS' : 'FAIL') + '\n');
  process.stdout.write('OVERALL: ' + (allPass ? 'ALL PASS' : 'SOME FAILURES') + '\n');

  await browser.close();
}

run().catch(err => {
  process.stdout.write('Error: ' + err.message + '\n' + err.stack + '\n');
  process.exit(1);
});
