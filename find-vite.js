const http = require('http');

async function checkPort(port) {
  return new Promise((resolve) => {
    const req = http.request({hostname:'localhost', port, path: '/', method:'GET'}, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        const isVite = d.includes('vite') || d.includes('Vite') || d.includes('src/main') || d.includes('react');
        console.log(`Port ${port}: status=${res.statusCode} isVite=${isVite} length=${d.length}`);
        resolve(true);
      });
    });
    req.on('error', () => resolve(false));
    req.setTimeout(2000, () => { req.destroy(); resolve(false); });
    req.end();
  });
}

async function main() {
  for (let port = 5170; port <= 5180; port++) {
    await checkPort(port);
  }
  // Also check common alt ports
  for (const port of [3000, 3002, 4173, 8080]) {
    await checkPort(port);
  }
}
main();
