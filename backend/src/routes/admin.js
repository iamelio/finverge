const express = require('express');
const { getDb } = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { mapLoan } = require('../utils/transformers');

const router = express.Router();

router.use(requireAuth, requireAdmin);

router.get('/overview', (_req, res, next) => {
  try {
    const db = getDb();
    const totals = db.prepare(`SELECT
        (SELECT COUNT(*) FROM users) AS total_users,
        (SELECT COUNT(*) FROM loan_applications) AS total_applications,
        (SELECT COUNT(*) FROM loan_applications WHERE status = 'Pending') AS pending,
        (SELECT COUNT(*) FROM loan_applications WHERE status = 'Approved') AS approved,
        (SELECT COUNT(*) FROM loan_applications WHERE status = 'Rejected') AS rejected
      `).get();
    const recentApps = db
      .prepare(`SELECT la.*, u.name AS user_name, u.email AS user_email
                FROM loan_applications la
                JOIN users u ON la.user_id = u.id
                ORDER BY la.created_at DESC
                LIMIT 5`)
      .all();
    const recentEvents = db
      .prepare(`SELECT le.id, le.application_id, le.actor_id, le.actor_role, le.event_type, le.detail, le.created_at,
                       u.name AS actor_name
                FROM loan_events le
                LEFT JOIN users u ON le.actor_id = u.id
                ORDER BY le.created_at DESC
                LIMIT 10`)
      .all();
    return res.json({
      totals,
      recentApplications: recentApps.map(mapLoan),
      recentEvents,
    });
  } catch (err) {
    return next(err);
  }
});

router.patch('/applications/batch-update', (req, res, next) => {
  try {
    const { applicationIds, status } = req.body;
    if (!Array.isArray(applicationIds) || !status) {
      const err = new Error('Invalid payload: applicationIds must be an array and status is required.');
      err.status = 400;
      throw err;
    }
    const db = getDb();
    const stmt = db.prepare(`
      UPDATE loan_applications
      SET status = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id IN (${applicationIds.map(() => '?').join(',')})
    `);
    const result = stmt.run(status, ...applicationIds);

    const eventStmt = db.prepare(`
      INSERT INTO loan_events (application_id, actor_id, actor_role, event_type, detail)
      VALUES (?, ?, ?, ?, ?)
    `);
    for (const appId of applicationIds) {
      eventStmt.run(appId, req.user.id, req.user.role, 'status_update', `Status changed to ${status} via batch update`);
    }

    return res.json({ message: `${result.changes} applications updated to ${status}.` });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
