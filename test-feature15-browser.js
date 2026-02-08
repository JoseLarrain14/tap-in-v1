const { chromium } = require('./node_modules/playwright');

async function testFeature15Browser() {
  var browser = await chromium.launch({ headless: true });
  var context = await browser.newContext();
  var page = await context.newPage();

  var BASE_URL = 'http://localhost:5180';
  var results = [];

  function log(step, pass, detail) {
    results.push({ step: step, pass: pass, detail: detail });
    console.log((pass ? 'PASS' : 'FAIL') + ': ' + step + (detail ? ' - ' + detail : ''));
  }

  try {
    // Navigate to login page (no auth)
    await page.goto(BASE_URL + '/login', { waitUntil: 'networkidle' });

    // Clear any tokens
    await page.evaluate(function() { localStorage.clear(); });

    // Test API endpoints from browser context without auth
    var result = await page.evaluate(async function() {
      var endpoints = [
        { method: 'GET', url: '/api/transactions', name: 'GET /api/transactions' },
        { method: 'GET', url: '/api/payment-requests', name: 'GET /api/payment-requests' },
        { method: 'GET', url: '/api/dashboard/summary', name: 'GET /api/dashboard/summary' },
        { method: 'POST', url: '/api/transactions', name: 'POST /api/transactions' }
      ];

      var results = [];
      for (var i = 0; i < endpoints.length; i++) {
        var ep = endpoints[i];
        var opts = { method: ep.method, headers: { 'Content-Type': 'application/json' } };
        if (ep.method === 'POST') {
          opts.body = JSON.stringify({ type: 'ingreso', amount: 1000, date: '2026-01-01' });
        }
        var response = await fetch(ep.url, opts);
        results.push({ name: ep.name, status: response.status });
      }
      return results;
    });

    for (var i = 0; i < result.length; i++) {
      var r = result[i];
      log(r.name + ' without auth -> 401', r.status === 401, 'Status: ' + r.status);
    }

    // Take screenshot showing we're on the login page (unauthenticated)
    await page.screenshot({ path: 'screenshots-feature15-unauth.png', fullPage: true });
    console.log('\nScreenshot saved: screenshots-feature15-unauth.png');

  } catch (err) {
    console.log('ERROR: ' + err.message);
  }

  var allPass = results.every(function(r) { return r.pass; });
  console.log('\n=== FEATURE #15 BROWSER SUMMARY ===');
  console.log('Total steps: ' + results.length);
  console.log('Passing: ' + results.filter(function(r) { return r.pass; }).length);
  console.log('Failing: ' + results.filter(function(r) { return !r.pass; }).length);
  console.log('Overall: ' + (allPass ? 'PASS' : 'FAIL'));

  await browser.close();
  process.exit(allPass ? 0 : 1);
}

testFeature15Browser();
