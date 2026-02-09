const http = require('http');

function testPort(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${port}/`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`Port ${port}: Status=${res.statusCode} Headers=${JSON.stringify(res.headers)} Body=${data.substring(0, 200)}`);
        resolve();
      });
    });
    req.on('error', (e) => {
      console.log(`Port ${port}: Error=${e.message}`);
      resolve();
    });
    req.setTimeout(5000, () => {
      console.log(`Port ${port}: Timeout`);
      req.destroy();
      resolve();
    });
  });
}

async function main() {
  await testPort(3001);
  await testPort(5173);
}

main();
