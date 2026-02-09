const { execSync, spawn } = require('child_process');
const http = require('http');

async function main() {
  // Kill anything on port 5173
  try {
    const result = execSync('netstat -ano | findstr :5173 | findstr LISTENING', { encoding: 'utf8' });
    const lines = result.trim().split('\n');
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && pid !== '0') {
        console.log('Killing PID on 5173:', pid);
        try { execSync(`taskkill /PID ${pid} /F`, { encoding: 'utf8' }); } catch(e) {}
      }
    }
  } catch(e) {
    console.log('Port 5173 is free');
  }

  await new Promise(r => setTimeout(r, 2000));

  // Start vite using npx
  console.log('Starting Vite frontend...');
  const child = spawn('npx', ['vite', '--host', '--port', '5173'], {
    cwd: 'C:/Users/josel/CPP/frontend',
    stdio: 'inherit',
    shell: true,
    detached: true
  });

  child.unref();

  // Wait for it to be ready
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 1000));
    try {
      const code = await new Promise((resolve, reject) => {
        const req = http.get('http://localhost:5173', (res) => {
          let d = '';
          res.on('data', c => d += c);
          res.on('end', () => resolve({ code: res.statusCode, body: d.substring(0, 100) }));
        });
        req.on('error', reject);
        req.setTimeout(2000, () => { req.destroy(); reject(new Error('timeout')); });
      });
      console.log(`Attempt ${i+1}: status=${code.code}, body starts with: ${code.body.substring(0, 50)}`);
      if (code.code === 200 && code.body.includes('html')) {
        console.log('Frontend is ready on port 5173!');
        process.exit(0);
      }
    } catch(e) {
      console.log(`Attempt ${i+1}: not ready yet`);
    }
  }

  console.log('Frontend may not be ready yet');
  process.exit(0);
}

main().catch(console.error);
