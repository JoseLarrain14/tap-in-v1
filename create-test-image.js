let fs = require('fs');
let buf = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
fs.writeFileSync('C:/Users/josel/CPP/test-attachment.png', buf);
process.stdout.write('Created: ' + buf.length + ' bytes\n');
