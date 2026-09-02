const API = '/api';
let myToken = null, lastKnown = 0, lastActionTs = 0, callAlertTimer = null, isAutoGenerating = false;
let doctors = [], selectedDocId = null, qrInstances = {}, mapInstance = null, toastTimer = null;

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initClock();
  loadDoctors();
  loadSavedPatient();
  loadNotice();
  initNav();
  
  document.getElementById('docSearch').addEventListener('input', filterDoctors);
  document.getElementById('getTokenBtn').addEventListener('click', generateToken);
  
  ['patientName', 'patientAge', 'patientMobile', 'patientGender'].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.addEventListener('input', checkAutoSubmit);
  });
  
  setInterval(() => { loadQueue(); }, 2000);
  setInterval(loadNotice, 15000);
});

function initTheme() {
  const saved = localStorage.getItem('medueon_theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  document.getElementById('themeBtn').textContent = saved === 'dark' ? '☀️' : '🌙';
  document.getElementById('themeBtn').addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme');
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('medueon_theme', next);
    document.getElementById('themeBtn').textContent = next === 'dark' ? '☀️' : '🌙';
  });
}

function initClock() {
  const tick = () => {
    document.getElementById('liveClock').textContent = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };
  tick(); setInterval(tick, 1000);
}

function initNav() {
  document.querySelectorAll('.nav-tabs .nav-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      document.querySelectorAll('.nav-tabs .nav-tab').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
      document.getElementById(view + 'View').classList.add('active');
      if (view === 'map') setTimeout(initNetworkBranchesMap, 150);
    });
  });
}

async function loadDoctors() {
  try {
    const res = await fetch(`${API}/clinic/data`);
    const data = await res.json();
    doctors = data.doctors || [];
    const savedDocId = parseInt(localStorage.getItem('pat_docId')) || null;
    if (savedDocId && doctors.find(d => d.id === savedDocId)) selectedDocId = savedDocId;
    renderDoctorList(doctors, 'doctorListQ');
    renderDocQrPanels();
    renderDisplayQRs();
    handleQRLanding();
  } catch (e) { console.error('Error fetching doctors structural array:', e); }
}

function renderDoctorList(docArray, containerId) {
  const el = document.getElementById(containerId);
  if (!docArray.length) { el.innerHTML = '<div style="color:var(--muted);padding:1rem;">No matching medical personnel active.</div>'; return; }
  
  el.innerHTML = docArray.map(d => `
    <div class="doc-card ${selectedDocId === d.id ? 'selected' : ''}" data-id="${d.id}">
      <div class="doc-name">${esc(d.full_name)}</div>
      <div class="doc-spec">${esc(d.specialization || 'General')}</div>
      <div class="doc-fee">₹${d.consultation_fee || 0} / visit</div>
    </div>`).join('');

  el.querySelectorAll('.doc-card').forEach(card => {
    card.addEventListener('click', () => {
      selectedDocId = parseInt(card.dataset.id);
      localStorage.setItem('pat_docId', selectedDocId);
      el.querySelectorAll('.doc-card').forEach(x => x.classList.remove('selected'));
      card.classList.add('selected');
      loadQueue();
      checkAutoSubmit();
    });
  });
}

function filterDoctors() {
  const query = document.getElementById('docSearch').value.toLowerCase().trim();
  const filtered = doctors.filter(d => d.full_name.toLowerCase().includes(query) || (d.specialization && d.specialization.toLowerCase().includes(query)));
  renderDoctorList(filtered, 'doctorListQ');
}

function qrUrl(docId) { return `${window.location.origin}${window.location.pathname}?doc=${docId}&join=1`; }

function renderDocQrPanels() {
  const grid = document.getElementById('docQrGrid');
  grid.innerHTML = doctors.map(d => `
    <div class="doc-qr-panel" style="border: 1px solid var(--border); padding: 1rem; border-radius:12px; display:flex; flex-direction:column; align-items:center; gap:0.5rem; background: var(--bg-mid)">
      <div id="pqr_${d.id}"></div>
      <div style="font-weight:700; margin-top:0.5rem;">Dr. ${esc(d.full_name)}</div>
      <div style="font-size:0.75rem; color:var(--muted);">${esc(d.specialization || '')}</div>
      <button class="btn btn-primary" onclick="joinFromPanel(${d.id})" style="padding:0.4rem; font-size:0.8rem;">Join Queue</button>
    </div>`).join('');

  requestAnimationFrame(() => {
    doctors.forEach(d => {
      const target = document.getElementById(`pqr_${d.id}`);
      if(target) new QRCode(target, { text: qrUrl(d.id), width: 130, height: 130 });
    });
  });
}

window.joinFromPanel = (docId) => {
  selectedDocId = docId;
  localStorage.setItem('pat_docId', docId);
  document.querySelector('[data-view="queue"]').click();
  renderDoctorList(doctors, 'doctorListQ');
  loadQueue();
};

async function generateToken() {
  if (isAutoGenerating) return;
  const name = document.getElementById('patientName').value.trim();
  const age = document.getElementById('patientAge').value;
  const mobile = document.getElementById('patientMobile').value.trim();
  const gender = document.getElementById('patientGender').value;
  if (!selectedDocId || !name || !age || mobile.length < 10 || !gender) return;

  isAutoGenerating = true;
  try {
    const res = await fetch(`${API}/queue/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, age: parseInt(age), contact: mobile, gender, doctorId: selectedDocId })
    });
    const data = await res.json();
    myToken = data.token;
    localStorage.setItem('pat_name', name);
    localStorage.setItem('pat_token', myToken);
    document.getElementById('patientTokenDisplay').textContent = myToken;
    showToast(`Token Generated: #${myToken}`);
    loadQueue();
  } catch (e) { showToast('Generation failed.', true); }
  finally { isAutoGenerating = false; }
}

function checkAutoSubmit() {
  if (myToken) return;
  const name = document.getElementById('patientName').value.trim();
  const age = document.getElementById('patientAge').value;
  const mobile = document.getElementById('patientMobile').value.trim();
  const gender = document.getElementById('patientGender').value;
  if (selectedDocId && name.length >= 2 && age > 0 && mobile.length === 10 && gender) {
    generateToken();
  }
}

async function loadQueue() {
  if (!selectedDocId) return;
  try {
    const res = await fetch(`${API}/queue/state?doctorId=${selectedDocId}`);
    const data = await res.json();
    const cur = data.current_number || 0;
    
    document.getElementById('nowServing').textContent = cur || '—';
    document.getElementById('displayCurrent').textContent = cur || '—';
    document.getElementById('displayNext').textContent = cur ? cur + 1 : '—';
    document.getElementById('displayWaiting').textContent = Math.max(0, (data.last_token || 0) - cur) || '—';
    document.getElementById('displayLast').textContent = data.last_token || '—';

    if (myToken) {
      const ahead = Math.max(0, myToken - cur - 1);
      document.getElementById('aheadCount').textContent = ahead;
    }
  } catch (e) { console.error(e); }
}

function loadSavedPatient() {
  const token = localStorage.getItem('pat_token');
  if (token) {
    myToken = parseInt(token);
    document.getElementById('patientTokenDisplay').textContent = myToken;
  }
}

async function loadNotice() {
  try {
    const res = await fetch(`${API}/notice/get`);
    const data = await res.json();
    const text = data.data?.text || 'No active announcements.';
    document.getElementById('noticeText').textContent = text;
    document.getElementById('displayNoticeText').textContent = text;
  } catch(e) { console.error(e); }
}

function renderDisplayQRs() {
  const grid = document.getElementById('displayQrGrid');
  grid.innerHTML = doctors.map(d => `
    <div style="text-align:center; padding:0.5rem; background:var(--bg-mid); border-radius:8px;">
      <div id="dqr_${d.id}"></div>
      <div style="font-size:0.8rem; font-weight:700; margin-top:0.25rem;">Dr. ${esc(d.full_name)}</div>
    </div>`).join('');
  requestAnimationFrame(() => {
    doctors.forEach(d => {
      const el = document.getElementById(`dqr_${d.id}`);
      if (el) new QRCode(el, { text: qrUrl(d.id), width: 100, height: 100 });
    });
  });
}

function initNetworkBranchesMap() {
  if (mapInstance) { mapInstance.invalidateSize(); return; }
  mapInstance = L.map('clinicMap').setView([19.0760, 72.8777], 11);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(mapInstance);
}

function handleQRLanding() {
  const p = new URLSearchParams(window.location.search);
  const dId = p.get('doc');
  if(dId) {
    selectedDocId = parseInt(dId);
    localStorage.setItem('pat_docId', selectedDocId);
    renderDoctorList(doctors, 'doctorListQ');
  }
}

function showToast(msg, isErr = false) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.display = 'block';
  t.style.background = isErr ? 'var(--red)' : 'var(--gold)';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.style.display = 'none', 3000);
}

function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
