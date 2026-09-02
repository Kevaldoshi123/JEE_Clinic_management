/**
 * doctor.js — Care Core Doctor Portal
 * Handles: auth, queue management, encounters, prescriptions,
 *          appointments, lab reports, billing, profile, availability
 * Depends: style.css  |  API at /api/*
 */
'use strict';

/* ─────────────────────────────────────────────
   CONSTANTS & SHARED STATE
───────────────────────────────────────────── */
const API = '/api';
const AVG_CONSULT_MINUTES = 7; // baseline ETA per patient

function isTokenExpired(token) {
  if (!token) return true;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    return payload.exp ? (payload.exp < Date.now() / 1000) : false;
  } catch (e) {
    return true;
  }
}

let authToken = localStorage.getItem('doc_token');
if (isTokenExpired(authToken)) {
  authToken = '';
  localStorage.removeItem('doc_token');
  localStorage.removeItem('doc_name');
  localStorage.removeItem('doc_photo');
}
let prescriptionItems = [];
let allInventory = [];
let allPatients = [];
let dropdownPrescriptionItems = [];
let _doctorAppointments = [];

/* ─────────────────────────────────────────────
   UTILITY
───────────────────────────────────────────── */
/** Set element text/html without throwing if el is absent. */
function _setEl(id, value, prop) {
  const el = document.getElementById(id);
  if (el) el[prop || 'textContent'] = value;
}

/* ─────────────────────────────────────────────
   THEME
───────────────────────────────────────────── */
(function initTheme() {
  const saved = localStorage.getItem('medueon_theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  const btn = document.getElementById('themeBtn');
  if (btn) btn.textContent = (saved === 'dark' ? '\u2600\uFE0F' : '\uD83C\uDF19') + ' Toggle Theme';
})();

document.getElementById('themeBtn')?.addEventListener('click', () => {
  const cur = document.documentElement.getAttribute('data-theme');
  const next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('medueon_theme', next);
  document.getElementById('themeBtn').textContent = (next === 'dark' ? '\u2600\uFE0F' : '\uD83C\uDF19') + ' Toggle Theme';
});

/* ─────────────────────────────────────────────
   TOAST
───────────────────────────────────────────── */
function toast(title, msg, type) {
  type = type || 'success';
  const wrap = document.getElementById('toastWrap');
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.innerHTML = '<div style="font-weight:600;font-size:.84rem">' + title + '</div>' +
    (msg ? '<div style="font-size:.75rem;color:var(--muted);margin-top:.15rem">' + msg + '</div>' : '');
  wrap.appendChild(t);
  setTimeout(function () { t.classList.add('show'); }, 10);
  setTimeout(function () { t.classList.remove('show'); setTimeout(function () { t.remove(); }, 300); }, 4000);
}

/* ─────────────────────────────────────────────
   AUTH & API WRAPPER
───────────────────────────────────────────── */
async function apiCall(endpoint, options) {
  options = options || {};
  const headers = { 'Content-Type': 'application/json' };
  if (authToken) headers['Authorization'] = 'Bearer ' + authToken;
  const r = await fetch(API + endpoint, Object.assign({}, options, { headers: headers }));
  if (r.status === 401) { localStorage.removeItem('doc_token'); location.reload(); }
  return r;
}

async function login() {
  const email = document.getElementById('loginEmail').value;
  const password = document.getElementById('loginPassword').value;
  const err = document.getElementById('loginError');
  err.style.display = 'none';
  try {
    const r = await fetch(API + '/auth/doctor/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, password: password })
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Login failed');
    authToken = data.token;
    localStorage.setItem('doc_token', authToken);
    if (data.doctor) {
      localStorage.setItem('doc_name', data.doctor.full_name || 'Doctor');
      localStorage.setItem('doc_photo', data.doctor.profile_photo_url || '');
    }
    document.getElementById('loginOverlay').style.display = 'none';
    document.getElementById('appContent').style.display = 'block';
    const name = (data.doctor && data.doctor.full_name) || localStorage.getItem('doc_name') || 'Doctor';
    const photo = (data.doctor && data.doctor.profile_photo_url) || localStorage.getItem('doc_photo') || '';
    document.getElementById('doctorName').textContent = name;
    const avatarEl = document.getElementById('docAvatar');
    if (photo) {
      avatarEl.innerHTML = `<img src="${photo}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
    } else {
      avatarEl.textContent = name.substring(0, 2).toUpperCase();
    }
    startApp();
  } catch (e) {
    err.textContent = e.message;
    err.style.display = 'block';
  }
}

function getDoctorId() {
  try {
    const token = localStorage.getItem('doc_token');
    if (!token) return null;
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.id || payload.doctor_id || payload.sub || null;
  } catch (e) { return null; }
}

/* ─────────────────────────────────────────────
   NAVIGATION
───────────────────────────────────────────── */
function navigate(page) {
  document.querySelectorAll('.nav-item').forEach(function (i) { i.classList.remove('active'); });
  const navEl = document.querySelector('[data-page="' + page + '"]');
  if (navEl) navEl.classList.add('active');
  document.querySelectorAll('.page').forEach(function (p) { p.classList.remove('active'); });
  const pageEl = document.getElementById('page-' + page);
  if (pageEl) pageEl.classList.add('active');
  const titles = {
    dashboard: 'Dashboard', queue: 'Queue Controls', encounter: 'Patient Encounter',
    bills: 'Billing Ledger', patients: 'Patients', laboratory: 'Laboratory',
    inventory: 'Inventory', notices: 'Notice Board', analytics: 'Analytics',
    appointments: 'Appointments Schedule', leaves: 'Leave Management',
    diagnost: 'Diagnost'
  };
  document.getElementById('pageTitle').textContent = titles[page] || page;
  var loaders = {
    bills: function () { loadBills(); loadFinancialSummary(); },
    patients: loadPatients,
    laboratory: loadLabPage,
    inventory: loadInventory,
    notices: loadNotice,
    analytics: function () { loadAnalytics(); loadDoctorCashRegister(); },
    queue: loadQueueMetric,
    appointments: function() { loadAppointmentsDoctor(); initAvailabilityUI(); },
    encounter: loadTemplatesList,
    leaves: loadDoctorLeaves
  };
  if (loaders[page]) loaders[page]();
}

document.querySelectorAll('.nav-item').forEach(function (item) {
  item.addEventListener('click', function () {
    if (window.innerWidth <= 768) closeSidebar();
    navigate(item.dataset.page);
  });
});

/* ═══════════════════════════════════════════════
   SECTION A — QUEUE & OPERATIONS METRICS
   Each function is independently callable and
   updates only its own slice of the UI.
═══════════════════════════════════════════════ */

/**
 * loadQueueMetric()
 * Fetches live queue state. Updates:
 *   nowServing, waitingCount, dashWaitETA (dashboard)
 *   qNowServing, qWaiting, qETA           (queue page)
 * Does not touch any financial metric.
 */
async function loadQueueMetric() {
  try {
    const r = await apiCall('/queue/state');
    const d = await r.json();
    const cur = d.current_number || 0;
    const waiting = Math.max(0, (d.last_token || 0) - cur);
    const etaMins = waiting * AVG_CONSULT_MINUTES;

    _setEl('nowServing', cur);
    _setEl('waitingCount', waiting);
    _setEl('dashWaitETA', waiting > 0 ? 'Est. wait: ~' + etaMins + ' min' : 'No queue');
    _setEl('qNowServing', cur);
    _setEl('qWaiting', waiting);
    _setEl('qETA', waiting > 0 ? '~' + etaMins + ' min' : '0 min');
  } catch (e) { console.error('[loadQueueMetric]', e); }
}

/**
 * loadUniquePatients()
 * Fetches the count of distinct registered patients.
 * Operates independently of billing and queue data.
 */
async function loadUniquePatients() {
  try {
    const r = await apiCall('/admin/patients');
    if (!r.ok) { _setEl('dashUniquePatients', '\u2014'); return; }
    const data = await r.json();
    allPatients = data;
    _setEl('dashUniquePatients', data.length);
    _setEl('patientsTotal', data.length);
  } catch (e) { console.error('[loadUniquePatients]', e); }
}

/**
 * loadMedicinesDispensed()
 * Fetches medicine units dispensed today from /metrics.
 * Isolated to the total_medicines field only.
 */
async function loadMedicinesDispensed() {
  try {
    const r = await apiCall('/metrics');
    if (!r.ok) return;
    const d = await r.json();
    const units = d.total_medicines || 0;
    _setEl('dashMeds', units);
    _setEl('dashMedsSub', units + ' unit' + (units !== 1 ? 's' : '') + ' today');
  } catch (e) { console.error('[loadMedicinesDispensed]', e); }
}

/**
 * loadPharmacyRevenue()
 * Sums pharmacy_cost across paid bills to get pharmacy-only revenue.
 * Does not mix consultation fees or unpaid amounts.
 */
async function loadPharmacyRevenue() {
  try {
    const r = await apiCall('/bills');
    if (!r.ok) return;
    const bills = await r.json();
    const total = bills
      .filter(function (b) { return b.payment_status === 'paid'; })
      .reduce(function (sum, b) { return sum + parseFloat(b.pharmacy_cost || 0); }, 0);
    _setEl('dashPharmacyRev', '\u20B9' + total.toFixed(0));
  } catch (e) { console.error('[loadPharmacyRevenue]', e); }
}

/**
 * loadInventoryAlerts()
 * Counts low-stock and out-of-stock items from inventory.
 * Runs independently; does not affect financial or queue metrics.
 */
async function loadInventoryAlerts() {
  try {
    const r = await apiCall('/inventory');
    if (!r.ok) return;
    const inv = await r.json();
    const low = inv.filter(function (i) { return i.stock_level > 0 && i.stock_level <= (i.safety_threshold || 5); });
    const out = inv.filter(function (i) { return i.stock_level === 0; });
    const total = low.length + out.length;
    _setEl('dashLowStock', total > 0 ? total : '\u2713');
    _setEl('dashLowStockSub', total > 0 ? out.length + ' out \u00B7 ' + low.length + ' low' : 'All items stocked');
  } catch (e) { console.error('[loadInventoryAlerts]', e); }
}

/* Queue action functions */
async function callNext() {
  try {
    const r = await apiCall('/queue/next', { method: 'POST' });
    if (r.status === 400) { toast('Queue', 'No patients waiting', 'warn'); return; }
    const d = await r.json();
    toast('\uD83D\uDCE2 Called', 'Patient #' + d.current_number, 'success');
    loadQueueMetric();
    loadTotalRevenue();
  } catch (e) { toast('Error', e.message, 'error'); }
}

async function skipToken() {
  try {
    const r = await apiCall('/queue/skip', { method: 'POST' });
    const d = await r.json();
    toast('\u23ED Skipped', 'Now at #' + d.current_number, 'info');
    loadQueueMetric();
  } catch (e) { toast('Error', e.message, 'error'); }
}

async function recallCurrent() {
  try {
    const r = await apiCall('/queue/recall', { method: 'POST' });
    const d = await r.json();
    toast('\uD83D\uDD01 Recalled', '#' + d.current_number, 'info');
  } catch (e) { toast('Error', e.message, 'error'); }
}

async function resetQueue() {
  try {
    const r = await apiCall('/queue/update-compat', {
      method: 'POST',
      body: JSON.stringify({ current_number: 0, last_token: 0 })
    });
    const d = await r.json();
    if (d.isOk) {
      toast('\u2705 Reset', 'Queue reset successfully', 'success');
      loadQueueMetric();
      loadTotalRevenue();
    } else { toast('Error', 'Failed to reset queue', 'error'); }
  } catch (e) { toast('Error', e.message, 'error'); }
}

function openResetModal() { document.getElementById('resetModal').classList.add('open'); }
function closeResetModal() { document.getElementById('resetModal').classList.remove('open'); }

/* ═══════════════════════════════════════════════
   SECTION B — FINANCIAL METRICS (Independent)
   Three separate functions: one per KPI.
   Each reads from its own slice of the API response.
═══════════════════════════════════════════════ */

/**
 * loadTotalRevenue()
 * Reads total_revenue from /metrics — paid bills only.
 * Does not compute or display counts or unpaid amounts.
 */
async function loadTotalRevenue() {
  try {
    const r = await apiCall('/metrics');
    if (!r.ok) return;
    const d = await r.json();
    const rev = parseFloat(d.total_revenue || 0);
    _setEl('todayRevenue', '\u20B9' + rev.toFixed(0));
    _setEl('dashRevSub', 'Paid bills only');
  } catch (e) { console.error('[loadTotalRevenue]', e); }
}

/**
 * loadDistinctBilling()
 * Fetches the count of distinct billed consultations (total_consultations)
 * and derives the average consultation fee from today's paid bills.
 * Does not touch revenue totals or unpaid data.
 */
async function loadDistinctBilling() {
  try {
    const [metricsR, billsR] = await Promise.all([
      apiCall('/metrics'),
      apiCall('/bills')
    ]);
    if (metricsR.ok) {
      const m = await metricsR.json();
      _setEl('dashConsult', m.total_consultations || 0);
    }
    if (billsR.ok) {
      const bills = await billsR.json();
      const paidBills = bills.filter(function (b) { return b.payment_status === 'paid'; });
      if (paidBills.length) {
        const totalFees = paidBills.reduce(function (s, b) { return s + parseFloat(b.consultation_fee || 0); }, 0);
        _setEl('dashConsultFee', 'Avg consult: \u20B9' + (totalFees / paidBills.length).toFixed(0));
      } else {
        _setEl('dashConsultFee', 'No paid consultations yet');
      }
    }
  } catch (e) { console.error('[loadDistinctBilling]', e); }
}

/**
 * loadUnpaidBills()
 * Fetches only unpaid bills, counts them, and sums outstanding amounts.
 * Strictly isolated from revenue and consultation counts.
 */
async function loadUnpaidBills() {
  try {
    const r = await apiCall('/bills');
    if (!r.ok) return;
    const bills = await r.json();
    const unpaid = bills.filter(function (b) { return b.payment_status === 'unpaid'; });
    const outstanding = unpaid.reduce(function (s, b) { return s + parseFloat(b.total_amount || 0); }, 0);
    _setEl('dashUnpaid', unpaid.length);
    _setEl('dashUnpaidAmt', unpaid.length > 0
      ? 'Outstanding: \u20B9' + outstanding.toFixed(0)
      : 'All bills settled');
  } catch (e) { console.error('[loadUnpaidBills]', e); }
}

/**
 * loadFinancialSummary()
 * Populates the Billing Ledger page summary strip.
 * From a single /bills fetch, derives three independent values:
 *   1. Total revenue (paid only)
 *   2. Distinct bill count (all statuses)
 *   3. Unpaid outstanding amount
 */
async function loadFinancialSummary() {
  try {
    const r = await apiCall('/bills');
    if (!r.ok) return;
    const bills = await r.json();

    var paidBills = bills.filter(function (b) { return b.payment_status === 'paid'; });
    var totalRev = paidBills.reduce(function (s, b) { return s + parseFloat(b.total_amount || 0); }, 0);
    _setEl('billsTotalRevenue', '\u20B9' + totalRev.toFixed(2));

    _setEl('billsDistinctCount', bills.length);

    var unpaidBills = bills.filter(function (b) { return b.payment_status === 'unpaid'; });
    var unpaidTotal = unpaidBills.reduce(function (s, b) { return s + parseFloat(b.total_amount || 0); }, 0);
    _setEl('billsUnpaidTotal', '\u20B9' + unpaidTotal.toFixed(2));
  } catch (e) { console.error('[loadFinancialSummary]', e); }
}

/* ─────────────────────────────────────────────
   BILLS TABLE
───────────────────────────────────────────── */
async function loadBills() {
  try {
    const r = await apiCall('/bills');
    const bills = await r.json();
    const tbody = document.getElementById('billsList');
    if (!bills.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="tbl-empty">No bills today yet.</td></tr>';
      return;
    }
    tbody.innerHTML = bills.map(function (b) {
      return '<tr>' +
        '<td style="color:var(--gold);font-family:\'JetBrains Mono\',monospace;font-weight:700">#' + (b.token_number || '?') + '</td>' +
        '<td><strong>' + (b.patient_name || '\u2014') + '</strong></td>' +
        '<td>\u20B9' + parseFloat(b.consultation_fee || 0).toFixed(2) + '</td>' +
        '<td>\u20B9' + parseFloat(b.pharmacy_cost || 0).toFixed(2) + '</td>' +
        '<td style="font-weight:600">\u20B9' + parseFloat(b.total_amount || 0).toFixed(2) + '</td>' +
        '<td><span class="pill ' + b.payment_status + '">' + b.payment_status + '</span></td>' +
        '<td>' + (b.payment_status === 'unpaid'
          ? '<button class="act pay" onclick="markBillPaid(\'' + b.id + '\')">Mark Paid</button>'
          : '<span style="color:var(--muted);font-size:.72rem">\u2014</span>') + '</td>' +
        '</tr>';
    }).join('');
    loadFinancialSummary();
  } catch (e) { console.error('[loadBills]', e); }
}

/**
 * markBillPaid()
 * Marks an individual bill as paid.
 * After success, refreshes each financial metric independently.
 */
async function markBillPaid(billId) {
  try {
    const r = await apiCall('/bills/' + billId + '/pay', {
      method: 'POST', body: JSON.stringify({ payment_method: 'cash' })
    });
    if (r.ok) {
      toast('\u2705 Paid', 'Bill marked as paid', 'success');
      loadBills();
      loadTotalRevenue();
      loadUnpaidBills();
      loadFinancialSummary();
    } else {
      const err = await r.json();
      toast('Error', err.error || 'Failed to mark as paid', 'error');
    }
  } catch (e) { toast('Error', e.message, 'error'); }
}

/* ─────────────────────────────────────────────
   NOTICE
───────────────────────────────────────────── */
async function loadNotice() {
  const docId = getDoctorId();
  try {
    const url = docId ? '/notice/get?doctorId=' + docId : '/notice/get';
    const r = await apiCall(url);
    const d = await r.json();
    const myText = (d.data && d.data.text) || 'No active announcement';
    _setEl('noticeDisplay', myText);
    _setEl('dashNotice', myText);
    if (myText !== 'No active announcement') document.getElementById('noticeInput').value = myText;
  } catch (e) { console.error('[loadNotice:doctor]', e); }

  try {
    const ra = await apiCall('/notice/get');
    const da = await ra.json();
    const adminTxt = (da.data && da.data.text) || 'No admin notice at this time';
    _setEl('adminNoticeDisplay', adminTxt);
    _setEl('dashAdminNotice', adminTxt);
  } catch (e) { console.error('[loadNotice:admin]', e); }
}

async function saveNotice() {
  const text = document.getElementById('noticeInput').value;
  const docId = getDoctorId();
  const body = docId ? { text: text, doctorId: docId } : { text: text };
  try {
    const r = await apiCall('/notice/set', { method: 'POST', body: JSON.stringify(body) });
    if (r.ok) { toast('\uD83D\uDCE1 Broadcast', 'Notice sent to your patients', 'success'); loadNotice(); }
    else toast('Error', 'Failed to save notice', 'error');
  } catch (e) { toast('Error', 'Error saving notice', 'error'); }
}

async function clearNotice() {
  document.getElementById('noticeInput').value = '';
  await saveNotice();
}

/* ─────────────────────────────────────────────
   PATIENTS
───────────────────────────────────────────── */
async function loadPatients() {
  try {
    const r = await apiCall('/admin/patients');
    if (!r.ok) {
      document.getElementById('patientsList').innerHTML =
        '<tr><td colspan="5" class="tbl-empty" style="color:var(--amber)">Patient list requires admin token. Contact system admin.</td></tr>';
      return;
    }
    allPatients = await r.json();
    _setEl('patientsTotal', allPatients.length);
    renderPatients(allPatients);
  } catch (e) { console.error('[loadPatients]', e); }
}

function renderPatients(data) {
  document.getElementById('patientsList').innerHTML = data.length
    ? data.map(function (p) {
      return '<tr>' +
        '<td><strong>' + esc(p.full_name) + '</strong></td>' +
        '<td>' + (p.age || '\u2014') + '</td>' +
        '<td style="text-transform:capitalize">' + (p.gender || '\u2014') + '</td>' +
        '<td>' + (p.contact || '\u2014') + '</td>' +
        '<td>' + (p.total_visits || 0) + '</td>' +
        '<td style="display:flex;gap:.35rem">' +
        '<button class="btn-sm primary" onclick="openPatientProfile(' + p.id + ')">&#128100; Profile</button>' +
        '<button class="btn-sm" onclick="openLabOrderForPatient(' + p.id + ',\'' + esc(p.full_name) + '\')">&#129514; Lab</button>' +
        '</td>' +
        '</tr>';
    }).join('')
    : '<tr><td colspan="6" class="tbl-empty">No patients found</td></tr>';
}

function esc(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&#39;').replace(/"/g, '&quot;'); }

function filterPatients() {
  const q = document.getElementById('patientSearch').value.toLowerCase();
  renderPatients(allPatients.filter(function (p) {
    return p.full_name.toLowerCase().includes(q) || (p.contact || '').includes(q);
  }));
}

/* ─────────────────────────────────────────────
   INVENTORY
───────────────────────────────────────────── */
async function loadInventory() {
  try {
    const [invRes, rxRes] = await Promise.all([
      apiCall('/inventory'),
      apiCall('/inventory/prescription-items')
    ]);
    allInventory = await invRes.json();
    dropdownPrescriptionItems = await rxRes.json();
    renderInventory(allInventory);
    filterMedDropdown();
  } catch (e) { console.error('[loadInventory]', e); }
}

function renderInventory(data) {
  const tbody = document.getElementById('inventoryList');
  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="tbl-empty">No inventory items found</td></tr>';
    return;
  }
  tbody.innerHTML = data.map(function (item) {
    const ss = item.stock_level === 0 ? 'out' : item.stock_level <= (item.safety_threshold || 5) ? 'low' : 'ok';
    const sl = item.stock_level === 0 ? 'Out' : item.stock_level <= (item.safety_threshold || 5) ? 'Low' : 'OK';
    return '<tr>' +
      '<td><strong>' + item.name + '</strong><br><span style="font-size:.72rem;color:var(--muted)">' + (item.generic_name || '') + '</span></td>' +
      '<td style="font-size:.78rem;text-transform:capitalize">' + (item.category || '\u2014') + '</td>' +
      '<td class="' + (ss !== 'ok' ? 'stock-low' : '') + '">' + item.stock_level + '</td>' +
      '<td style="font-size:.78rem;color:var(--muted)">' + (item.unit_of_measure || 'units') + '</td>' +
      '<td>\u20B9' + parseFloat(item.unit_price).toFixed(2) + '</td>' +
      '<td><span class="pill ' + ss + '">' + sl + '</span></td>' +
      '<td><button class="act edit" onclick="editInv(\'' + item.id + '\',\'' + item.name.replace(/'/g, "\\'") + '\',' + item.stock_level + ',' + item.unit_price + ',' + (item.safety_threshold || 5) + ')">Edit</button></td>' +
      '</tr>';
  }).join('');
}

function switchInvTab(tab) {
  document.querySelectorAll('.inv-tab').forEach(function (t) { t.classList.remove('active'); });
  document.querySelectorAll('.inv-panel').forEach(function (p) { p.classList.remove('active'); });
  document.getElementById('invPanel' + tab.charAt(0).toUpperCase() + tab.slice(1)).classList.add('active');
  event.currentTarget.classList.add('active');
}

function editInv(id, name, stock, price, threshold) {
  document.querySelectorAll('.inv-tab').forEach(function (t, i) { t.classList.toggle('active', i === 1); });
  document.querySelectorAll('.inv-panel').forEach(function (p, i) { p.classList.toggle('active', i === 1); });
  document.getElementById('invId').value = id;
  document.getElementById('invName').value = name;
  document.getElementById('invStock').value = stock;
  document.getElementById('invPrice').value = price;
  document.getElementById('invThreshold').value = threshold;
  navigate('inventory');
  toast('Edit Mode', 'Editing: ' + name, 'info');
}

async function saveInv() {
  const id = document.getElementById('invId').value.trim();
  if (!id) { toast('Error', 'Select an item to edit first', 'error'); return; }
  const payload = {
    id: id,
    name: document.getElementById('invName').value,
    stock_level: parseInt(document.getElementById('invStock').value),
    unit_price: parseFloat(document.getElementById('invPrice').value),
    safety_threshold: parseInt(document.getElementById('invThreshold').value) || 5
  };
  try {
    const r = await apiCall('/inventory/update', { method: 'POST', body: JSON.stringify(payload) });
    if (r.ok) {
      toast('Saved', 'Inventory item updated', 'success');
      loadInventory();
      loadInventoryAlerts(); // refresh low-stock badge independently
      ['invId', 'invName', 'invStock', 'invPrice', 'invThreshold'].forEach(function (k) { document.getElementById(k).value = ''; });
    } else {
      const err = await r.json();
      toast('Error', err.error || 'Update failed', 'error');
    }
  } catch (e) { toast('Error', e.message, 'error'); }
}

async function addNewInventory() {
  const name = document.getElementById('newInvName').value.trim();
  const category = document.getElementById('newInvCategory').value;
  const stock = parseInt(document.getElementById('newInvStock').value);
  const price = parseFloat(document.getElementById('newInvPrice').value);
  const generic = document.getElementById('newInvGeneric').value.trim();
  const threshold = parseInt(document.getElementById('newInvThreshold').value) || 5;
  const mfr = document.getElementById('newInvMfr').value.trim();
  const unit = document.getElementById('newInvUnit').value.trim() || 'units';

  if (!name || !category || isNaN(stock) || isNaN(price)) {
    toast('Validation', 'Name, category, stock and price are required', 'error');
    return;
  }
  const id = 'med_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
  const payload = {
    id: id, name: name, generic_name: generic, category: category,
    stock_level: stock, safety_threshold: threshold,
    unit_price: price, manufacturer: mfr, unit_of_measure: unit
  };
  try {
    const r = await apiCall('/inventory/update', { method: 'POST', body: JSON.stringify(payload) });
    if (r.ok) {
      toast('\u2795 Added', name + ' added to inventory', 'success');
      loadInventory();
      loadInventoryAlerts();
      ['newInvName', 'newInvGeneric', 'newInvStock', 'newInvPrice', 'newInvThreshold', 'newInvMfr', 'newInvUnit'].forEach(function (k) { document.getElementById(k).value = ''; });
      document.getElementById('newInvCategory').value = '';
    } else {
      const err = await r.json();
      toast('Error', err.error || 'Failed to add item', 'error');
    }
  } catch (e) { toast('Error', e.message, 'error'); }
}

/* ─────────────────────────────────────────────
   MEDICATION DROPDOWN
───────────────────────────────────────────── */
var _medActiveCat = 'all';
var selectedMed = null;

function renderMedList(items) {
  const list = document.getElementById('medList');
  if (!items.length) { list.innerHTML = '<div class="med-empty">No medications found</div>'; return; }
  list.innerHTML = items.map(function (m) {
    const sc = m.stock_level <= 0 ? 'out' : m.stock_level <= (m.safety_threshold || 10) ? 'low' : 'ok';
    const sl = m.stock_level <= 0 ? 'Out of stock' : m.stock_level + ' in stock';
    const ds = m.stock_level <= 0 ? 'style="opacity:.5;pointer-events:none"' : '';
    const sel = selectedMed && selectedMed.id === m.id ? ' selected' : '';
    return '<div class="med-list-item' + sel + '"' +
      ' onclick="selectMedicineDropdown(\'' + m.id + '\',\'' + m.name.replace(/'/g, "\\'") + '\',' + m.unit_price + ',\'' + (m.category || '').replace(/'/g, "\\'") + '\',' + m.stock_level + ')"' +
      ' ' + ds + '>' +
      '<div class="med-item-left"><span class="med-item-name">' + m.name + '</span>' +
      '<span class="med-item-generic">' + (m.generic_name || m.category || '') + '</span></div>' +
      '<div class="med-item-right"><span class="med-item-price">&#8377;' + parseFloat(m.unit_price).toFixed(2) + '</span>' +
      '<span class="med-item-stock ' + sc + '">' + sl + '</span></div></div>';
  }).join('');
}

function filterMedDropdown() {
  const q = (document.getElementById('medSearchInput').value || '').toLowerCase().trim();
  var items = dropdownPrescriptionItems;
  if (_medActiveCat !== 'all') items = items.filter(function (m) { return (m.category || '').toLowerCase() === _medActiveCat; });
  if (q) items = items.filter(function (m) { return m.name.toLowerCase().includes(q) || (m.generic_name || '').toLowerCase().includes(q); });
  renderMedList(items);
}

function filterByCategory(el, cat) {
  _medActiveCat = cat;
  document.querySelectorAll('.med-cat-chip').forEach(function (c) { c.classList.remove('active'); });
  el.classList.add('active');
  document.getElementById('medSearchInput').value = '';
  filterMedDropdown();
}

function toggleMedDropdown() {
  const trigger = document.getElementById('medDropdownTrigger');
  const panel = document.getElementById('medDropdownPanel');
  const isOpen = panel.classList.toggle('open');
  trigger.classList.toggle('open', isOpen);
  if (isOpen) { filterMedDropdown(); setTimeout(function () { document.getElementById('medSearchInput').focus(); }, 60); }
}

function closeMedDropdown() {
  document.getElementById('medDropdownPanel').classList.remove('open');
  document.getElementById('medDropdownTrigger').classList.remove('open');
}

document.addEventListener('click', function (e) {
  if (!e.target.closest('#medDropdownWrap')) closeMedDropdown();
});

function selectMedicineDropdown(id, name, price, category, stock) {
  selectedMed = { id: id, name: name, price: parseFloat(price), category: category, stock: stock };
  const trigText = document.getElementById('medTriggerText');
  trigText.textContent = name;
  trigText.classList.remove('placeholder');
  closeMedDropdown();
  filterMedDropdown();
}
function selectMedicine(id, name, price, category, stock) { selectMedicineDropdown(id, name, price, category, stock); }

function addPrescription() {
  const qty = parseInt(document.getElementById('medQty').value) || 1;
  const dosage = document.getElementById('medDosage').value.trim();
  if (!selectedMed) { toast('Medicine', 'Select a medicine from the dropdown', 'error'); return; }
  if (qty > selectedMed.stock) toast('Stock Warning', 'Only ' + selectedMed.stock + ' units available', 'warn');
  const existing = prescriptionItems.find(function (p) { return p.id === selectedMed.id; });
  if (existing) {
    existing.qty += qty;
    existing.dosage = dosage || existing.dosage;
    toast('Updated', selectedMed.name + ' quantity updated', 'info');
  } else {
    prescriptionItems.push(Object.assign({}, selectedMed, { qty: qty, dosage: dosage }));
  }
  renderPrescription();
  const trigText = document.getElementById('medTriggerText');
  trigText.textContent = 'Select medication from clinic\u2026';
  trigText.classList.add('placeholder');
  document.getElementById('medQty').value = 1;
  document.getElementById('medDosage').value = '';
  selectedMed = null;
}

function renderPrescription() {
  const tbody = document.getElementById('prescriptionList');
  var total = 0;
  if (!prescriptionItems.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="tbl-empty">No medications added yet</td></tr>';
    document.getElementById('pharmacyTotal').textContent = '\u20B90';
    return;
  }
  tbody.innerHTML = prescriptionItems.map(function (p, i) {
    const lineTotal = p.qty * p.price;
    total += lineTotal;
    return '<tr>' +
      '<td><strong>' + p.name + '</strong></td>' +
      '<td style="font-size:.77rem;color:var(--muted);text-transform:capitalize">' + (p.category || '\u2014') + '</td>' +
      '<td>' + p.qty + '</td>' +
      '<td>\u20B9' + p.price.toFixed(2) + '</td>' +
      '<td style="font-weight:600">\u20B9' + lineTotal.toFixed(2) + '</td>' +
      '<td style="font-size:.78rem;color:var(--muted)">' + (p.dosage || '\u2014') + '</td>' +
      '<td><button onclick="removeRx(' + i + ')" style="color:var(--red);cursor:pointer;background:none;border:none;font-size:1rem;padding:.1rem .3rem" title="Remove">\u2715</button></td>' +
      '</tr>';
  }).join('');
  document.getElementById('pharmacyTotal').textContent = '\u20B9' + total.toFixed(2);
}
window.removeRx = function (i) { prescriptionItems.splice(i, 1); renderPrescription(); };

/* ─────────────────────────────────────────────
   ENCOUNTER — Complete & Bill
───────────────────────────────────────────── */
function completeEncounter() {
  const complaints = document.getElementById('complaints').value.trim();
  const diagnosis = document.getElementById('diagnosis').value.trim();
  if (!complaints && !diagnosis && !prescriptionItems.length) {
    toast('Incomplete', 'Add at least complaints, diagnosis, or a medication', 'warn');
    return;
  }
  var summaryHtml = '';
  if (complaints) summaryHtml += '<div><strong>Complaints:</strong> ' + complaints + '</div>';
  if (diagnosis) summaryHtml += '<div><strong>Diagnosis:</strong> ' + diagnosis + '</div>';
  if (prescriptionItems.length) {
    const meds = prescriptionItems.map(function (p) { return p.name + ' \xD7' + p.qty; }).join(', ');
    const medTotal = prescriptionItems.reduce(function (s, p) { return s + p.qty * p.price; }, 0);
    summaryHtml += '<div><strong>Medications (' + prescriptionItems.length + '):</strong> ' + meds + '</div>';
    summaryHtml += '<div><strong>Pharmacy Total:</strong> \u20B9' + medTotal.toFixed(2) + '</div>';
  }
  if (!summaryHtml) summaryHtml = '<div style="color:var(--muted)">No details entered.</div>';
  document.getElementById('billModalSummary').innerHTML = summaryHtml;
  document.getElementById('billModal').classList.add('open');
}

async function doCompleteEncounter() {
  document.getElementById('billModal').classList.remove('open');
  const payload = {
    chief_complaints: document.getElementById('complaints').value,
    diagnosis: document.getElementById('diagnosis').value,
    observations: document.getElementById('observations').value,
    follow_up_date: document.getElementById('followUpDate').value || null,
    notes: document.getElementById('rxNotes').value,
    vitals_temp: parseFloat(document.getElementById('temp').value) || null,
    vitals_bp: document.getElementById('bp').value || null,
    vitals_pulse: parseInt(document.getElementById('pulse').value) || null,
    vitals_spo2: parseInt(document.getElementById('spo2').value) || null,
    vitals_weight: parseFloat(document.getElementById('weight').value) || null,
    vitals_height: parseFloat(document.getElementById('height').value) || null,
    vitals_bmi: parseFloat(document.getElementById('bmi').value) || null,
    prescription: prescriptionItems.map(function (p) {
      return { id: p.id, quantity: p.qty, dosage_instructions: p.dosage || '' };
    })
  };
  try {
    const r = await apiCall('/clinic/billing', { method: 'POST', body: JSON.stringify(payload) });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'Billing failed');

    if (d.bill_id) {
      await apiCall('/bills/' + d.bill_id + '/pay', {
        method: 'POST', body: JSON.stringify({ payment_method: 'cash' })
      });
    }

    toast('\u2705 Bill Created', 'Total \u20B9' + d.total_cost + ' \u2014 marked as Paid', 'success');

    // Upload any brand-new lab report files for this patient
    var patientId = d.patient_id || (d.bill && d.bill.patient_id) || null;
    var encounterId = d.encounter_id || (d.encounter && d.encounter.id) || null;

    if (patientId && _encounterLabFiles.length) {
      uploadEncounterLabFiles(patientId).then(function () {
        toast('📎 Lab Files Saved', 'New file(s) saved to patient profile', 'success');
      });
    }

    // Link existing DB lab reports to the completed encounter
    if (encounterId && _encounterLabDbSelected.length) {
      var dbCount = _encounterLabDbSelected.length;
      linkEncounterDbReports(encounterId).then(function () {
        toast('🔗 Reports Linked', dbCount + ' existing report' + (dbCount > 1 ? 's' : '') + ' linked to encounter', 'success');
      });
    }

    prescriptionItems = [];
    renderPrescription();
    ['complaints', 'diagnosis', 'observations', 'temp', 'bp', 'pulse', 'spo2', 'weight', 'height', 'bmi', 'followUpDate', 'rxNotes'].forEach(function (id) {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    selectedMed = null;
    const trigText = document.getElementById('medTriggerText');
    if (trigText) { trigText.textContent = 'Select medication from clinic\u2026'; trigText.classList.add('placeholder'); }
    // Clear encounter lab attachments (new files + DB selections)
    _encounterLabFiles = [];
    renderEncounterLabFiles();
    _encounterLabDbSelected = [];
    renderEncounterLabDbTags();

    // Refresh each metric independently after a completed encounter
    loadQueueMetric();
    loadTotalRevenue();
    loadDistinctBilling();
    loadUnpaidBills();
    loadMedicinesDispensed();
    loadPharmacyRevenue();
    loadInventoryAlerts();
    loadBills();
    loadInventory();
  } catch (e) { toast('Error', e.message, 'error'); }
}

/* ─────────────────────────────────────────────
   ENCOUNTER — LAB REPORT ATTACHMENT
   Supports: (A) upload new file, (B) pick from DB
───────────────────────────────────────────── */
let _encounterLabFiles = [];      // Array of File objects (new uploads)
let _encounterLabDbSelected = []; // Array of {id, report_title, file_name, uploaded_at} from DB
let _labPickerAllReports = [];    // Cache of fetched reports for search filtering

/* ── (A) New file upload ── */
function handleEncounterLabFile(files) {
  Array.from(files).forEach(function (f) {
    if (f.size > 10 * 1024 * 1024) { toast('File too large', f.name + ' exceeds 10 MB', 'error'); return; }
    const dup = _encounterLabFiles.find(function (x) { return x.name === f.name && x.size === f.size; });
    if (!dup) _encounterLabFiles.push(f);
  });
  renderEncounterLabFiles();
  document.getElementById('encounterLabFileInput').value = '';
}

function renderEncounterLabFiles() {
  const container = document.getElementById('encounterLabFileList');
  if (!container) return;
  if (!_encounterLabFiles.length) { container.innerHTML = ''; return; }
  container.innerHTML = _encounterLabFiles.map(function (f, i) {
    var ext = f.name.split('.').pop().toLowerCase();
    var icon = ext === 'pdf' ? '📕' : '🖼️';
    var kb = (f.size / 1024).toFixed(0);
    return '<div style="display:flex;align-items:center;gap:.55rem;padding:.4rem .7rem;background:var(--surface2);border:1px solid var(--border);border-radius:9px;margin-bottom:.3rem;font-size:.8rem">' +
      '<span>' + icon + '</span>' +
      '<span style="flex:1;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">' + esc(f.name) + '</span>' +
      '<span style="color:var(--muted);font-size:.7rem;flex-shrink:0">' + kb + ' KB · new</span>' +
      '<button type="button" onclick="removeEncounterLabFile(' + i + ')" style="background:none;border:none;cursor:pointer;color:var(--red);padding:0 .15rem;line-height:1">✕</button>' +
      '</div>';
  }).join('');
}

window.removeEncounterLabFile = function (i) {
  _encounterLabFiles.splice(i, 1);
  renderEncounterLabFiles();
};

/* ── (B) DB picker ── */
function renderEncounterLabDbTags() {
  const container = document.getElementById('encounterLabDbTags');
  if (!container) return;
  if (!_encounterLabDbSelected.length) { container.innerHTML = ''; return; }
  container.innerHTML = _encounterLabDbSelected.map(function (r, i) {
    var ext = (r.file_name || '').split('.').pop().toLowerCase();
    var icon = ext === 'pdf' ? '📕' : '🖼️';
    var dt = r.uploaded_at ? new Date(r.uploaded_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
    return '<div style="display:inline-flex;align-items:center;gap:.4rem;padding:.3rem .65rem;background:rgba(168,115,26,.1);border:1px solid rgba(168,115,26,.3);border-radius:8px;font-size:.78rem;color:var(--gold)">' +
      '<span>' + icon + '</span>' +
      '<span style="max-width:160px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis" title="' + esc(r.report_title) + '">' + esc(r.report_title) + '</span>' +
      (dt ? '<span style="color:var(--muted);font-size:.68rem">' + dt + '</span>' : '') +
      '<button type="button" onclick="removeEncounterLabDbItem(' + i + ')" style="background:none;border:none;cursor:pointer;color:var(--muted);padding:0;line-height:1;font-size:.85rem">✕</button>' +
      '</div>';
  }).join('');
}

window.removeEncounterLabDbItem = function (i) {
  _encounterLabDbSelected.splice(i, 1);
  renderEncounterLabDbTags();
};

async function openEncounterLabPicker() {
  document.getElementById('encounterLabPickerModal').classList.add('open');
  document.getElementById('labPickerSearch').value = '';

  const listEl = document.getElementById('labPickerList');
  listEl.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--muted);font-size:.84rem">Loading reports…</div>';

  try {
    // Resolve the patient_id of whoever is currently in-progress in the queue
    var patId = null;
    try {
      const qr = await apiCall('/queue/tokens?status=in_progress');
      if (qr.ok) {
        const tokens = await qr.json();
        if (tokens && tokens.length) patId = tokens[0].patient_id;
      }
    } catch (_) {}
    // Fallback: try to read patient_id from any in-progress token via /queue/state
    if (!patId) {
      try {
        const qsr = await apiCall('/queue/state');
        if (qsr.ok) {
          const qs = await qsr.json();
          patId = qs.current_patient_id || qs.patient_id || null;
        }
      } catch (_) {}
    }

    var endpoint = patId ? '/lab-reports?patient_id=' + patId : '/lab-reports';
    const r = await apiCall(endpoint);
    if (!r.ok) throw new Error('Failed to load lab reports');
    const data = await r.json();
    // Accept both array and {reports:[...]} response shapes
    _labPickerAllReports = Array.isArray(data) ? data : (data.reports || data.data || []);
    renderLabPickerList(_labPickerAllReports);
  } catch (e) {
    listEl.innerHTML = '<div style="padding:1.5rem;text-align:center;color:var(--red);font-size:.82rem">' + esc(e.message) + '</div>';
  }
}

function renderLabPickerList(reports) {
  const listEl = document.getElementById('labPickerList');
  if (!reports || !reports.length) {
    listEl.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--muted);font-size:.84rem;font-style:italic">No lab reports found for this patient.</div>';
    return;
  }
  listEl.innerHTML = reports.map(function (rep) {
    var ext = (rep.file_name || '').split('.').pop().toLowerCase();
    var icon = ext === 'pdf' ? '📕' : '🖼️';
    var dt = rep.uploaded_at ? new Date(rep.uploaded_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
    var isChecked = _encounterLabDbSelected.some(function (s) { return s.id === rep.id; });
    return '<label style="display:flex;align-items:center;gap:.75rem;padding:.7rem 1rem;border-bottom:1px solid var(--border);cursor:pointer;transition:background .15s" ' +
      'onmouseover="this.style.background=\'var(--surface)\'" onmouseout="this.style.background=\'\'">' +
      '<input type="checkbox" data-rep-id="' + rep.id + '" ' + (isChecked ? 'checked' : '') +
      ' style="width:15px;height:15px;accent-color:var(--gold);flex-shrink:0" onchange="toggleLabPickerItem(this,' + rep.id + ')">' +
      '<span style="font-size:1.1rem">' + icon + '</span>' +
      '<div style="flex:1;min-width:0">' +
      '<div style="font-size:.85rem;font-weight:600;overflow:hidden;white-space:nowrap;text-overflow:ellipsis">' + esc(rep.report_title || rep.file_name) + '</div>' +
      '<div style="font-size:.72rem;color:var(--muted)">' + esc(rep.file_name) + ' · ' + dt + '</div>' +
      (rep.notes ? '<div style="font-size:.7rem;color:var(--muted);font-style:italic">' + esc(rep.notes) + '</div>' : '') +
      '</div>' +
      (rep.file_path ? '<a href="' + esc(rep.file_path) + '" target="_blank" onclick="event.stopPropagation()" class="btn-sm primary" style="text-decoration:none;flex-shrink:0">👁</a>' : '') +
      '</label>';
  }).join('');
}

window.toggleLabPickerItem = function (checkbox, repId) {
  var rep = _labPickerAllReports.find(function (r) { return r.id == repId; });
  if (!rep) return;
  if (checkbox.checked) {
    if (!_encounterLabDbSelected.some(function (s) { return s.id == repId; }))
      _encounterLabDbSelected.push(rep);
  } else {
    _encounterLabDbSelected = _encounterLabDbSelected.filter(function (s) { return s.id != repId; });
  }
};

function filterLabPickerList() {
  var q = document.getElementById('labPickerSearch').value.toLowerCase();
  if (!q) { renderLabPickerList(_labPickerAllReports); return; }
  var filtered = _labPickerAllReports.filter(function (r) {
    return (r.report_title || '').toLowerCase().includes(q) ||
      (r.file_name || '').toLowerCase().includes(q) ||
      (r.notes || '').toLowerCase().includes(q);
  });
  renderLabPickerList(filtered);
}

function confirmLabPickerSelection() {
  document.getElementById('encounterLabPickerModal').classList.remove('open');
  renderEncounterLabDbTags();
  var n = _encounterLabDbSelected.length;
  if (n) toast('📎 ' + n + ' report' + (n > 1 ? 's' : '') + ' selected', 'Will be linked to encounter on billing', 'success');
}

/** After billing, link selected DB reports to the encounter. */
async function linkEncounterDbReports(encounterId) {
  if (!_encounterLabDbSelected.length || !encounterId) return;
  for (var i = 0; i < _encounterLabDbSelected.length; i++) {
    try {
      await apiCall('/lab-reports/' + _encounterLabDbSelected[i].id + '/link-encounter', {
        method: 'POST', body: JSON.stringify({ encounter_id: encounterId })
      });
    } catch (e) { console.warn('[linkEncounterDbReports]', e); }
  }
  _encounterLabDbSelected = [];
  renderEncounterLabDbTags();
}

/** Upload brand-new encounter lab files for a patient after billing. */
async function uploadEncounterLabFiles(patientId) {
  if (!_encounterLabFiles.length || !patientId) return;
  for (var i = 0; i < _encounterLabFiles.length; i++) {
    var file = _encounterLabFiles[i];
    try {
      var formData = new FormData();
      formData.append('file', file);
      formData.append('patient_id', patientId);
      formData.append('report_type', file.name.replace(/\.[^.]+$/, ''));
      formData.append('notes', 'Attached via Patient Encounter');
      var headers = {};
      if (authToken) headers['Authorization'] = 'Bearer ' + authToken;
      await fetch(API + '/lab-reports/upload', { method: 'POST', headers: headers, body: formData });
    } catch (e) { console.warn('[uploadEncounterLabFiles] failed for', file.name, e); }
  }
  _encounterLabFiles = [];
  renderEncounterLabFiles();
}

function calcBMI() {
  const w = parseFloat(document.getElementById('weight').value);
  const h = parseFloat(document.getElementById('height').value);
  const bmiEl = document.getElementById('bmi');
  if (w && h) {
    const bmi = w / ((h / 100) ** 2);
    bmiEl.value = bmi.toFixed(1);
  } else {
    bmiEl.value = '';
  }
}

/* ─────────────────────────────────────────────
   APPOINTMENT AVAILABILITY SCHEDULER
───────────────────────────────────────────── */
const DAYS_OF_WEEK = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const DAYS_SHORT = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

// In-memory store (persists via localStorage keyed by doctor id)
function _availKey() { return 'avail_' + (getDoctorId() || 'doc'); }

function _loadLocalAvail() {
  try { return JSON.parse(localStorage.getItem(_availKey()) || 'null'); } catch(e) { return null; }
}
function _saveLocalAvail(data) {
  try { localStorage.setItem(_availKey(), JSON.stringify(data)); } catch(e) {}
}

function initAvailabilityUI() {
  const saved = _loadLocalAvail() || {
    days: [0,1,2,3,4], // Mon-Fri by default
    slotStart: '09:00', slotEnd: '13:00', duration: 30,
    evening: false, eveStart: '17:00', eveEnd: '20:00', maxPerDay: 20
  };

  // Render day toggles
  const toggleContainer = document.getElementById('availDayToggles');
  if (!toggleContainer) return;
  toggleContainer.innerHTML = DAYS_OF_WEEK.map(function(day, i) {
    const active = saved.days.includes(i) ? ' active' : '';
    return '<div class="day-toggle' + active + '" data-day="' + i + '" onclick="toggleDay(this,' + i + ')">' +
      '<span class="day-abbr">' + DAYS_SHORT[i] + '</span>' +
      '<span>' + (i === 5 || i === 6 ? '🟡' : '🟢') + '</span>' +
    '</div>';
  }).join('');

  // Fill fields
  const startEl = document.getElementById('availSlotStart');
  const endEl = document.getElementById('availSlotEnd');
  const durEl = document.getElementById('availSlotDuration');
  const eveCheck = document.getElementById('availEvening');
  const eveStartEl = document.getElementById('availEveStart');
  const eveEndEl = document.getElementById('availEveEnd');
  const maxEl = document.getElementById('availMaxPerDay');

  if (startEl) startEl.value = saved.slotStart || '09:00';
  if (endEl) endEl.value = saved.slotEnd || '13:00';
  if (durEl) durEl.value = saved.duration || 30;
  if (eveCheck) eveCheck.checked = saved.evening || false;
  if (eveStartEl) eveStartEl.value = saved.eveStart || '17:00';
  if (eveEndEl) eveEndEl.value = saved.eveEnd || '20:00';
  if (maxEl) maxEl.value = saved.maxPerDay || 20;

  toggleEveningSlot();
  updateSlotPreview();

  // Live preview on change
  ['availSlotStart','availSlotEnd','availSlotDuration','availEveStart','availEveEnd'].forEach(function(id) {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', updateSlotPreview);
  });
}

function toggleDay(el, dayIdx) {
  el.classList.toggle('active');
  updateSlotPreview();
}

function toggleEveningSlot() {
  const check = document.getElementById('availEvening');
  const slot = document.getElementById('availEveningSlot');
  if (!check || !slot) return;
  slot.style.display = check.checked ? 'grid' : 'none';
  updateSlotPreview();
}

function _generateSlots(start, end, durationMin) {
  const slots = [];
  if (!start || !end) return slots;
  let [sh, sm] = start.split(':').map(Number);
  let [eh, em] = end.split(':').map(Number);
  let cur = sh * 60 + sm;
  const endMin = eh * 60 + em;
  while (cur + durationMin <= endMin) {
    const h = Math.floor(cur / 60), m = cur % 60;
    slots.push((h < 10 ? '0' + h : h) + ':' + (m < 10 ? '0' + m : m));
    cur += durationMin;
  }
  return slots;
}

function updateSlotPreview() {
  const preview = document.getElementById('availSlotPreview');
  if (!preview) return;
  const dur = parseInt((document.getElementById('availSlotDuration') || {}).value || 30);
  const start = (document.getElementById('availSlotStart') || {}).value;
  const end = (document.getElementById('availSlotEnd') || {}).value;
  const eveCheck = document.getElementById('availEvening');
  const eveStart = (document.getElementById('availEveStart') || {}).value;
  const eveEnd = (document.getElementById('availEveEnd') || {}).value;

  let slots = _generateSlots(start, end, dur);
  if (eveCheck && eveCheck.checked) slots = slots.concat(_generateSlots(eveStart, eveEnd, dur));

  if (!slots.length) {
    preview.innerHTML = '<span style="font-size:.78rem;color:var(--muted)">No slots — check times</span>';
    return;
  }
  preview.innerHTML = slots.map(function(s) {
    return '<span class="slot-pill">' + s + '</span>';
  }).join('');
}

function getSelectedDays() {
  const toggles = document.querySelectorAll('.day-toggle.active');
  return Array.from(toggles).map(function(t) { return parseInt(t.getAttribute('data-day')); });
}

function saveAvailability() {
  const data = {
    days: getSelectedDays(),
    slotStart: document.getElementById('availSlotStart').value,
    slotEnd: document.getElementById('availSlotEnd').value,
    duration: parseInt(document.getElementById('availSlotDuration').value),
    evening: document.getElementById('availEvening').checked,
    eveStart: document.getElementById('availEveStart').value,
    eveEnd: document.getElementById('availEveEnd').value,
    maxPerDay: parseInt(document.getElementById('availMaxPerDay').value) || 20
  };
  _saveLocalAvail(data);
  // Also try to sync with backend
  const docId = getDoctorId();
  if (docId) {
    apiCall('/doctor-availability', {
      method: 'POST',
      body: JSON.stringify(Object.assign({ doctor_id: docId }, data))
    }).catch(function() {});
  }
  toast('✅ Schedule Saved', 'Patients can now see your available days', 'success');
}

/* ─────────────────────────────────────────────
   APPOINTMENT APPROVAL
───────────────────────────────────────────── */
async function approveAppointment(id) {
  try {
    const r = await apiCall('/appointments/' + id + '/approve', { method: 'POST', body: JSON.stringify({ status: 'approved' }) });
    if (r.ok) { toast('✅ Approved', 'Patient will be notified', 'success'); loadAppointmentsDoctor(); }
    else { const e = await r.json(); toast('Error', e.error || 'Failed', 'error'); }
  } catch(e) { toast('Error', e.message, 'error'); }
}

async function rejectAppointment(id) {
  const reason = prompt('Reason for rejection (optional):') || '';
  try {
    const r = await apiCall('/appointments/' + id + '/reject', { method: 'POST', body: JSON.stringify({ status: 'rejected', reason: reason }) });
    if (r.ok) { toast('❌ Rejected', 'Patient will be notified', 'info'); loadAppointmentsDoctor(); }
    else { const e = await r.json(); toast('Error', e.error || 'Failed', 'error'); }
  } catch(e) { toast('Error', e.message, 'error'); }
}

async function loadAppointmentsDoctor() {
  const tbody = document.getElementById('appointmentsDoctorTbody');
  const pendingTbody = document.getElementById('pendingApptTbody');
  const pendingBadge = document.getElementById('pendingApptBadge');
  if (!tbody) return;
  const docId = getDoctorId();
  if (!docId) {
    tbody.innerHTML = '<tr><td colspan="5" class="tbl-empty">Failed to identify doctor context.</td></tr>';
    return;
  }
  const filterStatus = (document.getElementById('apptFilterStatus') || {}).value || '';
  try {
    const r = await apiCall('/appointments');
    if (!r.ok) throw new Error('Failed to load appointments');
    const data = await r.json();
    const doctorAppointments = data.filter(function(a) { return a.doctor_id == docId; });

    // Pending section
    const pending = doctorAppointments.filter(function(a) { return a.status === 'pending'; });
    if (pendingBadge) {
      pendingBadge.textContent = pending.length;
      pendingBadge.style.display = pending.length > 0 ? 'inline' : 'none';
    }
    if (pendingTbody) {
      if (!pending.length) {
        pendingTbody.innerHTML = '<tr><td colspan="4" class="tbl-empty">No pending approvals 🎉</td></tr>';
      } else {
        pendingTbody.innerHTML = pending.map(function(a) {
          const dateStr = new Date(a.appointment_date).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
          const timeStr = (a.appointment_time || '').substring(0,5);
          return '<tr>' +
            '<td><strong>' + esc(a.patient_name) + '</strong><br><span style="font-size:.72rem;color:var(--muted)">' + esc(a.patient_contact || '') + '</span></td>' +
            '<td>' + dateStr + ' at ' + timeStr + '</td>' +
            '<td style="font-size:.75rem;color:var(--muted);max-width:180px;white-space:normal">' + esc(a.notes || '—') + '</td>' +
            '<td style="white-space:nowrap">' +
              '<button class="act approve" onclick="approveAppointment(' + a.id + ')">✅ Approve</button>' +
              '<button class="act" style="background:rgba(220,38,38,.08);border-color:rgba(220,38,38,.25);color:var(--red)" onclick="rejectAppointment(' + a.id + ')">❌ Reject</button>' +
            '</td>' +
            '</tr>';
        }).join('');
      }
    }

    // All appointments (with filter)
    const filtered = filterStatus
      ? doctorAppointments.filter(function(a) { return a.status === filterStatus; })
      : doctorAppointments;

    if (!filtered.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="tbl-empty">No appointments' + (filterStatus ? ' with status "' + filterStatus + '"' : '') + '</td></tr>';
      return;
    }
    tbody.innerHTML = filtered.map(function(a) {
      const dateStr = new Date(a.appointment_date).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
      const timeStr = (a.appointment_time || '').substring(0,5);
      const statusBadge = '<span class="appt-badge ' + (a.status || 'pending') + '">' + (a.status || 'pending') + '</span>';
      return '<tr>' +
        '<td><strong>' + esc(a.patient_name) + '</strong><br><span style="font-size:.72rem;color:var(--muted)">' + esc(a.patient_contact || '') + '</span></td>' +
        '<td>' + dateStr + ' at ' + timeStr + '</td>' +
        '<td style="color:var(--gold);font-family:\'JetBrains Mono\',monospace;font-weight:700">#' + (a.token_number || '\u2014') + '</td>' +
        '<td>' + statusBadge + '</td>' +
        '<td style="font-size:.75rem;color:var(--muted);max-width:200px;white-space:normal">' + esc(a.notes || '—') + '</td>' +
        '</tr>';
    }).join('');
  } catch(e) {
    console.error('[loadAppointmentsDoctor]', e);
    tbody.innerHTML = '<tr><td colspan="5" class="tbl-empty" style="color:var(--red)">Error loading appointments: ' + e.message + '</td></tr>';
  }
}


/* ─────────────────────────────────────────────
   ANALYTICS
───────────────────────────────────────────── */
async function loadAnalytics() {
  try {
    const r = await apiCall('/admin/reports');
    if (!r.ok) {
      document.getElementById('analyticsTable').innerHTML =
        '<tr><td colspan="4" class="tbl-empty" style="color:var(--amber)">Analytics require admin privileges.</td></tr>';
      return;
    }
    const data = await r.json();
    document.getElementById('analyticsTable').innerHTML = (data.slice(0, 30).map(function (d) {
      return '<tr>' +
        '<td>' + new Date(d.report_date).toLocaleDateString('en-IN') + '</td>' +
        '<td>' + (d.total_tokens || 0) + '</td>' +
        '<td>' + (d.total_consultations || 0) + '</td>' +
        '<td style="font-weight:600">\u20B9' + parseFloat(d.total_revenue || 0).toFixed(2) + '</td>' +
        '</tr>';
    }).join('')) || '<tr><td colspan="4" class="tbl-empty">No data available</td></tr>';
  } catch (e) { console.error('[loadAnalytics]', e); }
}

/* ─────────────────────────────────────────────
   ORCHESTRATION
───────────────────────────────────────────── */

/**
 * loadDashboardMetrics()
 * Fires every dashboard metric independently via Promise.allSettled
 * so a failure in one function never blocks the others.
 */
function loadDashboardMetrics() {
  Promise.allSettled([
    loadQueueMetric(),
    loadUniquePatients(),
    loadMedicinesDispensed(),
    loadPharmacyRevenue(),
    loadInventoryAlerts(),
    loadTotalRevenue(),
    loadDistinctBilling(),
    loadUnpaidBills(),
    loadNotice()
  ]);
}

function loadAllData() {
  loadDashboardMetrics();
  loadInventory();
}

function startApp() {
  loadAllData();
  // Queue real-time refresh every 3 s
  setInterval(loadQueueMetric, 3000);
  // Financial KPIs — independent 20 s intervals
  setInterval(loadTotalRevenue, 20000);
  setInterval(loadUnpaidBills, 20000);
  setInterval(loadDistinctBilling, 20000);
  // Operations/pharmacy — 30 s intervals
  setInterval(loadMedicinesDispensed, 30000);
  setInterval(loadPharmacyRevenue, 30000);
  setInterval(loadInventoryAlerts, 30000);
}

/* ─────────────────────────────────────────────
   LAB TESTS CATALOGUE
───────────────────────────────────────────── */
const LAB_TESTS = [
  { id: 'cbc', label: 'CBC (Complete Blood Count)' },
  { id: 'bmp', label: 'Basic Metabolic Panel' },
  { id: 'lft', label: 'Liver Function Test' },
  { id: 'kft', label: 'Kidney Function Test' },
  { id: 'lipid', label: 'Lipid Profile' },
  { id: 'thyroid', label: 'Thyroid (TSH / T3 / T4)' },
  { id: 'rbs', label: 'Random Blood Sugar' },
  { id: 'fbs', label: 'Fasting Blood Sugar' },
  { id: 'hba1c', label: 'HbA1c' },
  { id: 'urine', label: 'Urine Routine & Microscopy' },
  { id: 'esr', label: 'ESR' },
  { id: 'crp', label: 'CRP (C-Reactive Protein)' },
  { id: 'dengue', label: 'Dengue NS1 / IgM / IgG' },
  { id: 'malaria', label: 'Malaria Antigen' },
  { id: 'typhi', label: 'Widal / Typhoid' },
  { id: 'covid', label: 'COVID-19 Antigen' },
  { id: 'xray', label: 'Chest X-Ray' },
  { id: 'ecg', label: 'ECG / EKG' },
  { id: 'echo', label: '2D Echo' },
  { id: 'usg', label: 'USG Abdomen' },
  { id: 'culture', label: 'Blood / Urine Culture' },
  { id: 'stool', label: 'Stool Routine' },
  { id: 'lfts2', label: 'PT / INR (Coagulation)' },
  { id: 'vitd', label: 'Vitamin D' },
  { id: 'vitb12', label: 'Vitamin B12' },
  { id: 'iron', label: 'Iron Studies' },
];

/* ─────────────────────────────────────────────
   LAB STATE
───────────────────────────────────────────── */
let _labOrders = [];     // persisted in localStorage
let _currentLabPat = null;   // {id, name} for open order modal
let _uploadForPat = null;   // {id, name} for upload modal
let _quickLabFiles = [];
let _activePatientId = null;   // patient profile currently open
let _patientProfiles = {};     // cache: id -> full profile data

function renderLabTestGrid(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = LAB_TESTS.map(function (t) {
    return '<label class="lab-test-chip" id="chip_' + containerId + '_' + t.id + '">' +
      '<input type="checkbox" value="' + t.id + '" data-label="' + t.label + '"> ' + t.label + '</label>';
  }).join('');
  // Style chip on change
  el.querySelectorAll('input[type=checkbox]').forEach(function (cb) {
    cb.addEventListener('change', function () {
      cb.closest('.lab-test-chip').classList.toggle('selected', cb.checked);
    });
  });
}

function getSelectedTests(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return [];
  const checked = el.querySelectorAll('input[type=checkbox]:checked');
  const list = [];
  checked.forEach(function (cb) {
    list.push({ id: cb.value, label: cb.getAttribute('data-label') });
  });
  return list;
}

function clearTestGrid(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.querySelectorAll('input[type=checkbox]').forEach(function (cb) {
    cb.checked = false;
    const chip = cb.closest('.lab-test-chip');
    if (chip) chip.classList.remove('selected');
  });
}

function loadLabPage() {
  renderLabTestGrid('quickLabTestGrid');
  loadLabOrders();
  const sel = document.getElementById('labPatientSelect');
  if (sel) {
    sel.innerHTML = '<option value="">— Select patient —</option>' + allPatients.map(function (p) {
      return '<option value="' + p.id + '">' + esc(p.full_name) + ' (' + esc(p.contact) + ')</option>';
    }).join('');
  }
}

function filterLabPatients() {
  const q = document.getElementById('labQuickPatient').value.toLowerCase().trim();
  const sel = document.getElementById('labPatientSelect');
  if (!sel) return;
  const filtered = allPatients.filter(function (p) {
    return p.full_name.toLowerCase().includes(q) || (p.contact || '').includes(q);
  });
  sel.innerHTML = '<option value="">— Select patient —</option>' + filtered.map(function (p) {
    return '<option value="' + p.id + '">' + esc(p.full_name) + ' (' + esc(p.contact) + ')</option>';
  }).join('');
  if (filtered.length === 1) {
    sel.value = filtered[0].id;
  }
}

function handleQuickLabFile(files) {
  _quickLabFiles = Array.from(files);
  renderQuickLabFileList();
}

function renderQuickLabFileList() {
  const list = document.getElementById('quickLabFileList');
  if (!list) return;
  list.innerHTML = _quickLabFiles.map(function (f, idx) {
    const icon = f.type === 'application/pdf' ? '📄' : '🖼';
    const size = f.size > 1048576 ? (f.size / 1048576).toFixed(1) + ' MB' : Math.round(f.size / 1024) + ' KB';
    return '<div class="lab-file-item">' +
      '<span class="file-icon">' + icon + '</span>' +
      '<span class="file-name">' + esc(f.name) + '</span>' +
      '<span class="file-size">' + size + '</span>' +
      '<button class="file-remove" onclick="removeQuickLabFile(' + idx + ')">✕</button>' +
      '</div>';
  }).join('');
}

window.removeQuickLabFile = function (idx) {
  _quickLabFiles.splice(idx, 1);
  renderQuickLabFileList();
};

(function setupQuickUploadDrop() {
  document.addEventListener('DOMContentLoaded', function () {
    const dz = document.getElementById('quickLabDropZone');
    if (!dz) return;
    dz.addEventListener('dragover', function (e) { e.preventDefault(); dz.classList.add('drag-over'); });
    dz.addEventListener('dragleave', function () { dz.classList.remove('drag-over'); });
    dz.addEventListener('drop', function (e) {
      e.preventDefault(); dz.classList.remove('drag-over');
      handleQuickLabFile(e.dataTransfer.files);
    });
  });
})();

async function placeQuickLabOrder() {
  const patId = document.getElementById('labPatientSelect').value;
  if (!patId) { toast('Patient', 'Select a patient first', 'error'); return; }
  const tests = getSelectedTests('quickLabTestGrid');
  if (!tests.length) { toast('Tests', 'Select at least one test', 'error'); return; }
  const notes = document.getElementById('quickLabNotes').value.trim();
  const pat = allPatients.find(function (p) { return p.id == patId; });

  const filePayloads = [];
  var pending = _quickLabFiles.length;

  async function sendRequest() {
    try {
      const r = await apiCall('/lab/orders', {
        method: 'POST',
        body: JSON.stringify({
          patient_id: parseInt(patId),
          tests: tests,
          notes: notes,
          files: filePayloads
        })
      });
      if (r.ok) {
        toast('✅ Lab Order', tests.length + ' test(s) ordered for ' + (pat ? pat.full_name : ''), 'success');
        clearTestGrid('quickLabTestGrid');
        document.getElementById('quickLabNotes').value = '';
        document.getElementById('labPatientSelect').value = '';
        document.getElementById('labQuickPatient').value = '';
        _quickLabFiles = []; renderQuickLabFileList();
        loadLabOrders();
      } else {
        const err = await r.json();
        toast('Error', err.error || 'Failed to place order', 'error');
      }
    } catch (e) { toast('Error', e.message, 'error'); }
  }

  if (!pending) { await sendRequest(); return; }

  Array.from(_quickLabFiles).forEach(function (f) {
    const reader = new FileReader();
    reader.onload = async function (e) {
      filePayloads.push({ name: f.name, size: f.size, type: f.type, dataUrl: e.target.result });
      if (--pending === 0) await sendRequest();
    };
    reader.readAsDataURL(f);
  });
}

/* ─────────────────────────────────────────────
   LAB ORDERS TABLE
───────────────────────────────────────────── */
async function loadLabOrders() {
  try {
    const r = await apiCall('/lab/orders');
    _labOrders = await r.json();
    renderLabOrdersList();
  } catch (e) { console.error('[loadLabOrders]', e); }
}

function renderLabOrdersList() {
  const tbody = document.getElementById('labOrdersList');
  if (!tbody) return;
  if (!_labOrders.length) {
    tbody.innerHTML = '<tr><td colspan="7" class="tbl-empty">No lab orders yet. Use the panel above to place an order.</td></tr>';
    return;
  }
  tbody.innerHTML = _labOrders.map(function (o) {
    const d = new Date(o.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const tests = o.tests.map(function (t) { return t.label; }).join(', ');
    const badge = '<span class="lab-status-badge ' + o.status + '">' + o.status + '</span>';
    const fileCount = (o.files || []).length;
    const filesCell = fileCount
      ? '<span style="font-size:.78rem;color:var(--blue);font-weight:600">&#128196; ' + fileCount + ' file' + (fileCount > 1 ? 's' : '') + '</span>'
      : '<span style="color:var(--muted);font-size:.75rem">None</span>';
    return '<tr>' +
      '<td style="font-size:.78rem;white-space:nowrap">' + d + '</td>' +
      '<td><strong>' + esc(o.patientName) + '</strong></td>' +
      '<td style="font-size:.75rem;max-width:200px;white-space:normal;line-height:1.4">' + esc(tests) + '</td>' +
      '<td style="font-size:.75rem;color:var(--muted);max-width:140px;white-space:normal">' + esc(o.notes || '—') + '</td>' +
      '<td>' + badge + '</td>' +
      '<td>' + filesCell + '</td>' +
      '<td style="display:flex;gap:.3rem;flex-wrap:wrap">' +
      (o.status === 'ordered' ? '<button class="btn-sm success" onclick="markLabCompleted(' + o.id + ')">✓ Mark Done</button>' : '') +
      '<button class="btn-sm" onclick="openUploadForOrder(' + o.id + ',\'' + esc(o.patientName.replace(/'/g, "\\'")) + '\',' + o.patientId + ')">⬆ Upload</button>' +
      '<button class="btn-sm danger" onclick="deleteLabOrder(' + o.id + ')">✕</button>' +
      '</td>' +
      '</tr>';
  }).join('');
}

window.markLabCompleted = async function (id) {
  try {
    const r = await apiCall('/lab/orders/' + id + '/complete', { method: 'POST' });
    if (r.ok) {
      toast('Lab Order', 'Marked as completed', 'success');
      loadLabOrders();
    }
  } catch (e) { toast('Error', e.message, 'error'); }
};

window.deleteLabOrder = async function (id) {
  if (!confirm('Are you sure you want to delete this lab order?')) return;
  try {
    const r = await apiCall('/lab/orders/' + id, { method: 'DELETE' });
    if (r.ok) {
      toast('Deleted', 'Lab order removed', 'info');
      loadLabOrders();
    }
  } catch (e) { toast('Error', e.message, 'error'); }
};

window.openUploadForOrder = function (id, patientName, patientId) {
  _uploadForPat = { orderId: id, id: patientId, name: patientName };
  document.getElementById('uploadReportTitle').value = '';
  document.getElementById('uploadNotes').value = '';
  document.getElementById('labSelectedFiles').innerHTML = '';
  document.getElementById('labFileInput').value = '';
  document.getElementById('labUploadModal').classList.add('open');
};

/* ─────────────────────────────────────────────
   LAB ORDER MODAL (from Patient list → Lab button)
───────────────────────────────────────────── */
function openLabOrderForPatient(patId, patName) {
  _currentLabPat = { id: patId, name: patName };
  document.getElementById('labPatientRef').value = patName;
  renderLabTestGrid('labTestGrid');
  document.getElementById('labOrderNotes').value = '';
  document.getElementById('labOrderModal').classList.add('open');
}

async function submitLabOrder() {
  if (!_currentLabPat) return;
  const tests = getSelectedTests('labTestGrid');
  if (!tests.length) { toast('Tests', 'Select at least one test', 'error'); return; }
  const notes = document.getElementById('labOrderNotes').value.trim();
  try {
    const r = await apiCall('/lab/orders', {
      method: 'POST',
      body: JSON.stringify({
        patient_id: parseInt(_currentLabPat.id),
        tests: tests,
        notes: notes,
        files: []
      })
    });
    if (r.ok) {
      document.getElementById('labOrderModal').classList.remove('open');
      toast('✅ Lab Order', tests.length + ' test(s) ordered for ' + _currentLabPat.name, 'success');
      loadLabOrders();
    } else {
      const err = await r.json();
      toast('Error', err.error || 'Failed to place lab order', 'error');
    }
  } catch (e) {
    toast('Error', e.message, 'error');
  }
}

/* ─────────────────────────────────────────────
   LAB UPLOAD MODAL
───────────────────────────────────────────── */
function handleLabFileSelect(files) {
  const list = document.getElementById('labSelectedFiles');
  Array.from(files).forEach(function (f) {
    if (f.size > 10 * 1024 * 1024) { toast('File too large', f.name + ' > 10 MB', 'warn'); return; }
    const icon = f.type === 'application/pdf' ? '📄' : '🖼';
    const size = f.size > 1048576 ? (f.size / 1048576).toFixed(1) + ' MB' : Math.round(f.size / 1024) + ' KB';
    const div = document.createElement('div');
    div.className = 'lab-file-item';
    div.innerHTML = '<span class="file-icon">' + icon + '</span>' +
      '<span class="file-name">' + esc(f.name) + '</span>' +
      '<span class="file-size">' + size + '</span>';
    list.appendChild(div);
  });
}

async function saveLabUpload() {
  const title = document.getElementById('uploadReportTitle').value.trim();
  const notes = document.getElementById('uploadNotes').value.trim();
  const files = document.getElementById('labFileInput').files;
  if (!title) { toast('Title required', 'Enter a report title', 'error'); return; }
  if (!files.length) { toast('No file', 'Select a file to upload', 'error'); return; }
  const target = _uploadForPat;
  if (!target) return;

  let pending = files.length;

  async function uploadFile(f, dataUrl) {
    try {
      const payload = {
        lab_order_id: target.orderId || null,
        patient_id: parseInt(target.id),
        report_title: title,
        file_name: f.name,
        file_type: f.type,
        file_size: f.size,
        dataUrl: dataUrl,
        notes: notes
      };

      const r = await apiCall('/lab/reports', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (r.ok) {
        if (--pending === 0) {
          document.getElementById('labUploadModal').classList.remove('open');
          toast('✅ Uploaded', 'Lab report saved successfully', 'success');
          loadLabOrders();
          if (_activePatientId && _activePatientId == target.id) {
            loadPatientLabReports(_activePatientId);
          }
        }
      } else {
        const err = await r.json();
        toast('Upload Error', err.error || 'Failed to upload report', 'error');
      }
    } catch (e) {
      toast('Upload Error', e.message, 'error');
    }
  }

  Array.from(files).forEach(function (f) {
    const reader = new FileReader();
    reader.onload = function (e) {
      uploadFile(f, e.target.result);
    };
    reader.readAsDataURL(f);
  });
}

function openUploadForPatient() {
  if (!_activePatientId) return;
  _uploadForPat = { id: _activePatientId, name: document.getElementById('ppbName').textContent };
  document.getElementById('uploadReportTitle').value = '';
  document.getElementById('uploadNotes').value = '';
  document.getElementById('labSelectedFiles').innerHTML = '';
  document.getElementById('labFileInput').value = '';
  document.getElementById('labUploadModal').classList.add('open');
}

// Drag-and-drop for upload modal
(function setupUploadDrop() {
  document.addEventListener('DOMContentLoaded', function () {
    const dz = document.getElementById('labDropZone');
    if (!dz) return;
    dz.addEventListener('dragover', function (e) { e.preventDefault(); dz.classList.add('drag-over'); });
    dz.addEventListener('dragleave', function () { dz.classList.remove('drag-over'); });
    dz.addEventListener('drop', function (e) {
      e.preventDefault(); dz.classList.remove('drag-over');
      const fi = document.getElementById('labFileInput');
      handleLabFileSelect(e.dataTransfer.files);
    });
  });
})();

/* ─────────────────────────────────────────────
   PATIENT PROFILE MODAL
───────────────────────────────────────────── */
function switchPPTab(tab, el) {
  document.querySelectorAll('.ppb-tab').forEach(function (t) { t.classList.remove('active'); });
  document.querySelectorAll('.ppb-panel').forEach(function (p) { p.classList.remove('active'); });
  el.classList.add('active');
  const panel = document.getElementById('pp-' + tab);
  if (panel) panel.classList.add('active');
  if (tab === 'labs' && _activePatientId) {
    loadPatientUploadedReports(_activePatientId);
  }
}

function closePatientProfile() {
  document.getElementById('patientProfileModal').classList.remove('open');
  _activePatientId = null;
}

async function openPatientProfile(patId) {
  _activePatientId = patId;
  // Reset tabs
  document.querySelectorAll('.ppb-tab').forEach(function (t, i) { t.classList.toggle('active', i === 0); });
  document.querySelectorAll('.ppb-panel').forEach(function (p, i) { p.classList.toggle('active', i === 0); });
  document.getElementById('ppbName').textContent = 'Loading…';
  document.getElementById('ppbMeta').textContent = '';
  document.getElementById('ppbAvatar').textContent = '…';
  document.getElementById('patientProfileModal').classList.add('open');

  // Load from cache or API
  let pat = _patientProfiles[patId] || allPatients.find(function (p) { return p.id == patId; });
  if (pat) {
    renderPatientDemographics(pat.patient || pat);
    renderPatientEncounters(pat.encounters || []);
    renderPatientPrescriptions(pat.prescriptions || []);
    renderPatientLabReports(pat.lab_orders || []);
  }

  // Attempt full profile fetch (encounters, Rx, etc.)
  try {
    const r = await apiCall('/admin/patients/' + patId + '/profile');
    if (r.ok) {
      const full = await r.json();
      _patientProfiles[patId] = full;
      renderPatientDemographics(full.patient || full);
      renderPatientEncounters(full.encounters || []);
      renderPatientPrescriptions(full.prescriptions || []);
      renderPatientLabReports(full.lab_orders || []);
    } else {
      if (pat) {
        renderPatientDemographics(pat.patient || pat);
      } else {
        renderPatientLabReports([]);
      }
    }
  } catch (e) {
    if (pat) {
      renderPatientDemographics(pat.patient || pat);
    } else {
      renderPatientLabReports([]);
    }
  }
}

function renderPatientDemographics(p) {
  if (!p) return;
  const initials = (p.full_name || '?').split(' ').map(function (w) { return w[0]; }).slice(0, 2).join('').toUpperCase();
  document.getElementById('ppbAvatar').textContent = initials;
  document.getElementById('ppbName').textContent = p.full_name || '—';
  document.getElementById('ppbMeta').textContent = [
    p.age ? p.age + ' yrs' : null,
    p.gender ? p.gender.charAt(0).toUpperCase() + p.gender.slice(1) : null,
    p.blood_group || null,
    p.contact || null
  ].filter(Boolean).join(' · ');

  document.getElementById('ppDemoGrid').innerHTML = [
    { label: 'Patient ID', val: p.unique_id || ('PAT-' + p.id) },
    { label: 'Full Name', val: p.full_name },
    { label: 'Age', val: p.age ? p.age + ' years' : '—' },
    { label: 'Gender', val: p.gender || '—' },
    { label: 'Blood Group', val: p.blood_group || '—' },
    { label: 'Contact', val: p.contact || '—' },
    { label: 'Email', val: p.email || '—' },
    { label: 'Emergency Contact', val: p.emergency_contact ? (p.emergency_contact_name ? p.emergency_contact_name + ': ' : '') + p.emergency_contact : '—' },
    { label: 'Address', val: p.address || '—' },
    { label: 'Registered', val: p.created_at ? new Date(p.created_at).toLocaleDateString('en-IN') : '—' },
  ].map(function (item) {
    return '<div class="demo-item"><div class="demo-label">' + item.label + '</div><div class="demo-val">' + esc(String(item.val)) + '</div></div>';
  }).join('');

  document.getElementById('ppMedHistory').innerHTML = esc(p.medical_history || '—').replace(/\n/g, '<br>');
  document.getElementById('ppAllergies').textContent = p.known_allergies || 'None recorded';
}

function renderPatientEncounters(encounters) {
  const el = document.getElementById('ppEncountersList');
  if (!encounters.length) {
    el.innerHTML = '<div style="text-align:center;padding:2.5rem;color:var(--muted);font-size:.86rem">No encounter history found.</div>';
    return;
  }
  el.innerHTML = encounters.map(function (e) {
    const d = e.encounter_date ? new Date(e.encounter_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
    const vitals = [
      e.vitals_temp ? 'Temp: ' + e.vitals_temp + '°F' : null,
      e.vitals_bp ? 'BP: ' + e.vitals_bp : null,
      e.vitals_pulse ? 'Pulse: ' + e.vitals_pulse : null,
      e.vitals_spo2 ? 'SpO₂: ' + e.vitals_spo2 + '%' : null,
      e.vitals_weight ? 'Wt: ' + e.vitals_weight + 'kg' : null,
    ].filter(Boolean);
    return '<div class="encounter-card">' +
      '<div class="encounter-card-header">' +
      '<span class="encounter-date">📋 ' + d + '</span>' +
      (e.diagnosis ? '<span class="lab-status-badge completed">' + esc(e.diagnosis.substring(0, 30)) + (e.diagnosis.length > 30 ? '…' : '') + '</span>' : '') +
      '</div>' +
      (e.chief_complaints ? '<div style="font-size:.83rem;margin-bottom:.4rem"><strong>Complaints:</strong> ' + esc(e.chief_complaints) + '</div>' : '') +
      (vitals.length ? '<div class="vitals-strip">' + vitals.map(function (v) { return '<span class="vital-chip">' + v + '</span>'; }).join('') + '</div>' : '') +
      (e.notes ? '<div style="font-size:.78rem;color:var(--muted);margin-top:.35rem">' + esc(e.notes) + '</div>' : '') +
      '</div>';
  }).join('');
}

function renderPatientPrescriptions(rxList) {
  const el = document.getElementById('ppRxList');
  if (!rxList.length) {
    el.innerHTML = '<div style="text-align:center;padding:2.5rem;color:var(--muted);font-size:.86rem">No prescriptions found.</div>';
    return;
  }
  // Group by encounter date
  const byDate = {};
  rxList.forEach(function (rx) {
    const key = rx.encounter_date || rx.created_at || 'Unknown';
    if (!byDate[key]) byDate[key] = [];
    byDate[key].push(rx);
  });
  el.innerHTML = Object.keys(byDate).sort(function (a, b) { return b > a ? 1 : -1; }).map(function (date) {
    const d = new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const items = byDate[date].map(function (rx) {
      return '<div class="rx-line">' +
        '<span class="rx-dot"></span>' +
        '<span style="flex:1"><strong>' + esc(rx.medicine_name || rx.name || '—') + '</strong></span>' +
        '<span style="color:var(--muted);font-size:.76rem">×' + (rx.quantity || 1) + '</span>' +
        (rx.dosage_instructions ? '<span style="color:var(--muted);font-size:.74rem;margin-left:.5rem">' + esc(rx.dosage_instructions) + '</span>' : '') +
        '</div>';
    }).join('');
    return '<div class="encounter-card"><div class="encounter-card-header"><span class="encounter-date">💊 ' + d + '</span></div>' + items + '</div>';
  }).join('');
}

function renderPatientLabReports(patOrders) {
  const el = document.getElementById('ppLabsList');
  if (!el) return;
  if (!patOrders || !patOrders.length) {
    el.innerHTML = '<div style="text-align:center;padding:2.5rem;color:var(--muted);font-size:.86rem">No lab reports yet. Use the ⬆ Upload button to attach a report.</div>';
    return;
  }
  el.innerHTML = patOrders.map(function (o) {
    const d = new Date(o.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const tests = o.tests.map(function (t) { return t.label; }).join(', ');
    const badge = '<span class="lab-status-badge ' + o.status + '">' + o.status + '</span>';
    const files = (o.files || []).map(function (f) {
      const icon = f.type === 'application/pdf' ? '📄' : '🖼';
      const size = f.size > 1048576 ? (f.size / 1048576).toFixed(1) + ' MB' : Math.round(f.size / 1024) + ' KB';
      return '<div class="lab-report-card" style="margin:.35rem 0">' +
        '<div class="lab-report-icon">' + icon + '</div>' +
        '<div class="lab-report-info">' +
        '<div class="lab-report-name">' + esc(f.title || f.name) + '</div>' +
        '<div class="lab-report-meta">' + esc(f.name) + ' · ' + size + ' · ' + (f.date ? new Date(f.date).toLocaleDateString('en-IN') : d) + '</div>' +
        (f.notes ? '<div class="lab-report-meta" style="margin-top:.1rem">' + esc(f.notes) + '</div>' : '') +
        '</div>' +
        (f.dataUrl ? '<div class="lab-report-actions"><a href="' + f.dataUrl + '" target="_blank" class="btn-sm primary" style="text-decoration:none">View</a></div>' : '') +
        '</div>';
    }).join('');
    return '<div class="encounter-card">' +
      '<div class="encounter-card-header"><span class="encounter-date">🧪 ' + d + '</span>' + badge + '</div>' +
      '<div style="font-size:.8rem;margin-bottom:.4rem;color:var(--muted)">' + esc(tests) + '</div>' +
      (o.notes ? '<div style="font-size:.76rem;color:var(--muted);margin-bottom:.4rem">' + esc(o.notes) + '</div>' : '') +
      (files || '<div style="font-size:.76rem;color:var(--muted);font-style:italic">No files attached</div>') +
      '</div>';
  }).join('');
}

async function loadPatientLabReports(patId) {
  try {
    const r = await apiCall('/admin/patients/' + patId + '/profile');
    if (r.ok) {
      const full = await r.json();
      _patientProfiles[patId] = full;
      renderPatientLabReports(full.lab_orders || []);
    }
  } catch (e) { console.error('[loadPatientLabReports]', e); }
}

async function loadPatientUploadedReports(patId) {
  const el = document.getElementById('ppPatientUploads');
  if (!el) return;
  el.innerHTML = '<div style="color:var(--muted);font-size:.82rem;text-align:center;padding:1rem">Loading patient-uploaded reports…</div>';
  try {
    const r = await apiCall('/lab-reports/patient/' + patId);
    if (!r.ok) throw new Error('Failed to load');
    const reports = await r.json();
    if (!reports.length) {
      el.innerHTML = '<div style="color:var(--muted);font-size:.82rem;font-style:italic;padding:.5rem 0">No reports uploaded by patient yet.</div>';
      return;
    }
    el.innerHTML = reports.map(function (rep) {
      var dt = rep.report_date ? new Date(rep.report_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
      var ext = rep.file_url.split('.').pop().toLowerCase();
      var icon = ext === 'pdf' ? '📕' : ext === 'dcm' ? '🩻' : '🖼️';
      return '<div class="lab-report-card">' +
        '<div class="lab-report-icon">' + icon + '</div>' +
        '<div class="lab-report-info" style="flex:1;min-width:0;">' +
        '<div class="lab-report-name" style="font-weight:700;font-size:.88rem;">' + esc(rep.report_type) + '</div>' +
        (rep.lab_name ? '<div class="lab-report-meta">🏥 ' + esc(rep.lab_name) + '</div>' : '') +
        (rep.notes ? '<div class="lab-report-meta">📝 ' + esc(rep.notes) + '</div>' : '') +
        '<div class="lab-report-meta">Report date: ' + dt + '</div>' +
        '</div>' +
        '<div class="lab-report-actions">' +
        '<a href="' + esc(rep.file_url) + '" target="_blank" class="btn-sm primary" style="text-decoration:none;">👁️ View</a>' +
        '</div>' +
        '</div>';
    }).join('');
  } catch (e) {
    el.innerHTML = '<div style="color:var(--red);font-size:.82rem;padding:.5rem 0">' + esc(e.message) + '</div>';
  }
}

window.openPatientProfile = openPatientProfile;
window.openLabOrderForPatient = openLabOrderForPatient;
window.openUploadForPatient = openUploadForPatient;
window.closePatientProfile = closePatientProfile;
window.switchPPTab = switchPPTab;
window.openEncounterLabPicker = openEncounterLabPicker;
window.confirmLabPickerSelection = confirmLabPickerSelection;
window.filterLabPickerList = filterLabPickerList;

// Close profile modal on overlay click
document.getElementById('patientProfileModal').addEventListener('click', function (e) {
  if (e.target === this) closePatientProfile();
});

/* ─────────────────────────────────────────────
   MOBILE SIDEBAR
───────────────────────────────────────────── */
function toggleSidebar() {
  document.querySelector('.sidebar').classList.toggle('open');
  document.getElementById('sidebarOverlay').classList.toggle('open');
}
function closeSidebar() {
  document.querySelector('.sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('open');
}

/* ─────────────────────────────────────────────
   LEAVE MANAGEMENT
───────────────────────────────────────────── */
async function loadDoctorLeaves() {
  const tbody = document.getElementById('leavesList');
  if (!tbody) return;
  try {
    const r = await apiCall('/doctor/leaves');
    if (!r.ok) throw new Error('Failed to load leaves');
    const data = await r.json();
    if (!data.length) {
      tbody.innerHTML = '<tr><td colspan="3" class="tbl-empty">No scheduled leaves</td></tr>';
      return;
    }
    tbody.innerHTML = data.map(function (lv) {
      const dateStr = new Date(lv.leave_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      return '<tr>' +
        '<td><strong>' + dateStr + '</strong></td>' +
        '<td>' + esc(lv.reason || 'No reason provided') + '</td>' +
        '<td><button class="btn-sm danger" onclick="cancelDoctorLeave(' + lv.id + ')">Cancel</button></td>' +
        '</tr>';
    }).join('');
  } catch (e) {
    console.error('[loadDoctorLeaves]', e);
    tbody.innerHTML = '<tr><td colspan="3" class="tbl-empty" style="color:var(--red)">Error loading leaves: ' + e.message + '</td></tr>';
  }
}

async function markLeaveDay() {
  const dateVal = document.getElementById('leaveDateInput').value;
  const reasonVal = document.getElementById('leaveReasonInput').value.trim();
  if (!dateVal) {
    toast('Validation', 'Please select a leave date', 'error');
    return;
  }
  try {
    const r = await apiCall('/doctor/leaves', {
      method: 'POST',
      body: JSON.stringify({ leave_date: dateVal, reason: reasonVal })
    });
    if (r.ok) {
      toast('🌴 Leave Scheduled', 'Leave marked for ' + dateVal, 'success');
      document.getElementById('leaveDateInput').value = '';
      document.getElementById('leaveReasonInput').value = '';
      loadDoctorLeaves();
    } else {
      const err = await r.json();
      toast('Error', err.error || 'Failed to schedule leave', 'error');
    }
  } catch (e) {
    toast('Error', e.message, 'error');
  }
}

async function cancelDoctorLeave(id) {
  if (!confirm('Are you sure you want to cancel this leave?')) return;
  try {
    const r = await apiCall('/doctor/leaves/' + id, { method: 'DELETE' });
    if (r.ok) {
      toast('Cancelled', 'Leave cancelled successfully', 'success');
      loadDoctorLeaves();
    } else {
      const err = await r.json();
      toast('Error', err.error || 'Failed to cancel leave', 'error');
    }
  } catch (e) {
    toast('Error', e.message, 'error');
  }
}

window.markLeaveDay = markLeaveDay;
window.cancelDoctorLeave = cancelDoctorLeave;
window.loadDoctorLeaves = loadDoctorLeaves;

/* ─────────────────────────────────────────────
   DIAGNOSIS & COMPLAINT AUTOCOMPLETE
───────────────────────────────────────────── */
function initAutocomplete(inputId, suggestionsId, type) {
  const input = document.getElementById(inputId);
  const suggestions = document.getElementById(suggestionsId);
  if (!input || !suggestions) return;

  let debounceTimer;

  input.addEventListener('input', function () {
    clearTimeout(debounceTimer);
    const q = input.value.trim();
    if (q.length < 2) {
      suggestions.style.display = 'none';
      suggestions.innerHTML = '';
      return;
    }

    debounceTimer = setTimeout(async function () {
      try {
        const r = await apiCall('/clinical-catalog?type=' + type + '&q=' + encodeURIComponent(q));
        if (!r.ok) return;
        const data = await r.json();
        if (!data.length) {
          suggestions.style.display = 'none';
          suggestions.innerHTML = '';
          return;
        }
        suggestions.innerHTML = data.map(function (item) {
          const display = item.code ? '[' + item.code + '] ' + item.name : item.name;
          return '<div class="autocomplete-item" data-value="' + esc(item.name) + '">' + esc(display) + '</div>';
        }).join('');
        suggestions.style.display = 'block';
      } catch (e) {
        console.error('[autocomplete]', e);
      }
    }, 150);
  });

  suggestions.addEventListener('click', function (e) {
    const item = e.target.closest('.autocomplete-item');
    if (item) {
      input.value = item.getAttribute('data-value');
      suggestions.style.display = 'none';
      suggestions.innerHTML = '';
    }
  });

  document.addEventListener('click', function (e) {
    if (e.target !== input && !suggestions.contains(e.target)) {
      suggestions.style.display = 'none';
    }
  });
}

// Call autocomplete init on DOMContentLoaded or startApp
document.addEventListener('DOMContentLoaded', function () {
  initAutocomplete('complaints', 'complaintsAutocomplete', 'complaint');
  initAutocomplete('diagnosis', 'diagnosisAutocomplete', 'diagnosis');
});

/* ─────────────────────────────────────────────
   ENCOUNTER NOTES TEMPLATES
───────────────────────────────────────────── */
let allTemplates = [];

async function loadTemplatesList() {
  const select = document.getElementById('templateSelect');
  if (!select) return;
  try {
    const r = await apiCall('/doctor/templates');
    if (!r.ok) return;
    allTemplates = await r.json();
    select.innerHTML = '<option value="">— Load Template —</option>' + allTemplates.map(function (t) {
      return '<option value="' + t.id + '">' + esc(t.template_name) + '</option>';
    }).join('');
  } catch (e) {
    console.error('[loadTemplates]', e);
  }
}

function loadTemplateSelected() {
  const select = document.getElementById('templateSelect');
  if (!select || !select.value) return;
  const t = allTemplates.find(function (x) { return x.id == select.value; });
  if (!t) return;
  if (t.chief_complaints) document.getElementById('complaints').value = t.chief_complaints;
  if (t.observations) document.getElementById('observations').value = t.observations;
  if (t.diagnosis) document.getElementById('diagnosis').value = t.diagnosis;
  if (t.notes) document.getElementById('rxNotes').value = t.notes;
  toast('Template Loaded', 'Applied template: ' + t.template_name, 'success');
  select.value = ''; // reset selection
}

async function saveCurrentAsTemplate() {
  const nameInput = document.getElementById('newTemplateName');
  const name = nameInput ? nameInput.value.trim() : '';
  if (!name) {
    toast('Validation', 'Please enter a name for the template', 'error');
    return;
  }
  const payload = {
    template_name: name,
    chief_complaints: document.getElementById('complaints').value,
    observations: document.getElementById('observations').value,
    diagnosis: document.getElementById('diagnosis').value,
    notes: document.getElementById('rxNotes').value
  };
  try {
    const r = await apiCall('/doctor/templates', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    if (r.ok) {
      toast('Template Saved', 'Saved encounter template: ' + name, 'success');
      if (nameInput) nameInput.value = '';
      loadTemplatesList();
    } else {
      const err = await r.json();
      toast('Error', err.error || 'Failed to save template', 'error');
    }
  } catch (e) {
    toast('Error', e.message, 'error');
  }
}

window.loadTemplateSelected = loadTemplateSelected;
window.saveCurrentAsTemplate = saveCurrentAsTemplate;

/* ─────────────────────────────────────────────
   DAILY CASH REGISTER
───────────────────────────────────────────── */
function getTodayDateString() {
  const today = new Date();
  const offset = today.getTimezoneOffset();
  const localDate = new Date(today.getTime() - (offset*60*1000));
  return localDate.toISOString().split('T')[0];
}

async function loadDoctorCashRegister() {
  const dateEl = document.getElementById('doctorRegisterDate');
  if (!dateEl) return;
  if (!dateEl.value) {
    dateEl.value = getTodayDateString();
  }
  const dateVal = dateEl.value;
  try {
    const r = await apiCall('/reports/cash-register?date=' + dateVal);
    if (!r.ok) return;
    const d = await r.json();
    
    _setEl('docRegBilled', '\u20B9' + parseFloat(d.total_billed || 0).toFixed(0));
    _setEl('docRegCollected', '\u20B9' + parseFloat(d.total_collected || 0).toFixed(0));
    _setEl('docRegPending', '\u20B9' + parseFloat(d.total_pending || 0).toFixed(0));
    _setEl('docRegExpenses', '\u20B9' + parseFloat(d.total_expenses || 0).toFixed(0));
    _setEl('docRegProfit', '\u20B9' + parseFloat(d.net_profit || 0).toFixed(0));
    
    const bd = d.breakdown || {};
    const breakdownHtml = [
      { label: 'Cash', val: bd.cash, color: 'var(--green)' },
      { label: 'UPI', val: bd.upi, color: 'var(--gold)' },
      { label: 'Card', val: bd.card, color: 'var(--blue)' },
      { label: 'Online', val: bd.online, color: 'var(--amber)' },
      { label: 'Insurance', val: bd.insurance, color: 'var(--muted)' }
    ].map(function (item) {
      return '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:.5rem .75rem;font-size:.78rem;">' +
        '<span style="color:var(--muted);font-weight:600">' + item.label + ':</span> ' +
        '<strong style="color:' + item.color + '">\u20B9' + parseFloat(item.val || 0).toFixed(0) + '</strong>' +
        '</div>';
    }).join('');
    
    document.getElementById('docRegBreakdown').innerHTML = breakdownHtml;
    
    const txTbody = document.getElementById('docRegTransactions');
    const txs = d.transactions || [];
    if (!txs.length) {
      txTbody.innerHTML = '<tr><td colspan="5" class="tbl-empty">No transactions logged for this date.</td></tr>';
      return;
    }
    txTbody.innerHTML = txs.map(function (t) {
      const badge = '<span class="pill ' + t.payment_status + '">' + t.payment_status + '</span>';
      return '<tr>' +
        '<td style="color:var(--gold);font-family:\'JetBrains Mono\',monospace;font-weight:700">#' + (t.token_number || '?') + '</td>' +
        '<td><strong>' + esc(t.patient_name) + '</strong></td>' +
        '<td>\u20B9' + parseFloat(t.total_amount || 0).toFixed(2) + '</td>' +
        '<td>' + badge + '</td>' +
        '<td style="text-transform:uppercase;font-size:.76rem;color:var(--muted)">' + (t.payment_method || '—') + '</td>' +
        '</tr>';
    }).join('');
  } catch (e) {
    console.error('[loadDoctorCashRegister]', e);
  }
}

window.loadDoctorCashRegister = loadDoctorCashRegister;

/* ─────────────────────────────────────────────
   EVENT BINDINGS
 ───────────────────────────────────────────── */
/* ── Login button: click + touchend for mobile ── */
(function bindLoginBtn() {
  const btn = document.getElementById('loginBtn');
  if (!btn) return;
  btn.addEventListener('click', login);
  /* touchend prevents the 300ms tap delay on older mobile browsers */
  btn.addEventListener('touchend', function (e) {
    e.preventDefault();
    login();
  });
})();

/* ── Login inputs: Enter key on both email AND password fields ── */
document.getElementById('loginEmail')?.addEventListener('keyup', function (e) {
  if (e.key === 'Enter') {
    const pw = document.getElementById('loginPassword');
    if (pw && !pw.value) { pw.focus(); } else { login(); }
  }
});
document.getElementById('loginPassword')?.addEventListener('keyup', function (e) { if (e.key === 'Enter') login(); });

/* ── Mobile tap fix: ensure inputs inside loginOverlay are always tappable ── */
(function fixLoginInputs() {
  const overlay = document.getElementById('loginOverlay');
  if (!overlay) return;
  overlay.style.pointerEvents = 'auto';

  overlay.querySelectorAll('input').forEach(function (inp) {
    inp.style.pointerEvents = 'auto';
    inp.style.touchAction = 'manipulation';
    inp.style.webkitUserSelect = 'text';
    inp.style.userSelect = 'text';
    inp.style.cursor = 'text';
    inp.style.position = 'relative';
    inp.style.zIndex = '10';

    /* Explicit focus on touchend bypasses iOS tap-delay quirks */
    inp.addEventListener('touchstart', function (e) {
      e.stopPropagation();
    }, { passive: true });

    inp.addEventListener('touchend', function (e) {
      e.stopPropagation();
      var self = this;
      setTimeout(function () { self.focus(); }, 30);
    }, { passive: true });
  });
})();
document.getElementById('callNextBtn')?.addEventListener('click', callNext);
document.getElementById('skipBtn')?.addEventListener('click', skipToken);
document.getElementById('recallBtn')?.addEventListener('click', recallCurrent);
document.getElementById('resetQueueBtn')?.addEventListener('click', openResetModal);
document.getElementById('confirmResetBtn')?.addEventListener('click', function () { closeResetModal(); resetQueue(); });
document.getElementById('cancelResetBtn')?.addEventListener('click', closeResetModal);
document.getElementById('addMedBtn')?.addEventListener('click', addPrescription);
document.getElementById('completeBtn')?.addEventListener('click', completeEncounter);
document.getElementById('confirmBillBtn')?.addEventListener('click', doCompleteEncounter);
document.getElementById('cancelBillBtn')?.addEventListener('click', function () { document.getElementById('billModal').classList.remove('open'); });
document.getElementById('saveNoticeBtn')?.addEventListener('click', saveNotice);
document.getElementById('clearNoticeBtn')?.addEventListener('click', clearNotice);
document.getElementById('logoutBtn')?.addEventListener('click', function () { localStorage.clear(); location.reload(); });

/* ─────────────────────────────────────────────
   AUTO LOGIN (persisted session)
───────────────────────────────────────────── */
if (authToken) {
  document.getElementById('loginOverlay').style.display = 'none';
  document.getElementById('appContent').style.display = 'block';
  const storedName = localStorage.getItem('doc_name') || 'Doctor';
  const storedPhoto = localStorage.getItem('doc_photo') || '';
  document.getElementById('doctorName').textContent = storedName;
  const avatarEl = document.getElementById('docAvatar');
  if (storedPhoto) {
    avatarEl.innerHTML = `<img src="${storedPhoto}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
  } else {
    avatarEl.textContent = storedName.substring(0, 2).toUpperCase();
  }
  startApp();
}
/* ─────────────────────────────────────────────
   TOUCHSCREEN FIX
   Problem: Many elements use onclick="" attributes or are dynamically
   rendered. On iOS/Android these can suffer a 300 ms delay or miss
   taps entirely when pointer-events or compositing layers interfere.
   Solution:
   1. A delegated touchend→click forwarder on document covers ALL
      elements with [onclick], buttons, and key interactive classes.
   2. Day toggles get explicit touchend listeners re-attached every
      time initAvailabilityUI() renders them.
   3. The medicine category chips and med-list-items get the same
      treatment via a MutationObserver that watches their containers.
───────────────────────────────────────────── */

(function installTouchFix() {
  'use strict';

  /**
   * Selectors that should forward touchend → click.
   * This covers both static and dynamically-rendered elements.
   */
  var TOUCH_SELECTORS = [
    '[onclick]',
    'button',
    '.nav-item',
    '.nav-tab',
    '.inv-tab',
    '.day-toggle',
    '.med-cat-chip',
    '.med-list-item',
    '.autocomplete-item',
    '.lab-test-chip',
    '.ppb-tab',
    '.doc-card',
    '.act',
    '.btn-sm',
    '.stat-refresh',
    '.mob-toggle',
    'select',
    'input[type=checkbox]',
    'input[type=radio]',
    'label'
  ].join(',');

  var _touchStartX = 0;
  var _touchStartY = 0;
  var _touchMoved = false;

  document.addEventListener('touchstart', function (e) {
    var t = e.touches[0];
    _touchStartX = t.clientX;
    _touchStartY = t.clientY;
    _touchMoved = false;
  }, { passive: true });

  document.addEventListener('touchmove', function () {
    _touchMoved = true;
  }, { passive: true });

  document.addEventListener('touchend', function (e) {
    if (_touchMoved) return; // ignore scrolls

    var target = e.target;

    // Walk up the DOM to find the first matching interactive ancestor
    var el = target;
    var limit = 6; // max levels to walk up
    while (el && limit-- > 0) {
      if (el.matches && el.matches(TOUCH_SELECTORS)) break;
      el = el.parentElement;
    }
    if (!el || !el.matches || !el.matches(TOUCH_SELECTORS)) return;

    // Skip if it's an input/select that should handle its own events
    var tag = el.tagName.toLowerCase();
    if (tag === 'input' || tag === 'select' || tag === 'textarea') return;

    // Prevent the ghost 300 ms click and fire a real one immediately
    e.preventDefault();
    el.click();
  }, { passive: false });

  /**
   * Also patch the sidebar nav-item click handlers to work on touch.
   * They already have addEventListener('click') in the main code, so
   * the delegated touchend above will handle them — but we ensure
   * touch-action is set in JS too (belt-and-suspenders).
   */
  function patchNavItems() {
    document.querySelectorAll('.nav-item').forEach(function (item) {
      item.style.touchAction = 'manipulation';
      item.style.webkitTapHighlightColor = 'transparent';
      item.style.cursor = 'pointer';
    });
  }

  // Run once DOM is ready, and after any navigation that re-renders nav
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', patchNavItems);
  } else {
    patchNavItems();
  }

  // Observe DOM changes so dynamically injected elements get patched
  var _observer = new MutationObserver(function (mutations) {
    var needsPatch = mutations.some(function (m) { return m.addedNodes.length > 0; });
    if (needsPatch) patchNavItems();
  });
  _observer.observe(document.body, { childList: true, subtree: true });

})();

/* ─────────────────────────────────────────────
   DIAGNOST WORKFLOW
   Search patient by mobile → view dashboard
   (past visits + past diagnosts) → either continue
   an existing diagnost (next session) or start a
   brand-new diagnost (with optional first session).
───────────────────────────────────────────── */
var _diagCurrentPatient = null;   // { id, full_name, ... } currently loaded in dashboard
var _diagDiagnosts = [];          // diagnosts for the current patient
var _diagActiveDiagnostId = null; // diagnost targeted by the Add Session modal

async function diagSearchPatient() {
  const mobile = document.getElementById('diagSearchMobile').value.trim();
  const resultsEl = document.getElementById('diagSearchResults');
  if (!mobile) { toast('Search', 'Enter a mobile number to search', 'error'); return; }
  resultsEl.innerHTML = '<div style="padding:1rem;color:var(--muted);font-size:.84rem">Searching&hellip;</div>';
  try {
    const r = await apiCall('/doctor/diagnost/patients/search?mobile=' + encodeURIComponent(mobile));
    if (!r.ok) throw new Error('Search failed');
    const patients = await r.json();
    if (!patients.length) {
      resultsEl.innerHTML = '<div style="padding:1rem;color:var(--muted);font-size:.84rem;font-style:italic">No patients found for that number.</div>';
      return;
    }
    resultsEl.innerHTML = patients.map(function (p) {
      return '<div style="display:flex;justify-content:space-between;align-items:center;padding:.7rem .9rem;background:var(--surface2);border:1px solid var(--border);border-radius:10px;margin-bottom:.4rem">' +
        '<div><strong>' + esc(p.full_name) + '</strong>' +
        '<div style="font-size:.76rem;color:var(--muted)">' + (p.age || '\u2014') + ' yrs &middot; ' + esc(p.gender || '\u2014') + ' &middot; ' + esc(p.contact || '\u2014') + '</div></div>' +
        '<button class="btn-sm primary" onclick="diagSelectPatient(' + p.id + ')">Select &rarr;</button>' +
        '</div>';
    }).join('');
  } catch (e) {
    resultsEl.innerHTML = '<div style="padding:1rem;color:var(--red);font-size:.84rem">' + esc(e.message) + '</div>';
  }
}

async function diagSelectPatient(patientId) {
  try {
    const r = await apiCall('/doctor/diagnost/patients/' + patientId + '/dashboard');
    if (!r.ok) {
      const err = await r.json().catch(function () { return {}; });
      toast('Error', err.error || 'Failed to load patient dashboard', 'error');
      return;
    }
    const data = await r.json();
    _diagCurrentPatient = data.patient;
    _diagDiagnosts = data.diagnosts || [];

    document.getElementById('diagPatName').textContent = data.patient.full_name;
    document.getElementById('diagPatMeta').textContent = [
      data.patient.unique_id,
      data.patient.age ? data.patient.age + ' yrs' : null,
      data.patient.gender,
      data.patient.contact
    ].filter(Boolean).join(' \u00B7 ');
    document.getElementById('newDiagPatLabel').textContent = data.patient.full_name;

    renderDiagnostsList(_diagDiagnosts);

    document.getElementById('diagSearchResults').innerHTML = '';
    document.getElementById('diagSearchMobile').value = '';
    document.getElementById('diagPatientDashboard').style.display = 'block';
  } catch (e) {
    toast('Error', e.message, 'error');
  }
}

function diagBackToSearch() {
  document.getElementById('diagPatientDashboard').style.display = 'none';
  _diagCurrentPatient = null;
  _diagDiagnosts = [];
}

function renderDiagnostsList(diagnosts) {
  const tbody = document.getElementById('diagDiagnostsList');
  if (!diagnosts.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="tbl-empty">No diagnosts yet for this patient.</td></tr>';
    return;
  }
  tbody.innerHTML = diagnosts.map(function (d) {
    const started = d.started_at ? new Date(d.started_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '\u2014';
    const lastSession = d.last_session_date ? new Date(d.last_session_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '\u2014';
    const sessionsLabel = (d.session_count || 0) + (d.planned_sessions ? ' / ' + d.planned_sessions : '');
    const closed = d.status === 'completed' || d.status === 'discontinued';
    return '<tr>' +
      '<td><strong>' + esc(d.diagnosis_title) + '</strong>' + (d.diagnosis_code ? '<br><span style="font-size:.72rem;color:var(--muted)">' + esc(d.diagnosis_code) + '</span>' : '') + '</td>' +
      '<td><span class="appt-badge ' + (d.status === 'active' ? 'approved' : d.status === 'on_hold' ? 'pending' : 'rejected') + '">' + esc(d.status) + '</span></td>' +
      '<td style="font-size:.8rem">' + started + '</td>' +
      '<td style="font-size:.8rem">' + sessionsLabel + '</td>' +
      '<td style="font-size:.8rem">' + lastSession + '</td>' +
      '<td>' + (closed
        ? '<span style="font-size:.74rem;color:var(--muted)">Closed</span>'
        : '<button class="btn-sm primary" onclick="openAddSessionModal(' + d.id + ')">&#9658; Continue</button>') + '</td>' +
      '</tr>';
  }).join('');
}

/* ── Add Session (continue existing diagnost) ── */
function openAddSessionModal(diagnostId) {
  _diagActiveDiagnostId = diagnostId;
  const d = _diagDiagnosts.find(function (x) { return x.id === diagnostId; });
  document.getElementById('asDiagnosisLabel').textContent = d ? d.diagnosis_title : ('Diagnost #' + diagnostId);
  document.getElementById('asSessionDate').value = getTodayDateString();
  document.getElementById('asFindings').value = '';
  document.getElementById('asNotes').value = '';
  document.getElementById('addSessionModal').classList.add('open');
}

async function submitAddSession() {
  if (!_diagActiveDiagnostId) return;
  const session_date = document.getElementById('asSessionDate').value;
  const findings = document.getElementById('asFindings').value.trim();
  const notes = document.getElementById('asNotes').value.trim();
  if (!session_date) { toast('Validation', 'Session date is required', 'error'); return; }
  try {
    const r = await apiCall('/doctor/diagnost/' + _diagActiveDiagnostId + '/sessions', {
      method: 'POST',
      body: JSON.stringify({ session_date: session_date, findings: findings, notes: notes })
    });
    const d = await r.json();
    if (!r.ok) {
      if (r.status === 409) toast('Diagnost Closed', d.error || 'This diagnost is closed', 'warn');
      else toast('Error', d.error || 'Failed to add session', 'error');
      return;
    }
    toast('\u2705 Session Added', 'Session #' + d.session_number + ' recorded', 'success');
    document.getElementById('addSessionModal').classList.remove('open');
    if (_diagCurrentPatient) diagSelectPatient(_diagCurrentPatient.id);
  } catch (e) {
    toast('Error', e.message, 'error');
  }
}

/* ── New Diagnost (standalone) ── */
function openNewDiagnostModal() {
  if (!_diagCurrentPatient) return;
  document.getElementById('ndTitle').value = '';
  document.getElementById('ndCode').value = '';
  document.getElementById('ndDescription').value = '';
  document.getElementById('ndPlan').value = '';
  document.getElementById('ndPlannedSessions').value = '';
  document.getElementById('ndStartedAt').value = getTodayDateString();
  document.getElementById('ndIncludeFirstSession').checked = true;
  document.getElementById('ndFirstSessionFields').style.display = 'block';
  document.getElementById('ndSessionDate').value = getTodayDateString();
  document.getElementById('ndFindings').value = '';
  document.getElementById('ndNotes').value = '';
  document.getElementById('newDiagnostModal').classList.add('open');
}

async function submitNewDiagnost() {
  if (!_diagCurrentPatient) return;
  const diagnosis_title = document.getElementById('ndTitle').value.trim();
  const started_at = document.getElementById('ndStartedAt').value;
  if (!diagnosis_title || !started_at) {
    toast('Validation', 'Diagnosis title and started-on date are required', 'error');
    return;
  }
  const payload = {
    diagnosis_title: diagnosis_title,
    diagnosis_code: document.getElementById('ndCode').value.trim() || null,
    description: document.getElementById('ndDescription').value.trim() || null,
    treatment_plan: document.getElementById('ndPlan').value.trim() || null,
    planned_sessions: parseInt(document.getElementById('ndPlannedSessions').value) || null,
    started_at: started_at
  };
  if (document.getElementById('ndIncludeFirstSession').checked) {
    const sessionDate = document.getElementById('ndSessionDate').value;
    if (sessionDate) {
      payload.first_session = {
        session_date: sessionDate,
        findings: document.getElementById('ndFindings').value.trim() || null,
        notes: document.getElementById('ndNotes').value.trim() || null
      };
    }
  }
  try {
    const r = await apiCall('/doctor/diagnost/patients/' + _diagCurrentPatient.id + '/diagnosts', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    const d = await r.json();
    if (!r.ok) { toast('Error', d.error || 'Failed to create diagnost', 'error'); return; }
    toast('\u2705 Diagnost Created', diagnosis_title + (d.session ? ' \u2014 first session recorded' : ''), 'success');
    document.getElementById('newDiagnostModal').classList.remove('open');
    diagSelectPatient(_diagCurrentPatient.id);
  } catch (e) {
    toast('Error', e.message, 'error');
  }
}

window.diagSearchPatient = diagSearchPatient;
window.diagSelectPatient = diagSelectPatient;
window.diagBackToSearch = diagBackToSearch;
window.openAddSessionModal = openAddSessionModal;
window.submitAddSession = submitAddSession;
window.openNewDiagnostModal = openNewDiagnostModal;
window.submitNewDiagnost = submitNewDiagnost;
