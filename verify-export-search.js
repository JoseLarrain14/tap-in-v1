const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, '.playwright-mcp', 'ingresos.xlsx');
try {
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(ws);

  console.log('Row count:', data.length);
  console.log('Descriptions:', data.map(r => r.Descripcion));

  const allExportTest = data.every(r => r.Descripcion && r.Descripcion.includes('EXPORT_TEST'));
  console.log('All contain EXPORT_TEST:', allExportTest);
  console.log('Has 5 records:', data.length === 5);
  console.log('PASS:', allExportTest && data.length === 5);
} catch(e) {
  console.error('Error:', e.message);
}
