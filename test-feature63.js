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
  // Login as delegado
  const delLogin = await request('POST', '/api/auth/login', null, {
    email: 'delegado@tapin.cl',
    password: 'password123'
  });
  const delToken = delLogin.body.token;
  console.log('Delegado:', delLogin.body.user.id, delLogin.body.user.name);

  // Login as presidente
  const presLogin = await request('POST', '/api/auth/login', null, {
    email: 'presidente@tapin.cl',
    password: 'password123'
  });
  const presToken = presLogin.body.token;
  console.log('Presidente:', presLogin.body.user.id, presLogin.body.user.name);

  // Login as secretaria
  const secLogin = await request('POST', '/api/auth/login', null, {
    email: 'secretaria@tapin.cl',
    password: 'password123'
  });
  if (secLogin.body.token) {
    console.log('Secretaria:', secLogin.body.user.id, secLogin.body.user.name);
  } else {
    console.log('Secretaria login failed:', secLogin.body.error);
  }
  const secToken = secLogin.body.token;

  // Get categories
  const catsRes = await request('GET', '/api/categories', delToken);
  const cats = catsRes.body.categories || catsRes.body;
  const egressCat = (Array.isArray(cats) ? cats : []).find(c => c.type === 'egreso');

  // Step 1: Create and submit a payment request as delegado
  const createRes = await request('POST', '/api/payment-requests', delToken, {
    description: 'F63_TEST_Aprobacion_Notificacion',
    amount: 30000,
    category_id: egressCat.id,
    beneficiary: 'Proveedor F63'
  });
  console.log('\nCreated PR:', createRes.body.id, 'status:', createRes.body.status);

  // Submit it
  const submitRes = await request('POST', '/api/payment-requests/' + createRes.body.id + '/submit', delToken);
  console.log('Submitted PR:', submitRes.body.status);

  // Step 2: Get delegado's current notification count
  const delNotifBefore = await request('GET', '/api/notifications', delToken);
  const delCountBefore = delNotifBefore.body.notifications.length;
  console.log('\nDelegado notifications before:', delCountBefore);

  // Get secretaria's current notification count
  let secCountBefore = 0;
  if (secToken) {
    const secNotifBefore = await request('GET', '/api/notifications', secToken);
    secCountBefore = secNotifBefore.body.notifications.length;
    console.log('Secretaria notifications before:', secCountBefore);
  }

  // Step 3: Approve the request as presidente
  const approveRes = await request('POST', '/api/payment-requests/' + createRes.body.id + '/approve', presToken);
  console.log('\nApproved PR:', approveRes.body.status);

  // Step 4: Check delegado's notifications after approval
  const delNotifAfter = await request('GET', '/api/notifications', delToken);
  const delCountAfter = delNotifAfter.body.notifications.length;
  console.log('\nDelegado notifications after:', delCountAfter, '(+' + (delCountAfter - delCountBefore) + ')');

  const delApprovalNotifs = delNotifAfter.body.notifications.filter(n =>
    n.reference_id === createRes.body.id && n.type === 'solicitud_aprobada'
  );
  console.log('Delegado approval notifications for this PR:', delApprovalNotifs.length);
  if (delApprovalNotifs.length > 0) {
    const n = delApprovalNotifs[0];
    console.log('  title:', n.title);
    console.log('  message:', n.message);
    console.log('  reference_type:', n.reference_type);
    console.log('  reference_id:', n.reference_id);
  }

  // Step 5: Check secretaria's notifications after approval
  if (secToken) {
    const secNotifAfter = await request('GET', '/api/notifications', secToken);
    const secCountAfter = secNotifAfter.body.notifications.length;
    console.log('\nSecretaria notifications after:', secCountAfter, '(+' + (secCountAfter - secCountBefore) + ')');

    const secApprovalNotifs = secNotifAfter.body.notifications.filter(n =>
      n.reference_id === createRes.body.id && n.type === 'solicitud_aprobada'
    );
    console.log('Secretaria approval notifications for this PR:', secApprovalNotifs.length);
    if (secApprovalNotifs.length > 0) {
      const n = secApprovalNotifs[0];
      console.log('  title:', n.title);
      console.log('  message:', n.message);
      console.log('  reference_type:', n.reference_type);
      console.log('  reference_id:', n.reference_id);
    }
  }

  console.log('\n=== FEATURE 63 TEST RESULTS ===');
  console.log('Delegado got approval notification:', delApprovalNotifs.length > 0 ? 'PASS' : 'FAIL');
  if (secToken) {
    const secNotifAfter = await request('GET', '/api/notifications', secToken);
    const secApprovalNotifs = secNotifAfter.body.notifications.filter(n =>
      n.reference_id === createRes.body.id && n.type === 'solicitud_aprobada'
    );
    console.log('Secretaria got approval notification:', secApprovalNotifs.length > 0 ? 'PASS' : 'FAIL');
  } else {
    console.log('Secretaria: NO ACCOUNT (need to create one)');
  }
  console.log('PR ID for browser test:', createRes.body.id);
}

main().catch(console.error);
