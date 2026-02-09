const http = require('http');

function checkPort(port, name) {
  return new Promise((resolve) => {
    const req = http.request({hostname:'localhost', port, path: port === 3001 ? '/api/health' : '/', method:'GET'}, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        console.log(name + ' (port ' + port + '): RUNNING (status ' + res.statusCode + ')');
        resolve(true);
      });
    });
    req.on('error', () => {
      console.log(name + ' (port ' + port + '): NOT RUNNING');
      resolve(false);
    });
    req.setTimeout(3000, () => { req.destroy(); resolve(false); });
    req.end();
  });
}

async function main() {
  await checkPort(3001, 'Backend');
  await checkPort(5173, 'Frontend');
}
main();
