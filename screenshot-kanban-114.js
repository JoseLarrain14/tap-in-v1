// Take screenshot of Kanban view for Feature #114 verification
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });

  // Login
  await page.goto('http://localhost:5174/login');
  await page.fill('input[type="email"]', 'presidente@tapin.cl');
  await page.fill('input[type="password"]', 'password123');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/');
  console.log('Logged in');

  // Navigate to solicitudes
  await page.goto('http://localhost:5174/solicitudes');
  await page.waitForTimeout(2000);

  // Make sure kanban view is active
  const kanbanBtn = page.locator('[data-testid="view-kanban"]');
  await kanbanBtn.click();
  await page.waitForTimeout(1500);

  // Take screenshot
  await page.screenshot({ path: 'feat114-kanban-verified.png', fullPage: true });
  console.log('Screenshot saved: feat114-kanban-verified.png');

  // Verify column counts
  const columns = ['borrador', 'pendiente', 'aprobado', 'rechazado', 'ejecutado'];
  for (const col of columns) {
    const column = page.locator(`[data-testid="kanban-column-${col}"]`);
    const exists = await column.count();
    if (exists > 0) {
      const countBadge = column.locator('.rounded-full');
      const countText = await countBadge.textContent();
      console.log(`  Column ${col}: ${countText?.trim()} cards`);
    } else {
      console.log(`  Column ${col}: NOT FOUND`);
    }
  }

  // Check for console errors
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  await page.waitForTimeout(500);
  if (consoleErrors.length > 0) {
    console.log('\nConsole errors:', consoleErrors);
  } else {
    console.log('\nNo console errors detected');
  }

  await browser.close();
})();
