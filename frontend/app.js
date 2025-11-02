/* -------------------------
   Demo frontend logic
   - Stores users and applications in localStorage
   - Simple eligibility rules
   - Admin demo credentials (client side)
   ------------------------- */

const STORAGE_USERS = 'fv_users_v1';
const STORAGE_APPS = 'fv_apps_v1';
const STORAGE_SESSION = 'fv_session_v1';

// Demo admin (for prototyping). Change when integrating backend.
const DEMO_ADMIN = { email: 'admin@finverge.demo', password: 'admin123' };

// Utility helpers
const $ = id => document.getElementById(id);
const qs = s => document.querySelector(s);
const qsa = s => document.querySelectorAll(s);

function saveToStore(key, value){ localStorage.setItem(key, JSON.stringify(value)); }
function readFromStore(key){ const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; }

// Initialize demo data if missing
if(!readFromStore(STORAGE_USERS)){
  saveToStore(STORAGE_USERS, [
    // sample user for easy testing
    { id: 'u1', name: 'Jane Demo', email: 'jane@demo.com', phone: '+234800000', password: 'password' }
  ]);
}
if(!readFromStore(STORAGE_APPS)){
  saveToStore(STORAGE_APPS, []);
}

// Navigation
function setActiveTab(name){
  qsa('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  qsa('[data-page]').forEach(s => s.style.display = (s.getAttribute('data-page') === name) ? 'block' : 'none');
}
qsa('.tab').forEach(t => t.addEventListener('click', ()=> setActiveTab(t.dataset.tab)));

function navigateTo(tab){
  setActiveTab(tab);
  if(tab === 'status') renderMyApps();
  if(tab === 'admin') renderAdminLoginArea();
}
setActiveTab('home');

// Session helpers
function setSession(user){ saveToStore(STORAGE_SESSION, user); }
function getSession(){ return readFromStore(STORAGE_SESSION); }
function clearSession(){ localStorage.removeItem(STORAGE_SESSION); }

// Registration
function handleRegister(){
  const name = $('reg-name').value.trim();
  const email = $('reg-email').value.trim().toLowerCase();
  const phone = $('reg-phone').value.trim();
  const password = $('reg-password').value;

  const users = readFromStore(STORAGE_USERS) || [];
  const errEl = $('regError');
  errEl.style.display = 'none';

  if(!name || !email || !password){ errEl.innerText = 'Please fill required fields.'; errEl.style.display='block'; return; }
  if(users.some(u => u.email === email)){ errEl.innerText = 'Email already registered.'; errEl.style.display='block'; return; }

  const id = 'u' + Date.now();
  users.push({ id, name, email, phone, password });
  saveToStore(STORAGE_USERS, users);
  setSession({ id, name, email, role: 'user' });
  alert('Account created and logged in.');
  $('registerForm').reset();
  navigateTo('apply');
}

// Login
function handleLogin(){
  const email = $('login-email').value.trim().toLowerCase();
  const password = $('login-password').value;
  const users = readFromStore(STORAGE_USERS) || [];
  const errEl = $('loginError'); errEl.style.display='none';

  // Admin quick login option
  if(email === DEMO_ADMIN.email && password === DEMO_ADMIN.password){
    setSession({ id: 'admin', name: 'Administrator', email: DEMO_ADMIN.email, role: 'admin' });
    alert('Admin logged in (demo). Navigate to Admin tab.');
    navigateTo('admin');
    return;
  }

  const user = users.find(u => u.email === email && u.password === password);
  if(!user){ errEl.innerText = 'Invalid credentials.'; errEl.style.display='block'; return; }
  setSession({ id: user.id, name: user.name, email: user.email, role: 'user' });
  alert('Logged in successfully.');
  $('loginForm').reset();
  navigateTo('apply');
}

// Apply for loan
function handleApply(){
  const session = getSession();
  const errEl = $('applyError'); errEl.style.display='none';
  if(!session || session.role !== 'user'){ errEl.innerText = 'You must be logged in as a user to apply.'; errEl.style.display='block'; navigateTo('login'); return; }

  const amount = Number($('loan-amount').value);
  const tenure = Number($('loan-tenure').value);
  const income = Number($('loan-income').value);
  const employment = $('loan-employment').value;
  const purpose = $('loan-purpose').value;
  const collateral = $('loan-collateral').value.trim();
  const notes = $('loan-notes').value.trim();

  if(!amount || !income || !tenure){ errEl.innerText = 'Please provide amount, tenure and income.'; errEl.style.display='block'; return; }
  if(amount < 10000){ errEl.innerText = 'Minimum loan amount is ₦10,000.'; errEl.style.display='block'; return; }

  // compute interest & EMI (amortizing)
  const annualRate = calcInterestRate(tenure, purpose);
  const monthlyEMI = Math.ceil(monthlyPayment(amount, annualRate, tenure));

  // eligibility heuristics (client preview)
  let eligible = true; let reasons = [];
  if(employment === 'unemployed'){ eligible = false; reasons.push('Employment status not eligible.'); }
  if(monthlyEMI > 0.4 * income){ eligible = false; reasons.push('EMI exceeds 40% of income.'); }
  const maxMultiple = (purpose === 'business') ? 24 : 12;
  if(amount > income * maxMultiple){ eligible = false; reasons.push(`Requested > ${maxMultiple}x monthly income.`); }

  // Save application
  const apps = readFromStore(STORAGE_APPS) || [];
  const app = {
    id: 'a' + Date.now(),
    userId: session.id,
    userName: session.name,
    userEmail: session.email,
    amount, tenure, income, employment, purpose, collateral, notes,
    annualRate,
    monthlyEMI,
    eligiblePreview: eligible,
    previewReasons: reasons,
    status: 'Pending', // Pending / Approved / Rejected
    adminNotes: '',
    createdAt: new Date().toISOString()
  };
  apps.push(app);
  saveToStore(STORAGE_APPS, apps);

  alert('Application submitted. You can track it from My Applications.');
  $('applyForm').reset();
  updateQuickPreview(0,0,null);
  navigateTo('status');
}

// Quick preview area updates
function updateQuickPreview(amount, tenure, income){
  $('quickLoanAmount').innerText = amount ? formatN(amount) : '₦0';
  if(amount && tenure){
    const annualRate = calcInterestRate(tenure, $('loan-purpose').value);
    const emi = Math.ceil(monthlyPayment(amount, annualRate, tenure));
    $('quickRepay').innerText = `${tenure} months • EMI ${formatN(emi)} • Rate ${(annualRate*100).toFixed(2)}% p.a.`;
    // eligibility quick hint
    let hint = 'Likely eligible (demo)';
    if(!income) hint = 'Provide income for eligibility preview';
    else if(emi > 0.4 * income) hint = 'EMI > 40% income — may be ineligible';
    $('quickElig').innerText = hint;
  } else {
    $('quickRepay').innerText = 'Enter loan amount & tenure';
    $('quickElig').innerText = 'Not checked';
  }
}

// Helper: render user applications
function renderMyApps(){
  const session = getSession();
  const area = $('myAppsArea'); area.innerHTML = '';
  if(!session || session.role !== 'user'){ area.innerHTML = '<div class="muted-small">Please login to view your applications.</div>'; return; }

  const apps = (readFromStore(STORAGE_APPS) || []).filter(a => a.userId === session.id).sort((a,b)=> b.createdAt.localeCompare(a.createdAt));
  if(!apps.length){ area.innerHTML = '<div class="muted-small">No applications yet. Click Apply to submit a loan request.</div>'; return; }

  let html = '<table><thead><tr><th>Requested</th><th>Tenure</th><th>EMI</th><th>Status</th><th>Applied</th><th></th></tr></thead><tbody>';
  apps.forEach(a=>{
    html += `<tr>
      <td>${formatN(a.amount)}</td>
      <td>${a.tenure} months</td>
      <td>${formatN(a.monthlyEMI)}</td>
      <td>${statusPill(a.status)}</td>
      <td>${new Date(a.createdAt).toLocaleString()}</td>
      <td><button class="btn ghost" onclick="downloadAppCSV('${a.id}')">Receipt</button></td>
    </tr>`;
  });
  html += '</tbody></table>';
  area.innerHTML = html;
}

// Admin area / authentication
function renderAdminLoginArea(){
  const session = getSession();
  if(session && session.role === 'admin'){
    $('adminLoginArea').style.display = 'none';
    $('adminArea').style.display = 'block';
    renderAdminTable();
  } else {
    $('adminLoginArea').style.display = 'block';
    $('adminArea').style.display = 'none';
  }
}

function handleAdminLogin(){
  const email = $('admin-email').value.trim().toLowerCase();
  const password = $('admin-password').value;
  const errEl = $('adminLoginError'); errEl.style.display='none';

  if(email === DEMO_ADMIN.email && password === DEMO_ADMIN.password){
    setSession({ id: 'admin', name: 'Administrator', email: DEMO_ADMIN.email, role: 'admin' });
    renderAdminLoginArea();
    return;
  }
  errEl.innerText = 'Invalid admin credentials (demo).';
  errEl.style.display = 'block';
}
function adminLogout(){ clearSession(); renderAdminLoginArea(); alert('Admin logged out.'); }

// Admin table: list apps and actions
function renderAdminTable(){
  const apps = (readFromStore(STORAGE_APPS) || []).sort((a,b)=> b.createdAt.localeCompare(a.createdAt));
  const area = $('adminTableArea');
  if(!apps.length){ area.innerHTML = '<div class="muted-small">No applications yet.</div>'; return; }

  let html = '<table><thead><tr><th>Applicant</th><th>Amount</th><th>Tenure</th><th>EMI</th><th>Purpose</th><th>Status</th><th>Applied</th><th>Actions</th></tr></thead><tbody>';
  apps.forEach(a=>{
    html += `<tr>
      <td>${escapeHtml(a.userName)}<div class="muted-small">${escapeHtml(a.userEmail)}</div></td>
      <td>${formatN(a.amount)}</td>
      <td>${a.tenure}m</td>
      <td>${formatN(a.monthlyEMI)}</td>
      <td class="muted-small">${escapeHtml(a.purpose)}</td>
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
  area.innerHTML = html;
}

// Admin actions
function viewApp(id){
  const apps = readFromStore(STORAGE_APPS) || [];
  const a = apps.find(x=>x.id===id);
  if(!a) return alert('Application not found.');
  const modal = `
    ${statusPill(a.status)}\n
    Applicant: ${a.userName} (${a.userEmail})\n
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
  // Simple prompt-based admin edit for demo
  const action = prompt(`${modal}\n\nType 'approve', 'reject', or enter admin note (cancel to exit):`);
  if(!action) return;
  if(action.toLowerCase() === 'approve'){ updateAppStatus(id, 'Approved'); return; }
  if(action.toLowerCase() === 'reject'){ updateAppStatus(id, 'Rejected'); return; }
  updateAppNote(id, action);
}

function quickApprove(id){ updateAppStatus(id, 'Approved'); }
function quickReject(id){ updateAppStatus(id, 'Rejected'); }

function updateAppStatus(id, status){
  const apps = readFromStore(STORAGE_APPS) || [];
  const i = apps.findIndex(x=>x.id===id);
  if(i === -1) return alert('Not found');
  apps[i].status = status;
  apps[i].adminNotes = apps[i].adminNotes || '';
  saveToStore(STORAGE_APPS, apps);
  renderAdminTable();
  alert('Status updated.');
}

function updateAppNote(id, note){
  const apps = readFromStore(STORAGE_APPS) || [];
  const i = apps.findIndex(x=>x.id===id);
  if(i === -1) return alert('Not found');
  apps[i].adminNotes = (apps[i].adminNotes ? apps[i].adminNotes + '\n' : '') + note;
  saveToStore(STORAGE_APPS, apps);
  renderAdminTable();
  alert('Note added.');
}

// CSV export & receipts
function exportAllCSV(){
  const apps = readFromStore(STORAGE_APPS) || [];
  if(!apps.length) return alert('No applications to export.');
  const rows = [
    ['id','userName','userEmail','amount','tenure','monthlyEMI','purpose','employment','status','adminNotes','createdAt']
  ];
  apps.forEach(a => rows.push([a.id, a.userName, a.userEmail, a.amount, a.tenure, a.monthlyEMI, a.purpose, a.employment, a.status, (a.adminNotes||'').replace(/\n/g,' '), a.createdAt]));
  downloadCSV(rows, 'applications_all.csv');
}

function downloadAppCSV(appId){
  const apps = readFromStore(STORAGE_APPS) || [];
  const a = apps.find(x=>x.id===appId);
  if(!a) return alert('Not found');
  const rows = [
    ['Field','Value'],
    ['Application ID', a.id],
    ['Applicant', a.userName],
    ['Email', a.userEmail],
    ['Amount', a.amount],
    ['Tenure (months)', a.tenure],
    ['Monthly EMI', a.monthlyEMI],
    ['Interest rate (p.a.)', (a.annualRate*100).toFixed(2) + '%'],
    ['Purpose', a.purpose],
    ['Employment', a.employment],
    ['Collateral', a.collateral],
    ['Preview eligible', a.eligiblePreview ? 'Yes' : 'No'],
    ['Status', a.status],
    ['Admin notes', a.adminNotes || ''],
    ['Applied at', a.createdAt]
  ];
  downloadCSV(rows, `loan_${a.id}.csv`);
}

function downloadCSV(rows, filename){
  const content = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

/* --------------------------
   Finance helpers (same logic as backend later)
   -------------------------- */
function calcInterestRate(tenureMonths, purpose){
  if(purpose === 'business') return 0.155; // 15.5% p.a.
  if(tenureMonths <= 12) return 0.125;
  if(tenureMonths <= 24) return 0.145;
  return 0.165;
}
function monthlyPayment(principal, annualRate, months){
  if(months <= 0) return 0;
  const r = annualRate / 12;
  if(r === 0) return principal / months;
  const numerator = principal * r * Math.pow((1+r), months);
  const denominator = Math.pow((1+r), months) - 1;
  return numerator / denominator;
}
function formatN(n){ return '₦' + Number(n).toLocaleString(); }

/* --------------------------
   Small helpers / events
   -------------------------- */
$('loan-amount').addEventListener('input', ()=> updateQuickPreview(Number($('loan-amount').value), Number($('loan-tenure').value), Number($('loan-income').value)));
$('loan-tenure').addEventListener('change', ()=> updateQuickPreview(Number($('loan-amount').value), Number($('loan-tenure').value), Number($('loan-income').value)));
$('loan-income').addEventListener('input', ()=> updateQuickPreview(Number($('loan-amount').value), Number($('loan-tenure').value), Number($('loan-income').value)));

// helper display helpers
function statusPill(status){
  if(status === 'Pending') return `<span class="status-pill status-pending">${status}</span>`;
  if(status === 'Approved') return `<span class="status-pill status-approved">${status}</span>`;
  if(status === 'Rejected') return `<span class="status-pill status-rejected">${status}</span>`;
  return `<span class="status-pill">${status}</span>`;
}

function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, (m)=> ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

/* initialize UI states depending on session */
(function init(){
  const session = getSession();
  if(session && session.role === 'admin') setActiveTab('admin');
  if(session && session.role === 'user') setActiveTab('apply');
})();
