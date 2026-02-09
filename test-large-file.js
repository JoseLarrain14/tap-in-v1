// Create a large test file (11MB) for testing file upload size limit
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'test-large-11mb.pdf');
const size = 11 * 1024 * 1024; // 11MB
const buffer = Buffer.alloc(size, 'A');
fs.writeFileSync(filePath, buffer);
process.stdout.write('Created test file: ' + filePath + ' (' + (size / 1024 / 1024) + 'MB)\n');

// Also create a small valid file
const smallPath = path.join(__dirname, 'test-small-valid.pdf');
fs.writeFileSync(smallPath, 'Small valid PDF test file content');
process.stdout.write('Created small file: ' + smallPath + '\n');
