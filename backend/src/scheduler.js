// Scheduled tasks for Tap In V1
// Runs periodic checks for reminders and other time-based features

const { getDb } = require('./database');

let reminderInterval = null;

/**
 * Check for payment requests that have been pending for 3+ days
 * and create reminder notifications for presidentes.
 *
 * Avoids duplicates by checking if a 'recordatorio' notification
 * already exists for the same payment_request within the last 3 days.
 */
function checkPendingReminders() {
  try {
    const db = getDb();

    // Find payment requests that have been in 'pendiente' status for 3+ days
    // We use the updated_at timestamp (when it was set to pendiente) or created_at
    const staleRequests = db.prepare(`
      SELECT pr.id, pr.organization_id, pr.description, pr.amount, pr.created_by,
             pr.created_at, pr.updated_at,
             cu.name as created_by_name
      FROM payment_requests pr
      LEFT JOIN users cu ON pr.created_by = cu.id
      WHERE pr.status = 'pendiente'
        AND datetime(pr.updated_at) <= datetime('now', '-3 days')
    `).all();

    if (staleRequests.length === 0) {
      return { checked: 0, reminders_created: 0 };
    }

    let remindersCreated = 0;

    for (const req of staleRequests) {
      // Check if a reminder was already sent for this request in the last 3 days
      const existingReminder = db.prepare(`
        SELECT id FROM notifications
        WHERE type = 'recordatorio'
          AND reference_type = 'payment_request'
          AND reference_id = ?
          AND organization_id = ?
          AND datetime(created_at) > datetime('now', '-3 days')
      `).get(req.id, req.organization_id);

      if (existingReminder) {
        // Already reminded recently, skip
        continue;
      }

      // Get all active presidentes in this organization
      const presidentes = db.prepare(
        "SELECT id FROM users WHERE organization_id = ? AND role = 'presidente' AND is_active = 1"
      ).all(req.organization_id);

      const creatorName = req.created_by_name || 'Un delegado';

      for (const pres of presidentes) {
        db.prepare(`
          INSERT INTO notifications (organization_id, user_id, type, title, message, reference_type, reference_id)
          VALUES (?, ?, 'recordatorio', 'Recordatorio: solicitud pendiente', ?, 'payment_request', ?)
        `).run(
          req.organization_id,
          pres.id,
          `La solicitud "${req.description}" de ${creatorName} lleva más de 3 días pendiente de aprobación`,
          req.id
        );
        remindersCreated++;
      }
    }

    if (remindersCreated > 0) {
      console.log(`[Scheduler] Created ${remindersCreated} reminder notifications for ${staleRequests.length} stale requests`);
    }

    return { checked: staleRequests.length, reminders_created: remindersCreated };
  } catch (err) {
    console.error('[Scheduler] Error checking pending reminders:', err.message);
    return { error: err.message };
  }
}

/**
 * Start the reminder scheduler.
 * Checks every hour for stale pending requests.
 * Also runs immediately on startup.
 */
function startScheduler() {
  console.log('[Scheduler] Starting reminder scheduler...');

  // Run immediately on startup
  checkPendingReminders();

  // Then check every hour (3600000ms)
  reminderInterval = setInterval(checkPendingReminders, 60 * 60 * 1000);

  console.log('[Scheduler] Reminder scheduler started (checks every hour)');
}

/**
 * Stop the reminder scheduler.
 */
function stopScheduler() {
  if (reminderInterval) {
    clearInterval(reminderInterval);
    reminderInterval = null;
    console.log('[Scheduler] Reminder scheduler stopped');
  }
}

module.exports = {
  checkPendingReminders,
  startScheduler,
  stopScheduler
};
