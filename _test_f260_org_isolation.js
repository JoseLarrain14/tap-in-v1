// Feature #260: API enforces organization isolation on all endpoints
// Tests that Org B user can ONLY see Org B data, not Org A data

const http = require('http');

const BASE = 'http://localhost:3001';

function request(method, path, token, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function login(email, password) {
  const res = await request('POST', '/api/auth/login', null, { email, password });
  if (res.status !== 200) throw new Error(`Login failed for ${email}: ${res.status}`);
  return res.data;
}

async function main() {
  console.log('=== Feature #260: API Organization Isolation Test ===\n');

  // Login as both orgs
  const orgA = await login('presidente@tapin.cl', 'password123');
  const orgB = await login('orgb_presidente@tapin.cl', 'password123');

  console.log(`Org A user: ${orgA.user.name} (org_id=${orgA.user.organization_id})`);
  console.log(`Org B user: ${orgB.user.name} (org_id=${orgB.user.organization_id})\n`);

  let allPassed = true;

  // First, ensure Org A has data by checking
  const orgATransactions = await request('GET', '/api/transactions', orgA.token);
  const orgARequests = await request('GET', '/api/payment-requests', orgA.token);
  const orgACategories = await request('GET', '/api/categories', orgA.token);
  const orgAUsers = await request('GET', '/api/users', orgA.token);

  console.log(`Org A baseline - Transactions: ${orgATransactions.data.transactions?.length || 0}`);
  console.log(`Org A baseline - Payment Requests: ${orgARequests.data.payment_requests?.length || 0}`);
  console.log(`Org A baseline - Categories: ${orgACategories.data.categories?.length || 0}`);
  console.log(`Org A baseline - Users: ${orgAUsers.data.users?.length || 0}\n`);

  // Step 1: GET /api/transactions - verify only Org B data
  console.log('--- Step 1: GET /api/transactions ---');
  const orgBTransactions = await request('GET', '/api/transactions', orgB.token);
  if (orgBTransactions.status === 200) {
    const txns = orgBTransactions.data.transactions || [];
    const hasOrgAData = txns.some(t => t.organization_id !== orgB.user.organization_id);
    if (hasOrgAData) {
      console.log('  FAIL: Org B can see Org A transactions!');
      allPassed = false;
    } else {
      console.log(`  PASS: Org B sees ${txns.length} transactions, none from Org A`);
    }
  } else {
    console.log(`  FAIL: Status ${orgBTransactions.status}`);
    allPassed = false;
  }

  // Step 2: GET /api/payment-requests - verify only Org B data
  console.log('--- Step 2: GET /api/payment-requests ---');
  const orgBRequests = await request('GET', '/api/payment-requests', orgB.token);
  if (orgBRequests.status === 200) {
    const reqs = orgBRequests.data.payment_requests || [];
    const hasOrgAData = reqs.some(r => r.organization_id !== orgB.user.organization_id);
    if (hasOrgAData) {
      console.log('  FAIL: Org B can see Org A payment requests!');
      allPassed = false;
    } else {
      console.log(`  PASS: Org B sees ${reqs.length} payment requests, none from Org A`);
    }
  } else {
    console.log(`  FAIL: Status ${orgBRequests.status}`);
    allPassed = false;
  }

  // Step 3: GET /api/categories - verify only Org B data
  console.log('--- Step 3: GET /api/categories ---');
  const orgBCategories = await request('GET', '/api/categories', orgB.token);
  if (orgBCategories.status === 200) {
    const cats = orgBCategories.data.categories || [];
    const hasOrgAData = cats.some(c => c.organization_id !== orgB.user.organization_id);
    if (hasOrgAData) {
      console.log('  FAIL: Org B can see Org A categories!');
      allPassed = false;
    } else {
      console.log(`  PASS: Org B sees ${cats.length} categories, none from Org A`);
      // Cross-check: Org A should have different categories
      if (orgACategories.data.categories?.length > 0 && cats.length !== orgACategories.data.categories.length) {
        console.log(`  PASS: Org A has ${orgACategories.data.categories.length} categories vs Org B has ${cats.length} (different sets)`);
      }
    }
  } else {
    console.log(`  FAIL: Status ${orgBCategories.status}`);
    allPassed = false;
  }

  // Step 4: GET /api/users - verify only Org B users
  console.log('--- Step 4: GET /api/users ---');
  const orgBUsers = await request('GET', '/api/users', orgB.token);
  if (orgBUsers.status === 200) {
    const users = orgBUsers.data.users || [];
    const hasOrgAData = users.some(u => u.organization_id !== orgB.user.organization_id);
    if (hasOrgAData) {
      console.log('  FAIL: Org B can see Org A users!');
      allPassed = false;
    } else {
      console.log(`  PASS: Org B sees ${users.length} users, none from Org A`);
      // Cross-check: Org A should have more/different users
      if (orgAUsers.data.users?.length > 0 && users.length < orgAUsers.data.users.length) {
        console.log(`  PASS: Org A has ${orgAUsers.data.users.length} users vs Org B has ${users.length} (isolated)`);
      }
    }
  } else {
    console.log(`  FAIL: Status ${orgBUsers.status}`);
    allPassed = false;
  }

  // Step 5: GET /api/notifications - verify only Org B notifications
  console.log('--- Step 5: GET /api/notifications ---');
  const orgBNotifs = await request('GET', '/api/notifications', orgB.token);
  if (orgBNotifs.status === 200) {
    const notifs = orgBNotifs.data.notifications || [];
    const hasOrgAData = notifs.some(n => n.organization_id !== orgB.user.organization_id);
    if (hasOrgAData) {
      console.log('  FAIL: Org B can see Org A notifications!');
      allPassed = false;
    } else {
      console.log(`  PASS: Org B sees ${notifs.length} notifications, none from Org A`);
    }
  } else {
    console.log(`  FAIL: Status ${orgBNotifs.status}`);
    allPassed = false;
  }

  // Step 6: GET /api/dashboard/summary - verify Org B totals only
  console.log('--- Step 6: GET /api/dashboard/summary ---');
  const orgBDashboard = await request('GET', '/api/dashboard/summary', orgB.token);
  const orgADashboard = await request('GET', '/api/dashboard/summary', orgA.token);
  if (orgBDashboard.status === 200) {
    const d = orgBDashboard.data;
    console.log(`  Org B dashboard: balance=${d.balance}, income=${d.income_total}, expense=${d.expense_total}`);
    console.log(`  Org A dashboard: balance=${orgADashboard.data.balance}, income=${orgADashboard.data.income_total}, expense=${orgADashboard.data.expense_total}`);

    // If Org A has data but Org B doesn't, that's good isolation
    // (assuming Org B has no transactions)
    if (orgADashboard.data.income_total > 0 || orgADashboard.data.expense_total > 0) {
      // Verify Org B doesn't see Org A's totals
      if (d.income_total !== orgADashboard.data.income_total || d.expense_total !== orgADashboard.data.expense_total) {
        console.log('  PASS: Org B dashboard totals differ from Org A (isolated data)');
      } else if (d.income_total === 0 && d.expense_total === 0) {
        console.log('  PASS: Org B has $0 totals (no transactions, Org A has different values)');
      } else {
        console.log('  WARN: Both orgs have same totals - may need deeper investigation');
      }
    } else {
      console.log('  PASS: Dashboard returned successfully with org-scoped data');
    }
  } else {
    console.log(`  FAIL: Status ${orgBDashboard.status}`);
    allPassed = false;
  }

  // Extra: Try to access Org A specific resources with Org B token
  console.log('\n--- Extra: Cross-org access attempts ---');

  // Try to access Org A's first transaction with Org B token (if Org A has transactions)
  if (orgATransactions.data.transactions?.length > 0) {
    const orgATxnId = orgATransactions.data.transactions[0].id;
    const crossAccessTx = await request('GET', `/api/transactions/${orgATxnId}/audit`, orgB.token);
    if (crossAccessTx.status === 404) {
      console.log(`  PASS: Org B cannot access Org A transaction #${orgATxnId} audit (404)`);
    } else {
      console.log(`  FAIL: Org B got ${crossAccessTx.status} for Org A transaction #${orgATxnId} (should be 404)`);
      allPassed = false;
    }
  }

  // Try to access Org A's first payment request with Org B token
  if (orgARequests.data.payment_requests?.length > 0) {
    const orgAPrId = orgARequests.data.payment_requests[0].id;
    const crossAccessPr = await request('GET', `/api/payment-requests/${orgAPrId}`, orgB.token);
    if (crossAccessPr.status === 404) {
      console.log(`  PASS: Org B cannot access Org A payment request #${orgAPrId} (404)`);
    } else {
      console.log(`  FAIL: Org B got ${crossAccessPr.status} for Org A payment request #${orgAPrId} (should be 404)`);
      allPassed = false;
    }
  }

  // Try to access Org A's first user with Org B token
  if (orgAUsers.data.users?.length > 0) {
    const orgAUserId = orgAUsers.data.users[0].id;
    const crossAccessUser = await request('GET', `/api/users/${orgAUserId}`, orgB.token);
    if (crossAccessUser.status === 404) {
      console.log(`  PASS: Org B cannot access Org A user #${orgAUserId} (404)`);
    } else {
      console.log(`  FAIL: Org B got ${crossAccessUser.status} for Org A user #${orgAUserId} (should be 404)`);
      allPassed = false;
    }
  }

  // Try to access Org A's first category with Org B token
  if (orgACategories.data.categories?.length > 0) {
    const orgACatId = orgACategories.data.categories[0].id;
    const crossAccessCat = await request('GET', `/api/categories/${orgACatId}`, orgB.token);
    if (crossAccessCat.status === 404) {
      console.log(`  PASS: Org B cannot access Org A category #${orgACatId} (404)`);
    } else {
      console.log(`  FAIL: Org B got ${crossAccessCat.status} for Org A category #${orgACatId} (should be 404)`);
      allPassed = false;
    }
  }

  // Try cross-org write operations
  console.log('\n--- Extra: Cross-org write attempts ---');

  // Org B tries to edit Org A transaction
  if (orgATransactions.data.transactions?.length > 0) {
    const orgATxnId = orgATransactions.data.transactions[0].id;
    const crossEditTx = await request('PUT', `/api/transactions/${orgATxnId}`, orgB.token, {
      amount: 1, description: 'HACK'
    });
    if (crossEditTx.status === 404) {
      console.log(`  PASS: Org B cannot edit Org A transaction #${orgATxnId} (404)`);
    } else {
      console.log(`  FAIL: Org B got ${crossEditTx.status} for editing Org A transaction (should be 404)`);
      allPassed = false;
    }
  }

  // Org B tries to delete Org A transaction
  if (orgATransactions.data.transactions?.length > 0) {
    const orgATxnId = orgATransactions.data.transactions[0].id;
    const crossDelTx = await request('DELETE', `/api/transactions/${orgATxnId}`, orgB.token);
    if (crossDelTx.status === 404) {
      console.log(`  PASS: Org B cannot delete Org A transaction #${orgATxnId} (404)`);
    } else {
      console.log(`  FAIL: Org B got ${crossDelTx.status} for deleting Org A transaction (should be 404)`);
      allPassed = false;
    }
  }

  // Org B tries to approve/reject/execute Org A payment request
  if (orgARequests.data.payment_requests?.length > 0) {
    const orgAPrId = orgARequests.data.payment_requests[0].id;
    const crossApprove = await request('POST', `/api/payment-requests/${orgAPrId}/approve`, orgB.token, { comment: 'HACK' });
    if (crossApprove.status === 404) {
      console.log(`  PASS: Org B cannot approve Org A payment request #${orgAPrId} (404)`);
    } else if (crossApprove.status === 400) {
      // If the request is not in "pendiente" status, 400 is ok since it was found but rejected by status check
      // But the important thing is it doesn't succeed
      console.log(`  INFO: Org B got ${crossApprove.status} for Org A PR approve - status mismatch (also acceptable, PR found but wrong status)`);
      // Need to check if this means it found the PR (bad) or not
      // Actually checking the code: it queries WHERE id = ? AND organization_id = ?, so wrong org should return 404
      console.log(`  FAIL: Org B should get 404 for Org A PR, but got 400 (org isolation may be broken)`);
      allPassed = false;
    } else {
      console.log(`  INFO: Org B got ${crossApprove.status} for Org A PR approve`);
      if (crossApprove.status !== 404) {
        allPassed = false;
      }
    }
  }

  // Verify Org B notification creation stays in Org B
  console.log('\n--- Extra: Notification POST creates with correct org ---');
  const createNotifRes = await request('POST', '/api/notifications', orgB.token, {
    user_id: orgB.user.id,
    type: 'recordatorio',
    title: 'Test Isolation',
    message: 'ISOLATION_TEST_260_CHECK'
  });
  if (createNotifRes.status === 201) {
    const notif = createNotifRes.data;
    if (notif.organization_id === orgB.user.organization_id) {
      console.log(`  PASS: Notification created with org_id=${notif.organization_id} (matches Org B)`);
      // Verify Org A can't see it
      const orgANotifs = await request('GET', '/api/notifications', orgA.token);
      const found = orgANotifs.data.notifications?.find(n => n.message === 'ISOLATION_TEST_260_CHECK');
      if (!found) {
        console.log('  PASS: Org A cannot see Org B notification');
      } else {
        console.log('  FAIL: Org A can see Org B notification!');
        allPassed = false;
      }
    } else {
      console.log(`  FAIL: Notification created with wrong org_id=${notif.organization_id}`);
      allPassed = false;
    }
  }

  console.log('\n=== RESULT ===');
  if (allPassed) {
    console.log('ALL TESTS PASSED - Organization isolation is enforced on all endpoints');
  } else {
    console.log('SOME TESTS FAILED - Organization isolation needs fixing');
  }
}

main().catch(console.error);
