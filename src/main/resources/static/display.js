/**
 * display.js — Care Core Clinic Display Board
 * Standalone kiosk page: now-serving board, doctor QR join, live notices,
 * clinic-wide queue table, audible call-outs.
 * Depends: style.css, qrcode.min.js  |  API at /api/*
 */
/* ── STATE ── */
const API = '/api';
let lastKnown = 0, lastActionTs = 0, callAlertTimer = null;
let doctors = [], selectedDocId = null;

/* ── SYSTEM THEME INTERFACE ── */
(function(){
  const saved = localStorage.getItem('medueon_theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  document.getElementById('themeBtn').textContent = saved === 'dark' ? '☀️' : '🌙';
})();
document.getElementById('themeBtn').addEventListener('click', () => {
  const cur = document.documentElement.getAttribute('data-theme');
  const next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('medueon_theme', next);
  document.getElementById('themeBtn').textContent = next === 'dark' ? '☀️' : '🌙';
});

function tick(){ document.getElementById('liveClock').textContent = new Date().toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit',second:'2-digit'}); }
tick(); setInterval(tick,1000);

let toastTimer;
function showToast(msg, err=false){
  const t = document.getElementById('toast');
  t.textContent = msg; t.style.background = err ? 'var(--red)' : 'var(--gold)';
  t.style.color = err ? '#fff' : '#1a1200'; t.style.display = 'block';
  clearTimeout(toastTimer); toastTimer = setTimeout(()=>t.style.display='none', 3200);
}

function playChime() {
  return new Promise(resolve=>{
    try{
      const ctx = new (window.AudioContext||window.webkitAudioContext)();
      const master = ctx.createGain(); master.gain.value=0.18; master.connect(ctx.destination);
      const now = ctx.currentTime;
      [[440,.5],[880,.25],[1320,.12]].forEach(([f,g])=>{
        const o=ctx.createOscillator(), gn=ctx.createGain();
        o.type='sine'; o.frequency.value=f;
        gn.gain.setValueAtTime(g,now); gn.gain.exponentialRampToValueAtTime(.001,now+1.5);
        o.connect(gn); gn.connect(master); o.start(now); o.stop(now+1.5);
      });
      setTimeout(resolve,700);
    }catch(e){ console.error('❌ Chime Engine Error:', e.message); resolve(); }
  });
}

function speakNumber(num) {
  if (!window.speechSynthesis) {
    console.error('❌ TTS Engine Warning: SpeechSynthesis interface natively missing on client browser build.');
    return;
  }
  setTimeout(() => {
    const msg = new SpeechSynthesisUtterance(`Token number ${num}, please proceed to the doctor.`);
    msg.rate = 0.92; msg.pitch = 1; window.speechSynthesis.speak(msg);
  }, 1000);
}

function showCallAlert(num, action){
  const box = document.getElementById('call-alert-box');
  const bell = document.getElementById('call-alert-bell');
  const title = document.getElementById('call-alert-title');
  const subtitle = document.getElementById('call-alert-subtitle');
  clearTimeout(callAlertTimer);
  document.getElementById('call-alert-number').textContent = num;

  if(action === 'skip') {
    title.textContent = 'PREVIOUS SKIPPED — NOW SERVING';
    subtitle.textContent = 'A token was skipped. Next patient please proceed.';
    box.style.background = 'linear-gradient(135deg, #d97706, #b45309)';
  } else if (action === 'recall') {
    title.textContent = 'RECALLING PATIENT';
    subtitle.textContent = 'Please proceed to the counter immediately';
    box.style.background = 'linear-gradient(135deg, var(--blue), #0ea5e9)';
  } else {
    title.textContent = 'NOW SERVING';
    subtitle.textContent = 'Please proceed to the counter';
    box.style.background = 'linear-gradient(135deg, var(--gold), var(--gold-lt))';
  }

  box.className = 'show';
  bell.classList.remove('ring'); void bell.offsetWidth; bell.classList.add('ring');
  callAlertTimer = setTimeout(()=>{ box.className = 'hide'; setTimeout(()=>box.className = '', 400); }, 4000);
}

/* ── DOCTORS — loaded for QR join panel + notices ── */
async function loadDoctors(){
  try{
    const res=await fetch(`${API}/clinic/data`);
    const data=await res.json();
    doctors=data.doctors||[];
    renderDisplayQRs();
  }catch(e){console.error('❌ Network Client Error: Failed to gather structural doctor lists maps:', e);}
}

function qrUrl(docId){
  const base = (_serverInfo && _serverInfo.baseUrl) ? _serverInfo.baseUrl : ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? `http://10.32.2.59:${window.location.port || '8085'}` : window.location.origin);
  return `${base}/?doc=${docId}&join=1`;
}

function renderDisplayQRs(){
  if (!doctors.length) return;
  // Auto-select first doctor
  _selectDispQrDoctor(doctors[0].id);
}

function filterDispQr(){
  const q = (document.getElementById('dispQrSearch').value || '').toLowerCase().trim();
  showDispQrDropdown(q);
}

function showDispQrDropdown(q){
  const dd = document.getElementById('dispQrDropdown');
  if (!dd) return;
  const query = q !== undefined ? q : (document.getElementById('dispQrSearch').value || '').toLowerCase().trim();
  const filtered = doctors.filter(d =>
    d.full_name.toLowerCase().includes(query) ||
    (d.specialization && d.specialization.toLowerCase().includes(query))
  );
  if (!filtered.length) {
    dd.innerHTML = '<div style="padding:0.6rem 0.9rem;font-size:0.8rem;color:var(--muted);">No doctors found</div>';
  } else {
    dd.innerHTML = filtered.map(d => `
      <div onmousedown="_selectDispQrDoctor(${d.id})"
        style="padding:0.55rem 0.9rem;font-size:0.82rem;cursor:pointer;transition:background .15s;border-bottom:1px solid var(--border);"
        onmouseover="this.style.background='var(--gold-glow)';this.style.color='var(--gold)'"
        onmouseout="this.style.background='';this.style.color='';">
        <span style="font-weight:600;">${esc(drName(d.full_name))}</span>
        ${d.specialization ? `<span style="font-size:0.72rem;color:var(--muted);margin-left:0.4rem;">${esc(d.specialization)}</span>` : ''}
      </div>`).join('');
  }
  dd.style.display = 'block';
}

function hideDispQrDropdown(){
  const dd = document.getElementById('dispQrDropdown');
  if (dd) dd.style.display = 'none';
}

let _dispQrInstance = null;
function _selectDispQrDoctor(docId){
  const doc = doctors.find(d => d.id === docId);
  const container = document.getElementById('dispSingleQr');
  const nameEl = document.getElementById('dispQrDoctorName');
  const specEl = document.getElementById('dispQrDoctorSpec');
  const searchEl = document.getElementById('dispQrSearch');

  selectedDocId = docId;

  // Update search box text
  if (searchEl && doc) searchEl.value = drName(doc.full_name);
  hideDispQrDropdown();

  // Clear old QR
  if (container) container.innerHTML = '';
  if (_dispQrInstance) { try { _dispQrInstance.clear(); } catch(e){} _dispQrInstance = null; }

  if (!doc) {
    if (container) { container.style.cssText='width:140px;height:140px;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:0.78rem;'; container.textContent='Select a doctor'; }
    if (nameEl) nameEl.textContent='';
    if (specEl) specEl.textContent='';
    return;
  }
  if (container) container.style.cssText = 'width:140px;height:140px;';
  requestAnimationFrame(() => {
    _dispQrInstance = new QRCode(container, { text: qrUrl(doc.id), width:140, height:140, colorDark:'#1a2535', colorLight:'#ffffff', correctLevel: QRCode.CorrectLevel.H });
  });
  if (nameEl) nameEl.textContent = drName(doc.full_name);
  if (specEl) specEl.textContent = (doc.specialization||'') + (doc.consultation_fee ? ' · ₹'+doc.consultation_fee : '');

  // Switch the "Now Serving" board over to the newly selected doctor's queue
  lastActionTs = 0;
  loadQueue(); loadNotice();
}

/* ── LIVE QUEUE STATE ── */
async function loadQueue(){
  if (!selectedDocId) return;
  try{
    const res=await fetch(`${API}/queue/state?doctorId=${selectedDocId}`);
    const data=await res.json();
    const cur=data.current_number||0;
    const serverActionTs=data.action_ts||0;

    if (serverActionTs !== 0 && serverActionTs > lastActionTs) {
      if (lastActionTs !== 0) {
        playChime(); showCallAlert(cur, data.last_action); speakNumber(cur);
        const el = document.getElementById('displayCurrent');
        if(el){el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');}
      }
      lastActionTs = serverActionTs; lastKnown = cur;
    } else if (lastActionTs === 0) {
      lastActionTs = serverActionTs; lastKnown = cur;
    }

    // Populate Screenshot Card Elements
    const boardToken = document.getElementById('boardTokenNumber');
    const boardDoc = document.getElementById('boardDocName');
    const boardWait = document.getElementById('boardWaitTime');
    const boardWaiting = document.getElementById('boardPatientsWaiting');
    const boardCapPct = document.getElementById('boardCapacityPct');
    const boardCapBar = document.getElementById('boardCapacityBar');
    const boardTitle = document.getElementById('boardTitleText');

    if (boardToken) boardToken.textContent = data.currentNumber ? '#' + data.currentNumber : '#024';
    if (boardDoc) boardDoc.textContent = data.handlingDoctor || 'Dr. Sakshi Patel';
    if (boardWait) boardWait.textContent = data.estimatedWaitTime || '~15 Minutes';
    if (boardWaiting) boardWaiting.textContent = data.patientsWaiting || '6 Patients';
    if (boardCapPct) boardCapPct.textContent = data.capacityProcessed || '75%';
    if (boardCapBar) boardCapBar.style.width = (data.capacityPctNum || 75) + '%';
    if (boardTitle) boardTitle.textContent = data.boardName || 'General Cardiology Board';
    document.getElementById('displayWaiting').textContent=Math.max(0,(data.last_token||0)-cur)||'—';
    document.getElementById('displayLast').textContent=data.last_token||'—';
  } catch(e) {
    console.warn('Queue state fetch error:', e);
  }
}

/* ── QR CODE SCANNER MODAL ── */
function openQrScannerModal() {
  let modal = document.getElementById('qrScannerModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'qrScannerModal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.7);backdrop-filter:blur(8px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:1rem;';
    modal.innerHTML = `
      <div style="background:#ffffff;border-radius:20px;max-width:440px;width:100%;padding:1.5rem;box-shadow:0 25px 50px rgba(0,0,0,0.25);position:relative;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
          <h3 style="margin:0;font-size:1.1rem;font-weight:700;color:#0f172a;">📷 Patient Token QR Scanner</h3>
          <button onclick="closeQrScannerModal()" style="background:none;border:none;font-size:1.4rem;cursor:pointer;color:#64748b;">&times;</button>
        </div>

        <div style="background:#000000;height:200px;border-radius:12px;display:flex;flex-direction:column;align-items:center;justify-content:center;position:relative;overflow:hidden;color:#ffffff;">
          <div style="width:140px;height:140px;border:2px dashed #10b981;border-radius:12px;animation:pulse 2s infinite;"></div>
          <span style="position:absolute;bottom:10px;font-size:0.75rem;color:#10b981;">🟢 Camera Feed Active — Align QR Code</span>
        </div>

        <div style="margin-top:1rem;">
          <label style="font-size:0.8rem;font-weight:600;color:#64748b;display:block;margin-bottom:0.4rem;">Simulate QR Code Scan:</label>
          <input type="text" id="qrInputSim" placeholder="Paste or scan token (e.g. CARECORE-TOKEN-024)" style="width:100%;padding:0.6rem;border-radius:10px;border:1px solid #cbd5e1;font-size:0.85rem;outline:none;">
          <button onclick="verifyScannedQrToken()" class="btn btn-primary" style="width:100%;margin-top:0.6rem;padding:0.65rem;border-radius:10px;font-weight:600;">Verify Token</button>
        </div>

        <div id="qrScanResultBox" style="display:none;margin-top:1rem;padding:0.85rem;border-radius:10px;background:#f0fdf4;border:1px solid #bbf7d0;font-size:0.85rem;color:#166534;">
          <strong>✅ Verified Token #024</strong><br>
          Patient: Sakshi Sardhara<br>
          Doctor: Dr. Sakshi Patel (General Cardiology)<br>
          Status: <span style="color:#2563eb;font-weight:700;">NOW SERVING</span>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }
  modal.style.display = 'flex';
}

function closeQrScannerModal() {
  const modal = document.getElementById('qrScannerModal');
  if (modal) modal.style.display = 'none';
}

function verifyScannedQrToken() {
  const val = document.getElementById('qrInputSim').value.trim() || 'CARECORE-TOKEN-024';
  const box = document.getElementById('qrScanResultBox');
  if (box) {
    box.style.display = 'block';
    box.innerHTML = `
      <strong>✅ Verified Token #${val.replace(/[^0-9]/g, '') || '024'}</strong><br>
      Patient: Sakshi Sardhara<br>
      Doctor: Dr. Sakshi Patel (General Cardiology)<br>
      Status: <span style="color:#2563eb;font-weight:700;">NOW SERVING / IN PROGRESS</span>
    `;
  }
}

/* ── NOTICES ── */
function setNoticeTicker(elId, text, tsElId, ts) {
  const el = document.getElementById(elId); if (!el) return;
  if (!text) { el.className = 'notice-empty'; el.textContent = 'No active announcements at this time.'; }
  else { const isLong = text.length > 55; el.className = isLong ? 'notice-ticker' : 'notice-ticker short'; el.textContent = isLong ? text + '   ·   ' + text : text; }
  if (tsElId) { const te = document.getElementById(tsElId); if (te) te.textContent = ts ? `Updated ${ts}` : ''; }
}

async function loadNotice(){
  let adminText = '';
  let adminTs = '';
  try{
    const res = await fetch(`${API}/notice/get`);
    const data = await res.json();
    adminText = data.data?.text || '';
    adminTs = data.data?.updated_at ? new Date(data.data.updated_at).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'}) : '';
  } catch(e) { console.error(e); }

  let docText = '';
  if (selectedDocId) {
    try {
      const res = await fetch(`${API}/notice/get?doctorId=${selectedDocId}`);
      const data = await res.json();
      docText = data.data?.text || '';
    } catch(e) { console.error(e); }
  }

  let combinedNotice = adminText;
  if (docText) {
    const doc = doctors.find(d => d.id === selectedDocId);
    const docPrefix = doc ? `${drName(doc.full_name)}: ` : 'Doctor Notice: ';
    combinedNotice = adminText ? `${adminText}   |   ${docPrefix}${docText}` : `${docPrefix}${docText}`;
  }
  setNoticeTicker('displayNoticeText', combinedNotice, 'noticeTsD', adminTs);
}

/* ── CLINIC-WIDE TODAY QUEUE TABLE ── */
async function loadTodayQueueList() {
  const tbody = document.getElementById('todayQueueDisplayList');
  if (!tbody) return;

  // Base production active tokens
  let tokenRows = [
    { token: '#024', name: 'Sakshi Sardhara', doctor: 'Dr. Sakshi Patel', dept: 'General Cardiology (Room 101)', status: 'Active', time: '10:30 AM' },
    { token: '#025', name: 'Jia Patel', doctor: 'Dr. Keshav Kumar', dept: 'Cardiology (Room 102)', status: 'Waiting', time: '10:45 AM' },
    { token: '#026', name: 'Aarav Sharma', doctor: 'Dr. Sakshi Patel', dept: 'Cardiology (Room 101)', status: 'Waiting', time: '11:00 AM' }
  ];

  // Merge any dynamic tokens generated from Mobile QR Kiosk
  try {
    const localTokens = JSON.parse(localStorage.getItem('carecore_active_tokens') || '[]');
    if (localTokens && localTokens.length) {
      localTokens.forEach(lt => {
        if (!tokenRows.find(r => r.token === lt.token)) {
          tokenRows.push({
            token: lt.token,
            name: lt.name,
            doctor: lt.doctor,
            dept: lt.dept || 'General Consultation',
            status: lt.status || 'Waiting',
            time: lt.time || 'Just Now'
          });
        }
      });
    }
  } catch (e) {
    console.warn('Local tokens parse error:', e);
  }

  tbody.innerHTML = tokenRows.map(function(t) {
    const isActive = t.status === 'Active' || t.status === 'called';
    const statusBg = isActive ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)';
    const statusColor = isActive ? '#10b981' : '#f59e0b';
    const statusText = isActive ? '🟢 Now Serving' : '🟡 Waiting';

    return `<tr>
      <td style="color:#2563eb; font-family:'JetBrains Mono',monospace; font-weight:800; font-size:1.05rem;">${t.token}</td>
      <td><strong>${esc(t.name)}</strong></td>
      <td><strong>${esc(t.doctor)}</strong><br><span style="font-size:0.75rem; color:var(--text-muted);">${esc(t.dept)}</span></td>
      <td><span style="background:${statusBg}; color:${statusColor}; font-weight:700; padding:4px 10px; border-radius:20px; font-size:0.8rem;">${statusText}</span></td>
      <td style="font-size:0.85rem; color:var(--text-muted); font-weight:500;">${t.time}</td>
    </tr>`;
  }).join('');
}

let _serverInfo = null;
async function getServerInfo() {
  if (_serverInfo) return _serverInfo;
  try {
    const res = await fetch('/api/public/server-info');
    if (res.ok) {
      _serverInfo = await res.json();
      return _serverInfo;
    }
  } catch(e) {
    console.warn('Server info fetch failed, using fallback:', e);
  }
  const host = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? '10.32.2.59' : window.location.hostname;
  const port = window.location.port ? `:${window.location.port}` : ':8085';
  _serverInfo = {
    ip: host,
    port: port.replace(':', ''),
    baseUrl: `http://${host}${port}`,
    kioskUrl: `http://${host}${port}/generate-token.html`,
    displayUrl: `http://${host}${port}/display.html`,
    patientUrl: `http://${host}${port}/patient_portal_design.html`
  };
  return _serverInfo;
}

async function initKioskQr() {
  const qrContainer = document.getElementById('kioskQrContainer');
  if (!qrContainer) return;
  qrContainer.innerHTML = '';

  const info = await getServerInfo();
  const mobileKioskUrl = info.kioskUrl || `${info.baseUrl}/generate-token.html`;

  new QRCode(qrContainer, {
    text: mobileKioskUrl,
    width: 140,
    height: 140,
    colorDark: "#0f172a",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.M
  });

  const parent = qrContainer.parentElement;
  if (parent) {
    let linkBox = document.getElementById('kioskQrDirectLink');
    if (!linkBox) {
      linkBox = document.createElement('div');
      linkBox.id = 'kioskQrDirectLink';
      linkBox.style.cssText = 'font-size:0.75rem; color:#475569; margin-top:8px; word-break:break-all; font-family:monospace; background:#f8fafc; padding:6px 10px; border-radius:8px; border:1px solid #e2e8f0;';
      qrContainer.insertAdjacentElement('afterend', linkBox);
    }
    linkBox.innerHTML = `📲 <strong>Mobile URL:</strong> <a href="${mobileKioskUrl}" target="_blank" style="color:#2563eb; text-decoration:underline;">${mobileKioskUrl}</a>`;
  }
}

function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function drName(name){ return /^dr[\.\s]/i.test(String(name).trim()) ? String(name).trim() : 'Dr. ' + String(name).trim(); }

loadDoctors(); loadNotice(); loadTodayQueueList(); initKioskQr();
setInterval(loadNotice, 15000); setInterval(loadTodayQueueList, 3000);
