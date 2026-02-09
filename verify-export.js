const XLSX = require('xlsx');
const path = require('path');

// Check the downloaded file
const filePath = path.join(__dirname, '.playwright-mcp', 'ingresos-desde-2026-01-01-hasta-2026-01-31.xlsx');
try {
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(ws);

  console.log('Sheet name:', wb.SheetNames[0]);
  console.log('Row count:', data.length);
  console.log('Columns:', Object.keys(data[0] || {}));
  console.log('\nAll rows:');
  data.forEach((row, i) => {
    console.log(`  Row ${i+1}: date=${row.Fecha}, desc=${row.Descripcion}, amount=${row['Monto (CLP)']}`);
  });

  // Verify only January records
  const allJanuary = data.every(row => row.Fecha && row.Fecha.startsWith('2026-01'));
  const noFeb = data.every(row => !row.Fecha || !row.Fecha.startsWith('2026-02'));

  console.log('\n--- VERIFICATION ---');
  console.log('All records are January:', allJanuary);
  console.log('No February records:', noFeb);
  console.log('Has 3 records:', data.length === 3);
  console.log('PASS:', allJanuary && noFeb && data.length === 3);
} catch(e) {
  console.error('Error reading file:', e.message);
}
