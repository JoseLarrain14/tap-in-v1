const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Intercept ALL /api/* requests
  // - /auth/me: return mock user
  // - everything else: simulate network failure (connection refused)
  await page.route('**/api/**', (route, request) => {
    const url = request.url();
    if (url.includes('/api/auth/me')) {
      console.log('Intercepted /api/auth/me - returning mock user');
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 1,
            email: 'admin@test.com',
            nombre: 'Admin Test',
            role: 'presidente',
          }
        })
      });
    } else {
      console.log(`Intercepted ${url} - aborting (simulating network failure)`);
      route.abort('connectionrefused');
    }
  });

  // Log console messages
  page.on('console', msg => {
    if (msg.type() === 'error' || msg.type() === 'warn') {
      console.log(`[console.${msg.type()}] ${msg.text()}`);
    }
  });

  // Navigate to the domain first and set a token in localStorage
  console.log('Setting up localStorage token...');
  await page.goto('http://localhost:5174', { waitUntil: 'domcontentloaded', timeout: 10000 });
  await page.evaluate(() => {
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = btoa(JSON.stringify({
      id: 1,
      email: 'admin@test.com',
      role: 'presidente',
      nombre: 'Admin Test',
      exp: Math.floor(Date.now() / 1000) + 3600
    }));
    const fakeToken = `${header}.${payload}.fakesignature`;
    localStorage.setItem('token', fakeToken);
  });

  // Now navigate to /ingresos
  console.log('Navigating to /ingresos...');
  await page.goto('http://localhost:5174/ingresos', { waitUntil: 'domcontentloaded', timeout: 10000 });

  // Wait 3 seconds for the page to load and error to appear
  console.log('Waiting 3 seconds for errors to appear...');
  await page.waitForTimeout(3000);

  // Check current URL
  const currentUrl = page.url();
  console.log('Current URL:', currentUrl);

  // Take a screenshot
  await page.screenshot({ path: 'C:/Users/josel/CPP/feat104-network-error.png', fullPage: true });
  console.log('Screenshot saved to feat104-network-error.png');

  // Look for data-testid="network-error"
  const networkError = await page.$('[data-testid="network-error"]');
  if (networkError) {
    const text = await networkError.textContent();
    console.log('\n=== NETWORK ERROR ELEMENT FOUND ===');
    console.log('Full text content:', text);

    // Also get more specific sub-elements
    const message = await page.$('[data-testid="network-error-message"]');
    if (message) {
      const msgText = await message.textContent();
      console.log('Error message:', msgText);
    }

    const retryBtn = await page.$('[data-testid="network-error-retry"]');
    if (retryBtn) {
      const btnText = await retryBtn.textContent();
      console.log('Retry button text:', btnText);
    }

    const countdown = await page.$('[data-testid="network-error-countdown"]');
    if (countdown) {
      const cdText = await countdown.textContent();
      console.log('Countdown text:', cdText);
    }

    const isVisible = await networkError.isVisible();
    console.log('Is visible:', isVisible);

    // Get the bounding box to verify positioning
    const box = await networkError.boundingBox();
    console.log('Bounding box:', box);
    console.log('===================================');
  } else {
    console.log('\nNo element with data-testid="network-error" found.');

    // Look for any error-related elements
    console.log('\nSearching for error-related content...');

    const selectors = [
      '[data-testid*="error"]',
      '[role="alert"]',
      '.bg-red-50',
      '.bg-orange-50',
      '[data-testid="loading-skeleton"]',
    ];

    for (const selector of selectors) {
      const elements = await page.$$(selector);
      if (elements.length > 0) {
        console.log(`\nFound ${elements.length} element(s) matching "${selector}":`);
        for (let i = 0; i < elements.length; i++) {
          const text = await elements[i].textContent();
          const visible = await elements[i].isVisible();
          console.log(`  [${i}] visible=${visible} text: "${text.trim().substring(0, 300)}"`);
        }
      }
    }

    // Also grab all visible text on the page
    console.log('\n=== PAGE VISIBLE TEXT ===');
    const bodyText = await page.evaluate(() => document.body.innerText);
    console.log(bodyText.substring(0, 2000));
    console.log('========================');
  }

  await browser.close();
  console.log('\nDone!');
})().catch(err => {
  console.error('Script error:', err.message);
  process.exit(1);
});
