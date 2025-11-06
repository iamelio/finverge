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

module.exports = router;
