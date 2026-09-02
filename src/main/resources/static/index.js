/**
 * index.js — Care Core Patient Portal
 * Handles: token generation, doctor selection, appointments,
 *          QR scan, map view, lab reports, display board
 * Depends: style.css, qrcode.min.js, leaflet.js  |  API at /api/*
 */
/* ── STATE ── */
const API = '/api';
let myToken = null, lastKnown = 0, lastActionTs = 0, callAlertTimer = null, isAutoGenerating = false;
let doctors = [], selectedDocId = null, qrInstances = {}, mapInstance = null;
let tokenLabSelectedFile = null;

/* ── LEAFLET + OPENSTREETMAP CLINIC NETWORK MAP (FREE) ── */
function initNetworkBranchesMap() {
  console.log('🗺️ Map Layer: Initializing Leaflet network branch views container...');
  if (!mapInstance) {
    mapInstance = L.map('clinicMap').setView([19.0760, 72.8777], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19, attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(mapInstance);
  }
  mapInstance.invalidateSize();

  // Custom gold pin icon
  const goldIcon = L.divIcon({
    className: '',
    html: `<div style="width:18px;height:18px;background:#a8731a;border:3px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(168,115,26,0.55);"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    popupAnchor: [0, -12]
  });

  // Clear existing markers before re-fetching
  mapInstance.eachLayer(layer => {
    if (layer instanceof L.Marker) mapInstance.removeLayer(layer);
  });

  console.log('📡 Map Network: Fetching geocentric marker arrays from backend pool endpoint...');
  fetch(`${API}/clinics/locations`)
    .then(res => {
      console.log(`📡 Map Network response received status: ${res.status}`);
      return res.json();
    })
    .then(branches => {
      console.log(`✅ Map Network: [${branches.length}] locations parsed safely. Rendering pins onto tile map canvas.`);
      const validBranches = branches.filter(b => b.lat && b.lng);
      if (validBranches.length === 0) {
        console.warn('⚠️ Map: No approved clinic branches with coordinates found.');
        return;
      }

      const group = L.featureGroup();
      validBranches.forEach(b => {
        const expText = b.years_experience > 0
          ? `${b.years_experience} yr${b.years_experience !== 1 ? 's' : ''} experience`
          : 'Experience not listed';
        const popup = `
          <div class="leaflet-popup-content" style="margin:10px 14px;">
            <div class="iw-name">${esc(drName(b.full_name || b.name))}</div>
            <div class="iw-spec">🩺 ${esc(b.specialization || 'General Practice')}</div>
            <div class="iw-exp">⏱ ${esc(expText)}</div>
            <div class="iw-addr">📍 ${esc(b.address || '')}</div>
          </div>`;
        const marker = L.marker([parseFloat(b.lat), parseFloat(b.lng)], { icon: goldIcon })
          .addTo(mapInstance)
          .bindPopup(popup, { maxWidth: 240 });
        group.addLayer(marker);
      });
      if (validBranches.length > 1) {
        mapInstance.fitBounds(group.getBounds().pad(0.2));
      } else if (validBranches.length === 1) {
        mapInstance.setView([parseFloat(validBranches[0].lat), parseFloat(validBranches[0].lng)], 15);
      }
    })
    .catch(e => console.error('❌ Map Network Error:', e));
}

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
  console.log('🔔 Chime Engine: Simulating audio frequencies output context chime...');
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
  console.log(`🗣️ TTS Engine: Staging synthesis conversion vocal sequence for entry: #${num}`);
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
  console.log(`🖼️ Alert UI: Staging popup alert panel for Token: #${num} | Action Event Type: [${action}]`);
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

document.querySelectorAll('.nav-tab').forEach(btn=>{
  btn.addEventListener('click',()=>{
    const view=btn.dataset.view;
    if(!view) return; // buttons like "Display" handle their own onclick and don't switch views
    document.querySelectorAll('.nav-tab').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
    document.getElementById(view+'View').classList.add('active');
    if(view === 'map') setTimeout(initNetworkBranchesMap, 150);
    if(view === 'labreports') {
      if (labToken) showLabPanel(); else showLabLogin();
    }
  });
});

/* ── DOCTORS POPULATION GRID WITH DYNAMIC SEARCH FILTERING ── */
async function loadDoctors(){
  console.log('📡 Network Client: Requesting registered clinic doctor arrays schema map...');
  try{
    const res=await fetch(`${API}/clinic/data`);
    console.log(`📡 Network Client: Doctor lookup baseline route answered status: ${res.status}`);
    const data=await res.json();
    doctors=data.doctors||[];
    const savedDocId=parseInt(localStorage.getItem('pat_docId'))||null;
    if(savedDocId && doctors.find(d=>d.id===savedDocId)) selectedDocId=savedDocId;
    renderDoctorList(doctors, 'doctorListQ', 'queue');
    renderAptDoctorList(doctors);
    renderDocQrPanels();
    handleQRLanding();

    // (aptDoctorSelect is now a hidden input; value set by renderAptDoctorList clicks)
  }catch(e){console.error('❌ Network Client Error: Failed to gather structural doctor lists maps:', e);}
}

function renderDoctorList(docArray, containerId, ctx){
  const el=document.getElementById(containerId);
  if(!docArray.length){el.innerHTML='<div style="color:var(--muted);font-size:.85rem; padding: 0.5rem;">No matching doctors found.</div>';return;}
  el.innerHTML=docArray.map(d=>{
    const initials = esc(d.full_name).replace(/^Dr.\s+/i, '').substring(0, 2).toUpperCase();
    const onLeave = d.is_on_leave === 1 || d.is_on_leave === true;
    const disabledClass = onLeave ? ' disabled' : '';
    const leaveBadge = onLeave 
      ? '<div style="font-size:0.65rem;color:var(--amber);font-weight:700;margin-top:0.2rem;text-transform:uppercase;letter-spacing:0.04em;">🌴 Not Available Today</div>'
      : `<div class="doc-fee">₹${d.consultation_fee||0} / visit</div>`;
      
    return `
    <div class="doc-card ${selectedDocId===d.id?'selected':''}${disabledClass}" data-id="${d.id}" data-ctx="${ctx}" ${onLeave ? 'style="opacity:0.65; cursor:not-allowed;"' : ''}>
      <div class="doc-avatar-wrap">
        ${d.profile_photo_url 
          ? `<img src="${d.profile_photo_url}" class="doc-card-photo" alt="${esc(drName(d.full_name))}">`
          : `<div class="doc-card-initials">${initials}</div>`
        }
      </div>
      <div class="doc-details-wrap">
        <div class="doc-name">${esc(d.full_name)}</div>
        <div class="doc-spec">${esc(d.specialization||'')}</div>
        ${leaveBadge}
      </div>
      <button class="doc-id-btn" onclick="event.stopPropagation();showDoctorIdCard(${d.id})" title="View doctor profile"><em>i</em></button>
    </div>`;
  }).join('');
  el.querySelectorAll('.doc-card').forEach(card=>{
    if (card.classList.contains('disabled')) return;
    card.addEventListener('click',()=>{
      selectedDocId=parseInt(card.dataset.id); localStorage.setItem('pat_docId',selectedDocId);
      el.querySelectorAll('.doc-card').forEach(x=>x.classList.remove('selected'));
      card.classList.add('selected');
      console.log(`🖱️ Input Interaction: Patient selected doctor index node node ID: ${selectedDocId}`);
      loadQueue(); loadDoctorNotice(); checkAutoSubmit();
    });
  });
}

function showDoctorIdCard(docId) {
  const d = doctors.find(x => x.id === docId);
  if (!d) return;
  const initials = esc(d.full_name).replace(/^Dr\.\s+/i, '').substring(0, 2).toUpperCase();
  const onLeave = d.is_on_leave === 1 || d.is_on_leave === true;
  const photo = d.profile_photo_url;
  const exp = d.years_experience ? d.years_experience + ' yr' + (d.years_experience !== 1 ? 's' : '') + ' experience' : null;
  const qual = d.qualification || d.degree || null;
  const room = d.room_number ? 'Room ' + d.room_number : null;
  const bio  = d.bio || d.about || d.description || null;
  const lang = d.languages || null;
  const clinic = d.clinic_name || null;

  const overlay = document.createElement('div');
  overlay.id = 'docIdCardOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.55);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;padding:1rem;animation:fadeIn .2s ease;';
  overlay.onclick = function(e){ if(e.target===overlay) closeDoctorIdCard(); };

  overlay.innerHTML = `
    <div style="background:var(--bg-mid);border:1px solid var(--border);border-radius:22px;width:100%;max-width:380px;max-height:90vh;overflow-y:auto;box-shadow:0 24px 60px rgba(0,0,0,0.22);animation:modalIn .28s cubic-bezier(.34,1.56,.64,1);">
      <!-- Header band -->
      <div style="background:linear-gradient(135deg,var(--gold) 0%,var(--gold-lt) 100%);border-radius:22px 22px 0 0;padding:1.5rem 1.4rem 1.2rem;position:relative;">
        <button onclick="closeDoctorIdCard()" style="position:absolute;top:0.9rem;right:1rem;background:rgba(0,0,0,0.12);border:none;color:#1a1200;border-radius:50%;width:30px;height:30px;cursor:pointer;font-size:1rem;display:flex;align-items:center;justify-content:center;line-height:1;transition:background .18s;" onmouseover="this.style.background='rgba(0,0,0,0.22)'" onmouseout="this.style.background='rgba(0,0,0,0.12)'">✕</button>
        <div style="display:flex;align-items:center;gap:1rem;">
          <!-- Photo / Initials -->
          <div style="width:72px;height:72px;border-radius:50%;overflow:hidden;background:rgba(255,255,255,0.3);border:3px solid rgba(255,255,255,0.6);flex-shrink:0;display:flex;align-items:center;justify-content:center;">
            ${photo
              ? `<img src="${esc(photo)}" style="width:100%;height:100%;object-fit:cover;object-position:center top;" alt="${esc(drName(d.full_name))}">`
              : `<span style="font-size:1.6rem;font-weight:700;color:#1a1200;">${initials}</span>`
            }
          </div>
          <div style="flex:1;min-width:0;">
            <div style="font-family:'DM Serif Display',serif;font-size:1.15rem;color:#1a1200;font-weight:700;line-height:1.2;margin-bottom:0.2rem;">${esc(drName(d.full_name))}</div>
            ${d.specialization ? `<div style="font-size:0.78rem;color:rgba(26,18,0,0.7);font-weight:500;">${esc(d.specialization)}</div>` : ''}
            ${qual ? `<div style="font-size:0.72rem;color:rgba(26,18,0,0.6);margin-top:0.1rem;">${esc(qual)}</div>` : ''}
          </div>
        </div>
        ${onLeave ? `<div style="margin-top:0.85rem;background:rgba(0,0,0,0.12);border-radius:8px;padding:0.4rem 0.75rem;font-size:0.72rem;font-weight:700;color:#1a1200;display:inline-flex;align-items:center;gap:0.3rem;">🌴 Not Available Today</div>` : ''}
      </div>

      <!-- Body -->
      <div style="padding:1.25rem 1.4rem;">

        <!-- Info chips row -->
        <div style="display:flex;flex-wrap:wrap;gap:0.45rem;margin-bottom:1.1rem;">
          ${exp ? `<span style="display:inline-flex;align-items:center;gap:0.3rem;background:rgba(168,115,26,0.1);border:1px solid rgba(168,115,26,0.22);color:var(--gold);border-radius:20px;padding:0.28rem 0.75rem;font-size:0.72rem;font-weight:600;">🏆 ${esc(exp)}</span>` : ''}
          ${room ? `<span style="display:inline-flex;align-items:center;gap:0.3rem;background:rgba(12,99,228,0.08);border:1px solid rgba(12,99,228,0.18);color:var(--blue);border-radius:20px;padding:0.28rem 0.75rem;font-size:0.72rem;font-weight:600;">🚪 ${esc(room)}</span>` : ''}
          ${lang ? `<span style="display:inline-flex;align-items:center;gap:0.3rem;background:rgba(22,163,74,0.08);border:1px solid rgba(22,163,74,0.18);color:var(--green);border-radius:20px;padding:0.28rem 0.75rem;font-size:0.72rem;font-weight:600;">🗣️ ${esc(lang)}</span>` : ''}
          ${clinic ? `<span style="display:inline-flex;align-items:center;gap:0.3rem;background:var(--surface2);border:1px solid var(--border);color:var(--muted);border-radius:20px;padding:0.28rem 0.75rem;font-size:0.72rem;font-weight:600;">🏥 ${esc(clinic)}</span>` : ''}
        </div>

        <!-- Fee row -->
        <div style="display:flex;align-items:center;justify-content:space-between;background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:0.75rem 1rem;margin-bottom:1rem;">
          <div>
            <div style="font-size:0.63rem;text-transform:uppercase;letter-spacing:0.07em;color:var(--muted);font-weight:600;margin-bottom:0.15rem;">Consultation Fee</div>
            <div style="font-family:'JetBrains Mono',monospace;font-size:1.35rem;font-weight:700;color:var(--gold);">₹${d.consultation_fee || 0}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:0.63rem;text-transform:uppercase;letter-spacing:0.07em;color:var(--muted);font-weight:600;margin-bottom:0.15rem;">Status</div>
            <div style="display:inline-flex;align-items:center;gap:0.28rem;font-size:0.75rem;font-weight:700;color:${onLeave?'var(--amber)':'var(--green)'};">
              <span style="width:7px;height:7px;border-radius:50%;background:currentColor;display:inline-block;"></span>
              ${onLeave ? 'On Leave' : 'Available'}
            </div>
          </div>
        </div>

        ${bio ? `
        <!-- Bio -->
        <div style="margin-bottom:1rem;">
          <div style="font-size:0.63rem;text-transform:uppercase;letter-spacing:0.07em;color:var(--muted);font-weight:600;margin-bottom:0.4rem;">About</div>
          <div style="font-size:0.84rem;color:var(--text);line-height:1.6;">${esc(bio)}</div>
        </div>` : ''}

        <!-- CTA -->
        <button onclick="closeDoctorIdCard()" style="width:100%;padding:0.72rem;border-radius:12px;border:none;background:linear-gradient(135deg,var(--gold),var(--gold-lt));color:#1a1200;font-weight:700;font-size:0.9rem;cursor:pointer;font-family:inherit;transition:opacity .2s;" onmouseover="this.style.opacity='.88'" onmouseout="this.style.opacity='1'">Done</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);
}

function closeDoctorIdCard() {
  const el = document.getElementById('docIdCardOverlay');
  if (el) el.remove();
}

function loadDoctorNotice() {
  // Placeholder: load and display doctor-specific notices/announcements
}

function filterDoctors() {
  const query = document.getElementById('docSearch').value.toLowerCase().trim();
  const filtered = doctors.filter(d => 
    d.full_name.toLowerCase().includes(query) || 
    (d.specialization && d.specialization.toLowerCase().includes(query))
  );
  renderDoctorList(filtered, 'doctorListQ', 'queue');
}

let aptSelectedDocId = null;

function filterAptDoctors() {
  const query = (document.getElementById('aptDocSearch').value || '').toLowerCase().trim();
  const filtered = doctors.filter(d =>
    d.full_name.toLowerCase().includes(query) ||
    (d.specialization && d.specialization.toLowerCase().includes(query))
  );
  renderAptDoctorList(filtered);
}

function renderAptDoctorList(docArray) {
  const el = document.getElementById('aptDoctorGrid');
  if (!el) return;
  if (!docArray.length) {
    el.innerHTML = '<div style="color:var(--muted);font-size:.85rem;padding:0.5rem;">No matching doctors found.</div>';
    return;
  }
  el.innerHTML = docArray.map(d => {
    const initials = esc(d.full_name).replace(/^Dr.\s+/i,'').substring(0,2).toUpperCase();
    const onLeave = d.is_on_leave === 1 || d.is_on_leave === true;
    const isSelected = aptSelectedDocId === d.id;
    const leaveBadge = onLeave
      ? '<div style="font-size:0.65rem;color:var(--amber);font-weight:700;margin-top:0.2rem;text-transform:uppercase;letter-spacing:0.04em;">🌴 Not Available Today</div>'
      : `<div class="doc-fee">₹${d.consultation_fee||0} / visit</div>`;
    return `<div class="doc-card ${isSelected?'selected':''}" data-id="${d.id}" data-ctx="apt" ${onLeave?'style="opacity:0.65;cursor:not-allowed;"':''}>
      <div class="doc-avatar-wrap">
        ${d.profile_photo_url
          ? `<img src="${d.profile_photo_url}" class="doc-card-photo" alt="${esc(drName(d.full_name))}">`
          : `<div class="doc-card-initials">${initials}</div>`}
      </div>
      <div class="doc-details-wrap">
        <div class="doc-name">${esc(d.full_name)}</div>
        <div class="doc-spec">${esc(d.specialization||'')}</div>
        ${leaveBadge}
      </div>
      <button class="doc-id-btn" onclick="event.stopPropagation();showDoctorIdCard(${d.id})" title="View doctor profile"><em>i</em></button>
    </div>`;
  }).join('');
  el.querySelectorAll('.doc-card').forEach(card => {
    const onLeave = card.style.cursor === 'not-allowed';
    if (onLeave) return;
    card.addEventListener('click', () => {
      aptSelectedDocId = parseInt(card.dataset.id);
      document.getElementById('aptDoctorSelect').value = aptSelectedDocId;
      el.querySelectorAll('.doc-card').forEach(x => x.classList.remove('selected'));
      card.classList.add('selected');
      const doc = doctors.find(d => d.id === aptSelectedDocId);
      const nameEl = document.getElementById('aptDocSelectedName');
      const selCard = document.getElementById('aptDocSelectedCard');
      if (nameEl) nameEl.textContent = doc ? drName(doc.full_name) + ' \u2014 ' + (doc.specialization||'') : 'Doctor selected';
      if (selCard) selCard.style.display = 'block';
      // Pre-fill dropdown with default slots immediately so patient isn't blocked
      const aptTimeEl = document.getElementById('aptTime');
      if (aptTimeEl && aptTimeEl.options.length <= 1) {
        const defSlots = _genPatientSlots('09:00','13:00',30).concat(_genPatientSlots('17:00','20:00',30));
        aptTimeEl.innerHTML = '<option value="">Select a time slot\u2026</option>' +
          defSlots.map(function(s){ return '<option value="'+s+'">'+s+'</option>'; }).join('');
      }
      checkDoctorLeaveOnDate();
      showDoctorAvailability(aptSelectedDocId);
    });
  });
}

/* ── Doctor availability display (patient side) ── */
const DAYS_NAMES_FULL = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];

function _getDoctorLocalAvail(docId) {
  try { return JSON.parse(localStorage.getItem('avail_' + docId) || 'null'); } catch(e) { return null; }
}

// Default availability used when doctor hasn't configured a schedule yet
const DEFAULT_AVAIL = {
  days: [0,1,2,3,4], slotStart: '09:00', slotEnd: '13:00', duration: 30,
  evening: true, eveStart: '17:00', eveEnd: '20:00'
};

function showDoctorAvailability(docId) {
  const panel = document.getElementById('aptDocAvailPanel');
  const daysEl = document.getElementById('aptDocAvailDays');
  const slotsEl = document.getElementById('aptDocAvailSlots');
  const slotPills = document.getElementById('aptDocSlotPills');
  if (!panel) return;

  fetch(`${API}/doctor-availability?doctor_id=${docId}`)
    .then(r => r.ok ? r.json() : null)
    .catch(() => null)
    .then(data => {
      // Always fall back so the dropdown is never empty
      const avail = (data && !data.error && data.days) ? data
                  : (_getDoctorLocalAvail(docId) || DEFAULT_AVAIL);

      panel.style.display = 'block';

      // Day chips
      const activeDays = avail.days || [0,1,2,3,4];
      daysEl.innerHTML = DAYS_NAMES_FULL.map((name, i) => {
        const ok = activeDays.includes(i);
        return '<span style="display:inline-flex;align-items:center;gap:0.25rem;padding:0.28rem 0.65rem;border-radius:10px;font-size:0.75rem;font-weight:600;' +
          'background:' + (ok ? 'rgba(22,163,74,0.1)' : 'var(--surface2)') + ';' +
          'border:1.5px solid ' + (ok ? 'rgba(22,163,74,0.35)' : 'var(--border)') + ';' +
          'color:' + (ok ? 'var(--green)' : 'var(--muted)') + ';">' +
          (ok ? '✓' : '✗') + ' ' + name + '</span>';
      }).join('');

      // Generate slots — always use defaults if fields missing
      const dur = avail.duration || 30;
      let slots = _genPatientSlots(avail.slotStart || '09:00', avail.slotEnd || '13:00', dur);
      if (avail.evening && avail.eveStart && avail.eveEnd) {
        slots = slots.concat(_genPatientSlots(avail.eveStart, avail.eveEnd, dur));
      }

      // Clickable slot pills
      slotPills.innerHTML = slots.map(function(s) {
        return '<span style="padding:0.22rem 0.6rem;border-radius:8px;font-size:0.72rem;font-weight:600;' +
          'background:var(--surface2);border:1px solid var(--border);color:var(--muted);' +
          'font-family:\'JetBrains Mono\',monospace;cursor:pointer;transition:all .18s;"' +
          ' onclick="selectTimeSlot(\'' + s + '\')"' +
          ' onmouseover="this.style.borderColor=\'var(--gold)\';this.style.color=\'var(--gold)\'"' +
          ' onmouseout="this.style.borderColor=\'var(--border)\';this.style.color=\'var(--muted)\'">' + s + '</span>';
      }).join('');
      slotsEl.style.display = 'block';

      // Always populate the <select> dropdown
      const aptTimeEl = document.getElementById('aptTime');
      if (aptTimeEl) {
        aptTimeEl.innerHTML = '<option value="">Select a time slot\u2026</option>' +
          slots.map(function(s) { return '<option value="' + s + '">' + s + '</option>'; }).join('');
      }

      window._currentDocAvail = avail;
    });
}

function _genPatientSlots(start, end, dur) {
  const slots = [];
  if (!start || !end) return slots;
  let [sh, sm] = start.split(':').map(Number);
  let [eh, em] = end.split(':').map(Number);
  let cur = sh * 60 + sm;
  const endMin = eh * 60 + em;
  while (cur + dur <= endMin) {
    const h = Math.floor(cur / 60), m = cur % 60;
    slots.push((h < 10 ? '0' + h : h) + ':' + (m < 10 ? '0' + m : m));
    cur += dur;
  }
  return slots;
}

function selectTimeSlot(time) {
  const sel = document.getElementById('aptTime');
  if (sel) sel.value = time;
}

function checkDateAvailability() {
  const dateVal = (document.getElementById('aptDate') || {}).value;
  const unavailEl = document.getElementById('aptDateUnavail');
  if (!dateVal || !unavailEl) return;
  const avail = window._currentDocAvail;
  if (!avail || !avail.days) { unavailEl.style.display = 'none'; return; }
  // JS getDay: 0=Sun,1=Mon,...6=Sat — convert to Mon=0..Sun=6
  const jsDay = new Date(dateVal + 'T12:00:00').getDay();
  const normalised = jsDay === 0 ? 6 : jsDay - 1;
  const isAvail = avail.days.includes(normalised);
  unavailEl.style.display = isAvail ? 'none' : 'block';
}

/* ── My appointments status lookup ── */
function showMyAppointments() {
  const card = document.getElementById('myAppointmentsCard');
  if (card) {
    card.style.display = 'block';
    card.scrollIntoView({ behavior: 'smooth' });
    const mob = document.getElementById('aptMobile');
    const myMob = document.getElementById('myApptMobile');
    if (mob && myMob && mob.value) myMob.value = mob.value;
    loadMyAppointments();
  }
}

async function loadMyAppointments() {
  const mobile = (document.getElementById('myApptMobile') || {}).value || '';
  const listEl = document.getElementById('myAppointmentsList');
  if (!listEl) return;
  if (!mobile || mobile.length < 10) {
    listEl.innerHTML = '<div style="text-align:center;padding:1.5rem;color:var(--muted);font-size:0.85rem;">Enter your 10-digit mobile number to view appointments.</div>';
    return;
  }
  listEl.innerHTML = '<div style="text-align:center;padding:1.5rem;color:var(--muted);font-size:0.85rem;">Loading…</div>';
  try {
    const r = await fetch(`${API}/appointments?contact=${mobile}`);
    if (!r.ok) throw new Error('Could not load appointments');
    const data = await r.json();
    const myAppts = Array.isArray(data) ? data.filter(a => (a.patient_contact || '').replace(/\D/g,'') === mobile.replace(/\D/g,'')) : [];
    if (!myAppts.length) {
      listEl.innerHTML = '<div style="text-align:center;padding:1.5rem;color:var(--muted);font-size:0.85rem;">No appointments found for this number.</div>';
      return;
    }
    const statusColors = { pending: '#d97706', approved: '#16a34a', rejected: '#dc2626', completed: '#1d6fa4' };
    const statusEmoji = { pending: '⏳', approved: '✅', rejected: '❌', completed: '🏁' };
    listEl.innerHTML = myAppts.map(a => {
      const dateStr = new Date(a.appointment_date).toLocaleDateString('en-IN', { weekday:'short', day:'2-digit', month:'short', year:'numeric' });
      const timeStr = (a.appointment_time || '').substring(0, 5);
      const color = statusColors[a.status] || 'var(--muted)';
      const emoji = statusEmoji[a.status] || '📋';
      return `<div style="padding:0.85rem;background:var(--surface2);border:1px solid var(--border);border-left:3px solid ${color};border-radius:10px;margin-bottom:0.6rem;">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:0.5rem;flex-wrap:wrap;">
          <div>
            <div style="font-weight:700;font-size:0.9rem;margin-bottom:0.15rem;">${esc(drName(a.doctor_name || a.doctor_id))}</div>
            <div style="font-size:0.78rem;color:var(--muted);">📅 ${dateStr} at ${timeStr}</div>
            ${a.notes ? `<div style="font-size:0.75rem;color:var(--muted);margin-top:0.2rem;">💬 ${esc(a.notes)}</div>` : ''}
          </div>
          <span style="display:inline-flex;align-items:center;gap:0.28rem;padding:0.25rem 0.7rem;border-radius:12px;font-size:0.72rem;font-weight:700;background:${color}18;color:${color};border:1px solid ${color}44;white-space:nowrap;">${emoji} ${(a.status||'pending').toUpperCase()}</span>
        </div>
        ${a.status === 'approved' ? `<div style="margin-top:0.5rem;font-size:0.75rem;font-weight:600;color:var(--green);">✅ Appointment confirmed! Token #${a.token_number||'—'}</div>` : ''}
        ${a.status === 'rejected' ? `<div style="margin-top:0.5rem;font-size:0.75rem;font-weight:600;color:var(--red);">❌ Appointment declined. Please call the clinic to reschedule.</div>` : ''}
      </div>`;
    }).join('');
  } catch(e) {
    listEl.innerHTML = `<div style="text-align:center;padding:1.5rem;color:var(--red);font-size:0.85rem;">${esc(e.message)}</div>`;
  }
}

/* ── Appointment Lab Report Upload Handlers ── */
let aptLabSelectedFile = null;
function aptLabDragOver(e) {
  e.preventDefault();
  document.getElementById('aptLabDropZone').style.borderColor = 'var(--gold)';
  document.getElementById('aptLabDropZone').style.background = 'var(--gold-glow)';
}
function aptLabDragLeave(e) {
  e.preventDefault();
  document.getElementById('aptLabDropZone').style.borderColor = 'var(--border)';
  document.getElementById('aptLabDropZone').style.background = 'var(--surface2)';
}
function aptLabDrop(e) {
  e.preventDefault();
  document.getElementById('aptLabDropZone').style.borderColor = 'var(--border)';
  document.getElementById('aptLabDropZone').style.background = 'var(--surface2)';
  if (e.dataTransfer.files && e.dataTransfer.files.length) aptLabHandleFile(e.dataTransfer.files[0]);
}
function aptLabFileSelected(e) {
  if (e.target.files && e.target.files.length) aptLabHandleFile(e.target.files[0]);
}
function aptLabHandleFile(file) {
  const allowed = ['.pdf','.jpg','.jpeg','.png','.dcm'];
  const ext = '.' + file.name.split('.').pop().toLowerCase();
  if (!allowed.includes(ext)) { showToast('Only PDF, JPG, PNG, or DICOM files are allowed', true); return; }
  if (file.size > 10*1024*1024) { showToast('Maximum file size is 10 MB', true); return; }
  aptLabSelectedFile = file;
  document.getElementById('aptLabChipName').textContent = file.name;
  document.getElementById('aptLabChipSize').textContent = (file.size/(1024*1024)).toFixed(2)+' MB';
  document.getElementById('aptLabChipIcon').textContent = ext==='.pdf'?'📕':ext==='.dcm'?'🩻':'🖼️';
  document.getElementById('aptLabFileChip').style.display = 'flex';
}
function aptLabClear(e) {
  if (e) e.stopPropagation();
  aptLabSelectedFile = null;
  document.getElementById('aptLabFileInput').value = '';
  document.getElementById('aptLabFileChip').style.display = 'none';
}

let _lanBaseUrl = window.location.origin;
(async function initLanInfo() {
  try {
    const res = await fetch('/api/public/server-info');
    if (res.ok) {
      const data = await res.json();
      if (data.baseUrl) _lanBaseUrl = data.baseUrl;
    }
  } catch(e) {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      _lanBaseUrl = `http://10.32.2.59:${window.location.port || '8085'}`;
    }
  }
})();

function qrUrl(docId){
  const base = (_lanBaseUrl && (_lanBaseUrl.startsWith('http://192.') || _lanBaseUrl.startsWith('http://10.') || _lanBaseUrl.startsWith('http://172.'))) 
    ? _lanBaseUrl 
    : ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? `http://10.32.2.59:${window.location.port || '8085'}` : window.location.origin);
  return `${base}${window.location.pathname}?doc=${docId}&join=1`;
}

function renderDocQrPanels(){
  const grid = document.getElementById('docQrGrid');
  if(!doctors.length){grid.innerHTML='<div style="color:var(--muted);padding:1rem">No doctors listed.</div>';return;}
  grid.innerHTML = doctors.map(d => `
    <div class="doc-qr-panel">
      <div class="doc-qr-qrbox" id="pqr_${d.id}"></div>
      <div class="doc-qr-name">${esc(drName(d.full_name))}</div>
      <div class="doc-qr-spec">${esc(d.specialization||'')}</div>
      <div class="doc-qr-fee">&#8377;${d.consultation_fee||0} per visit</div>
      <div class="doc-qr-actions">
        <button class="doc-qr-btn" onclick="copyLink('${qrUrl(d.id)}')">&#128203; Copy Link</button>
        <button class="doc-qr-btn primary" onclick="joinFromPanel(${d.id})">&#127923; Join Queue</button>
      </div>
    </div>`).join('');
  requestAnimationFrame(()=>{
    doctors.forEach(d=>{
      const el = document.getElementById(`pqr_${d.id}`); if(!el) return;
      new QRCode(el, { text: qrUrl(d.id), width:160, height:160, colorDark:'#1a2535', colorLight:'#ffffff', correctLevel: QRCode.CorrectLevel.H });
    });
  });
}

function joinFromPanel(docId){
  document.querySelectorAll('.nav-tab').forEach(b=>b.classList.remove('active'));
  document.querySelector('[data-view="queue"]').classList.add('active');
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.getElementById('queueView').classList.add('active');
  selectedDocId = docId; localStorage.setItem('pat_docId', docId);
  filterDoctors();
  document.querySelectorAll('#doctorListQ .doc-card').forEach(c=>{ c.classList.toggle('selected', parseInt(c.dataset.id)===docId); });
  showToast(`${esc(drName((doctors.find(d=>d.id===docId)||{}).full_name||''))} selected!`);
  loadQueue(); checkAutoSubmit();
}

function copyLink(url){ navigator.clipboard.writeText(url).then(()=>showToast('Link copied!')).catch(()=>showToast('Copy failed',true)); }

/* ── INSTANT SCAN DETECTION PROFILE VECTOR PASSTHROUGH ENGINE ── */
function handleQRLanding(){
  const p=new URLSearchParams(window.location.search);
  const docId=parseInt(p.get('doc'));
  const join=p.get('join');
  if(!docId||join!=='1') return;
  console.log(`📱 Link Landing: Patient hyperlinked into isolated doctor vector tracking ID path: ${docId}`);
  selectedDocId=docId;
  localStorage.setItem('pat_docId', docId);
  document.querySelectorAll('#doctorListQ .doc-card').forEach(c=>{ c.classList.toggle('selected', parseInt(c.dataset.id)===docId); });

  const savedToken=localStorage.getItem('pat_token');
  if(savedToken && localStorage.getItem('pat_docId') == docId){ 
    showToast(`Welcome back! Your token is #${savedToken}`); 
    loadQueue(); return; 
  }
  const savedName = localStorage.getItem('pat_name');
  if (savedName) {
    console.log('🤖 Auto-Engine: Local profile data cache discovered. Initiating instant token dispatch loop parameters fields...');
    showToast('Profile parsed! Auto-generating queue token data...');
    generateToken(); return;
  }
  showToast('Doctor linked! Fill details to complete auto-generation pipeline.');
  loadQueue();
}

function loadSavedPatient(){
  const name=localStorage.getItem('pat_name'); const token=localStorage.getItem('pat_token');
  if(!name||!token) return;
  myToken=parseInt(token);
  document.getElementById('patientName').value=name;
  document.getElementById('patientAge').value=localStorage.getItem('pat_age')||'';
  document.getElementById('patientMobile').value=localStorage.getItem('pat_mobile')||'';
  document.getElementById('patientGender').value=localStorage.getItem('pat_gender')||'';
  document.getElementById('patientTokenDisplay').textContent=myToken;
  const pill=document.getElementById('savedPatientInfo'); pill.classList.add('show');
  document.getElementById('savedName').textContent=name;
  document.getElementById('savedDetails').textContent=`${localStorage.getItem('pat_age')||''} yrs · ${localStorage.getItem('pat_gender')||''} · 📞 ${localStorage.getItem('pat_mobile')||'—'}`;
}

async function generateToken(){
  if (isAutoGenerating) return;
  const name=document.getElementById('patientName').value.trim();
  const age=document.getElementById('patientAge').value;
  const mobile=document.getElementById('patientMobile').value.trim();
  const gender=document.getElementById('patientGender').value;
  if(!selectedDocId || !name || !age || age<0 || age>120 || mobile.length<10 || !gender) return;
  
  console.log(`🎫 Action: Triggering outbound token dispatch post query sequence vector targeting Doctor ID: ${selectedDocId}`);
  isAutoGenerating = true;
  const btn=document.getElementById('getTokenBtn');
  btn.disabled=true; btn.textContent='⏳ Appending tracking metrics…';
  try{
    let fileData = null, fileName = null, fileSize = null, fileType = null;
    if (tokenLabSelectedFile) {
      fileName = tokenLabSelectedFile.name;
      fileSize = tokenLabSelectedFile.size;
      fileType = tokenLabSelectedFile.type;
      fileData = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Failed to read file attachment'));
        reader.readAsDataURL(tokenLabSelectedFile);
      });
    }

    const res=await fetch(`${API}/queue/token`,{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        name,
        age:parseInt(age),
        contact:mobile,
        gender,
        doctorId:selectedDocId,
        fileData,
        fileName,
        fileSize,
        fileType
      })
    });
    console.log(`📡 Token Endpoint answered status code: ${res.status}`);
    const data=await res.json();
    if(!res.ok) throw new Error(data.error||'Failed');
    myToken=data.token;
    localStorage.setItem('pat_name',name); localStorage.setItem('pat_age',age);
    localStorage.setItem('pat_mobile',mobile); localStorage.setItem('pat_gender',gender);
    localStorage.setItem('pat_token',myToken); localStorage.setItem('pat_docId',selectedDocId);
    document.getElementById('patientTokenDisplay').textContent=myToken;
    const pill=document.getElementById('savedPatientInfo'); pill.classList.add('show');
    document.getElementById('savedName').textContent=name;
    document.getElementById('savedDetails').textContent=`${age} yrs · ${gender} · 📞 ${mobile}`;
    
    // Clear attachment chip and selection
    tokenLabClear();
    
    await playChime(); showToast(`🎫 Token #${myToken} generated successfully!`);
    loadQueue();
  }catch(e){ console.error('❌ Token Generation critical front-end error path encountered:', e); showToast('Error: '+e.message,true); }
  finally{btn.disabled=false; btn.textContent='🎫 Get My Token Number'; isAutoGenerating = false;}
}
document.getElementById('getTokenBtn').addEventListener('click',generateToken);

function checkAutoSubmit() {
  if (myToken) return;
  const name=document.getElementById('patientName').value.trim();
  const age=document.getElementById('patientAge').value;
  const mobile=document.getElementById('patientMobile').value.trim();
  const gender=document.getElementById('patientGender').value;
  if (selectedDocId && name.length >= 2 && age > 0 && mobile.length === 10 && gender) {
    console.log('🤖 Auto-Engine: Structural valid parameter threshold met! Initiating touchless registration auto-submit workflow loops.');
    generateToken();
  }
}
['patientName', 'patientAge', 'patientMobile', 'patientGender'].forEach(id => {
  document.getElementById(id).addEventListener('input', checkAutoSubmit);
  document.getElementById(id).addEventListener('change', checkAutoSubmit);
});

/* ── ISOLATED LIVE INTERCEPT POLL POINTER ── */
async function loadQueue(){
  if (!selectedDocId) return;
  try{
    const res=await fetch(`${API}/queue/state?doctorId=${selectedDocId}`);
    const data=await res.json();
    const cur=data.current_number||0;
    const serverActionTs=data.action_ts||0;
    
    if (serverActionTs !== 0 && serverActionTs > lastActionTs) {
      if (lastActionTs !== 0) { 
        console.log(`🔔 Event Stream: Discovered incoming timeline event trigger block [${data.last_action}]. Advancing queue view indices safely.`);
        playChime(); showCallAlert(cur, data.last_action); speakNumber(cur); 
      }
      lastActionTs = serverActionTs; lastKnown = cur;
    } else if (lastActionTs === 0) {
      lastActionTs = serverActionTs; lastKnown = cur;
    }
    
    document.getElementById('nowServing').textContent=cur||'—';
    
    if(myToken && parseInt(localStorage.getItem('pat_docId')) === selectedDocId){
      const ahead=Math.max(0,myToken-cur-1);
      document.getElementById('aheadCount').textContent=ahead;
      const st=document.getElementById('patientStatus');
      if(myToken<=cur){
        st.textContent='✅ Your turn! Please proceed to the room.'; st.className='token-status ok';
      } else if(ahead===0){
        st.textContent='⏭️ You are next up! Please remain ready.'; st.className='token-status warn';
      } else {
        st.textContent=`${ahead} ${ahead===1?'person':'people'} ahead of you`; st.className='token-status';
      }
    } else { document.getElementById('aheadCount').textContent='—'; }
  }catch(e){console.error(e);}
}

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
    setNoticeTicker('noticeTextAdmin', adminText, 'noticeTsAdmin', adminTs);
  } catch(e) { console.error(e); }

  let docText = '';
  if (selectedDocId) {
    try {
      const res = await fetch(`${API}/notice/get?doctorId=${selectedDocId}`);
      const data = await res.json();
      docText = data.data?.text || '';
      const docTs = data.data?.updated_at ? new Date(data.data.updated_at).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'}) : '';
      const docAreaEl = document.getElementById('noticeAreaDoctor');
      if (!docText) {
        if (docAreaEl) docAreaEl.style.display = 'none';
      } else {
        if (docAreaEl) docAreaEl.style.display = '';
        const nameEl = document.getElementById('doctorNoticeName');
        if (nameEl) {
          const doc = doctors.find(d => d.id === selectedDocId);
          nameEl.textContent = doc ? `${drName(doc.full_name)}` : 'Doctor';
        }
        setNoticeTicker('noticeText', docText, 'noticeTs', docTs);
      }
    } catch(e) { console.error(e); }
  } else {
    const docAreaEl = document.getElementById('noticeAreaDoctor');
    if (docAreaEl) docAreaEl.style.display = 'none';
  }
}

function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

/** Returns the name prefixed with "Dr." only if it doesn't already start with Dr/dr */
function drName(name){ return /^dr[\.\s]/i.test(String(name).trim()) ? String(name).trim() : 'Dr. ' + String(name).trim(); }

loadDoctors(); loadSavedPatient(); loadQueue(); loadNotice(); handleQRLanding();
setInterval(loadQueue, 1000); setInterval(loadNotice, 15000);

/* ─────────────────────────────────────────────
   APPOINTMENT BOOKING HELPERS
───────────────────────────────────────────── */
async function checkDoctorLeaveOnDate() {
  const docId = document.getElementById('aptDoctorSelect').value;
  const dateVal = document.getElementById('aptDate').value;
  const warnEl = document.getElementById('aptLeaveWarning');
  const bookBtn = document.getElementById('bookAptBtn');
  if (!docId || !dateVal || !warnEl || !bookBtn) return;

  try {
    const chosenDate = new Date(dateVal);
    const today = new Date();
    const isToday = chosenDate.toDateString() === today.toDateString();
    
    const doc = doctors.find(x => x.id == docId);
    if (isToday && doc && doc.is_on_leave) {
      warnEl.style.display = 'block';
      bookBtn.disabled = true;
    } else {
      warnEl.style.display = 'none';
      bookBtn.disabled = false;
    }
  } catch (e) {
    console.error('[checkDoctorLeaveOnDate]', e);
  }
}

async function bookAppointment() {
  const name = document.getElementById('aptName').value.trim();
  const age = document.getElementById('aptAge').value;
  const mobile = document.getElementById('aptMobile').value.trim();
  const gender = document.getElementById('aptGender').value;
  const email = document.getElementById('aptEmail').value.trim();
  const docId = document.getElementById('aptDoctorSelect').value;
  const dateVal = document.getElementById('aptDate').value;
  const timeVal = document.getElementById('aptTime').value;
  const notes = document.getElementById('aptNotes').value.trim();

  const warnEl = document.getElementById('aptLeaveWarning');
  const successEl = document.getElementById('aptSuccessDetails');
  const btn = document.getElementById('bookAptBtn');

  if (!name || !age || !mobile || !gender || !docId || !dateVal || !timeVal) {
    showToast('Please fill in all required fields (*)', true);
    return;
  }
  if (mobile.length < 10) {
    showToast('Please enter a valid 10-digit mobile number', true);
    return;
  }

  warnEl.style.display = 'none';
  successEl.style.display = 'none';
  btn.disabled = true;
  btn.textContent = '⏳ Booking Appointment…';

  try {
    // Read optional lab file
    let labFileData = null, labFileName = null, labFileType = null;
    if (aptLabSelectedFile) {
      labFileName = aptLabSelectedFile.name;
      labFileType = aptLabSelectedFile.type;
      labFileData = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Failed to read lab file'));
        reader.readAsDataURL(aptLabSelectedFile);
      });
    }

    const r = await fetch(API + '/public/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name,
        age: parseInt(age),
        gender: gender,
        contact: mobile,
        email: email,
        doctor_id: parseInt(docId),
        appointment_date: dateVal,
        appointment_time: timeVal,
        notes: notes,
        lab_report_type: document.getElementById('aptLabReportType').value || null,
        lab_report_date: document.getElementById('aptLabReportDate').value || null,
        lab_name: document.getElementById('aptLabName').value.trim() || null,
        lab_file_data: labFileData,
        lab_file_name: labFileName,
        lab_file_type: labFileType
      })
    });
    const d = await r.json();
    if (!r.ok) {
      if (d.error && d.error.includes('leave')) {
        warnEl.style.display = 'block';
        showToast('Doctor is on leave', true);
      } else {
        showToast(d.error || 'Failed to book appointment', true);
      }
      return;
    }

    document.getElementById('aptResPatientId').textContent = d.patient_id || '—';
    document.getElementById('aptResToken').textContent = '#' + (d.token_id || '—');
    
    const doc = doctors.find(x => x.id == docId);
    const docName = doc ? doc.full_name : 'Doctor';
    document.getElementById('aptResDateTime').textContent = `${dateVal} at ${timeVal} (${drName(docName)})`;
    
    successEl.style.display = 'block';
    showToast('Appointment booked successfully! 🎉');
    
    // Clear all fields
    ['aptName','aptAge','aptMobile','aptEmail','aptDate','aptTime','aptNotes',
     'aptLabReportType','aptLabReportDate','aptLabName'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    document.getElementById('aptGender').value = '';
    document.getElementById('aptDoctorSelect').value = '';
    aptSelectedDocId = null;
    aptLabSelectedFile = null;
    document.getElementById('aptLabFileChip').style.display = 'none';
    document.getElementById('aptLabFileInput').value = '';
    document.getElementById('aptDocSelectedCard').style.display = 'none';
    renderAptDoctorList(doctors);
  } catch (e) {
    showToast(e.message, true);
  } finally {
    btn.disabled = false;
    btn.textContent = '📅 Book Appointment';
  }
}

window.bookAppointment = bookAppointment;
window.checkDoctorLeaveOnDate = checkDoctorLeaveOnDate;

/* ══════════════════════════════════════════════
   LAB REPORTS MODULE
══════════════════════════════════════════════ */
let labToken = null;
let labSelectedFile = null;

function showLabLogin() {
  document.getElementById('labLoginPrompt').style.display = '';
  document.getElementById('labPanel').style.display = 'none';
}
function showLabPanel() {
  document.getElementById('labLoginPrompt').style.display = 'none';
  document.getElementById('labPanel').style.display = '';
  loadLabReports();
}

/* ── Auth ── */
async function labLogin() {
  const uid = document.getElementById('labPatientId').value.trim();
  const mob = document.getElementById('labMobile').value.trim();
  if (!uid || !mob) { showToast('Please enter your Patient ID and mobile number', true); return; }
  const btn = document.getElementById('labLoginBtn');
  btn.disabled = true; btn.textContent = 'Signing in…';
  try {
    const res = await fetch(`${API}/auth/patient/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unique_id: uid, contact: mob })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    labToken = data.token;
    const p = data.patient;
    document.getElementById('labWelcomeName').textContent = p.full_name || 'Patient';
    document.getElementById('labWelcomeId').textContent = `ID: ${p.unique_id || uid}`;
    // pre-fill today's date
    document.getElementById('labReportDate').value = new Date().toISOString().split('T')[0];
    showLabPanel();
    showToast('Signed in successfully');
  } catch (err) {
    showToast(err.message, true);
  } finally {
    btn.disabled = false; btn.textContent = '🔑 Sign In';
  }
}

function labLogout() {
  labToken = null; labSelectedFile = null;
  document.getElementById('labPatientId').value = '';
  document.getElementById('labMobile').value = '';
  labClearFile();
  showLabLogin();
  showToast('Signed out');
}

/* ── File selection ── */
function labDragOver(e) {
  e.preventDefault();
  document.getElementById('labDropZone').style.borderColor = 'var(--gold)';
  document.getElementById('labDropZone').style.background = 'var(--gold-glow)';
}
function labDragLeave(e) {
  document.getElementById('labDropZone').style.borderColor = 'var(--border)';
  document.getElementById('labDropZone').style.background = 'var(--surface2)';
}
function labDrop(e) {
  e.preventDefault();
  labDragLeave(e);
  const file = e.dataTransfer.files[0];
  if (file) labSetFile(file);
}
function labFileSelected(e) {
  const file = e.target.files[0];
  if (file) labSetFile(file);
}
function labSetFile(file) {
  const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
  const maxSize = 10 * 1024 * 1024;
  if (!allowed.includes(file.type) && !file.name.endsWith('.dcm')) {
    showToast('Only PDF, JPG, PNG, or DICOM files are allowed', true); return;
  }
  if (file.size > maxSize) { showToast('File must be under 10 MB', true); return; }
  labSelectedFile = file;
  const icon = file.type === 'application/pdf' ? '📕' : file.name.endsWith('.dcm') ? '🩻' : '🖼️';
  document.getElementById('labFileIcon').textContent = icon;
  document.getElementById('labFileName').textContent = file.name;
  document.getElementById('labFileSize').textContent = (file.size / 1024).toFixed(1) + ' KB';
  document.getElementById('labFilePreview').style.display = 'flex';
  document.getElementById('labDropZone').style.display = 'none';
}
function labClearFile() {
  labSelectedFile = null;
  document.getElementById('labFileInput').value = '';
  document.getElementById('labFilePreview').style.display = 'none';
  document.getElementById('labDropZone').style.display = '';
  document.getElementById('labProgressWrap').style.display = 'none';
}

/* ── Upload ── */
async function labUpload() {
  if (!labSelectedFile) { showToast('Please select a file first', true); return; }
  const reportType = document.getElementById('labReportType').value;
  if (!reportType) { showToast('Please select a report type', true); return; }

  const formData = new FormData();
  formData.append('report', labSelectedFile);
  formData.append('report_type', reportType);
  formData.append('report_date', document.getElementById('labReportDate').value);
  formData.append('lab_name', document.getElementById('labLabName').value.trim());
  formData.append('notes', document.getElementById('labNotes').value.trim());

  const btn = document.getElementById('labUploadBtn');
  btn.disabled = true; btn.textContent = 'Uploading…';
  const progressWrap = document.getElementById('labProgressWrap');
  const progressBar = document.getElementById('labProgressBar');
  const progressLabel = document.getElementById('labProgressLabel');
  progressWrap.style.display = '';
  progressBar.style.width = '0%';

  try {
    await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API}/lab-reports/upload`);
      xhr.setRequestHeader('Authorization', `Bearer ${labToken}`);
      xhr.upload.onprogress = e => {
        if (e.lengthComputable) {
          const pct = Math.round((e.loaded / e.total) * 100);
          progressBar.style.width = pct + '%';
          progressLabel.textContent = pct + '%';
        }
      };
      xhr.onload = () => {
        if (xhr.status === 401) {
          labLogout();
          reject(new Error('Session expired. Please sign in again.'));
        } else if (xhr.status >= 200 && xhr.status < 300) {
          resolve(JSON.parse(xhr.responseText));
        } else {
          reject(new Error(JSON.parse(xhr.responseText).error || 'Upload failed'));
        }
      };
      xhr.onerror = () => reject(new Error('Network error'));
      xhr.send(formData);
    });

    showToast('Report uploaded successfully! 🎉');
    labClearFile();
    document.getElementById('labReportType').value = '';
    document.getElementById('labLabName').value = '';
    document.getElementById('labNotes').value = '';
    document.getElementById('labReportDate').value = new Date().toISOString().split('T')[0];
    loadLabReports();
  } catch (err) {
    showToast(err.message, true);
    progressWrap.style.display = 'none';
  } finally {
    btn.disabled = false; btn.textContent = '📤 Upload Report';
  }
}

/* ── Token lab uploader helpers ── */
function tokenLabDragOver(e) {
  e.preventDefault();
  document.getElementById('tokenLabDropZone').style.borderColor = 'var(--gold)';
  document.getElementById('tokenLabDropZone').style.background = 'var(--gold-glow)';
}
function tokenLabDragLeave(e) {
  e.preventDefault();
  document.getElementById('tokenLabDropZone').style.borderColor = 'var(--border)';
  document.getElementById('tokenLabDropZone').style.background = 'var(--surface2)';
}
function tokenLabDrop(e) {
  e.preventDefault();
  document.getElementById('tokenLabDropZone').style.borderColor = 'var(--border)';
  document.getElementById('tokenLabDropZone').style.background = 'var(--surface2)';
  if (e.dataTransfer.files && e.dataTransfer.files.length) {
    tokenLabHandleFile(e.dataTransfer.files[0]);
  }
}
function tokenLabFileSelected(e) {
  if (e.target.files && e.target.files.length) {
    tokenLabHandleFile(e.target.files[0]);
  }
}
function tokenLabHandleFile(file) {
  const allowed = ['.pdf', '.jpg', '.jpeg', '.png', '.dcm'];
  const ext = '.' + file.name.split('.').pop().toLowerCase();
  if (!allowed.includes(ext)) {
    showToast('Only PDF, JPG, PNG, or DICOM files are allowed', true);
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    showToast('Maximum file size is 10 MB', true);
    return;
  }
  tokenLabSelectedFile = file;
  document.getElementById('tokenLabDropLabel').textContent = 'File attached';
  document.getElementById('tokenLabChipName').textContent = file.name;
  document.getElementById('tokenLabChipSize').textContent = (file.size / (1024 * 1024)).toFixed(2) + ' MB';
  document.getElementById('tokenLabChipIcon').textContent = ext === '.pdf' ? '📕' : ext === '.dcm' ? '🩻' : '🖼️';
  document.getElementById('tokenLabChip').style.display = 'flex';
}
function tokenLabClear(e) {
  if (e) e.stopPropagation();
  tokenLabSelectedFile = null;
  document.getElementById('tokenLabFile').value = '';
  document.getElementById('tokenLabDropLabel').textContent = 'Click to browse or drag & drop a file';
  document.getElementById('tokenLabChip').style.display = 'none';
}

/* ── Load & display reports ── */
async function loadLabReports() {
  const container = document.getElementById('labReportsList');
  container.innerHTML = '<div style="text-align:center;padding:2rem;color:var(--muted);font-size:0.86rem;">Loading…</div>';
  try {
    const res = await fetch(`${API}/lab-reports/my`, {
      headers: { 'Authorization': `Bearer ${labToken}` }
    });
    if (res.status === 401) {
      labLogout();
      return;
    }
    if (!res.ok) throw new Error('Could not load reports');
    const reports = await res.json();
    if (!reports.length) {
      container.innerHTML = '<div style="text-align:center;padding:2.5rem 1rem;color:var(--muted);font-size:0.87rem;">No reports uploaded yet.<br><span style="font-size:0.78rem;">Upload your first lab report above.</span></div>';
      return;
    }
    container.innerHTML = reports.map(r => {
      const date = r.report_date ? new Date(r.report_date).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' }) : '—';
      const uploaded = new Date(r.created_at).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
      const ext = r.file_url.split('.').pop().toLowerCase();
      const icon = ext === 'pdf' ? '📕' : ext === 'dcm' ? '🩻' : '🖼️';
      const typeColor = { 'Blood Test':'var(--red)','Urine Test':'var(--amber)','X-Ray':'var(--blue)','MRI':'var(--blue)','CT Scan':'var(--blue)','ECG':'var(--green)','Ultrasound':'var(--gold)','Pathology':'var(--amber)','Other':'var(--muted)' }[r.report_type] || 'var(--muted)';
      return `<div style="display:flex;align-items:flex-start;gap:0.85rem;padding:0.9rem 0;border-bottom:1px solid var(--border);">
        <div style="font-size:1.75rem;flex-shrink:0;margin-top:0.1rem;">${icon}</div>
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.2rem;">
            <span style="font-weight:700;font-size:0.9rem;">${esc(r.report_type)}</span>
            <span style="font-size:0.7rem;font-weight:600;color:${typeColor};background:${typeColor}1a;border:1px solid ${typeColor}33;padding:0.12rem 0.5rem;border-radius:10px;">${esc(r.report_type)}</span>
          </div>
          ${r.lab_name ? `<div style="font-size:0.78rem;color:var(--muted);margin-bottom:0.15rem;">🏥 ${esc(r.lab_name)}</div>` : ''}
          ${r.notes ? `<div style="font-size:0.78rem;color:var(--muted);margin-bottom:0.15rem;">📝 ${esc(r.notes)}</div>` : ''}
          <div style="font-size:0.71rem;color:var(--muted);">Report date: ${date} · Uploaded: ${uploaded}</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:0.4rem;flex-shrink:0;">
          <a href="${esc(r.file_url)}" target="_blank" style="display:inline-flex;align-items:center;gap:0.3rem;padding:0.35rem 0.8rem;border-radius:8px;font-size:0.76rem;font-weight:600;text-decoration:none;background:linear-gradient(135deg,var(--gold),var(--gold-lt));color:#1a1200;transition:all .2s;" onmouseover="this.style.opacity='.85';" onmouseout="this.style.opacity='1';">👁️ View</a>
          <button onclick="labDeleteReport(${r.id}, this)" style="padding:0.3rem 0.8rem;border-radius:8px;font-size:0.76rem;font-weight:600;border:1px solid rgba(225,45,61,0.2);background:rgba(225,45,61,0.06);color:var(--red);cursor:pointer;font-family:inherit;transition:all .2s;" onmouseover="this.style.background='var(--red)';this.style.color='#fff';" onmouseout="this.style.background='rgba(225,45,61,0.06)';this.style.color='var(--red)';">🗑️ Delete</button>
        </div>
      </div>`;
    }).join('') + '<div style="height:0.5rem;"></div>';
  } catch (err) {
    container.innerHTML = `<div style="text-align:center;padding:2rem;color:var(--red);font-size:0.86rem;">${esc(err.message)}</div>`;
  }
}

async function labDeleteReport(id, btn) {
  if (!confirm('Delete this report? This cannot be undone.')) return;
  btn.disabled = true;
  try {
    const res = await fetch(`${API}/lab-reports/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${labToken}` }
    });
    if (res.status === 401) {
      labLogout();
      return;
    }
    if (!res.ok) throw new Error((await res.json()).error || 'Delete failed');
    showToast('Report deleted');
    loadLabReports();
  } catch (err) {
    showToast(err.message, true);
    btn.disabled = false;
  }
}
