const { exec, spawn } = require('child_process');
const path = require('path');

// Find and kill processes on ports 5173-5178
const ports = [5173, 5174, 5175, 5176, 5177, 5178];

function killPort(port) {
  return new Promise((resolve) => {
    exec(`node -e "const http = require('http'); const req = http.request({hostname:'localhost',port:${port},path:'/__vite_ping',method:'GET'},()=>{}); req.on('error',()=>{}); req.end();"`, () => resolve());
  });
}

// Use a different approach - find node PIDs listening on these ports via PowerShell
exec('powershell -Command "Get-NetTCPConnection -LocalPort 5173,5174,5175,5176,5177,5178 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess | Sort-Object -Unique"', (err, stdout) => {
  if (stdout && stdout.trim()) {
    const pids = stdout.trim().split('\n').map(p => p.trim()).filter(Boolean);
    console.log('Found PIDs on vite ports:', pids);
    pids.forEach(pid => {
      exec(`powershell -Command "Stop-Process -Id ${pid} -Force -ErrorAction SilentlyContinue"`, () => {
        console.log(`Killed PID ${pid}`);
      });
    });
    setTimeout(startVite, 2000);
  } else {
    console.log('No processes found on vite ports');
    startVite();
  }
});

function startVite() {
  console.log('Starting Vite on port 5173...');
  const child = spawn('npx', ['vite', '--host', '--port', '5173', '--strictPort'], {
    cwd: path.join(__dirname, 'frontend'),
    stdio: 'inherit',
    shell: true
  });
  child.on('error', (err) => console.error('Failed:', err));
}
