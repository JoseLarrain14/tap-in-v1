const { execSync } = require('child_process');
try {
  // On Windows, find and kill processes on port 3001
  const result = execSync('wmic process where "commandline like \'%index.js%\'" get processid /format:list', { encoding: 'utf8' });
  console.log('WMIC result:', result);
  const pids = result.match(/ProcessId=(\d+)/g);
  if (pids) {
    pids.forEach(p => {
      const pid = p.split('=')[1];
      console.log('Killing PID:', pid);
      try { execSync(`taskkill /F /PID ${pid}`); } catch(e) { console.log('Kill error:', e.message); }
    });
  }
} catch(e) {
  // Fallback: kill all node processes
  console.log('Trying taskkill /F /IM node.exe...');
  try {
    execSync('taskkill /F /IM node.exe', { encoding: 'utf8' });
    console.log('Killed all node.exe processes');
  } catch(e2) {
    console.log('Result:', e2.message);
  }
}
