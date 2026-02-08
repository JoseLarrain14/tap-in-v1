const { execSync } = require('child_process');

// Find process on port 3001
try {
  const result = execSync('netstat -ano', { encoding: 'utf8', stdio: 'pipe' });
  const lines = result.split('\n').filter(l => l.includes(':3001') && l.includes('LISTENING'));
  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    const pid = parts[parts.length - 1];
    if (pid && pid !== '0') {
      console.log('Killing PID:', pid);
      try { execSync('kill ' + pid); } catch(e) { console.log('kill via kill failed'); }
    }
  }
} catch(e) {
  console.log('Error:', e.message);
}
console.log('Done');
