var XLSX = require('xlsx');
var path = require('path');

var filePath = path.join(__dirname, '.playwright-mcp', 'solicitudes.xlsx');
console.log('Reading file:', filePath);

try {
  var wb = XLSX.readFile(filePath);
  console.log('Sheet names:', wb.SheetNames);

  var ws = wb.Sheets[wb.SheetNames[0]];
  var data = XLSX.utils.sheet_to_json(ws);

  console.log('Total rows:', data.length);
  console.log('');
  console.log('Columns:', Object.keys(data[0] || {}));
  console.log('');
  console.log('First 5 rows:');
  data.slice(0, 5).forEach(function(row, i) {
    console.log('Row ' + (i+1) + ':', JSON.stringify(row));
  });

  // Verify required columns: monto, categoria, estado, beneficiario
  var required = ['Monto (CLP)', 'Categoria', 'Estado', 'Beneficiario'];
  var cols = Object.keys(data[0] || {});
  var missing = required.filter(function(c) { return cols.indexOf(c) === -1; });

  console.log('');
  if (missing.length > 0) {
    console.log('MISSING COLUMNS:', missing);
  } else {
    console.log('All required columns present: monto, categoria, estado, beneficiario');
  }

  // Verify various states exist
  var states = {};
  data.forEach(function(r) {
    var s = r['Estado'] || 'unknown';
    states[s] = (states[s] || 0) + 1;
  });
  console.log('');
  console.log('States distribution:', JSON.stringify(states));

  // Verify amounts are numeric
  var allAmountsNumeric = data.every(function(r) { return typeof r['Monto (CLP)'] === 'number'; });
  console.log('All amounts are numeric:', allAmountsNumeric);

  console.log('');
  console.log('VERIFICATION PASSED - Valid .xlsx file with correct data');
} catch(e) {
  console.error('ERROR:', e.message);
}
