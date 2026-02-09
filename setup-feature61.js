const http = require('http');

const BASE = 'http://localhost:3001';

function request(method, path, token, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (token) options.headers['Authorization'] = 'Bearer ' + token;

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch(e) { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  // Login as presidente
  const presLogin = await request('POST', '/api/auth/login', null, {
    email: 'presidente@tapin.cl',
    password: 'password123'
  });
  const presToken = presLogin.body.token;
  console.log('Presidente token obtained');

  // Login as delegado
  const delLogin = await request('POST', '/api/auth/login', null, {
    email: 'delegado@tapin.cl',
    password: 'password123'
  });
  const delToken = delLogin.body.token;
  console.log('Delegado token obtained');

  // Get existing payment requests and clean up old test ones
  const existing = await request('GET', '/api/payment-requests', presToken);
  const prs = existing.body.payment_requests || [];
  console.log('Existing PRs:', prs.length);

  // Show existing statuses
  const statusCount = {};
  prs.forEach(pr => {
    statusCount[pr.status] = (statusCount[pr.status] || 0) + 1;
  });
  console.log('Status counts:', JSON.stringify(statusCount));

  // Get categories
  const catsRes = await request('GET', '/api/categories', presToken);
  const cats = catsRes.body.categories || catsRes.body;
  const egressCat = (Array.isArray(cats) ? cats : []).find(c => c.type === 'egreso');
  console.log('Egress category:', egressCat ? egressCat.id + ' - ' + egressCat.name : 'NONE');

  if (!egressCat) {
    console.log('ERROR: No egress category found');
    return;
  }

  // Create 3 test payment requests as drafts from delegado
  const testPRs = [];
  for (let i = 1; i <= 3; i++) {
    const pr = await request('POST', '/api/payment-requests', delToken, {
      title: 'F61_TEST_PR_' + i,
      description: 'Feature 61 test payment request ' + i,
      amount: 10000 * i,
      category_id: egressCat.id,
      beneficiary: 'Test Beneficiary ' + i
    });
    console.log('Created PR ' + i + ':', pr.status, pr.body.id || pr.body.error || JSON.stringify(pr.body).substring(0, 100));
    if (pr.body.id) testPRs.push(pr.body);
  }

  // Submit all 3 to pendiente
  for (const pr of testPRs) {
    const submitRes = await request('POST', '/api/payment-requests/' + pr.id + '/submit', delToken);
    console.log('Submitted PR ' + pr.id + ':', submitRes.status, submitRes.body.status || submitRes.body.error);
  }

  // Check dashboard - should show increased pending_approval
  const sum1 = await request('GET', '/api/dashboard/summary', presToken);
  console.log('\nAfter submitting 3 PRs:');
  console.log('  pending_approval:', sum1.body.pending_approval);
  console.log('  pending_execution:', sum1.body.pending_execution);

  // Now approve the first one
  const approveRes = await request('POST', '/api/payment-requests/' + testPRs[0].id + '/approve', presToken);
  console.log('\nApproved PR ' + testPRs[0].id + ':', approveRes.status, approveRes.body.status || approveRes.body.error);

  // Check dashboard again
  const sum2 = await request('GET', '/api/dashboard/summary', presToken);
  console.log('\nAfter approving 1 PR:');
  console.log('  pending_approval:', sum2.body.pending_approval);
  console.log('  pending_execution:', sum2.body.pending_execution);

  // Store IDs for browser testing
  console.log('\n=== TEST DATA ===');
  console.log('PR IDs:', testPRs.map(p => p.id).join(', '));
  console.log('Remaining pendiente PRs:', testPRs.slice(1).map(p => p.id).join(', '));
  console.log('Approved PR:', testPRs[0].id);
}

main().catch(console.error);
