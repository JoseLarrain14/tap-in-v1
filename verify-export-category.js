const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, '.playwright-mcp', 'ingresos.xlsx');
try {
  const wb = XLSX.readFile(filePath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(ws);

  console.log('Row count:', data.length);

  // Check categories
  const categories = [...new Set(data.map(r => r.Categoria))];
  console.log('Unique categories:', categories);

  const allCuota = data.every(r => r.Categoria === 'Cuota Mensual');
  console.log('All Cuota Mensual:', allCuota);
  console.log('PASS:', allCuota && data.length === 24);
} catch(e) {
  console.error('Error:', e.message);
}
