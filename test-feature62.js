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
  console.log('Delegado id:', delLogin.body.user.id, 'name:', delLogin.body.user.name);

  // Login as presidente
  const presLogin = await request('POST', '/api/auth/login', null, {
    email: 'presidente@tapin.cl',
    password: 'password123'
  });
  const presToken = presLogin.body.token;
  console.log('Presidente id:', presLogin.body.user.id, 'name:', presLogin.body.user.name);

  // Check presidente's notifications BEFORE
  const notifBefore = await request('GET', '/api/notifications', presToken);
  console.log('\nPresidente notifications BEFORE:', notifBefore.body.notifications.length);

  // Get a category for the request
  const catsRes = await request('GET', '/api/categories', delToken);
  const cats = catsRes.body.categories || catsRes.body;
  const egressCat = (Array.isArray(cats) ? cats : []).find(c => c.type === 'egreso');

  // Create a draft payment request as delegado
  const createRes = await request('POST', '/api/payment-requests', delToken, {
    title: 'F62_TEST_SOLICITUD',
    description: 'Feature 62 test - Compra materiales escolares',
    amount: 25000,
    category_id: egressCat.id,
    beneficiary: 'Librería Test'
  });
  console.log('\nCreated draft PR:', createRes.status, 'id:', createRes.body.id, 'status:', createRes.body.status);

  // Submit the draft (borrador -> pendiente)
  const submitRes = await request('POST', '/api/payment-requests/' + createRes.body.id + '/submit', delToken);
  console.log('Submitted PR:', submitRes.status, 'status:', submitRes.body.status);

  // Check presidente's notifications AFTER
  const notifAfter = await request('GET', '/api/notifications', presToken);
  console.log('\nPresidente notifications AFTER:', notifAfter.body.notifications.length);

  // Find the new notification
  const newNotifs = notifAfter.body.notifications.filter(n =>
    n.reference_id === createRes.body.id && n.type === 'solicitud_creada'
  );
  console.log('New solicitud_creada notifications:', newNotifs.length);
  if (newNotifs.length > 0) {
    const notif = newNotifs[0];
    console.log('  title:', notif.title);
    console.log('  message:', notif.message);
    console.log('  type:', notif.type);
    console.log('  reference_type:', notif.reference_type);
    console.log('  reference_id:', notif.reference_id);
    console.log('  is_read:', notif.is_read);
    console.log('\n=== FEATURE 62 TEST PASSED ===');
    console.log('PR ID for browser test:', createRes.body.id);
  } else {
    console.log('ERROR: No notification found for the submitted PR');
    console.log('All recent notifications:');
    notifAfter.body.notifications.slice(0, 5).forEach(n => {
      console.log('  -', n.id, n.type, n.title, 'ref:', n.reference_id);
    });
  }
}

main().catch(console.error);
