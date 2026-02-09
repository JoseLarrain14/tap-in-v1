// Submit payment request 29 and test attachment upload
const http = require('http');
const fs = require('fs');
const path = require('path');

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
  // Login as delegado
  const login = await apiCall('POST', '/api/auth/login', null, {
    email: 'delegado@tapin.cl', password: 'password123'
  });
  const token = login.data.token;

  // Submit PR 29
  const submit = await apiCall('POST', '/api/payment-requests/29/submit', token, {});
  console.log('Submit status:', submit.status, JSON.stringify(submit.data).substring(0, 200));

  // Check PR detail
  const detail = await apiCall('GET', '/api/payment-requests/29', token);
  console.log('PR status:', detail.data.payment_request?.status || detail.data.status);
  console.log('PR ID: 29');
  console.log('Navigate to: http://localhost:5173/solicitudes/29');
}

main().catch(console.error);
