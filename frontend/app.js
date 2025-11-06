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

function setActiveTab(tab) {
  pageSections.forEach((section) => {
    const isActive = section.dataset.page === tab;
    section.style.display = isActive ? 'block' : 'none';
  });
  localStorage.setItem(LAST_TAB_KEY, tab);
  if (tab === 'status') {
    void loadMyApplications();
  }
  if (tab === 'admin') {
    void loadAdminData();
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

  if (!state.user) {
    userBadge.classList.add('d-none');
    userActions.classList.remove('d-none');
  } else {
    userBadge.classList.remove('d-none');
    userActions.classList.add('d-none');
    userName.textContent = state.user.name || state.user.email;
    userRole.textContent = mapRole(state.user.role);
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
    accountType: form.querySelector('input[name="role"]:checked').value || 'user',
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
    showToast('Please login before submitting an application.', 'error');
    navigateTo('login');
    return;
  }

  const payload = {
    amount: Number($('loan-amount')?.value),
    tenure: Number($('loan-tenure')?.value),
    income: Number($('loan-income')?.value),
    employment: $('loan-employment')?.value,
    purpose: $('loan-purpose')?.value,
    // These are not in the new form, so we'll use dummy data or remove them from the backend
    collateral: '',
    notes: '',
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
      (app) => `
      <a href="#" class="list-group-item list-group-item-action" aria-current="true">
        <div class="d-flex w-100 justify-content-between">
          <h5 class="mb-1">Loan for ₦${app.amount}</h5>
          <small>${new Date(app.createdAt).toLocaleDateString()}</small>
        </div>
        <p class="mb-1">Tenure: ${app.tenure} months</p>
        <small>${statusBadge(app.status)}</small>
      </a>`
    )
    .join('');
  area.innerHTML = `<div class="list-group">${cards}</div>`;
}

function statusBadge(status) {
  const badgeMap = {
    Pending: 'warning',
    Approved: 'success',
    Rejected: 'danger',
  };
  const badgeClass = badgeMap[status] || 'secondary';
  return `<span class="badge bg-${badgeClass}">${status}</span>`;
}

async function loadAdminData() {
  const adminArea = $('adminArea');
  if (!adminArea) return;
  if (!state.user || state.user.role !== 'admin') {
    adminArea.innerHTML = '<div class="alert alert-danger">You are not authorized to view this page.</div>';
    return;
  }

  try {
    const [loanResponse, overviewResponse] = await Promise.all([
      apiFetch('/loans'),
      apiFetch('/admin/overview'),
    ]);
    state.adminApplications = loanResponse.applications || [];
    state.adminOverview = overviewResponse || null;
    renderAdminTable();
  } catch (err) {
    adminArea.innerHTML = `<div class="alert alert-danger">${escapeHtml(err.message)}</div>`;
  }
}

function renderAdminTable() {
  const tableArea = $('adminTableArea');
  const metricsArea = $('adminMetrics');
  if (!tableArea || !metricsArea) return;

  const overview = state.adminOverview;
  if (overview?.totals) {
    const { total_users: totalUsers, total_applications: totalApps, pending, approved, rejected } = overview.totals;
    const metricData = [
      { label: 'Users', value: totalUsers },
      { label: 'Applications', value: totalApps },
      { label: 'Pending', value: pending },
      { label: 'Approved', value: approved },
      { label: 'Rejected', value: rejected },
    ];
    metricsArea.innerHTML = metricData
      .map(
        (m) => `
        <div class="card me-2">
          <div class="card-body">
            <h6 class="card-title">${m.label}</h6>
            <p class="card-text fs-4">${m.value}</p>
          </div>
        </div>`
      )
      .join('');
  }

  if (!state.adminApplications.length) {
    tableArea.innerHTML = '<div class="alert alert-info">No applications to display.</div>';
    return;
  }

  const tableRows = state.adminApplications
    .slice()
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .map(
      (app) => `
      <tr>
        <td>${app.userName || 'N/A'}</td>
        <td>₦${app.amount}</td>
        <td>${app.tenure} months</td>
        <td>${statusBadge(app.status)}</td>
        <td>
          <button class="btn btn-sm btn-primary" onclick="viewApp('${app.id}')">Details</button>
        </td>
      </tr>`
    )
    .join('');

  tableArea.innerHTML = `
    <table class="table table-striped">
      <thead>
        <tr>
          <th>Applicant</th>
          <th>Amount</th>
          <th>Tenure</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows}
      </tbody>
    </table>`;
}

async function viewApp(id) {
  try {
    const data = await apiFetch(`/loans/${id}`);
    const application = data.application;
    const events = data.events || [];
    const content = `
      <dl class="row">
        <dt class="col-sm-3">Applicant</dt><dd class="col-sm-9">${application.userName}</dd>
        <dt class="col-sm-3">Email</dt><dd class="col-sm-9">${application.userEmail}</dd>
        <dt class="col-sm-3">Amount</dt><dd class="col-sm-9">₦${application.amount}</dd>
        <dt class="col-sm-3">Tenure</dt><dd class="col-sm-9">${application.tenure} months</dd>
        <dt class="col-sm-3">EMI</dt><dd class="col-sm-9">₦${application.monthlyEMI}</dd>
        <dt class="col-sm-3">Status</dt><dd class="col-sm-9">${statusBadge(application.status)}</dd>
      </dl>
      <hr />
      <h5>Actions</h5>
      <div class="btn-group" role="group">
        <button class="btn btn-success" onclick="updateAppStatus('${id}', 'Approved')">Approve</button>
        <button class="btn btn-danger" onclick="updateAppStatus('${id}', 'Rejected')">Reject</button>
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

async function updateAppStatus(id, status) {
  try {
    await apiFetch(`/loans/${id}/status`, { method: 'PATCH', body: { status } });
    await loadAdminData();
    const appModal = bootstrap.Modal.getInstance($('appModal'));
    appModal.hide();
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
})();