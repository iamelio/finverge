/* ------------------------------------------------------
   Finverge Lending Hub — Frontend orchestration layer
   - Token-aware fetch wrapper (JWT in Authorization header)
   - Responsive UI updates for borrowers & administrators
   - Modal experience for deep loan reviews
------------------------------------------------------- */

const API_BASE = window.API_BASE_URL || 'http://localhost:4000/api';
const TOKEN_STORAGE_KEY = 'loan_app_token_v1';
const LAST_TAB_KEY = 'loan_app_last_tab';

const state = {
  authToken: null,
  user: null,
  myApplications: [],
  adminApplications: [],
  adminOverview: null,
};

const $ = (id) => document.getElementById(id);
const qs = (selector) => document.querySelector(selector);
const qsa = (selector) => Array.from(document.querySelectorAll(selector));

const pageSections = qsa('[data-page]');
const navLinks = qsa('.nav-link');

function setActiveTab(tab) {
  pageSections.forEach((section) => {
    const isActive = section.dataset.page === tab;
    section.style.display = isActive ? 'block' : 'none';
  });

  navLinks.forEach((link) => {
    if (link.getAttribute('onclick').includes(`navigateTo('${tab}')`)) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });

  localStorage.setItem(LAST_TAB_KEY, tab);
  if (tab === 'status') {
    void loadMyApplications();
  }
  if (tab === 'admin') {
    void loadAdminData();
  }
  if (tab === 'apply') {
    // Refresh quick summary when entering Apply tab
    try { updateQuickPreview(); } catch (_e) {}
  }
}

function navigateTo(tab) {
  setActiveTab(tab);
}
window.navigateTo = navigateTo;

function showToast(message, type = 'success') {
  const toastEl = $('toast');
  const toastBody = toastEl.querySelector('.toast-body');
  toastBody.textContent = message;
  const toast = new bootstrap.Toast(toastEl);
  toast.show();
}

function setAuthToken(token) {
  state.authToken = token || null;
  if (token) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}

function hydrateAuthToken() {
  const stored = localStorage.getItem(TOKEN_STORAGE_KEY);
  state.authToken = stored || null;
}

function mapRole(role) {
  return role === 'admin' ? 'Administrator' : 'Borrower';
}

function renderUserStatus() {
  const userBadge = $('userBadge');
  const userActions = $('userActions');
  const userName = $('userName');
  const userRole = $('userRole');
  const navApply = $('nav-apply');
  const navAdmin = $('nav-admin');
  const navStatus = $('nav-status');

  if (!state.user) {
    userBadge.classList.add('d-none');
    userActions.classList.remove('d-none');
    navApply.style.display = 'block';
    navAdmin.style.display = 'none';
    navStatus.querySelector('.nav-link').textContent = 'My Loans';
    navStatus.querySelector('.nav-link').setAttribute('onclick', "navigateTo('status')");
  } else {
    userBadge.classList.remove('d-none');
    userActions.classList.add('d-none');
    userName.textContent = state.user.name || state.user.email;
    userRole.textContent = mapRole(state.user.role);

    if (state.user.role === 'admin') {
      navApply.style.display = 'none';
      navAdmin.style.display = 'block';
      navStatus.querySelector('.nav-link').textContent = 'My Loans';
      navStatus.querySelector('.nav-link').setAttribute('onclick', "navigateTo('status')");
    } else {
      navApply.style.display = 'block';
      navAdmin.style.display = 'none';
      navStatus.querySelector('.nav-link').textContent = 'My Loans';
      navStatus.querySelector('.nav-link').setAttribute('onclick', "navigateTo('status')");
    }
  }
}

async function apiFetch(path, { method = 'GET', body, headers = {} } = {}) {
  const opts = {
    method,
    credentials: 'include',
    headers: { ...headers },
  };
  if (body !== undefined && body !== null) {
    if (body instanceof FormData) {
      opts.body = body;
    } else {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
  }
  if (state.authToken) {
    opts.headers.Authorization = `Bearer ${state.authToken}`;
  }
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, opts);
  } catch (err) {
    throw new Error(`Network request failed (${err.message}). Check that the API server is running.`);
  }
  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch (_err) {
      data = null;
    }
  }
  if (!res.ok) {
    const error = new Error(data?.message || `Request failed (${res.status})`);
    error.status = res.status;
    error.details = data?.details;
    throw error;
  }
  return data || {};
}

async function fetchSession() {
  try {
    const { user } = await apiFetch('/auth/me');
    state.user = user;
  } catch (err) {
    if (err.status === 401) {
      state.user = null;
      if (state.authToken) {
        setAuthToken(null);
      }
    } else {
      console.error(err);
    }
  }
  renderUserStatus();
}

async function handleRegister() {
  const form = $('registerForm');
  const errorEl = $('regError');
  errorEl.style.display = 'none';

  const payload = {
    name: form.querySelector('#reg-name').value.trim(),
    email: form.querySelector('#reg-email').value.trim().toLowerCase(),
    phone: form.querySelector('#reg-phone').value.trim(),
    password: form.querySelector('#reg-password').value,
    accountType: document.querySelector('input[name="role"]:checked').value || 'user',
  };

  if (!payload.name || !payload.email || !payload.password) {
    errorEl.textContent = 'Please complete all required fields.';
    errorEl.style.display = 'block';
    return;
  }

  try {
    const { user, token } = await apiFetch('/auth/register', { method: 'POST', body: payload });
    if (token) {
      setAuthToken(token);
    }
    state.user = user;
    renderUserStatus();
    form.reset();
    showToast('Registration successful. You are signed in.', 'success');
    if (user.role === 'admin') {
      navigateTo('admin');
    } else {
      navigateTo('apply');
    }
  } catch (err) {
    errorEl.textContent = err.message || 'Registration failed';
    errorEl.style.display = 'block';
  }
}
window.handleRegister = handleRegister;

async function handleLogin() {
  const form = $('loginForm');
  const errorEl = $('loginError');
  errorEl.style.display = 'none';

  const payload = {
    email: form.querySelector('#login-email').value.trim().toLowerCase(),
    password: form.querySelector('#login-password').value,
  };

  try {
    const { user, token } = await apiFetch('/auth/login', { method: 'POST', body: payload });
    if (token) {
      setAuthToken(token);
    }
    state.user = user;
    renderUserStatus();
    form.reset();
    showToast('Logged in successfully.', 'success');
    if (user.role === 'admin') {
      navigateTo('admin');
    } else {
      navigateTo('apply');
    }
  } catch (err) {
    errorEl.textContent = err.message || 'Login failed';
    errorEl.style.display = 'block';
  }
}
window.handleLogin = handleLogin;

async function handleLogout() {
  try {
    await apiFetch('/auth/logout', { method: 'POST' });
  } catch (_err) {
    // Ignore logout failures
  }
  setAuthToken(null);
  state.user = null;
  renderUserStatus();
  showToast('Signed out.', 'success');
  navigateTo('home');
}
window.handleLogout = handleLogout;

function nextStep(step) {
  const currentStep = step - 1;
  const form = $('applyForm');
  const currentStepEl = $(`step${currentStep}`);
  const inputs = qsa(`#step${currentStep} input, #step${currentStep} select`);
  let isValid = true;
  for (const input of inputs) {
    if (!input.checkValidity()) {
      isValid = false;
      input.classList.add('is-invalid');
    } else {
      input.classList.remove('is-invalid');
    }
  }

  if (isValid) {
    currentStepEl.style.display = 'none';
    $(`step${step}`).style.display = 'block';
  }

  if (step === 4) {
    updateReviewSummary();
  }
}
window.nextStep = nextStep;

function prevStep(step) {
  const currentStep = step + 1;
  $(`step${currentStep}`).style.display = 'none';
  $(`step${step}`).style.display = 'block';
}
window.prevStep = prevStep;

function updateReviewSummary() {
  $('apply-name').value = state.user?.name || '';
  $('apply-email').value = state.user?.email || '';

  const name = $('apply-name').value;
  const email = $('apply-email').value;
  const income = $('loan-income').value;
  const employment = $('loan-employment').value;
  const amount = $('loan-amount').value;
  const tenure = $('loan-tenure').value;
  const purpose = $('loan-purpose').value;

  const summary = `
    <dl class="row">
      <dt class="col-sm-3">Name</dt><dd class="col-sm-9">${name}</dd>
      <dt class="col-sm-3">Email</dt><dd class="col-sm-9">${email}</dd>
      <dt class="col-sm-3">Income</dt><dd class="col-sm-9">₦${income}</dd>
      <dt class="col-sm-3">Employment</dt><dd class="col-sm-9">${employment}</dd>
      <dt class="col-sm-3">Amount</dt><dd class="col-sm-9">₦${amount}</dd>
      <dt class="col-sm-3">Tenure</dt><dd class="col-sm-9">${tenure} months</dd>
      <dt class="col-sm-3">Purpose</dt><dd class="col-sm-9">${purpose}</dd>
    </dl>
  `;
  $('review-summary').innerHTML = summary;
}

async function handleApply() {
  if (!state.user) {
    const loginModal = new bootstrap.Modal($('loginModal'));
    loginModal.show();
    return;
  }

  const payload = {
    amount: Number($('loan-amount')?.value),
    tenure: Number($('loan-tenure')?.value),
    income: Number($('loan-income')?.value),
    employment: $('loan-employment')?.value,
    purpose: $('loan-purpose')?.value,
  };

  try {
    const { application } = await apiFetch('/loans', { method: 'POST', body: payload });
    $('applyForm')?.reset();
    showToast('Application submitted successfully.', 'success');
    navigateTo('status');
  } catch (err) {
    const errorEl = $('applyError');
    errorEl.textContent = err.message || 'Unable to submit application';
    errorEl.style.display = 'block';
  }
}
window.handleApply = handleApply;

async function handleModalLogin() {
  const form = $('modalLoginForm');
  const errorEl = $('modalLoginError');
  errorEl.style.display = 'none';

  const payload = {
    email: form.querySelector('#modal-login-email').value.trim().toLowerCase(),
    password: form.querySelector('#modal-login-password').value,
  };

  try {
    const { user, token } = await apiFetch('/auth/login', { method: 'POST', body: payload });
    if (token) {
      setAuthToken(token);
    }
    state.user = user;
    renderUserStatus();
    form.reset();
    const loginModal = bootstrap.Modal.getInstance($('loginModal'));
    loginModal.hide();
    showToast('Logged in successfully.', 'success');
    await handleApply();
  } catch (err) {
    errorEl.textContent = err.message || 'Login failed';
    errorEl.style.display = 'block';
  }
}
window.handleModalLogin = handleModalLogin;

function formatN(n) {
  const num = Number(n || 0);
  return `₦${num.toLocaleString()}`;
}

function calcInterestRate(tenureMonths, purpose) {
  if (purpose === 'business') return 0.155;
  if (tenureMonths <= 12) return 0.125;
  if (tenureMonths <= 24) return 0.145;
  return 0.165;
}

function monthlyPayment(principal, annualRate, months) {
  if (months <= 0) return 0;
  const r = annualRate / 12;
  if (r === 0) return principal / months;
  const numerator = principal * r * Math.pow(1 + r, months);
  const denominator = Math.pow(1 + r, months) - 1;
  return numerator / denominator;
}

function updateQuickPreview() {
  const amount = Number($('loan-amount')?.value) || 0;
  const tenure = Number($('loan-tenure')?.value) || 0;
  const income = Number($('loan-income')?.value) || 0;
  const purpose = $('loan-purpose')?.value;

  $('quickLoanAmount').innerText = amount ? formatN(amount) : '₦0';
  if (amount && tenure) {
    const annualRate = calcInterestRate(tenure, purpose);
    const emi = Math.ceil(monthlyPayment(amount, annualRate, tenure));
    $('quickRepay').innerText = `${tenure} months • EMI ${formatN(emi)} • Rate ${(annualRate * 100).toFixed(2)}% p.a.`;
    let hint = 'Likely eligible. Final decision after review.';
    if (!income) hint = 'Provide income for eligibility preview';
    else if (emi > 0.4 * income) hint = 'EMI > 40% of income — flagged for review';
    $('quickElig').innerText = hint;
  } else {
    $('quickRepay').innerText = 'Enter loan amount & tenure';
    $('quickElig').innerText = 'Not checked yet';
  }
}

async function loadMyApplications() {
  const area = $('myAppsArea');
  if (!area) return;
  if (!state.user) {
    area.innerHTML = '<div class="alert alert-warning">Login to view your loan applications.</div>';
    return;
  }
  try {
    const { applications } = await apiFetch('/loans');
    state.myApplications = applications || [];
    renderMyApps();
  } catch (err) {
    if (err.status === 401) {
      setAuthToken(null);
      state.user = null;
      renderUserStatus();
    }
    area.innerHTML = `<div class="alert alert-danger">${escapeHtml(err.message)}</div>`;
  }
}

function renderMyApps() {
  const area = $('myAppsArea');
  if (!area) return;
  if (!state.user) {
    area.innerHTML = '<div class="alert alert-warning">Login to view your loan applications.</div>';
    return;
  }
  if (!state.myApplications.length) {
    area.innerHTML = '<div class="alert alert-info">No applications yet. Kickstart one from the Apply tab.</div>';
    return;
  }
  const cards = state.myApplications
    .slice()
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .map(
      (app) => {
        let rejectionReason = '';
        if (app.status === 'Rejected' && app.adminNotes) {
          rejectionReason = `<p class="mb-1 text-danger">Reason: ${escapeHtml(app.adminNotes)}</p>`;
        }
        return `
          <div class="list-group-item" aria-current="true">
            <div class="d-flex w-100 justify-content-between">
              <h5 class="mb-1">₦${Number(app.amount).toLocaleString()} • ${app.tenure} mo</h5>
              <small>${new Date(app.createdAt).toLocaleDateString()}</small>
            </div>
            <p class="mb-1">EMI: ${formatN(app.monthlyEMI)} • Purpose: ${escapeHtml(app.purpose)}</p>
            <small>${statusBadge(app.status)}</small>
            ${rejectionReason}
          </div>`;
      }
    )
    .join('');
  area.innerHTML = `<div class="list-group">${cards}</div>`;
}

function statusBadge(status) {
  const badgeMap = {
    Pending: 'warning',
    Approved: 'success',
    Rejected: 'danger',
    'Under Review': 'info',
  };
  const badgeClass = badgeMap[status] || 'secondary';
  return `<span class="badge bg-${badgeClass}">${status}</span>`;
}

let currentAppId = null;

async function viewApp(id) {
  currentAppId = id;
  try {
    const data = await apiFetch(`/loans/${id}`);
    const application = data.application;
    const events = data.events || [];
    const content = `
      <dl class="row">
        <dt class="col-sm-4">Applicant</dt><dd class="col-sm-8">${application.userName}</dd>
        <dt class="col-sm-4">Email</dt><dd class="col-sm-8">${application.userEmail}</dd>
        <dt class="col-sm-4">Phone</dt><dd class="col-sm-8">${application.userPhone || 'N/A'}</dd>
        <dt class="col-sm-4">Employment</dt><dd class="col-sm-8">${application.employment}</dd>
        <hr class="my-2" />
        <dt class="col-sm-4">Amount</dt><dd class="col-sm-8">₦${application.amount}</dd>
        <dt class="col-sm-4">Tenure</dt><dd class="col-sm-8">${application.tenure} months</dd>
        <dt class="col-sm-4">EMI</dt><dd class="col-sm-8">₦${application.monthlyEMI}</dd>
        <dt class="col-sm-4">Status</dt><dd class="col-sm-8">${statusBadge(application.status)}</dd>
      </dl>
      <hr />
      <h5>Actions</h5>
      <div class="btn-group" role="group">
        <button class="btn btn-success" onclick="updateAppStatus('${id}', 'Approved')">Approve</button>
        <button class="btn btn-danger" onclick="openRejectionModal('${id}')">Reject</button>
      </div>
      <hr />
      <h5>Admin Notes</h5>
      <textarea class="form-control" id="admin-notes" rows="3">${application.adminNotes || ''}</textarea>
      <button class="btn btn-primary mt-2" onclick="submitModalNote('${id}')">Save Note</button>
      `;
    $('appModalBody').innerHTML = content;
    const appModal = new bootstrap.Modal($('appModal'));
    appModal.show();
  } catch (err) {
    showToast(err.message || 'Unable to load application', 'error');
  }
}
window.viewApp = viewApp;

function openRejectionModal(id) {
  currentAppId = id;
  const rejectionModal = new bootstrap.Modal($('rejectionModal'));
  rejectionModal.show();
}

async function handleRejectionSubmit() {
  const reason = $('rejection-reason').value.trim();
  if (!reason) {
    showToast('Please provide a rejection reason.', 'error');
    return;
  }
  await updateAppStatus(currentAppId, 'Rejected', reason);
  const rejectionModal = bootstrap.Modal.getInstance($('rejectionModal'));
  rejectionModal.hide();
}
window.handleRejectionSubmit = handleRejectionSubmit;

async function updateAppStatus(id, status, rejectionReason = null) {
  try {
    const payload = { status };
    if (rejectionReason) {
      // Backend expects 'adminNotes' alongside status; use it as the rejection reason
      payload.adminNotes = rejectionReason;
    }
    await apiFetch(`/loans/${id}/status`, { method: 'PATCH', body: payload });
    await loadAdminData();
    const appModal = bootstrap.Modal.getInstance($('appModal'));
    if (appModal) {
      appModal.hide();
    }
    showToast(`Status updated to ${status}.`, 'success');
  } catch (err) {
    showToast(err.message || 'Unable to update status', 'error');
  }
}
window.updateAppStatus = updateAppStatus;

async function submitModalNote(id) {
  const note = $('admin-notes').value.trim();
  try {
    await apiFetch(`/loans/${id}/notes`, { method: 'PATCH', body: { adminNotes: note } });
    await loadAdminData();
    const appModal = bootstrap.Modal.getInstance($('appModal'));
    appModal.hide();
    showToast('Note added.', 'success');
  } catch (err) {
    showToast(err.message || 'Unable to add note', 'error');
  }
}
window.submitModalNote = submitModalNote;

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// -----------------------------
// Admin Desk
// -----------------------------
async function loadAdminData() {
  const adminArea = $('adminArea');
  const tableArea = $('adminTableArea');
  if (!adminArea || !tableArea) return;
  try {
    // Overview metrics
    const overview = await apiFetch('/admin/overview');
    state.adminOverview = overview;
    renderAdminMetrics();
  } catch (e) {
    // Non-fatal; continue to load applications list
    console.warn('Overview load failed:', e.message);
  }
  try {
    const { applications } = await apiFetch('/loans');
    state.adminApplications = applications || [];
    renderAdminTable();
    adminArea.style.display = 'block';
  } catch (err) {
    tableArea.innerHTML = `<div class="alert alert-danger">${escapeHtml(err.message || 'Failed to load applications')}</div>`;
  }
}
window.loadAdminData = loadAdminData;

function renderAdminMetrics() {
  const metricsEl = $('adminMetrics');
  if (!metricsEl || !state.adminOverview?.totals) return;
  const t = state.adminOverview.totals;
  metricsEl.innerHTML = `
    <div class="d-flex gap-3">
      <span class="badge text-bg-secondary">Users: ${t.total_users}</span>
      <span class="badge text-bg-primary">Applications: ${t.total_applications}</span>
      <span class="badge text-bg-warning">Pending: ${t.pending}</span>
      <span class="badge text-bg-success">Approved: ${t.approved}</span>
      <span class="badge text-bg-danger">Rejected: ${t.rejected}</span>
    </div>`;
}

function renderAdminTable() {
  const tableArea = $('adminTableArea');
  if (!tableArea) return;
  if (!state.adminApplications.length) {
    tableArea.innerHTML = '<div class="alert alert-info">No applications yet.</div>';
    return;
  }
  const rows = state.adminApplications
    .slice()
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .map((app) => {
      const reasons = (app.previewReasons || []).map((r) => `<li>${escapeHtml(r)}</li>`).join('');
      return `
        <tr>
          <td>${app.id}</td>
          <td>
            <div class="fw-semibold">${escapeHtml(app.userName || '')}</div>
            <div class="small text-muted">${escapeHtml(app.userEmail || '')}</div>
          </td>
          <td>${formatN(app.amount)}</td>
          <td>${formatN(app.income)}</td>
          <td>${formatN(app.monthlyEMI)}</td>
          <td>${app.tenure} mo</td>
          <td>${escapeHtml(app.purpose)}</td>
          <td>${escapeHtml(app.employment)}</td>
          <td>${new Date(app.createdAt).toLocaleDateString()}</td>
          <td>${statusBadge(app.status)}</td>
          <td>${reasons ? `<ul class="mb-0 small">${reasons}</ul>` : ''}</td>
          <td class="text-nowrap">
            <button class="btn btn-sm btn-outline-primary me-1" onclick="viewApp('${app.id}')">View</button>
            <button class="btn btn-sm btn-success me-1" onclick="updateAppStatus('${app.id}', 'Approved')">Approve</button>
            <button class="btn btn-sm btn-danger" onclick="openRejectionModal('${app.id}')">Reject</button>
          </td>
        </tr>`;
    })
    .join('');

  tableArea.innerHTML = `
    <div class="table-responsive">
      <table class="table table-sm align-middle">
        <thead>
          <tr>
            <th>ID</th>
            <th>Applicant</th>
            <th>Amount</th>
            <th>Income</th>
            <th>EMI</th>
            <th>Tenure</th>
            <th>Purpose</th>
            <th>Employment</th>
            <th>Submitted</th>
            <th>Status</th>
            <th>Eligibility Notes</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

function exportAllCSV() {
  const items = state.adminApplications || [];
  if (!items.length) return showToast('No applications to export', 'info');
  const headers = [
    'ID','Applicant Name','Applicant Email','Amount','Income','EMI','Tenure','Purpose','Employment','Status','Created At','Admin Notes'
  ];
  const lines = [headers.join(',')];
  for (const a of items) {
    const row = [
      a.id,
      JSON.stringify(a.userName || ''),
      JSON.stringify(a.userEmail || ''),
      a.amount,
      a.income,
      a.monthlyEMI,
      a.tenure,
      JSON.stringify(a.purpose || ''),
      JSON.stringify(a.employment || ''),
      a.status,
      new Date(a.createdAt).toISOString(),
      JSON.stringify(a.adminNotes || '')
    ];
    lines.push(row.join(','));
  }
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `applications_${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
window.exportAllCSV = exportAllCSV;

(async function init() {
  hydrateAuthToken();
  renderUserStatus();

  const lastTab = localStorage.getItem(LAST_TAB_KEY) || 'home';
  setActiveTab(lastTab);

  await fetchSession();
  if (state.user) {
    if (state.user.role === 'admin') {
      await loadAdminData();
    } else {
      await loadMyApplications();
    }
  }

  const amountInput = $('loan-amount');
  const tenureInput = $('loan-tenure');
  const incomeInput = $('loan-income');
  const purposeInput = $('loan-purpose');
  if (amountInput) {
    amountInput.addEventListener('input', updateQuickPreview);
  }
  if (tenureInput) {
    tenureInput.addEventListener('change', updateQuickPreview);
  }
  if (incomeInput) {
    incomeInput.addEventListener('input', updateQuickPreview);
  }
  if (purposeInput) {
    purposeInput.addEventListener('change', updateQuickPreview);
  }
  try { updateQuickPreview(); } catch (_e) {}
})();
