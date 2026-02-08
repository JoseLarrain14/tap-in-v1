const http = require('http');
const ports = [5173, 5180, 5181, 5182, 5183];
ports.forEach(p => {
  const req = http.get('http://localhost:' + p, r => {
    console.log('Port ' + p + ': OPEN (status ' + r.statusCode + ')');
    r.resume();
  });
  req.on('error', () => console.log('Port ' + p + ': closed'));
  req.setTimeout(2000, () => { console.log('Port ' + p + ': timeout'); req.destroy(); });
});
