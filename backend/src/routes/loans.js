const express = require('express');
const { getDb } = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { parseOrThrow, loanApplicationSchema, statusUpdateSchema, adminNoteSchema } = require('../utils/validators');
const { calcInterestRate, monthlyPayment } = require('../utils/finance');
const { mapLoan } = require('../utils/transformers');

const router = express.Router();

function buildEligibility({ amount, income, tenure, employment, purpose }) {
  let eligible = true;
  const reasons = [];
  if (employment === 'unemployed') {
    eligible = false;
    reasons.push('Employment status not eligible');
  }
  if (income <= 0) {
    eligible = false;
    reasons.push('Income must be greater than zero');
  }
  const annualRate = calcInterestRate(tenure, purpose);
  const emi = Math.ceil(monthlyPayment(amount, annualRate, tenure));
  if (emi > income * 0.4) {
    eligible = false;
    reasons.push('Monthly repayment exceeds 40% of income');
  }
  const maxMultiple = purpose === 'business' ? 24 : 12;
  if (amount > income * maxMultiple) {
    eligible = false;
    reasons.push(`Requested amount exceeds ${maxMultiple}x monthly income`);
  }
  return { eligible, reasons, emi, annualRate };
}

router.post('/', requireAuth, (req, res, next) => {
  try {
    const payload = {
      amount: Number(req.body.amount),
      tenure: Number(req.body.tenure),
      income: Number(req.body.income),
      employment: req.body.employment,
      purpose: req.body.purpose,
      collateral: req.body.collateral,
      notes: req.body.notes,
    };
    const data = parseOrThrow(loanApplicationSchema, payload);
    const { eligible, reasons, emi, annualRate } = buildEligibility(data);
    const db = getDb();
    const insert = db.prepare(`INSERT INTO loan_applications (
        user_id, amount, tenure, income, employment, purpose, collateral, notes,
        annual_rate, monthly_emi, eligible_preview, preview_reasons, status, admin_notes
      ) VALUES (@user_id, @amount, @tenure, @income, @employment, @purpose, @collateral, @notes,
                @annual_rate, @monthly_emi, @eligible_preview, @preview_reasons, 'Pending', NULL)`);
    const result = insert.run({
      user_id: req.user.id,
      amount: data.amount,
      tenure: data.tenure,
      income: data.income,
      employment: data.employment,
      purpose: data.purpose,
      collateral: data.collateral || null,
      notes: data.notes || null,
      annual_rate: annualRate,
      monthly_emi: emi,
      eligible_preview: eligible ? 1 : 0,
      preview_reasons: JSON.stringify(reasons),
    });
    db.prepare(`INSERT INTO loan_events (application_id, actor_id, actor_role, event_type, detail)
                VALUES (?, ?, ?, ?, ?)`)
      .run(result.lastInsertRowid, req.user.id, req.user.role, 'application_created', 'Loan application submitted');
    const record = db
      .prepare('SELECT * FROM loan_applications WHERE id = ?')
      .get(result.lastInsertRowid);
    return res.status(201).json({ application: mapLoan(record) });
  } catch (err) {
    return next(err);
  }
});

router.get('/', requireAuth, (req, res, next) => {
  try {
    const db = getDb();
    if (req.user.role === 'admin') {
      const filters = [];
      const params = [];
      if (req.query.status) {
        filters.push('la.status = ?');
        params.push(req.query.status);
      }
      if (req.query.search) {
        filters.push('(u.email LIKE ? OR u.name LIKE ? OR la.id LIKE ?)');
        const like = `%${req.query.search}%`;
        params.push(like, like, like);
      }
      const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
      const rows = db
        .prepare(`SELECT la.*, u.name AS user_name, u.email AS user_email
                  FROM loan_applications la
                  JOIN users u ON la.user_id = u.id
                  ${where}
                  ORDER BY la.created_at DESC`)
        .all(...params);
      const applications = rows.map(mapLoan);
      return res.json({ applications });
    }
    const rows = db
      .prepare('SELECT * FROM loan_applications WHERE user_id = ? ORDER BY created_at DESC')
      .all(req.user.id);
    const applications = rows.map(mapLoan);
    return res.json({ applications });
  } catch (err) {
    return next(err);
  }
});

router.get('/:id', requireAuth, (req, res, next) => {
  try {
    const db = getDb();
    const row = db
      .prepare(`SELECT la.*, u.name AS user_name, u.email AS user_email, u.phone AS user_phone
                FROM loan_applications la
                JOIN users u ON la.user_id = u.id
                WHERE la.id = ?`)
      .get(req.params.id);
    if (!row) {
      const err = new Error('Application not found');
      err.status = 404;
      throw err;
    }
    if (req.user.role !== 'admin' && row.user_id !== req.user.id) {
      const err = new Error('Unauthorized to access this application');
      err.status = 403;
      throw err;
    }
    const events = getDb()
      .prepare(`SELECT id, actor_id, actor_role, event_type, detail, created_at
                 FROM loan_events WHERE application_id = ? ORDER BY created_at DESC`)
      .all(row.id);
    return res.json({ application: mapLoan(row), events });
  } catch (err) {
    return next(err);
  }
});

router.patch('/:id/status', requireAuth, requireAdmin, (req, res, next) => {
  try {
    const data = parseOrThrow(statusUpdateSchema, req.body);
    const db = getDb();
    const row = db.prepare('SELECT * FROM loan_applications WHERE id = ?').get(req.params.id);
    if (!row) {
      const err = new Error('Application not found');
      err.status = 404;
      throw err;
    }
    db.prepare(`UPDATE loan_applications
                SET status = @status,
                    admin_notes = COALESCE(@adminNotes, admin_notes),
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = @id`).run({
      status: data.status,
      adminNotes: data.adminNotes || row.admin_notes,
      id: row.id,
    });
    db.prepare(`INSERT INTO loan_events (application_id, actor_id, actor_role, event_type, detail)
                VALUES (?, ?, ?, ?, ?)`)
      .run(row.id, req.user.id, req.user.role, 'status_update', `Status changed to ${data.status}`);
    const updated = db.prepare('SELECT * FROM loan_applications WHERE id = ?').get(row.id);
    return res.json({ application: mapLoan(updated) });
  } catch (err) {
    return next(err);
  }
});

router.patch('/:id/notes', requireAuth, requireAdmin, (req, res, next) => {
  try {
    const data = parseOrThrow(adminNoteSchema, req.body);
    const db = getDb();
    const row = db.prepare('SELECT * FROM loan_applications WHERE id = ?').get(req.params.id);
    if (!row) {
      const err = new Error('Application not found');
      err.status = 404;
      throw err;
    }
    const combinedNotes = row.admin_notes
      ? `${row.admin_notes}\n${new Date().toISOString()} — ${data.adminNotes}`
      : `${new Date().toISOString()} — ${data.adminNotes}`;
    db.prepare(`UPDATE loan_applications
                SET admin_notes = @adminNotes,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = @id`).run({
      adminNotes: combinedNotes,
      id: row.id,
    });
    db.prepare(`INSERT INTO loan_events (application_id, actor_id, actor_role, event_type, detail)
                VALUES (?, ?, ?, ?, ?)`)
      .run(row.id, req.user.id, req.user.role, 'admin_note', data.adminNotes);
    const updated = db.prepare('SELECT * FROM loan_applications WHERE id = ?').get(row.id);
    return res.json({ application: mapLoan(updated) });
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
