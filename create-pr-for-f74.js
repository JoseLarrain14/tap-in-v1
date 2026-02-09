// Create a payment request for Feature #74 testing
const http = require('http');

function apiCall(method, path, token, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'localhost',
      port: 3001,
      path: path,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
      }
    };
    const req = http.request(opts, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(body) }); } catch(e) { resolve({ status: res.statusCode, data: body }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  // Login as delegado (can create payment requests)
  const login = await apiCall('POST', '/api/auth/login', null, {
    email: 'delegado@tapin.cl', password: 'password123'
  });
  console.log('Login:', login.data.user ? 'OK' : 'FAILED');
  const token = login.data.token;

  // Get categories
  const cats = await apiCall('GET', '/api/categories', token);
  const egresoCat = cats.data.categories.find(c => c.type === 'egreso');
  console.log('Using category:', egresoCat.name, 'ID:', egresoCat.id);

  // Create a payment request
  const pr = await apiCall('POST', '/api/payment-requests', token, {
    amount: 75000,
    description: 'TEST_F74_ATTACHMENT - Compra de materiales para test de adjuntos',
    beneficiary: 'Proveedor Test F74',
    category_id: egresoCat.id
  });
  console.log('Payment request created:', JSON.stringify(pr.data));

  // Submit it
  if (pr.data.payment_request) {
    const prId = pr.data.payment_request.id;
    const submit = await apiCall('POST', `/api/payment-requests/${prId}/submit`, token, {});
    console.log('Submitted:', submit.status);
    console.log('PR ID:', prId);
    console.log('\nNavigate to: http://localhost:5173/solicitudes/' + prId);
  }
}

main().catch(console.error);
