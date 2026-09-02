let TOKEN = localStorage.getItem('adminToken') || '';
let ADMIN_INFO = JSON.parse(localStorage.getItem('adminInfo') || '{}');
let allDoctors = [], allPatients = [];

window.addEventListener('DOMContentLoaded', () => {
  initClock();
  if (TOKEN) { showApp(); }
});

function initClock() {
  const tick = () => {
    const n = new Date();
    document.getElementById('liveClock').textContent = [n.getHours(), n.getMinutes(), n.getSeconds()].map(x => String(x).padStart(2, '0')).join(':');
  };
  tick(); setInterval(tick, 1000);
}

async function doLogin() {
  const username = document.getElementById('loginUser').value.trim();
  const password = document.getElementById('loginPass').value;
  try {
    const r = await fetch('/api/auth/admin/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'Identity rejection');
    TOKEN = d.token;
    ADMIN_INFO = d.admin;
    localStorage.setItem('adminToken', TOKEN);
    localStorage.setItem('adminInfo', JSON.stringify(ADMIN_INFO));
    showApp();
  } catch (e) { document.getElementById('loginErr').textContent = e.message; }
}

function showApp() {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('adminNameSB').textContent = ADMIN_INFO.full_name || 'Admin Officer';
  loadDashboard();
}

function nav(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + id).classList.add('active');
  if(id === 'pending') loadPendingList();
  if(id === 'doctors') loadDoctorsRegistry();
  if(id === 'patients') loadPatientsRegistry();
  if(id === 'services') loadServicesToggles();
}

async function loadDashboard() {
  try {
    const [docs, patients] = await Promise.all([
      fetch('/api/admin/doctors', { headers: { 'Authorization': 'Bearer ' + TOKEN } }).then(r => r.json()),
      fetch('/api/admin/patients', { headers: { 'Authorization': 'Bearer ' + TOKEN } }).then(r => r.json())
    ]);
    document.getElementById('s-docs').textContent = docs.length;
    document.getElementById('s-pending').textContent = docs.filter(d => d.approval_status === 'pending').length;
    document.getElementById('s-patients').textContent = patients.length;
  } catch (e) { console.error('Error fetching dashboard statistics metrics:', e); }
}

async function loadPendingList() {
  const r = await fetch('/api/admin/doctors?status=pending', { headers: { 'Authorization': 'Bearer ' + TOKEN } });
  const list = await r.json();
  document.getElementById('pendingTbody').innerHTML = list.map(d => `
    <tr>
      <td>Dr. ${d.full_name}</td><td>${d.specialization}</td><td>${d.registration_number}</td>
      <td><button class="btn" onclick="approve(${d.id})" style="background:var(--green); color:#fff; padding:0.25rem 0.5rem;">Approve</button></td>
    </tr>`).join('');
}

async function approve(id) {
  await fetch(`/api/admin/doctors/${id}/approve`, { method: 'POST', headers: { 'Authorization': 'Bearer ' + TOKEN } });
  loadPendingList();
}

async function loadDoctorsRegistry() {
  const r = await fetch('/api/admin/doctors', { headers: { 'Authorization': 'Bearer ' + TOKEN } });
  const docs = await r.json();
  document.getElementById('doctorsTbody').innerHTML = docs.map(d => `
    <tr><td>Dr. ${d.full_name}</td><td>${d.specialization}</td><td><span class="pill pill-${d.approval_status}">${d.approval_status}</span></td><td>${d.is_active ? 'Online' : 'Offline'}</td></tr>`).join('');
}

async function loadPatientsRegistry() {
  const r = await fetch('/api/admin/patients', { headers: { 'Authorization': 'Bearer ' + TOKEN } });
  const patients = await r.json();
  document.getElementById('patientsTbody').innerHTML = patients.map(p => `
    <tr><td>${p.full_name}</td><td>${p.age || '—'}</td><td>${p.contact || '—'}</td></tr>`).join('');
}

async function loadServicesToggles() {
  const r = await fetch('/api/admin/doctors', { headers: { 'Authorization': 'Bearer ' + TOKEN } });
  const docs = await r.json();
  document.getElementById('servicesBody').innerHTML = docs.map(d => `
    <div style="display:flex; justify-content:space-between; padding:0.5rem; background:var(--bg-mid); border-bottom:1px solid var(--border)">
      <span>Dr. ${d.full_name}</span>
      <button class="btn" style="width:auto; padding:0.25rem 0.5rem;" onclick="toggleService(${d.id}, ${d.is_active})">${d.is_active ? 'Stop Service' : 'Start Service'}</button>
    </div>`).join('');
}

async function toggleService(id, active) {
  const endpoint = active ? 'suspend' : 'approve';
  await fetch(`/api/admin/doctors/${id}/${endpoint}`, { method: 'POST', headers: { 'Authorization': 'Bearer ' + TOKEN } });
  loadServicesToggles();
}

function doLogout() { localStorage.clear(); location.reload(); }
function toggleTheme() {
  const h = document.documentElement;
  h.setAttribute('data-theme', h.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
}
