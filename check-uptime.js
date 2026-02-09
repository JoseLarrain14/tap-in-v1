const http = require('http');
http.get('http://localhost:3001/api/health', res => {
  let b = '';
  res.on('data', c => b += c);
  res.on('end', () => {
    const j = JSON.parse(b);
    process.stdout.write('Uptime: ' + j.server.uptime + 's\n');
  });
}).on('error', e => process.stdout.write('Error: ' + e.message + '\n'));
