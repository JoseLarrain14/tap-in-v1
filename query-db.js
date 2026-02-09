const { initializeDatabase, getDb } = require('./backend/src/database');

async function main() {
  await initializeDatabase();
  const db = getDb();
  const action = process.argv[2];

  if (action === 'users') {
    const users = db.prepare('SELECT id, name, email, role, organization_id FROM users WHERE organization_id = 1').all();
    console.log(JSON.stringify(users, null, 2));
  } else if (action === 'payment-requests') {
    const prs = db.prepare('SELECT id, description, status, amount, created_by FROM payment_requests WHERE organization_id = 1').all();
    console.log(JSON.stringify(prs, null, 2));
  } else if (action === 'notifications') {
    const notifs = db.prepare('SELECT id, user_id, type, title, message, reference_type, reference_id, is_read FROM notifications WHERE organization_id = 1 ORDER BY id DESC LIMIT 20').all();
    console.log(JSON.stringify(notifs, null, 2));
  } else if (action === 'clean-test-data') {
    // Delete test payment requests and related events
    const prs = db.prepare("SELECT id FROM payment_requests WHERE organization_id = 1 AND description LIKE 'COUNTER_TEST%'").all();
    for (const pr of prs) {
      db.prepare('DELETE FROM payment_events WHERE payment_request_id = ?').run(pr.id);
    }
    const result = db.prepare("DELETE FROM payment_requests WHERE organization_id = 1 AND description LIKE 'COUNTER_TEST%'").run();
    console.log('Deleted', result.changes, 'test payment requests');
    // Clean test notifications
    const notifResult = db.prepare("DELETE FROM notifications WHERE organization_id = 1 AND (message LIKE '%COUNTER_TEST%' OR message LIKE '%NOTIF_TEST%' OR message LIKE '%APPROVAL_NOTIF_TEST%')").run();
    console.log('Deleted', notifResult.changes, 'test notifications');
  } else {
    console.log('Usage: node query-db.js [users|payment-requests|notifications|clean-test-data]');
  }
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
