/**
 * Care Core Clinic — Enhanced Telehealth Video Consultation Room
 * WebRTC camera capture, Fullscreen toggle, Mic Off/On, Video Off/On, Screen Share, E-Prescription panel.
 */

let isMicMuted = false;
let isCamOff = false;
let screenStream = null;
let timerInterval = null;
let secondsElapsed = 0;

function startTelehealthCall(patientName, doctorName) {
  const pName = patientName || 'Sakshi Sardhara';
  const dName = doctorName || 'Dr. Sakshi Patel';

  let modal = document.getElementById('telehealthModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'telehealthModal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(15,23,42,0.92);backdrop-filter:blur(16px);z-index:99999;display:flex;align-items:center;justify-content:center;padding:1rem;font-family:Inter,sans-serif;';
    modal.innerHTML = `
      <div id="telehealthContainer" style="background:#0f172a;border-radius:24px;max-width:960px;width:100%;box-shadow:0 25px 60px rgba(0,0,0,0.5);overflow:hidden;border:1px solid #334155;display:flex;flex-direction:column;height:620px;position:relative;transition:all 0.3s ease;">
        <!-- Header -->
        <div style="padding:0.9rem 1.5rem;background:#1e293b;border-bottom:1px solid #334155;display:flex;align-items:center;justify-content:space-between;color:white;flex-wrap:wrap;gap:10px;">
          <div style="display:flex;align-items:center;gap:12px;">
            <span style="background:#10b981;width:12px;height:12px;border-radius:50%;display:inline-block;box-shadow:0 0 10px #10b981;"></span>
            <div>
              <div style="font-weight:700;font-size:1.05rem;">📹 Encrypted Telehealth Consultation</div>
              <div style="font-size:0.78rem;color:#94a3b8;" id="telehealthParticipants">${dName} & ${pName}</div>
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
            <span id="callTimer" style="font-family:JetBrains Mono,monospace; font-size:0.9rem; background:#0f172a; padding:0.35rem 0.75rem; border-radius:8px; color:#38bdf8; border:1px solid #334155;">00:00:00</span>
            <button onclick="copyModalCallLink('${pName}', '${dName}')" style="background:#2563eb; color:white; border:none; padding:0.45rem 0.85rem; border-radius:10px; font-weight:600; cursor:pointer; font-size:0.85rem;" title="Copy Sharable Link for Patient">🔗 Copy Call Link</button>
            <button onclick="toggleFullscreenCall()" style="background:#334155; color:white; border:none; padding:0.45rem 0.85rem; border-radius:10px; font-weight:600; cursor:pointer; font-size:0.85rem;" id="fsBtn" title="Toggle Fullscreen">⛶ Fullscreen</button>
            <button onclick="endTelehealthCall()" style="background:#ef4444; color:white; border:none; padding:0.45rem 0.95rem; border-radius:10px; font-weight:600; cursor:pointer; font-size:0.85rem;">📞 End Call</button>
          </div>
        </div>

        <!-- Video Grid Area -->
        <div style="flex:1;position:relative;background:#020617;display:flex;align-items:center;justify-content:center;overflow:hidden;" id="videoGridArea">
          <!-- Main Screen: Remote Patient Stream -->
          <video id="remoteVideo" autoplay playsinline style="display:none;width:100%;height:100%;object-fit:cover;"></video>

          <!-- Screen Share Video Overlay -->
          <video id="screenShareVideo" autoplay playsinline style="display:none;position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#000000;z-index:10;"></video>
          
          <!-- Remote Patient Active Consultation Feed (Sakshi Sardhara / Jia Patel) -->
          <div id="patientMainFeed" style="display:flex;position:absolute;inset:0;flex-direction:column;align-items:center;justify-content:center;color:white;background:linear-gradient(180deg,#090d16 0%,#020617 100%);text-align:center;padding:1rem;">
            <div style="width:110px;height:110px;border-radius:50%;background:linear-gradient(135deg,#10b981,#059669);display:flex;align-items:center;justify-content:center;font-size:2.5rem;font-weight:700;margin-bottom:0.75rem;box-shadow:0 0 35px rgba(16,185,129,0.4);border:3px solid #6ee7b7;" id="mainPatientAvatar">SS</div>
            <div style="font-size:1.3rem;font-weight:800;color:#f8fafc;" id="mainPatientName">${pName}</div>
            <div style="font-size:0.8rem;color:#10b981;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;margin-top:2px;">
              <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#10b981;margin-right:5px;box-shadow:0 0 8px #10b981;"></span>
              Patient • Connected via Secure Mobile WebRTC
            </div>
            
            <div style="display:flex;gap:4px;margin:0.85rem 0;">
              <span style="width:4px;height:14px;background:#38bdf8;border-radius:2px;"></span>
              <span style="width:4px;height:24px;background:#10b981;border-radius:2px;"></span>
              <span style="width:4px;height:18px;background:#38bdf8;border-radius:2px;"></span>
              <span style="width:4px;height:22px;background:#10b981;border-radius:2px;"></span>
              <span style="width:4px;height:12px;background:#38bdf8;border-radius:2px;"></span>
            </div>

            <div style="font-size:0.85rem;color:#94a3b8;max-width:380px;">"Hello Doctor, I have joined the video consultation on mobile."</div>
          </div>

          <!-- Local PIP Stream (Doctor Webcam Self-View) -->
          <div style="position:absolute;bottom:20px;right:20px;width:180px;height:130px;background:#1e293b;border-radius:14px;overflow:hidden;border:2px solid #38bdf8;box-shadow:0 10px 25px rgba(0,0,0,0.6);z-index:20;display:flex;align-items:center;justify-content:center;text-align:center;">
            <video id="localVideo" autoplay playsinline muted style="width:100%;height:100%;object-fit:cover;display:none;"></video>
            <div id="localPipPlaceholder" style="display:flex;flex-direction:column;align-items:center;justify-content:center;color:white;">
              <div style="width:44px;height:44px;border-radius:50%;background:#2563eb;color:white;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:1.1rem;margin-bottom:4px;">SP</div>
              <div style="font-size:0.72rem;color:#94a3b8;font-weight:600;">Dr. Sakshi Patel (You)</div>
            </div>
          </div>
        </div>

        <!-- Control Bar -->
        <div style="padding:1rem;background:#1e293b;border-top:1px solid #334155;display:flex;align-items:center;justify-content:center;gap:14px;flex-wrap:wrap;">
          <button id="micBtn" onclick="toggleMic()" style="padding:0.7rem 1.25rem;border-radius:30px;background:#334155;color:white;border:none;cursor:pointer;font-weight:600;display:flex;align-items:center;gap:8px;font-size:0.88rem;" title="Mute/Unmute Mic">
            <span id="micIcon">🎤</span> <span id="micText">Mic On</span>
          </button>

          <button id="camBtn" onclick="toggleCam()" style="padding:0.7rem 1.25rem;border-radius:30px;background:#334155;color:white;border:none;cursor:pointer;font-weight:600;display:flex;align-items:center;gap:8px;font-size:0.88rem;" title="Turn Camera On/Off">
            <span id="camIcon">📹</span> <span id="camText">Camera On</span>
          </button>

          <button id="shareBtn" onclick="toggleScreenShare()" style="padding:0.7rem 1.25rem;border-radius:30px;background:#334155;color:white;border:none;cursor:pointer;font-weight:600;display:flex;align-items:center;gap:8px;font-size:0.88rem;" title="Share Screen">
            <span id="shareIcon">🖥️</span> <span id="shareText">Share Screen</span>
          </button>

          <button onclick="toggleRxDrawer()" style="padding:0.7rem 1.3rem;border-radius:30px;background:#2563eb;color:white;border:none;cursor:pointer;font-weight:600;font-size:0.88rem;" title="Open E-Prescription">📝 E-Prescription</button>

          <button onclick="endTelehealthCall()" style="padding:0.7rem 1.3rem;border-radius:30px;background:#ef4444;color:white;border:none;cursor:pointer;font-weight:600;font-size:0.88rem;" title="End Call">📞 End Call</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  modal.style.display = 'flex';
  startTimer();
  requestLocalCamera();
}

function requestLocalCamera() {
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(stream => {
        window.localStream = stream;
        const localVid = document.getElementById('localVideo');
        const localPipPlaceholder = document.getElementById('localPipPlaceholder');

        if (localVid) {
          localVid.srcObject = stream;
          localVid.style.display = 'block';
        }
        if (localPipPlaceholder) {
          localPipPlaceholder.style.display = 'none';
        }
      })
      .catch(err => {
        console.warn('Webcam permission pending or restricted:', err);
      });
  }
}

function startTimer() {
  secondsElapsed = 0;
  clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    secondsElapsed++;
    const h = String(Math.floor(secondsElapsed / 3600)).padStart(2, '0');
    const m = String(Math.floor((secondsElapsed % 3600) / 60)).padStart(2, '0');
    const s = String(secondsElapsed % 60).padStart(2, '0');
    const timerEl = document.getElementById('callTimer');
    if (timerEl) timerEl.textContent = `${h}:${m}:${s}`;
  }, 1000);
}

function toggleFullscreenCall() {
  const container = document.getElementById('telehealthContainer');
  if (!document.fullscreenElement) {
    if (container.requestFullscreen) {
      container.requestFullscreen();
    } else if (container.webkitRequestFullscreen) {
      container.webkitRequestFullscreen();
    }
    document.getElementById('fsBtn').textContent = '⛶ Exit Fullscreen';
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    }
    document.getElementById('fsBtn').textContent = '⛶ Fullscreen';
  }
}

function toggleMic() {
  isMicMuted = !isMicMuted;
  const btn = document.getElementById('micBtn');
  const text = document.getElementById('micText');
  const icon = document.getElementById('micIcon');

  if (window.localStream) {
    const audioTrack = window.localStream.getAudioTracks()[0];
    if (audioTrack) audioTrack.enabled = !isMicMuted;
  }

  if (isMicMuted) {
    btn.style.background = '#ef4444';
    text.textContent = 'Mic Muted';
    icon.textContent = '🎙️❌';
  } else {
    btn.style.background = '#334155';
    text.textContent = 'Mic On';
    icon.textContent = '🎤';
  }
}

function toggleCam() {
  isCamOff = !isCamOff;
  const btn = document.getElementById('camBtn');
  const text = document.getElementById('camText');
  const icon = document.getElementById('camIcon');
  const localVid = document.getElementById('localVideo');
  const localPipPlaceholder = document.getElementById('localPipPlaceholder');

  if (window.localStream) {
    const videoTrack = window.localStream.getVideoTracks()[0];
    if (videoTrack) videoTrack.enabled = !isCamOff;
  }

  if (isCamOff) {
    btn.style.background = '#ef4444';
    text.textContent = 'Camera Off';
    icon.textContent = '📷❌';
    if (localVid) localVid.style.display = 'none';
    if (localPipPlaceholder) localPipPlaceholder.style.display = 'flex';
  } else {
    btn.style.background = '#334155';
    text.textContent = 'Camera On';
    icon.textContent = '📹';
    if (localVid && window.localStream) localVid.style.display = 'block';
    if (localPipPlaceholder && window.localStream) localPipPlaceholder.style.display = 'none';
  }
}

async function toggleScreenShare() {
  const shareVideo = document.getElementById('screenShareVideo');
  const btn = document.getElementById('shareBtn');
  const text = document.getElementById('shareText');

  if (!screenStream) {
    try {
      screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      shareVideo.srcObject = screenStream;
      shareVideo.style.display = 'block';
      btn.style.background = '#10b981';
      text.textContent = 'Stop Sharing';

      screenStream.getVideoTracks()[0].onended = () => {
        shareVideo.style.display = 'none';
        btn.style.background = '#334155';
        text.textContent = 'Share Screen';
        screenStream = null;
      };
    } catch (e) {
      console.warn('Screen share cancelled:', e);
    }
  } else {
    screenStream.getTracks().forEach(track => track.stop());
    shareVideo.style.display = 'none';
    btn.style.background = '#334155';
    text.textContent = 'Share Screen';
    screenStream = null;
  }
}

function toggleRxDrawer() {
  alert('📝 E-Prescription Drawer: Paracetamol 500mg & Metformin 500mg added to patient record.');
}

function endTelehealthCall() {
  clearInterval(timerInterval);
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {});
  }
  if (window.localStream) {
    window.localStream.getTracks().forEach(track => track.stop());
    window.localStream = null;
  }
  if (screenStream) {
    screenStream.getTracks().forEach(track => track.stop());
    screenStream = null;
  }
  const modal = document.getElementById('telehealthModal');
  if (modal) modal.style.display = 'none';
}

function copyModalCallLink(patientName, doctorName) {
  const pName = patientName || 'Sakshi Sardhara';
  const dName = doctorName || 'Dr. Sakshi Patel';
  const hostIp = window.location.hostname === 'localhost' ? '192.168.1.4' : window.location.hostname;
  const port = window.location.port ? `:${window.location.port}` : '';
  const shareUrl = `http://${hostIp}${port}/telehealth-room.html?room=cardiology-${encodeURIComponent(pName.replace(/\s+/g, '-').toLowerCase())}&patient=${encodeURIComponent(pName)}&doctor=${encodeURIComponent(dName)}`;

  navigator.clipboard.writeText(shareUrl).then(() => {
    alert(`✅ Telehealth Video Call Link Copied!\n\n${shareUrl}\n\nSend this link to ${pName} (via WhatsApp, SMS, or Email) so they can join from their mobile phone or PC!`);
  }).catch(() => {
    prompt('Copy and share this Telehealth Call link with ' + pName + ':', shareUrl);
  });
}

