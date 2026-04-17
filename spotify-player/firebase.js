// ═══════════════════════════════════════════════════
//  VioletTunes — Sync без авторизации
//  Код синхронизации: VIOLET-XXXX
//  Данные хранятся в Firebase Firestore
// ═══════════════════════════════════════════════════

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// ── Firebase config ──
// Получи на https://console.firebase.google.com
// Создай проект → Add Web App → скопируй config
// Включи Firestore Database (test mode)
const firebaseConfig = {
  apiKey:            "AIzaSyCvIjWMnvkCNm0hpmQvyLf12N2jFkcfu74",
  authDomain:        "spotify-player-f0b83.firebaseapp.com",
  projectId:         "spotify-player-f0b83",
  storageBucket:     "spotify-player-f0b83.firebasestorage.app",
  messagingSenderId: "408123320978",
  appId:             "1:408123320978:web:c3d28d3b5d7d43189b944b",
  measurementId:     "G-22M2TDJESW",
};

const CONFIGURED = firebaseConfig.apiKey !== 'PASTE_YOUR_API_KEY';

let app, db;
if (CONFIGURED) {
  app = initializeApp(firebaseConfig);
  db  = getFirestore(app);
}

// ── State ──
let syncCode       = localStorage.getItem('vt_sync_code') || null;
let syncUnsub      = null;
let pushDebounce   = null;
let isSyncing      = false;
let _applyingCloud = false;

// ── Public API ──
window.VTSync = { connect, disconnect, getSyncCode: () => syncCode, isConfigured: () => CONFIGURED };

// ── Авто-подключение если код уже сохранён ──
document.addEventListener('DOMContentLoaded', () => {
  bindUI();
  if (CONFIGURED && syncCode) {
    startListening(syncCode);
    setStatus('connected', syncCode);
  } else if (!CONFIGURED) {
    setStatus('unconfigured');
  } else {
    setStatus('idle');
  }
});

// ── Подключиться по коду ──
async function connect(code) {
  if (!CONFIGURED) { showSetupHint(); return; }
  code = code.trim().toUpperCase();
  if (!code) return;

  setStatus('loading');
  try {
    const ref  = doc(db, 'sync', code);
    const snap = await getDoc(ref);

    if (snap.exists()) {
      // Код существует — подтягиваем данные
      applyCloudData(snap.data());
      showToastGlobal(`Подключено к коду ${code}`);
    } else {
      // Новый код — создаём запись с текущими данными
      await pushToCloud(code);
      showToastGlobal(`Создан новый код ${code}`);
    }

    syncCode = code;
    localStorage.setItem('vt_sync_code', code);
    startListening(code);
    setStatus('connected', code);
  } catch (e) {
    console.error(e);
    setStatus('error');
    showToastGlobal('Ошибка подключения');
  }
}

// ── Отключиться ──
function disconnect() {
  if (syncUnsub) { syncUnsub(); syncUnsub = null; }
  syncCode = null;
  localStorage.removeItem('vt_sync_code');
  setStatus('idle');
  showToastGlobal('Синхронизация отключена');
}

// ── Слушать изменения в реальном времени ──
function startListening(code) {
  if (syncUnsub) syncUnsub();
  const ref = doc(db, 'sync', code);
  syncUnsub = onSnapshot(ref, snap => {
    if (!snap.exists() || isSyncing) return;
    const data    = snap.data();
    const cloudTs = data.updatedAt?.toMillis?.() || 0;
    const localTs = parseInt(localStorage.getItem('vt_last_push') || '0');
    // Применяем только если облако новее
    if (cloudTs > localTs + 1000) {
      applyCloudData(data);
      setStatus('connected', code);
    }
  }, err => {
    console.error('Listener error:', err);
    setStatus('error');
  });
}

// ── Применить данные из облака ──
function applyCloudData(data) {
  // Ставим флаг чтобы localStorage хук не пушил данные обратно
  _applyingCloud = true;
  if (data.history)   localStorage.setItem('vt_history',   JSON.stringify(data.history));
  if (data.liked)     localStorage.setItem('vt_liked',     JSON.stringify(data.liked));
  if (data.playlists) localStorage.setItem('vt_playlists', JSON.stringify(data.playlists));
  _applyingCloud = false;

  // Обновляем живые переменные в app.js
  if (window.vtApplySync) {
    window.vtApplySync(data);
  }
}

// ── Пушить данные в облако ──
async function pushToCloud(code) {
  if (!CONFIGURED || !code) return;
  isSyncing = true;
  try {
    const history   = JSON.parse(localStorage.getItem('vt_history')   || '{}');
    const liked     = JSON.parse(localStorage.getItem('vt_liked')     || '{}');
    const playlists = JSON.parse(localStorage.getItem('vt_playlists') || '[]');
    await setDoc(doc(db, 'sync', code), {
      history, liked, playlists,
      updatedAt: serverTimestamp(),
    }, { merge: true });
    localStorage.setItem('vt_last_push', Date.now().toString());
  } finally {
    isSyncing = false;
  }
}

// ── Дебаунс-пуш при изменении localStorage ──
const _origSetItem = localStorage.setItem.bind(localStorage);
localStorage.setItem = function(key, value) {
  _origSetItem(key, value);
  // Не пушим обратно то что только что пришло из облака
  if (!_applyingCloud && ['vt_history', 'vt_liked', 'vt_playlists'].includes(key) && syncCode) {
    clearTimeout(pushDebounce);
    pushDebounce = setTimeout(() => pushToCloud(syncCode), 1500);
    setStatus('saving');
  }
};

// ── Генерация кода ──
function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'VT-';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

// ── UI ──
function bindUI() {
  const btnOpen   = document.getElementById('btnSyncOpen');
  const modal     = document.getElementById('syncModal');
  const btnClose  = document.getElementById('syncModalClose');
  const btnGen    = document.getElementById('btnGenCode');
  const btnConn   = document.getElementById('btnConnectCode');
  const btnDisc   = document.getElementById('btnDisconnect');
  const codeInput = document.getElementById('syncCodeInput');
  const copyBtn   = document.getElementById('btnCopyCode');

  if (!btnOpen) return;

  btnOpen.addEventListener('click', () => modal.classList.remove('hidden'));
  btnClose.addEventListener('click', () => modal.classList.add('hidden'));
  modal.addEventListener('click', e => { if (e.target === modal) modal.classList.add('hidden'); });

  btnGen.addEventListener('click', () => {
    codeInput.value = generateCode();
  });

  btnConn.addEventListener('click', () => {
    const code = codeInput.value.trim();
    if (!code) { showToastGlobal('Введи код'); return; }
    connect(code);
    modal.classList.add('hidden');
  });

  btnDisc.addEventListener('click', () => {
    if (confirm('Отключить синхронизацию?')) {
      disconnect();
      modal.classList.add('hidden');
    }
  });

  copyBtn.addEventListener('click', () => {
    if (syncCode) {
      navigator.clipboard.writeText(syncCode).then(() => showToastGlobal('Код скопирован'));
    }
  });

  codeInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') btnConn.click();
  });

  // Показать текущий код если есть
  if (syncCode) codeInput.value = syncCode;
}

function setStatus(state, code) {
  const indicator = document.getElementById('syncIndicator');
  const label     = document.getElementById('syncLabel');
  const codeEl    = document.getElementById('syncCurrentCode');
  const discBtn   = document.getElementById('btnDisconnect');
  if (!indicator) return;

  const states = {
    idle:          { dot: '',   text: 'Не синхронизировано', color: 'var(--text-muted)' },
    loading:       { dot: '⟳',  text: 'Подключение...',      color: 'var(--text-muted)' },
    saving:        { dot: '↑',  text: 'Сохранение...',       color: '#f59e0b' },
    connected:     { dot: '●',  text: `Синхронизировано`,    color: '#10b981' },
    error:         { dot: '✕',  text: 'Ошибка',              color: '#ef4444' },
    unconfigured:  { dot: '○',  text: 'Firebase не настроен', color: 'var(--text-muted)' },
  };
  const s = states[state] || states.idle;
  indicator.textContent = s.dot;
  indicator.style.color = s.color;
  if (label) { label.textContent = s.text; label.style.color = s.color; }
  if (codeEl) codeEl.textContent = code ? `Код: ${code}` : '';
  if (discBtn) discBtn.classList.toggle('hidden', !syncCode);
}

function showToastGlobal(msg) {
  if (window.showToast) window.showToast(msg);
  else console.log(msg);
}
