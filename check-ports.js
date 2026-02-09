const http = require('http');
[5173, 5174, 5175, 5176, 3001].forEach(p => {
  const req = http.get('http://localhost:' + p, r => {
    let d = '';
    r.on('data', c => d += c);
    r.on('end', () => console.log('Port ' + p + ': OPEN (status ' + r.statusCode + ') body: ' + d.substring(0, 150)));
  });
  req.on('error', () => console.log('Port ' + p + ': closed'));
  req.setTimeout(2000, () => { console.log('Port ' + p + ': timeout'); req.destroy(); });
});
