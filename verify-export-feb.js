const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, '.playwright-mcp', 'ingresos-desde-2026-02-01-hasta-2026-02-28.xlsx');
try {
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(ws);

  console.log('Sheet name:', wb.SheetNames[0]);
  console.log('Row count:', data.length);

  // Check all are February
  const allFeb = data.every(row => row.Fecha && row.Fecha.startsWith('2026-02'));
  const noJan = data.every(row => !row.Fecha || !row.Fecha.startsWith('2026-01'));

  console.log('All records are February:', allFeb);
  console.log('No January records:', noJan);
  console.log('Has records (>0):', data.length > 0);

  // Show first 3 and last 3
  console.log('\nFirst 3:');
  data.slice(0, 3).forEach(r => console.log(`  ${r.Fecha} - ${r.Descripcion} - ${r['Monto (CLP)']}`));
  console.log('Last 3:');
  data.slice(-3).forEach(r => console.log(`  ${r.Fecha} - ${r.Descripcion} - ${r['Monto (CLP)']}`));

  console.log('\nPASS:', allFeb && noJan && data.length > 0);
} catch(e) {
  console.error('Error:', e.message);
}
