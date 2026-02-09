var db = require('./backend/src/database.js');
var users = db.prepare('SELECT id, email, role FROM users LIMIT 10').all();
users.forEach(function(u) { process.stdout.write(u.id + ' ' + u.email + ' ' + u.role + '\n'); });
