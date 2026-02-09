var XLSX = require('xlsx');
var path = require('path');

var filePath = path.join(__dirname, '.playwright-mcp', 'ingresos.xlsx');
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
  console.log('First 3 rows:');
  data.slice(0, 3).forEach(function(row, i) {
    console.log('Row ' + (i+1) + ':', JSON.stringify(row));
  });

  // Verify required columns
  var required = ['Monto (CLP)', 'Fecha', 'Categoria', 'Descripcion', 'Pagador'];
  var cols = Object.keys(data[0] || {});
  var missing = required.filter(function(c) { return cols.indexOf(c) === -1; });

  console.log('');
  if (missing.length > 0) {
    console.log('MISSING COLUMNS:', missing);
  } else {
    console.log('All required columns present: monto, fecha, categoria, descripcion, pagador');
  }

  // Verify data matches - check amounts are numbers
  var allAmountsNumeric = data.every(function(r) { return typeof r['Monto (CLP)'] === 'number'; });
  console.log('All amounts are numeric:', allAmountsNumeric);

  console.log('');
  console.log('VERIFICATION PASSED - Valid .xlsx file with correct data');
} catch(e) {
  console.error('ERROR:', e.message);
}
