// Feature #103: File upload rejects oversized files
const http = require('http');
const fs = require('fs');
const path = require('path');

function loginRequest() {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ email: 'secretaria@tapin.cl', password: 'password123' });
    const req = http.request({
      hostname: 'localhost', port: 3001,
      path: '/api/auth/login', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, res => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => resolve(JSON.parse(b)));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function uploadFile(path, token, fieldName, fileBuffer, filename) {
  return new Promise((resolve, reject) => {
    const boundary = '----FormBoundary' + Date.now();

    let body = Buffer.concat([
      Buffer.from(`--${boundary}\r\n`),
      Buffer.from(`Content-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\n`),
      Buffer.from(`Content-Type: application/octet-stream\r\n\r\n`),
      fileBuffer,
      Buffer.from(`\r\n--${boundary}--\r\n`)
    ]);

    const req = http.request({
      hostname: 'localhost', port: 3001,
      path, method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length
      }
    }, res => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(b) });
        } catch(e) {
          resolve({ status: res.statusCode, body: b });
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  // Login as secretaria (has upload permissions for execution)
  const login = await loginRequest();
  const token = login.token;
  process.stdout.write('Login: ' + (token ? 'OK' : 'FAIL') + '\n');

  // Test 1: Try to upload a file > 10MB (create 11MB buffer)
  process.stdout.write('\n--- Test 1: Upload oversized file (11MB) ---\n');
  const largeFile = Buffer.alloc(11 * 1024 * 1024, 'A'); // 11MB of 'A'

  // Upload to attachments endpoint with a dummy payment request ID
  // First find an approved PR to test execute endpoint, or use attachments
  const t1 = await uploadFile('/api/payment-requests/1/attachments', token, 'file', largeFile, 'large-test.pdf');
  process.stdout.write('Status: ' + t1.status + ' (expected 413 or 400)\n');
  process.stdout.write('Response: ' + JSON.stringify(t1.body) + '\n');
  const oversizeRejected = (t1.status === 413 || t1.status === 400) &&
    typeof t1.body === 'object' && t1.body.error && t1.body.error.includes('tamaño');
  process.stdout.write('PASS: ' + (oversizeRejected ? 'YES' : 'NO') + '\n');

  // Test 2: Upload normal-sized file (should succeed if PR exists)
  process.stdout.write('\n--- Test 2: Upload normal-sized file ---\n');
  const smallFile = Buffer.from('This is a normal test file content for feature 103 testing.');
  const t2 = await uploadFile('/api/payment-requests/1/attachments', token, 'file', smallFile, 'test-small.pdf');
  process.stdout.write('Status: ' + t2.status + '\n');
  process.stdout.write('Response: ' + JSON.stringify(t2.body).substring(0, 200) + '\n');
  // Could be 201 success or 404 if PR doesn't exist for this user's org
  const normalAccepted = t2.status === 201 || t2.status === 404;
  process.stdout.write('PASS (not blocked by size): ' + (normalAccepted ? 'YES' : 'NO') + '\n');

  // Test 3: Upload file with wrong type
  process.stdout.write('\n--- Test 3: Upload wrong file type ---\n');
  const exeFile = Buffer.from('fake exe content');
  const t3 = await uploadFile('/api/payment-requests/1/attachments', token, 'file', exeFile, 'malware.exe');
  process.stdout.write('Status: ' + t3.status + ' (expected 400)\n');
  process.stdout.write('Response: ' + JSON.stringify(t3.body) + '\n');
  const wrongTypeRejected = t3.status === 400 && typeof t3.body === 'object' && t3.body.error;
  process.stdout.write('PASS: ' + (wrongTypeRejected ? 'YES' : 'NO') + '\n');

  process.stdout.write('\n=== All tests completed ===\n');
}

main().catch(e => process.stdout.write('Error: ' + e.message + '\n'));
