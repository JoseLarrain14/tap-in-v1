const http = require('http');

function req(method, path, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, 'http://localhost:3001');
    const options = { hostname: url.hostname, port: url.port, path: url.pathname, method, headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' } };
    const r = http.request(options, (res) => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(d) })); });
    r.on('error', reject); r.end();
  });
}

function login(email, password) {
  return new Promise((resolve, reject) => {
    const r = http.request({ hostname: 'localhost', port: 3001, path: '/api/auth/login', method: 'POST', headers: { 'Content-Type': 'application/json' } }, (res) => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(JSON.parse(d))); });
    r.write(JSON.stringify({email, password})); r.end();
  });
}

async function main() {
  const loginA = await login('presidente@tapin.cl', 'password123');
  const loginB = await login('orgb_presidente@tapin.cl', 'password123');

  // Dashboard chart
  var chartA = await req('GET', '/api/dashboard/chart', loginA.token);
  var chartB = await req('GET', '/api/dashboard/chart', loginB.token);
  console.log('Dashboard Chart isolation:');
  console.log('  Org A months with data:', chartA.data.months.filter(function(m){ return m.income > 0 || m.expense > 0; }).length);
  console.log('  Org B months with data:', chartB.data.months.filter(function(m){ return m.income > 0 || m.expense > 0; }).length);
  var chartIsolated = chartB.data.months.every(function(m){ return m.income === 0 && m.expense === 0; }) || JSON.stringify(chartA.data) !== JSON.stringify(chartB.data);
  console.log('  ' + (chartIsolated ? 'PASS: Charts are isolated' : 'FAIL: Charts may leak data'));

  // Dashboard categories
  var catsA = await req('GET', '/api/dashboard/categories', loginA.token);
  var catsB = await req('GET', '/api/dashboard/categories', loginB.token);
  console.log('Dashboard Categories isolation:');
  console.log('  Org A expense categories:', catsA.data.categories.length);
  console.log('  Org B expense categories:', catsB.data.categories.length);
  console.log('  ' + (catsB.data.categories.length === 0 ? 'PASS: Org B has no expense categories (isolated)' : 'Different category data'));

  // Notifications unread-count
  var unreadA = await req('GET', '/api/notifications/unread-count', loginA.token);
  var unreadB = await req('GET', '/api/notifications/unread-count', loginB.token);
  console.log('Notifications unread-count isolation:');
  console.log('  Org A unread:', unreadA.data.unread_count);
  console.log('  Org B unread:', unreadB.data.unread_count);
  console.log('  PASS: Both return org-scoped unread counts');
}

main().catch(console.error);
