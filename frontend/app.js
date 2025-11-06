/* ------------------------------------------------------
   Finverge demo frontend wired to Node/Express backend
   - Makes authenticated fetch calls (cookies) to /api
   - Keeps UI state in-memory instead of localStorage
   - Still offers quick eligibility preview client-side
   ------------------------------------------------------ */

const API_BASE = window.API_BASE_URL || 'http://localhost:4000/api';

const state = {
  user: null,
  myApplications: [],
  adminApplications: [],
  adminOverview: null,
  adminEvents: [],
};

const $ = (id) => document.getElementById(id);
const qs = (selector) => document.querySelector(selector);
const qsa = (selector) => Array.from(document.querySelectorAll(selector));

const navButtons = qsa('nav .tab');
const pageSections = qsa('main section');

function setActiveTab(tab) {
  pageSections.forEach((section) => {
    section.style.display = section.dataset.page === tab ? 'block' : 'none';
  });
  navButtons.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  localStorage.setItem('loan_app_last_tab', tab);
  if (tab === 'status') void loadMyApplications();
  if (tab === 'admin') void loadAdminData();
}

function navigateTo(tab) {
  setActiveTab(tab);
}
window.navigateTo = navigateTo;

navButtons.forEach((btn) => {
  btn.addEventListener('click', () => setActiveTab(btn.dataset.tab));
});

function showError(id, message) {
  const el = $(id);
  if (!el) return;
  el.innerText = message;
  el.style.display = 'block';
}

function clearError(id) {
  const el = $(id);
  if (!el) return;
  el.innerText = '';
  el.style.display = 'none';
}

async function apiFetch(path, { method = 'GET', body, headers = {} } = {}) {
  const opts = {
    method,
    credentials: 'include',
    headers: { ...headers },
  };
  if (body !== undefined && body !== null) {
    if (!(body instanceof FormData)) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    } else {
      opts.body = body;
    }
  }
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, opts);
  } catch (err) {
    const message = err && err.message ? err.message : 'Network error';
    throw new Error(`Network request failed (${message}). Check that the API server is running and reachable.`);
  }
  const text = await res.text();
  let data = null;
  if (text) {
    try { data = JSON.parse(text); } catch (_err) { data = null; }
  }
  if (!res.ok) {
    const message = data && data.message ? data.message : `Request failed (${res.status})`;
    const error = new Error(message);
    error.status = res.status;
    error.details = data && data.details ? data.details : undefined;
    throw error;
  }
  return data || {};
}

async function fetchSession() {
  try {
    const { user } = await apiFetch('/auth/me');
    state.user = user;
  } catch (_err) {
    state.user = null;
  }
}

async function loadMyApplications() {
  const area = $('myAppsArea');
  if (!state.user) {
    area.innerHTML = '<div class="muted-small">Please login to view your applications.</div>';
    return;
  }
  try {
    const { applications } = await apiFetch('/loans');
    state.myApplications = applications || [];
    renderMyApps();
  } catch (err) {
    area.innerHTML = `<div class="error">${err.message}</div>`;
  }
}

async function loadAdminData() {
  const isAdmin = state.user && state.user.role === 'admin';
  renderAdminLoginArea();
  if (!isAdmin) return;
  try {
    const [loanResponse, overviewResponse] = await Promise.all([
      apiFetch('/loans'),
      apiFetch('/admin/overview'),
    ]);
    state.adminApplications = loanResponse.applications || [];
    state.adminOverview = overviewResponse || null;
    renderAdminLoginArea();
  } catch (err) {
    const area = $('adminTableArea');
    area.innerHTML = `<div class="error">${err.message}</div>`;
  }
}

function renderMyApps() {
  const area = $('myAppsArea');
  area.innerHTML = '';
  if (!state.user) {
    area.innerHTML = '<div class="muted-small">Please login to view your applications.</div>';
    return;
  }
  if (!state.myApplications.length) {
    area.innerHTML = '<div class="muted-small">No applications yet. Click Apply to submit a loan request.</div>';
    return;
  }
  let html = '<table><thead><tr><th>Requested</th><th>Tenure</th><th>EMI</th><th>Status</th><th>Applied</th><th></th></tr></thead><tbody>';
  state.myApplications
    .slice()
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .forEach((app) => {
      html += `<tr>
        <td>${formatN(app.amount)}</td>
        <td>${app.tenure} months</td>
        <td>${formatN(app.monthlyEMI)}</td>
        <td>${statusPill(app.status)}</td>
        <td>${new Date(app.createdAt).toLocaleString()}</td>
        <td><button class="btn ghost" onclick="downloadAppCSV('${app.id}')">Receipt</button></td>
      </tr>`;
    });
  html += '</tbody></table>';
  area.innerHTML = html;
}

function renderAdminLoginArea() {
  const loginArea = $('adminLoginArea');
  const adminArea = $('adminArea');
  if (state.user && state.user.role === 'admin') {
    loginArea.style.display = 'none';
    adminArea.style.display = 'block';
    renderAdminTable();
  } else {
    loginArea.style.display = 'block';
    adminArea.style.display = 'none';
    $('adminTableArea').innerHTML = '<div class="muted-small">Login as admin to manage applications.</div>';
  }
}

function renderAdminTable() {
  const area = $('adminTableArea');
  if (!state.user || state.user.role !== 'admin') {
    area.innerHTML = '<div class="muted-small">Administrator access required.</div>';
    return;
  }
  const overview = state.adminOverview;
  const apps = state.adminApplications.slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  let html = '';
  if (overview && overview.totals) {
    const { total_users: totalUsers, total_applications: totalApps, pending, approved, rejected } = overview.totals;
    html += `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:12px">
      <div class="tile"><div class="small">Total users</div><div class="big">${totalUsers}</div></div>
      <div class="tile"><div class="small">Applications</div><div class="big">${totalApps}</div></div>
      <div class="tile"><div class="small">Pending</div><div class="big">${pending}</div></div>
      <div class="tile"><div class="small">Approved</div><div class="big">${approved}</div></div>
      <div class="tile"><div class="small">Rejected</div><div class="big">${rejected}</div></div>
    </div>`;
  }

  if (!apps.length) {
    html += '<div class="muted-small">No applications yet.</div>';
    area.innerHTML = html;
    return;
  }

  html += '<table><thead><tr><th>Applicant</th><th>Amount</th><th>Tenure</th><th>EMI</th><th>Purpose</th><th>Status</th><th>Applied</th><th>Actions</th></tr></thead><tbody>';
  apps.forEach((a) => {
    html += `<tr>
      <td>${escapeHtml(a.userName || '')}<div class="muted-small">${escapeHtml(a.userEmail || '')}</div></td>
      <td>${formatN(a.amount)}</td>
      <td>${a.tenure}m</td>
      <td>${formatN(a.monthlyEMI)}</td>
      <td class="muted-small">${escapeHtml(a.purpose || '')}</td>
      <td>${statusPill(a.status)}</td>
      <td class="muted-small">${new Date(a.createdAt).toLocaleString()}</td>
      <td>
        <button class="btn ghost" onclick="viewApp('${a.id}')">View</button>
        <button class="btn" onclick="quickApprove('${a.id}')">Approve</button>
        <button class="btn" style="background:#ef4444" onclick="quickReject('${a.id}')">Reject</button>
      </td>
    </tr>`;
  });
  html += '</tbody></table>';

  if (overview && overview.recentEvents && overview.recentEvents.length) {
    html += '<div style="margin-top:16px"><div class="small">Latest activity</div><ul class="muted-small" style="margin:8px 0 0 18px">';
    overview.recentEvents.slice(0, 5).forEach((event) => {
      const actor = event.actor_name ? `${event.actor_name} (${event.actor_role || 'system'})` : event.actor_role || 'system';
      html += `<li>${new Date(event.created_at).toLocaleString()} — ${escapeHtml(event.event_type)} by ${escapeHtml(actor)} · ${escapeHtml(event.detail || '')}</li>`;
    });
    html += '</ul></div>';
  }

  area.innerHTML = html;
}

async function handleRegister() {
  clearError('regError');
  try {
    const payload = {
      name: $('reg-name').value.trim(),
      email: $('reg-email').value.trim().toLowerCase(),
      phone: $('reg-phone').value.trim(),
      password: $('reg-password').value,
    };
    if (!payload.name || !payload.email || !payload.password) {
      throw new Error('Please fill all required fields.');
    }
    const { user } = await apiFetch('/auth/register', { method: 'POST', body: payload });
    state.user = user;
    $('registerForm').reset();
    alert('Registration successful. You are now logged in.');
    void loadMyApplications();
    navigateTo('apply');
  } catch (err) {
    showError('regError', err.message || 'Registration failed');
  }
}
window.handleRegister = handleRegister;

async function handleLogin() {
  clearError('loginError');
  try {
    const payload = {
      email: $('login-email').value.trim().toLowerCase(),
      password: $('login-password').value,
    };
    const { user } = await apiFetch('/auth/login', { method: 'POST', body: payload });
    state.user = user;
    $('loginForm').reset();
    alert('Logged in successfully.');
    if (user.role === 'admin') {
      navigateTo('admin');
    } else {
      void loadMyApplications();
      navigateTo('apply');
    }
  } catch (err) {
    showError('loginError', err.message || 'Login failed');
  }
}
window.handleLogin = handleLogin;

async function handleAdminLogin() {
  clearError('adminLoginError');
  try {
    const payload = {
      email: $('admin-email').value.trim().toLowerCase(),
      password: $('admin-password').value,
    };
    const { user } = await apiFetch('/auth/login', { method: 'POST', body: payload });
    state.user = user;
    $('adminLogin').reset();
    if (user.role !== 'admin') {
      showError('adminLoginError', 'This account is not an administrator.');
      navigateTo('login');
      return;
    }
    alert('Administrator logged in.');
    void loadAdminData();
  } catch (err) {
    showError('adminLoginError', err.message || 'Admin login failed');
  }
}
window.handleAdminLogin = handleAdminLogin;

async function adminLogout() {
  try {
    await apiFetch('/auth/logout', { method: 'POST' });
  } catch (_err) {
    // ignore network errors here
  }
  state.user = null;
  state.adminApplications = [];
  state.adminOverview = null;
  renderAdminLoginArea();
  alert('Logged out.');
  navigateTo('home');
}
window.adminLogout = adminLogout;

async function handleApply() {
  clearError('applyError');
  if (!state.user) {
    showError('applyError', 'You must login before applying.');
    navigateTo('login');
    return;
  }
  const payload = {
    amount: Number($('loan-amount').value),
    tenure: Number($('loan-tenure').value),
    income: Number($('loan-income').value),
    employment: $('loan-employment').value,
    purpose: $('loan-purpose').value,
    collateral: $('loan-collateral').value.trim(),
    notes: $('loan-notes').value.trim(),
  };
  try {
    const { application } = await apiFetch('/loans', { method: 'POST', body: payload });
    $('applyForm').reset();
    updateQuickPreview(0, 0, 0);
    alert('Application submitted successfully.');
    state.myApplications.unshift(application);
    renderMyApps();
    navigateTo('status');
  } catch (err) {
    showError('applyError', err.message || 'Unable to submit application');
  }
}
window.handleApply = handleApply;

async function viewApp(id) {
  try {
    const data = await apiFetch(`/loans/${id}`);
    const a = data.application;
    const modal = `
${statusPill(a.status)}\n
Applicant: ${a.userName || ''} (${a.userEmail || ''})\n
Amount: ${formatN(a.amount)}\n
Tenure: ${a.tenure} months\n
EMI: ${formatN(a.monthlyEMI)}\n
Purpose: ${a.purpose}\n
Employment: ${a.employment}\n
Collateral: ${a.collateral || '—'}\n
Notes: ${a.notes || '—'}\n
Preview eligible: ${a.eligiblePreview ? 'Yes' : 'No'}\n
Admin notes: ${a.adminNotes || '—'}
`;
    const action = prompt(`${modal}\n\nType 'approve', 'reject', or enter an admin note (cancel to exit):`);
    if (!action) return;
    const lower = action.toLowerCase();
    if (lower === 'approve') {
      await updateAppStatus(id, 'Approved');
      return;
    }
    if (lower === 'reject') {
      await updateAppStatus(id, 'Rejected');
      return;
    }
    await updateAppNote(id, action);
  } catch (err) {
    alert(err.message || 'Unable to load application');
  }
}
window.viewApp = viewApp;

async function quickApprove(id) {
  await updateAppStatus(id, 'Approved');
}
window.quickApprove = quickApprove;

async function quickReject(id) {
  await updateAppStatus(id, 'Rejected');
}
window.quickReject = quickReject;

async function updateAppStatus(id, status) {
  try {
    await apiFetch(`/loans/${id}/status`, { method: 'PATCH', body: { status } });
    await loadAdminData();
    alert('Status updated.');
  } catch (err) {
    alert(err.message || 'Unable to update status');
  }
}

async function updateAppNote(id, note) {
  try {
    await apiFetch(`/loans/${id}/notes`, { method: 'PATCH', body: { adminNotes: note } });
    await loadAdminData();
    alert('Note added.');
  } catch (err) {
    alert(err.message || 'Unable to add note');
  }
}

async function exportAllCSV() {
  if (!state.user || state.user.role !== 'admin') {
    alert('Administrator access required');
    return;
  }
  if (!state.adminApplications.length) {
    alert('No applications to export.');
    return;
  }
  const rows = [
    ['id', 'userName', 'userEmail', 'amount', 'tenure', 'monthlyEMI', 'purpose', 'employment', 'status', 'adminNotes', 'createdAt'],
  ];
  state.adminApplications.forEach((a) => {
    rows.push([
      a.id,
      a.userName,
      a.userEmail,
      a.amount,
      a.tenure,
      a.monthlyEMI,
      a.purpose,
      a.employment,
      a.status,
      (a.adminNotes || '').replace(/\n/g, ' '),
      a.createdAt,
    ]);
  });
  downloadCSV(rows, 'applications_all.csv');
}
window.exportAllCSV = exportAllCSV;

function downloadAppCSV(appId) {
  const source = state.user && state.user.role === 'admin' ? state.adminApplications : state.myApplications;
  const app = source.find((x) => x.id === appId);
  if (!app) {
    alert('Application not found.');
    return;
  }
  const rows = [
    ['Field', 'Value'],
    ['Application ID', app.id],
    ['Applicant', app.userName || ''],
    ['Email', app.userEmail || ''],
    ['Amount', app.amount],
    ['Tenure (months)', app.tenure],
    ['Monthly EMI', app.monthlyEMI],
    ['Interest rate (p.a.)', `${(app.annualRate * 100).toFixed(2)}%`],
    ['Purpose', app.purpose],
    ['Employment', app.employment],
    ['Collateral', app.collateral || ''],
    ['Preview eligible', app.eligiblePreview ? 'Yes' : 'No'],
    ['Status', app.status],
    ['Admin notes', app.adminNotes || ''],
    ['Applied at', app.createdAt],
  ];
  downloadCSV(rows, `loan_${app.id}.csv`);
}
window.downloadAppCSV = downloadAppCSV;

function downloadCSV(rows, filename) {
  const content = rows
    .map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function statusPill(status) {
  if (status === 'Pending') return '<span class="status-pill status-pending">Pending</span>';
  if (status === 'Approved') return '<span class="status-pill status-approved">Approved</span>';
  if (status === 'Rejected') return '<span class="status-pill status-rejected">Rejected</span>';
  return `<span class="status-pill">${escapeHtml(status)}</span>`;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

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

function updateQuickPreview(amount, tenure, income) {
  $('quickLoanAmount').innerText = amount ? formatN(amount) : '₦0';
  if (amount && tenure) {
    const annualRate = calcInterestRate(tenure, $('loan-purpose').value);
    const emi = Math.ceil(monthlyPayment(amount, annualRate, tenure));
    $('quickRepay').innerText = `${tenure} months • EMI ${formatN(emi)} • Rate ${(annualRate * 100).toFixed(2)}% p.a.`;
    let hint = 'Likely eligible';
    if (!income) hint = 'Provide income for eligibility preview';
    else if (emi > 0.4 * income) hint = 'EMI > 40% income — may be ineligible';
    $('quickElig').innerText = hint;
  } else {
    $('quickRepay').innerText = 'Enter loan amount & tenure';
    $('quickElig').innerText = 'Not checked';
  }
}

$('loan-amount').addEventListener('input', () => updateQuickPreview(Number($('loan-amount').value), Number($('loan-tenure').value), Number($('loan-income').value)));
$('loan-tenure').addEventListener('change', () => updateQuickPreview(Number($('loan-amount').value), Number($('loan-tenure').value), Number($('loan-income').value)));
$('loan-income').addEventListener('input', () => updateQuickPreview(Number($('loan-amount').value), Number($('loan-tenure').value), Number($('loan-income').value)));

(async function init() {
  await fetchSession();
  const lastTab = localStorage.getItem('loan_app_last_tab') || 'home';
  if (state.user) {
    if (state.user.role === 'admin') {
      setActiveTab('admin');
      await loadAdminData();
    } else {
      setActiveTab(lastTab === 'admin' ? 'apply' : lastTab);
      await loadMyApplications();
    }
  } else {
    setActiveTab(lastTab);
  }
})();
