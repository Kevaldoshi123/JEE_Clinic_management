/**
 * Care Core Clinic — Professional Portal Navigation Switcher
 * Floating compact portal selector widget with ZERO layout shifting.
 */

(function () {
  if (document.getElementById('carecore-portal-switcher-widget')) return;

  const style = document.createElement('style');
  style.textContent = `
    .c-portal-widget-btn {
      position: fixed;
      bottom: 24px;
      left: 24px;
      z-index: 99999;
      background: #0f172a;
      color: #ffffff;
      padding: 10px 18px;
      border-radius: 30px;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 13px;
      font-weight: 600;
      box-shadow: 0 10px 25px rgba(0,0,0,0.3);
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 10px;
      border: 1px solid #334155;
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .c-portal-widget-btn:hover {
      transform: translateY(-3px);
      background: #1e293b;
      box-shadow: 0 15px 35px rgba(0,0,0,0.4);
      border-color: #2563eb;
    }

    .c-portal-dropdown {
      display: none;
      position: fixed;
      bottom: 74px;
      left: 24px;
      z-index: 99999;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      width: 260px;
      max-height: 480px;
      overflow-y: auto;
      padding: 10px;
      box-shadow: 0 20px 40px rgba(0,0,0,0.18);
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    }

    .c-portal-dropdown-item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 9px 12px;
      color: #334155;
      text-decoration: none;
      font-size: 13px;
      font-weight: 500;
      border-radius: 10px;
      transition: background 0.15s;
    }

    .c-portal-dropdown-item:hover {
      background: #f1f5f9;
      color: #2563eb;
    }
  `;
  document.head.appendChild(style);

  const currentPage = window.location.pathname.split('/').pop() || 'homepage_design.html';

  const widget = document.createElement('div');
  widget.id = 'carecore-portal-switcher-widget';
  widget.innerHTML = `
    <div class="c-portal-widget-btn" onclick="togglePortalDropdown()">
      <span>🧭</span>
      <span>Portal Switcher</span>
      <span style="font-size:10px; opacity:0.7;">▲</span>
    </div>

    <div class="c-portal-dropdown" id="portalDropdownMenu">
      <div style="font-size:11px; font-weight:700; color:#94a3b8; text-transform:uppercase; letter-spacing:0.05em; padding:6px 12px 4px 12px;">Main Portals</div>
      <a href="homepage_design.html" class="c-portal-dropdown-item">🏠 Public Homepage</a>
      <a href="portal.html" class="c-portal-dropdown-item">🧭 Role Selection Hub</a>
      
      <div style="font-size:11px; font-weight:700; color:#94a3b8; text-transform:uppercase; letter-spacing:0.05em; padding:8px 12px 4px 12px; border-top:1px solid #f1f5f9; margin-top:4px;">Patient & Kiosk Services</div>
      <a href="generate-token.html" class="c-portal-dropdown-item" style="color:#2563eb; font-weight:600;">⚡ Instant Token Generator</a>
      <a href="queue-checkin.html" class="c-portal-dropdown-item">📱 Mobile QR Check-In</a>
      <a href="patient_portal_design.html" class="c-portal-dropdown-item">🏥 Patient Health Portal</a>
      <a href="display.html" class="c-portal-dropdown-item">📺 Live Waiting Board TV</a>

      <div style="font-size:11px; font-weight:700; color:#94a3b8; text-transform:uppercase; letter-spacing:0.05em; padding:8px 12px 4px 12px; border-top:1px solid #f1f5f9; margin-top:4px;">Clinical & Hospital Staff</div>
      <a href="doctor_portal_design.html" class="c-portal-dropdown-item">🩺 Doctor Consultation Desk</a>
      <a href="staff_portal_design.html" class="c-portal-dropdown-item">💊 Staff Reception & Pharmacy</a>
      <a href="admin_portal_design.html" class="c-portal-dropdown-item">📊 Admin Governance Panel</a>
      <a href="telehealth-room.html" class="c-portal-dropdown-item">📹 Telehealth Virtual Room</a>
      <a href="register.html" class="c-portal-dropdown-item">📝 Doctor Registration</a>
    </div>
  `;

  document.body.appendChild(widget);

  window.togglePortalDropdown = function () {
    const menu = document.getElementById('portalDropdownMenu');
    if (menu) {
      menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
    }
  };

  document.addEventListener('click', function (e) {
    const widgetEl = document.getElementById('carecore-portal-switcher-widget');
    if (widgetEl && !widgetEl.contains(e.target)) {
      const menu = document.getElementById('portalDropdownMenu');
      if (menu) menu.style.display = 'none';
    }
  });
})();
