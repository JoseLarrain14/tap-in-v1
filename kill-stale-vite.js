const { execSync } = require('child_process');
try {
  const result = execSync('powershell -Command "Get-Process -Name node -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like \'*vite*\' } | ForEach-Object { Stop-Process -Id $_.Id -Force; Write-Output (\'Killed \' + $_.Id) }"', { encoding: 'utf8' });
  console.log(result || 'Done');
} catch(e) {
  // Try alternate approach - just kill node processes on vite ports
  console.log('Trying alternate approach...');
  try {
    const result2 = execSync('powershell -Command "Get-NetTCPConnection -LocalPort 5173,5174,5175,5176,5177,5178,5179,5180,5181,5182 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue; Write-Output (\'Killed PID \' + $_.OwningProcess) }"', { encoding: 'utf8' });
    console.log(result2 || 'Done killing port owners');
  } catch(e2) {
    console.log('Could not kill via ports either:', e2.message);
  }
}
