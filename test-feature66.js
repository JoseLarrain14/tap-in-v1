var http = require('http');

function request(method, path, body, token) {
  return new Promise(function(resolve, reject) {
    var opts = {
      hostname: 'localhost',
      port: 3001,
      path: path,
      method: method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (token) opts.headers['Authorization'] = 'Bearer ' + token;
    var req = http.request(opts, function(res) {
      var data = '';
      res.on('data', function(chunk) { data += chunk; });
      res.on('end', function() {
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
  // Login
  var login = await request('POST', '/api/auth/login', {
    email: 'presidente@tapin.cl', password: 'password123'
  });
  var token = login.body.token;

  // Get categories
  var cats = await request('GET', '/api/categories?type=ingreso', null, token);
  var catList = cats.body.categories || [];
  var catId = catList[0].id;

  // Create 5 incomes with different amounts and dates
  var incomes = [
    { amount: 10000, description: 'SORT_TEST_A_smallest', date: '2026-02-05' },
    { amount: 50000, description: 'SORT_TEST_B_medium', date: '2026-02-03' },
    { amount: 30000, description: 'SORT_TEST_C_mid', date: '2026-02-07' },
    { amount: 90000, description: 'SORT_TEST_D_largest', date: '2026-02-01' },
    { amount: 20000, description: 'SORT_TEST_E_small', date: '2026-02-06' },
  ];

  for (var i = 0; i < incomes.length; i++) {
    var inc = incomes[i];
    var res = await request('POST', '/api/transactions', {
      type: 'ingreso',
      amount: inc.amount,
      category_id: catId,
      description: inc.description,
      date: inc.date,
      payer_name: 'Tester ' + (i + 1)
    }, token);
    process.stdout.write('Created: ' + inc.description + ' ($' + inc.amount + ', ' + inc.date + ') -> id=' + res.body.id + '\n');
  }

  // Test sort by amount ascending
  var amtAsc = await request('GET', '/api/transactions?type=ingreso&sort_by=amount&sort_order=asc&search=SORT_TEST', null, token);
  var amtAscList = amtAsc.body.transactions || [];
  process.stdout.write('\n=== SORT BY AMOUNT ASC ===\n');
  amtAscList.forEach(function(tx) {
    process.stdout.write('  $' + tx.amount + ' - ' + tx.description + '\n');
  });
  var amtAscOk = amtAscList.length >= 5 && amtAscList[0].amount <= amtAscList[amtAscList.length - 1].amount;
  process.stdout.write('Amount ASC correct: ' + amtAscOk + '\n');

  // Test sort by amount descending
  var amtDesc = await request('GET', '/api/transactions?type=ingreso&sort_by=amount&sort_order=desc&search=SORT_TEST', null, token);
  var amtDescList = amtDesc.body.transactions || [];
  process.stdout.write('\n=== SORT BY AMOUNT DESC ===\n');
  amtDescList.forEach(function(tx) {
    process.stdout.write('  $' + tx.amount + ' - ' + tx.description + '\n');
  });
  var amtDescOk = amtDescList.length >= 5 && amtDescList[0].amount >= amtDescList[amtDescList.length - 1].amount;
  process.stdout.write('Amount DESC correct: ' + amtDescOk + '\n');

  // Test sort by date ascending
  var dateAsc = await request('GET', '/api/transactions?type=ingreso&sort_by=date&sort_order=asc&search=SORT_TEST', null, token);
  var dateAscList = dateAsc.body.transactions || [];
  process.stdout.write('\n=== SORT BY DATE ASC ===\n');
  dateAscList.forEach(function(tx) {
    process.stdout.write('  ' + tx.date + ' - ' + tx.description + '\n');
  });
  var dateAscOk = dateAscList.length >= 5 && dateAscList[0].date <= dateAscList[dateAscList.length - 1].date;
  process.stdout.write('Date ASC correct: ' + dateAscOk + '\n');

  // Test sort by date descending
  var dateDesc = await request('GET', '/api/transactions?type=ingreso&sort_by=date&sort_order=desc&search=SORT_TEST', null, token);
  var dateDescList = dateDesc.body.transactions || [];
  process.stdout.write('\n=== SORT BY DATE DESC ===\n');
  dateDescList.forEach(function(tx) {
    process.stdout.write('  ' + tx.date + ' - ' + tx.description + '\n');
  });
  var dateDescOk = dateDescList.length >= 5 && dateDescList[0].date >= dateDescList[dateDescList.length - 1].date;
  process.stdout.write('Date DESC correct: ' + dateDescOk + '\n');

  if (amtAscOk && amtDescOk && dateAscOk && dateDescOk) {
    process.stdout.write('\n=== ALL API SORT CHECKS PASSED ===\n');
  } else {
    process.stdout.write('\n=== SOME CHECKS FAILED ===\n');
  }
}

main().catch(function(e) { process.stdout.write('Error: ' + e.message + '\n'); });
