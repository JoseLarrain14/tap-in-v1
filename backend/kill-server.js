// Kill server on port 3001 and restart
var cp = require('child_process');
try {
  var result = cp.execSync('powershell -Command "Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }"', { encoding: 'utf8', timeout: 5000 });
  console.log('Killed processes on port 3001');
} catch(e) {
  console.log('No process on port 3001 or could not kill: ' + e.message);
}
