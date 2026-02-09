const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  try {
    // Step 1: Navigate to login page
    console.log('1. Navigating to login page...');
    await page.goto('http://localhost:5174/login', { waitUntil: 'networkidle', timeout: 15000 });

    // Step 2: Take screenshot of login page
    console.log('2. Taking screenshot of login page...');
    await page.screenshot({ path: 'C:/Users/josel/CPP/feat104-login.png', fullPage: true });
    console.log('   Saved: feat104-login.png');

    // Step 3: Fill in login form
    console.log('3. Filling in login form...');
    await page.fill('input[type="email"], input[name="email"], input[placeholder*="mail"], input[placeholder*="correo"]', 'presidente@tapin.cl');
    await page.fill('input[type="password"], input[name="password"]', 'password123');
    console.log('   Filled email and password');

    // Step 4: Click "Ingresar" button
    console.log('4. Clicking Ingresar button...');
    await page.click('button:has-text("Ingresar")');

    // Step 5: Wait for navigation to complete
    console.log('5. Waiting for navigation...');
    await page.waitForURL('**/dashboard**', { timeout: 10000 }).catch(async () => {
      // If not redirected to dashboard, wait a bit and check where we are
      await page.waitForTimeout(3000);
      console.log('   Current URL after login:', page.url());
    });
    console.log('   Navigation complete. Current URL:', page.url());

    // Step 6: Take screenshot of dashboard
    console.log('6. Taking screenshot of dashboard...');
    await page.waitForTimeout(2000); // Wait for dashboard data to load
    await page.screenshot({ path: 'C:/Users/josel/CPP/feat104-dashboard.png', fullPage: true });
    console.log('   Saved: feat104-dashboard.png');

    // Step 7: Navigate to Ingresos page
    console.log('7. Navigating to Ingresos page...');
    await page.goto('http://localhost:5174/ingresos', { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000); // Wait for page data to load

    // Step 8: Take screenshot of Ingresos page
    console.log('8. Taking screenshot of Ingresos page...');
    await page.screenshot({ path: 'C:/Users/josel/CPP/feat104-ingresos-normal.png', fullPage: true });
    console.log('   Saved: feat104-ingresos-normal.png');

    console.log('\nAll steps completed successfully!');
    console.log('Screenshots saved:');
    console.log('  - C:/Users/josel/CPP/feat104-login.png');
    console.log('  - C:/Users/josel/CPP/feat104-dashboard.png');
    console.log('  - C:/Users/josel/CPP/feat104-ingresos-normal.png');

  } catch (error) {
    console.error('Error during test:', error.message);
    // Take an error screenshot if possible
    try {
      await page.screenshot({ path: 'C:/Users/josel/CPP/feat104-error.png', fullPage: true });
      console.log('Error screenshot saved: feat104-error.png');
    } catch (e) {
      console.error('Could not take error screenshot:', e.message);
    }
  } finally {
    await browser.close();
  }
})();
