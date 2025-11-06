function parsePreviewReasons(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_err) {
    return [];
  }
}

function mapLoan(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    userName: row.user_name || row.userName,
    userEmail: row.user_email || row.userEmail,
    amount: row.amount,
    tenure: row.tenure,
    income: row.income,
    employment: row.employment,
    purpose: row.purpose,
    collateral: row.collateral,
    notes: row.notes,
    annualRate: row.annual_rate,
    monthlyEMI: row.monthly_emi,
    eligiblePreview: !!row.eligible_preview,
    previewReasons: parsePreviewReasons(row.preview_reasons),
    status: row.status,
    adminNotes: row.admin_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

module.exports = {
  mapLoan,
};
