// ═══════════════════════════════════════════
//  VioletTunes — Smart Recommendations
// ═══════════════════════════════════════════

const YT_API = 'https://www.googleapis.com/youtube/v3';
let YT_API_KEY = localStorage.getItem('vt_yt_key') || 'AIzaSyBU-H0DMXXizBKEXOg3KN5lR2xuaf3R82I';

// ══ BACKEND URL — меняй на свой Render URL после деплоя ══
const BACKEND_URL = localStorage.getItem('vt_backend_url') || 'https://violettunes-backend.onrender.com';

// ══ LISTEN HISTORY & SMART ENGINE ══
// Структура записи: { id, name, artist, cover, src, playCount, totalSec, lastPlayed, keywords[] }
let listenHistory = JSON.parse(localStorage.getItem('vt_history')   || '{}');
let liked     = JSON.parse(localStorage.getItem('vt_liked')     || '{}');
let playlists = JSON.parse(localStorage.getItem('vt_playlists') || '[]');

// Текущая сессия прослушивания
let sessionStart = null;
let sessionTrackId = null;
let forYouRendered = false;

function saveHistory() { localStorage.setItem('vt_history', JSON.stringify(listenHistory)); }

// Записать факт прослушивания
function recordPlay(track) {
  if (!track) return;
  const id = track.id;
  if (!listenHistory[id]) {
    listenHistory[id] = {
      id, name: track.name, artist: track.artist, cover: track.cover,
      playCount: 0, totalSec: 0, lastPlayed: 0,
      keywords: extractKeywords(track.name + ' ' + track.artist),
    };
  }
  listenHistory[id].playCount++;
  listenHistory[id].lastPlayed = Date.now();
  listenHistory[id].name   = track.name;
  listenHistory[id].artist = track.artist;
  listenHistory[id].cover  = track.cover;
  saveHistory();
  forYouRendered = false;
}

// Записать сколько секунд прослушано
function recordListenTime(trackId, seconds) {
  if (!listenHistory[trackId] || seconds < 5) return;
  listenHistory[trackId].totalSec = (listenHistory[trackId].totalSec || 0) + seconds;
  saveHistory();
}

// Извлечь ключевые слова из названия
function extractKeywords(text) {
  const stopWords = new Set(['the','a','an','in','on','at','to','for','of','and','or','is','ft','feat','official','video','lyrics','audio','music','hd','mv']);
  return text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w) && !/^\d+$/.test(w))
    .slice(0, 6);
}

// ══ RECOMMENDATION ENGINE ══
function buildRecommendations() {
  const entries = Object.values(listenHistory);
  if (!entries.length) return null;

  // Скор = playCount * 2 + totalSec/30 + (свежесть: чем новее тем выше)
  const now = Date.now();
  const scored = entries.map(e => ({
    ...e,
    score: e.playCount * 2 + (e.totalSec || 0) / 30 + (1 / ((now - e.lastPlayed) / 3600000 + 1)),
  })).sort((a, b) => b.score - a.score);

  // Топ артисты
  const artistCount = {};
  scored.forEach(e => {
    const a = e.artist;
    artistCount[a] = (artistCount[a] || 0) + e.score;
  });
  const topArtists = Object.entries(artistCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name]) => name);

  // Топ ключевые слова
  const kwCount = {};
  scored.slice(0, 20).forEach(e => {
    (e.keywords || []).forEach(kw => { kwCount[kw] = (kwCount[kw] || 0) + 1; });
  });
  const topKw = Object.entries(kwCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([kw]) => kw);

  // Генерируем поисковые запросы для YouTube
  const queries = [];

  // 1. По топ-артистам
  topArtists.slice(0, 3).forEach(artist => {
    queries.push({ label: `Похоже на ${artist}`, query: `${artist} similar music` });
  });

  // 2. По ключевым словам
  if (topKw.length >= 3) {
    queries.push({ label: 'По твоим вкусам', query: topKw.slice(0, 4).join(' ') + ' music' });
  }

  // 3. Микс топ-артистов
  if (topArtists.length >= 2) {
    queries.push({ label: 'Твой микс', query: topArtists.slice(0, 2).join(' ') + ' mix playlist' });
  }

  return {
    topArtists,
    topKeywords: topKw,
    topTracks: scored.slice(0, 5),
    queries,
    totalTracks: entries.length,
    totalTime: Math.round(entries.reduce((s, e) => s + (e.totalSec || 0), 0) / 60),
  };
}

// ══ MOODS (упрощённые, только в поиске) ══
const MOODS = [
  { id: 'energetic',  name: 'Энергия',   emoji: '⚡', query: 'energetic workout music 2024',    color: 'linear-gradient(135deg,#f59e0b,#ef4444)' },
  { id: 'chill',      name: 'Чилл',      emoji: '🌊', query: 'chill lofi beats relax',          color: 'linear-gradient(135deg,#06b6d4,#3b82f6)' },
  { id: 'happy',      name: 'Радость',   emoji: '😊', query: 'happy upbeat pop music',          color: 'linear-gradient(135deg,#f59e0b,#ec4899)' },
  { id: 'focus',      name: 'Фокус',     emoji: '🎯', query: 'focus study music concentration', color: 'linear-gradient(135deg,#10b981,#059669)' },
  { id: 'party',      name: 'Вечеринка', emoji: '🎉', query: 'party dance hits 2024',           color: 'linear-gradient(135deg,#ec4899,#f43f5e)' },
  { id: 'night',      name: 'Ночь',      emoji: '🌙', query: 'night drive synthwave music',     color: 'linear-gradient(135deg,#1e1b4b,#7c3aed)' },
  { id: 'hiphop',     name: 'Hip-Hop',   emoji: '🎤', query: 'hip hop rap hits 2024',           color: 'linear-gradient(135deg,#374151,#111827)' },
  { id: 'rock',       name: 'Рок',       emoji: '🎸', query: 'rock music hits classic',         color: 'linear-gradient(135deg,#dc2626,#7f1d1d)' },
];

// ══ State ══
let tracks        = [];
let currentIndex  = -1;
let isPlaying     = false;
let isShuffle     = false;
let isRepeat      = false;
let isMuted       = false;
let prevVolume    = 80;
let currentSrc    = 'youtube';
let ytPlayer      = null;
let ytReady       = false;
let progressTimer = null;
let nextPageToken = '';
let lastQuery     = '';
let pendingTrack  = null;

// ══ DOM ══
const $ = id => document.getElementById(id);
const playerTitle      = $('playerTitle');
const playerArtist     = $('playerArtist');
const playerCover      = $('playerCover');
const btnPlay          = $('btnPlay');
const btnPrev          = $('btnPrev');
const btnNext          = $('btnNext');
const btnShuffle       = $('btnShuffle');
const btnRepeat        = $('btnRepeat');
const btnLike          = $('btnLike');
const btnAddToPlaylist = $('btnAddToPlaylist');
const btnMute          = $('btnMute');
const iconPlay         = $('iconPlay');
const iconPause        = $('iconPause');
const progressBar      = $('progressBar');
const progressFill     = $('progressFill');
const progressThumb    = $('progressThumb');
const timeCurrent      = $('timeCurrent');
const timeTotal        = $('timeTotal');
const volumeSlider     = $('volumeSlider');
const sourceBadge      = $('sourceBadge');
const searchInput      = $('searchInput');
const searchBtn        = $('searchBtn');
const ytKeyInput       = $('ytKeyInput');
const ytKeySave        = $('ytKeySave');
const modalOverlay     = $('modalOverlay');
const modalBody        = $('modalBody');
const modalClose       = $('modalClose');
const heroVinyl        = $('heroVinyl');

// ══ YouTube IFrame API ══
window.onYouTubeIframeAPIReady = function () {
  ytPlayer = new YT.Player('ytPlayer', {
    height: '1', width: '1',
    playerVars: { autoplay: 0, controls: 0 },
    events: {
      onReady: () => {
        ytReady = true;
        ytPlayer.setVolume(+volumeSlider.value);
        if (pendingTrack !== null) { playTrack(pendingTrack); pendingTrack = null; }
      },
      onStateChange: onYTState,
      onError: () => { showToast('Ошибка воспроизведения'); playNext(); },
    },
  });
};
function loadYTScript() {
  if ($('yt-api')) return;
  const s = document.createElement('script');
  s.id = 'yt-api'; s.src = 'https://www.youtube.com/iframe_api';
  document.head.appendChild(s);
}

function onYTState(e) {
  const S = YT.PlayerState;
  if (e.data === S.PLAYING) {
    isPlaying = true; setPlayIcon(true); startProgress(); renderCurrentList();
    heroVinyl.classList.add('spinning');
    sessionStart = Date.now();
    sessionTrackId = tracks[currentIndex]?.id;
    setMediaSessionState(true);
    if (currentIndex !== -1) updateNativeNotification(tracks[currentIndex], true, !!liked[tracks[currentIndex]?.id]);
  } else if (e.data === S.PAUSED) {
    isPlaying = false; setPlayIcon(false); stopProgress(); renderCurrentList();
    heroVinyl.classList.remove('spinning');
    flushListenTime();
    setMediaSessionState(false);
    if (currentIndex !== -1) updateNativeNotification(tracks[currentIndex], false, !!liked[tracks[currentIndex]?.id]);
  } else if (e.data === S.ENDED) {
    flushListenTime();
    stopProgress(); heroVinyl.classList.remove('spinning');
    if (isRepeat) ytPlayer.playVideo(); else playNext();
  }
}

function flushListenTime() {
  if (sessionStart && sessionTrackId) {
    const sec = (Date.now() - sessionStart) / 1000;
    recordListenTime(sessionTrackId, sec);
    sessionStart = null; sessionTrackId = null;
  }
}

// ══ Progress ══
function startProgress() {
  stopProgress();
  progressTimer = setInterval(() => {
    if (!ytPlayer?.getCurrentTime) return;
    const cur = ytPlayer.getCurrentTime() || 0;
    const dur = ytPlayer.getDuration()    || 0;
    if (!dur) return;
    const pct = (cur / dur) * 100;
    progressFill.style.width = pct + '%';
    progressThumb.style.left = pct + '%';
    timeCurrent.textContent  = fmt(cur);
    timeTotal.textContent    = fmt(dur);
    updateMediaPosition();
  }, 500);
}
function stopProgress() { if (progressTimer) { clearInterval(progressTimer); progressTimer = null; } }

// ══ YouTube API ══
async function ytFetch(endpoint, params) {
  const url = new URL(`${YT_API}${endpoint}`);
  url.searchParams.set('key', YT_API_KEY);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url);
  return res.json();
}

async function ytSearch(query, pageToken = '') {
  $('searchTrackList').innerHTML = '<div class="loading-msg">Поиск...</div>';
  try {
    const res = await fetch(`${BACKEND_URL}/search?q=${encodeURIComponent(query)}&limit=20`);
    const data = await res.json();
    if (data.error) { showToast('Ошибка поиска: ' + data.error); return; }
    const newT = data.tracks || [];
    tracks = pageToken ? [...tracks, ...newT] : newT;
    if (!pageToken) currentIndex = -1;
    $('searchHeading').textContent = `YouTube: "${query}"`;
    $('btnMore').classList.add('hidden');
    renderList($('searchTrackList'), tracks);
  } catch (e) {
    showToast('Ошибка соединения с сервером');
    $('searchTrackList').innerHTML = '<div class="loading-msg">Ошибка загрузки</div>';
  }
}

async function ytLoadPopular() {
  $('homeTrackList').innerHTML = '<div class="loading-msg">Загрузка...</div>';
  try {
    const res = await fetch(`${BACKEND_URL}/trending`);
    const data = await res.json();
    if (data.error) { $('homeTrackList').innerHTML = '<div class="loading-msg">Ошибка загрузки</div>'; return; }
    tracks = data.tracks || [];
    renderList($('homeTrackList'), tracks);
  } catch (e) {
    $('homeTrackList').innerHTML = '<div class="loading-msg">Сервер недоступен. Попробуй позже.</div>';
  }
}

async function ytLoadQuery(query, container) {
  container.innerHTML = '<div class="loading-msg">Загрузка...</div>';
  try {
    const res = await fetch(`${BACKEND_URL}/search?q=${encodeURIComponent(query)}&limit=15`);
    const data = await res.json();
    if (data.error || !data.tracks?.length) {
      container.innerHTML = '<div class="loading-msg">Не удалось загрузить</div>';
      return [];
    }
    return data.tracks;
  } catch (e) {
    container.innerHTML = '<div class="loading-msg">Ошибка загрузки</div>';
    return [];
  }
}

function ytItemToTrack(item) {
  return {
    id:     item.id.videoId || item.id,
    name:   item.snippet.title,
    artist: item.snippet.channelTitle,
    cover:  item.snippet.thumbnails?.medium?.url || item.snippet.thumbnails?.default?.url,
    src:    'youtube',
  };
}

// ══ SoundCloud ══
function scSearch(query) {
  $('searchSC').classList.remove('hidden');
  $('searchYT').classList.add('hidden');
  const url = `https://soundcloud.com/search?q=${encodeURIComponent(query)}`;
  $('scResults').innerHTML = `
    <div class="sc-embed-item">
      <div class="sc-embed-label">🔊 SoundCloud — "${query}"</div>
      <iframe width="100%" height="450" scrolling="no" frameborder="no" allow="autoplay"
        src="https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&color=%237C3AED&auto_play=false&hide_related=false&show_comments=false&show_user=true&visual=true">
      </iframe>
    </div>`;
}
function scShowPopular() {
  $('searchSC').classList.remove('hidden');
  $('searchYT').classList.add('hidden');
  const charts = [
    { label: '🔥 Топ чарты', url: 'https://soundcloud.com/charts/top?genre=all-music' },
    { label: '🎛 Electronic', url: 'https://soundcloud.com/charts/top?genre=electronic' },
    { label: '🎤 Hip-Hop',    url: 'https://soundcloud.com/charts/top?genre=hiphoprap' },
  ];
  $('scResults').innerHTML = charts.map(c => `
    <div class="sc-embed-item">
      <div class="sc-embed-label">${c.label}</div>
      <iframe width="100%" height="280" scrolling="no" frameborder="no" allow="autoplay"
        src="https://w.soundcloud.com/player/?url=${encodeURIComponent(c.url)}&color=%237C3AED&auto_play=false&hide_related=false&show_comments=false&show_user=true&visual=true">
      </iframe>
    </div>`).join('');
}

// ══ FOR YOU PAGE ══
async function renderForYouPage() {
  const page = $('pageForyou');
  if (!page) return;
  const content = page.querySelector('.foryou-content');
  if (!content) return;

  // Если уже загружено и история не изменилась — не перерисовывать
  const histLen = Object.keys(history).length;
  if (forYouRendered && content.dataset.histLen === String(histLen)) return;
  content.dataset.histLen = histLen;
  forYouRendered = true;

  const rec = buildRecommendations();

  if (!rec || rec.totalTracks < 2) {
    content.innerHTML = `
      <div class="foryou-empty">
        <div class="foryou-empty-icon">🎧</div>
        <h3>Слушай музыку — я запомню</h3>
        <p>Послушай несколько треков, и я составлю персональную подборку на основе твоих вкусов.</p>
        <button class="btn-foryou-start" onclick="showPage('home')">Начать слушать</button>
      </div>`;
    return;
  }

  let html = '';

  // Статистика
  html += `
    <div class="foryou-stats">
      <div class="stat-card">
        <div class="stat-num">${rec.totalTracks}</div>
        <div class="stat-label">треков в истории</div>
      </div>
      <div class="stat-card">
        <div class="stat-num">${rec.totalTime}</div>
        <div class="stat-label">минут прослушано</div>
      </div>
      <div class="stat-card">
        <div class="stat-num">${rec.topArtists.length}</div>
        <div class="stat-label">любимых артистов</div>
      </div>
    </div>`;

  // Топ артисты
  if (rec.topArtists.length) {
    html += `
      <div class="foryou-section">
        <div class="foryou-section-title">🎤 Твои артисты</div>
        <div class="artist-chips">${rec.topArtists.map(a =>
          `<div class="artist-chip" data-artist="${a}">${a}</div>`
        ).join('')}</div>
      </div>`;
  }

  // Часто слушаемые
  if (rec.topTracks.length) {
    html += `
      <div class="foryou-section">
        <div class="foryou-section-title">🔁 Часто слушаешь</div>
        <div class="foryou-top-tracks">${rec.topTracks.map(t => `
          <div class="foryou-top-track" data-id="${t.id}">
            <div class="ftt-cover">${t.cover ? `<img src="${t.cover}" alt="" />` : '🎵'}</div>
            <div class="ftt-info">
              <div class="ftt-name">${t.name}</div>
              <div class="ftt-artist">${t.artist}</div>
            </div>
            <div class="ftt-plays">${t.playCount}×</div>
          </div>`).join('')}
        </div>
      </div>`;
  }

  // Подборки (динамические секции)
  html += `<div class="foryou-section">
    <div class="foryou-section-title">✨ Подборки для тебя</div>
    <div class="rec-sections" id="recSections">
      ${rec.queries.map((q, i) => `
        <div class="rec-section" id="recSec${i}">
          <div class="rec-section-header">
            <span class="rec-section-label">${q.label}</span>
            <button class="rec-refresh" data-qi="${i}" title="Обновить">↻</button>
          </div>
          <div class="rec-track-list" id="recList${i}"><div class="loading-msg">Загрузка...</div></div>
        </div>`).join('')}
    </div>
  </div>`;

  content.innerHTML = html;
  for (let i = 0; i < rec.queries.length; i++) {
    const container = $(`recList${i}`);
    const result = await ytLoadQuery(rec.queries[i].query, container);
    if (result.length) {
      renderRecSection(container, result, i);
    }
  }

  // Клики по артистам
  page.querySelectorAll('.artist-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      searchInput.value = chip.dataset.artist;
      showPage('search');
      $('searchYT').classList.remove('hidden');
      $('searchSC').classList.add('hidden');
      ytSearch(chip.dataset.artist + ' music');
      $('searchHeading').textContent = `YouTube: "${chip.dataset.artist}"`;
    });
  });

  // Клики по часто слушаемым
  page.querySelectorAll('.foryou-top-track').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.dataset.id;
      const t  = history[id];
      if (!t) return;
      tracks = [{ id: t.id, name: t.name, artist: t.artist, cover: t.cover, src: 'youtube' }];
      currentIndex = -1;
      playTrack(0);
    });
  });

  // Кнопки обновить
  page.querySelectorAll('.rec-refresh').forEach(btn => {
    btn.addEventListener('click', async () => {
      const qi = +btn.dataset.qi;
      const container = $(`recList${qi}`);
      btn.style.animation = 'spin .6s linear';
      const result = await ytLoadQuery(rec.queries[qi].query, container);
      if (result.length) renderRecSection(container, result, qi);
      btn.style.animation = '';
    });
  });
}

// Рендер горизонтальной секции рекомендаций
function renderRecSection(container, list, sectionIdx) {
  container.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'rec-cards';
  list.forEach((track, i) => {
    const card = document.createElement('div');
    card.className = 'rec-card';
    card.innerHTML = `
      <div class="rec-card-cover">
        ${track.cover ? `<img src="${track.cover}" alt="" />` : '<div class="rec-card-no-cover">🎵</div>'}
        <div class="rec-card-play">▶</div>
      </div>
      <div class="rec-card-name">${track.name}</div>
      <div class="rec-card-artist">${track.artist}</div>
    `;
    card.addEventListener('click', () => {
      // Загружаем эту секцию как текущий список
      tracks = list;
      currentIndex = -1;
      playTrack(i);
    });
    wrap.appendChild(card);
  });
  container.appendChild(wrap);
}

// ══ Render track list ══
function renderList(container, list) {
  container.innerHTML = '';
  if (!list.length) { container.innerHTML = '<div class="loading-msg">Ничего не найдено</div>'; return; }
  list.forEach((track, i) => {
    const isActive = tracks === list && i === currentIndex;
    const isLiked  = !!liked[track.id];
    const el = document.createElement('div');
    el.className = 'track-item' + (isActive ? ' active' : '');
    el.innerHTML = `
      <div class="track-num">${isActive && isPlaying
        ? '<div class="eq-icon"><span></span><span></span><span></span></div>'
        : i + 1}</div>
      <div class="track-cover">${track.cover
        ? `<img src="${track.cover}" alt="" loading="lazy" />`
        : `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>`}
      </div>
      <div class="track-meta">
        <div class="track-name">${track.name}</div>
        <div class="track-artist">${track.artist}</div>
      </div>
      <div class="track-item-actions">
        <button class="track-action-btn ${isLiked ? 'liked' : ''}" data-action="like" title="В избранное">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
        </button>
        <button class="track-action-btn" data-action="playlist" title="В плейлист">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
        </button>
      </div>
      <span class="track-src-badge badge-yt">YT</span>
    `;
    el.addEventListener('click', e => {
      const action = e.target.closest('[data-action]')?.dataset.action;
      if (action === 'like')     { toggleLikeTrack(track, el.querySelector('[data-action="like"]')); return; }
      if (action === 'playlist') { openAddToPlaylist(track); return; }
      if (tracks !== list) tracks = list;
      playTrack(i);
    });
    container.appendChild(el);
  });
}

function renderCurrentList() {
  const page = document.querySelector('.page.active');
  if (!page) return;
  const listEl = page.querySelector('.track-list');
  if (listEl && tracks.length) renderList(listEl, tracks);
}

// ══ Playback ══
function playTrack(index) {
  if (!ytReady) { pendingTrack = index; showToast('Плеер загружается...'); return; }
  const track = tracks[index];
  if (!track) return;
  currentIndex = index;
  ytPlayer.loadVideoById(track.id);
  ytPlayer.setVolume(isMuted ? 0 : +volumeSlider.value);
  recordPlay(track);
  updatePlayerUI(track);
}

function updatePlayerUI(track) {
  playerTitle.textContent  = track.name;
  playerArtist.textContent = track.artist;
  playerCover.innerHTML    = track.cover
    ? `<img src="${track.cover}" alt="" />`
    : `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>`;
  btnLike.classList.toggle('liked', !!liked[track.id]);
  sourceBadge.textContent = 'YouTube';
  sourceBadge.className   = 'source-badge yt';
  document.title = `${track.name} — VioletTunes`;
  if (lyricsOpen) fetchLyrics(track);
  updateMediaSession(track);
  updateNativeNotification(track, true, !!liked[track.id]);
}

// ══ MEDIA NOTIFICATION (Android native) ══
const isCapacitor = !!(window.Capacitor?.isNativePlatform?.());

async function updateNativeNotification(track, playing, liked) {
  if (!isCapacitor) return;
  try {
    await window.Capacitor.Plugins.MediaNotification.updateNotification({
      title:   track.name,
      artist:  track.artist,
      cover:   track.cover || '',
      playing: playing,
      liked:   !!liked,
    });
  } catch (e) { console.warn('MediaNotification:', e); }
}

async function stopNativeNotification() {
  if (!isCapacitor) return;
  try { await window.Capacitor.Plugins.MediaNotification.stopNotification(); } catch (_) {}
}

function setupNativeMediaButtons() {
  if (!isCapacitor) return;
  try {
    window.Capacitor.Plugins.MediaNotification.addListener('mediaAction', e => {
      switch (e.action) {
        case 'play':  if (ytPlayer?.playVideo)  ytPlayer.playVideo();  break;
        case 'pause': if (ytPlayer?.pauseVideo) ytPlayer.pauseVideo(); break;
        case 'next':  playNext(); break;
        case 'prev':  playPrev(); break;
        case 'like':
          if (currentIndex !== -1) toggleLikeTrack(tracks[currentIndex], null);
          break;
        case 'stop':
          if (ytPlayer?.pauseVideo) ytPlayer.pauseVideo();
          break;
      }
    });
  } catch (e) { console.warn('MediaNotification listener:', e); }
}
// Показывает уведомление с обложкой и кнопками управления
// на Android (Chrome), iOS (Safari 15+), десктоп Chrome/Edge
function setupMediaSession() {
  if (!('mediaSession' in navigator)) return;

  navigator.mediaSession.setActionHandler('play', () => {
    if (ytPlayer?.playVideo) ytPlayer.playVideo();
  });
  navigator.mediaSession.setActionHandler('pause', () => {
    if (ytPlayer?.pauseVideo) ytPlayer.pauseVideo();
  });
  navigator.mediaSession.setActionHandler('nexttrack', () => playNext());
  navigator.mediaSession.setActionHandler('previoustrack', () => playPrev());
  navigator.mediaSession.setActionHandler('seekto', e => {
    if (ytPlayer?.seekTo) ytPlayer.seekTo(e.seekTime, true);
  });
  // Кнопка "лайк" через action (поддерживается в некоторых браузерах)
  try {
    navigator.mediaSession.setActionHandler('togglemicrophone', () => {
      if (currentIndex !== -1) toggleLikeTrack(tracks[currentIndex], null);
    });
  } catch (_) {}
}

function updateMediaSession(track) {
  if (!('mediaSession' in navigator)) return;

  // Обложка — нужен абсолютный URL
  const artwork = [];
  if (track.cover) {
    artwork.push({ src: track.cover, sizes: '480x360', type: 'image/jpeg' });
  }

  navigator.mediaSession.metadata = new MediaMetadata({
    title:  track.name,
    artist: track.artist,
    album:  'VioletTunes',
    artwork,
  });

  navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
}

function setMediaSessionState(playing) {
  if (!('mediaSession' in navigator)) return;
  navigator.mediaSession.playbackState = playing ? 'playing' : 'paused';
}

// Обновляем позицию для прогресс-бара в уведомлении
function updateMediaPosition() {
  if (!('mediaSession' in navigator) || !ytPlayer?.getCurrentTime) return;
  try {
    const pos = ytPlayer.getCurrentTime() || 0;
    const dur = ytPlayer.getDuration()    || 0;
    if (dur > 0) {
      navigator.mediaSession.setPositionState({
        duration:     dur,
        playbackRate: 1,
        position:     Math.min(pos, dur),
      });
    }
  } catch (_) {}
}

function togglePlay() {
  if (!ytReady) return;
  if (currentIndex === -1 && tracks.length) { playTrack(0); return; }
  if (isPlaying) ytPlayer.pauseVideo(); else ytPlayer.playVideo();
}
function playNext() {
  if (!tracks.length) return;
  playTrack(isShuffle ? Math.floor(Math.random() * tracks.length) : (currentIndex + 1) % tracks.length);
}
function playPrev() {
  if (!tracks.length) return;
  const cur = ytPlayer?.getCurrentTime?.() || 0;
  if (cur > 3) { ytPlayer.seekTo(0, true); return; }
  playTrack((currentIndex - 1 + tracks.length) % tracks.length);
}
function setPlayIcon(p) {
  iconPlay.classList.toggle('hidden', p);
  iconPause.classList.toggle('hidden', !p);
}

// ══ Like ══
function toggleLikeTrack(track, btn) {
  if (liked[track.id]) {
    delete liked[track.id];
    btn?.classList.remove('liked');
    if (tracks[currentIndex]?.id === track.id) btnLike.classList.remove('liked');
  } else {
    liked[track.id] = { id: track.id, name: track.name, artist: track.artist, cover: track.cover, src: track.src };
    btn?.classList.add('liked');
    if (tracks[currentIndex]?.id === track.id) btnLike.classList.add('liked');
  }
  localStorage.setItem('vt_liked', JSON.stringify(liked));
  if ($('pageLiked').classList.contains('active')) renderLikedPage();
}

// ══ Playlists ══
function savePlaylists() { localStorage.setItem('vt_playlists', JSON.stringify(playlists)); }
function createPlaylist(name) {
  const icons = ['🎵','🎶','🔥','⚡','🌊','🎸','🎤','🎷','🎹','🌙'];
  const pl = { id: Date.now(), name, icon: icons[Math.floor(Math.random()*icons.length)], tracks: [] };
  playlists.push(pl); savePlaylists(); renderSidebarPlaylists(); return pl;
}
function deletePlaylist(id) {
  playlists = playlists.filter(p => p.id !== id);
  savePlaylists(); renderSidebarPlaylists(); showPage('home');
}
function addTrackToPlaylist(plId, track) {
  const pl = playlists.find(p => p.id === plId);
  if (!pl) return;
  if (pl.tracks.find(t => t.id === track.id)) { showToast('Уже в плейлисте'); return; }
  pl.tracks.push({ id: track.id, name: track.name, artist: track.artist, cover: track.cover, src: track.src });
  savePlaylists(); renderSidebarPlaylists(); showToast(`Добавлено в "${pl.name}"`);
}
function removeTrackFromPlaylist(plId, trackId) {
  const pl = playlists.find(p => p.id === plId);
  if (!pl) return;
  pl.tracks = pl.tracks.filter(t => t.id !== trackId);
  savePlaylists(); openPlaylistPage(plId);
}

function renderSidebarPlaylists() {
  const list = $('playlistList');
  list.innerHTML = '';
  if (!playlists.length) {
    list.innerHTML = '<div style="font-size:11px;color:var(--text-muted);padding:4px 10px">Нет плейлистов</div>';
    return;
  }
  playlists.forEach(pl => {
    const el = document.createElement('div');
    el.className = 'pl-sidebar-item';
    el.innerHTML = `<span class="pl-sidebar-icon">${pl.icon}</span><span class="pl-sidebar-name">${pl.name}</span><span class="pl-sidebar-count">${pl.tracks.length}</span>`;
    el.onclick = () => openPlaylistPage(pl.id);
    list.appendChild(el);
  });
}

function openPlaylistPage(plId) {
  const pl = playlists.find(p => p.id === plId);
  if (!pl) return;
  $('plPageTitle').textContent = pl.name;
  $('plPageIcon').textContent  = pl.icon;
  $('plPageCount').textContent = `${pl.tracks.length} треков`;
  $('btnDeletePlaylist').onclick = () => { if (confirm(`Удалить "${pl.name}"?`)) deletePlaylist(pl.id); };

  const listEl = $('playlistTrackList');
  listEl.innerHTML = '';
  $('emptyPlaylist').classList.toggle('hidden', pl.tracks.length > 0);

  // Локальная копия треков плейлиста — НЕ перезаписываем глобальный tracks сразу
  const plTracks = pl.tracks.map(t => ({ ...t }));

  pl.tracks.forEach((track, i) => {
    const isActive = tracks === plTracks && i === currentIndex;
    const el = document.createElement('div');
    el.className = 'track-item' + (isActive ? ' active' : '');
    el.innerHTML = `
      <div class="track-num">${isActive && isPlaying
        ? '<div class="eq-icon"><span></span><span></span><span></span></div>'
        : i + 1}</div>
      <div class="track-cover">${track.cover
        ? `<img src="${track.cover}" alt="" loading="lazy" />`
        : `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>`}
      </div>
      <div class="track-meta">
        <div class="track-name">${track.name}</div>
        <div class="track-artist">${track.artist}</div>
      </div>
      <div class="track-item-actions">
        <button class="track-action-btn" data-action="remove" title="Удалить">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
        </button>
      </div>
      <span class="track-src-badge badge-yt">YT</span>`;

    el.addEventListener('click', e => {
      if (e.target.closest('[data-action="remove"]')) {
        removeTrackFromPlaylist(plId, track.id);
        return;
      }
      // Только при клике переключаем глобальный список на этот плейлист
      tracks = plTracks;
      currentIndex = -1;
      playTrack(i);
    });
    listEl.appendChild(el);
  });

  showPage('playlist');
}

// ══ Add to playlist modal ══
function openAddToPlaylist(track) {
  $('modalTitle').textContent = 'Добавить в плейлист';
  modalBody.innerHTML = '';
  playlists.forEach(pl => {
    const el = document.createElement('div');
    el.className = 'modal-pl-item';
    el.innerHTML = `<span class="modal-pl-item-icon">${pl.icon}</span><span class="modal-pl-item-name">${pl.name}</span><span class="modal-pl-item-count">${pl.tracks.length}</span>`;
    el.onclick = () => { addTrackToPlaylist(pl.id, track); closeModal(); };
    modalBody.appendChild(el);
  });
  const newRow = document.createElement('div');
  newRow.className = 'modal-new-pl';
  newRow.innerHTML = `<input type="text" placeholder="Новый плейлист..." id="newPlInput" /><button id="newPlBtn">Создать</button>`;
  modalBody.appendChild(newRow);
  setTimeout(() => {
    $('newPlBtn').onclick = () => {
      const name = $('newPlInput').value.trim();
      if (!name) return;
      addTrackToPlaylist(createPlaylist(name).id, track);
      closeModal();
    };
  }, 0);
  modalOverlay.classList.remove('hidden');
}
function closeModal() { modalOverlay.classList.add('hidden'); }

// ══ Pages ══
function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const key = name.charAt(0).toUpperCase() + name.slice(1);
  $('page' + key)?.classList.add('active');
  document.querySelectorAll('.nav-item[data-page]').forEach(n => n.classList.toggle('active', n.dataset.page === name));
  updateBottomNavActive(name);
  if (name === 'liked')   renderLikedPage();
  if (name === 'foryou')  renderForYouPage();
}

function renderLikedPage() {
  const ids = Object.keys(liked);
  $('likedCount').textContent = ids.length + ' треков';
  $('emptyLiked').classList.toggle('hidden', ids.length > 0);
  const likedTracks = ids.map(id => liked[id]);
  tracks = likedTracks; currentIndex = -1;
  renderList($('likedTrackList'), likedTracks);
}

// ══ Utils ══
function fmt(s) {
  if (!s || isNaN(s)) return '0:00';
  s = Math.floor(s);
  return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
}
function showToast(msg) {
  let t = document.querySelector('.toast');
  if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}
function showNoKey(container) {
  container.innerHTML = `<div class="no-key-hint"><h3>Нужен YouTube API Key</h3><p>Вставь ключ в поле вверху и нажми Сохранить</p></div>`;
}

// ══ Search ══
function doSearch() {
  const q = searchInput.value.trim();
  if (!q) return;
  lastQuery = q; nextPageToken = '';
  showPage('search');
  if (currentSrc === 'youtube') {
    $('searchYT').classList.remove('hidden'); $('searchSC').classList.add('hidden');
    ytSearch(q);
  } else { scSearch(q); }
}

// ══ Source switch ══
function switchSource(src) {
  currentSrc = src;
  document.querySelectorAll('.source-btn').forEach(b => b.classList.toggle('active', b.dataset.src === src));
  document.querySelectorAll('.src-toggle-btn').forEach(b => b.classList.toggle('active', b.dataset.src === src));
}

// ══ Event listeners ══
btnPlay.addEventListener('click', togglePlay);
btnNext.addEventListener('click', playNext);
btnPrev.addEventListener('click', playPrev);
btnShuffle.addEventListener('click', () => { isShuffle = !isShuffle; btnShuffle.classList.toggle('active', isShuffle); });
btnRepeat.addEventListener('click',  () => { isRepeat  = !isRepeat;  btnRepeat.classList.toggle('active', isRepeat); });
btnLike.addEventListener('click', () => { if (currentIndex !== -1) toggleLikeTrack(tracks[currentIndex], null); });
btnAddToPlaylist.addEventListener('click', () => { if (currentIndex !== -1) openAddToPlaylist(tracks[currentIndex]); });
btnMute.addEventListener('click', () => {
  isMuted = !isMuted;
  if (isMuted) { prevVolume = +volumeSlider.value; ytPlayer?.setVolume(0); volumeSlider.value = 0; }
  else { ytPlayer?.setVolume(prevVolume); volumeSlider.value = prevVolume; }
});
volumeSlider.addEventListener('input', () => { ytPlayer?.setVolume(+volumeSlider.value); });
progressBar.addEventListener('click', e => {
  if (!ytReady) return;
  const dur = ytPlayer?.getDuration?.() || 0; if (!dur) return;
  const rect = progressBar.getBoundingClientRect();
  ytPlayer.seekTo(((e.clientX - rect.left) / rect.width) * dur, true);
});
searchBtn.addEventListener('click', doSearch);
searchInput.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });
$('btnMore').addEventListener('click', () => { if (lastQuery && nextPageToken) ytSearch(lastQuery, nextPageToken); });
$('srcYT').addEventListener('click', () => switchSource('youtube'));
$('srcSC').addEventListener('click', () => switchSource('soundcloud'));
$('stYT').addEventListener('click',  () => { switchSource('youtube'); $('searchYT').classList.remove('hidden'); $('searchSC').classList.add('hidden'); });
$('stSC').addEventListener('click',  () => { switchSource('soundcloud'); const q = searchInput.value.trim(); if (q) scSearch(q); else scShowPopular(); });
document.querySelectorAll('.nav-item[data-page]').forEach(el => {
  el.addEventListener('click', e => { e.preventDefault(); showPage(el.dataset.page); });
});
$('btnAddPlaylist').addEventListener('click', () => {
  const name = prompt('Название плейлиста:');
  if (name?.trim()) { createPlaylist(name.trim()); showToast('Плейлист создан'); }
});
if (YT_API_KEY) ytKeyInput.value = YT_API_KEY;
ytKeySave.addEventListener('click', () => {
  const key = ytKeyInput.value.trim(); if (!key) return;
  YT_API_KEY = key; localStorage.setItem('vt_yt_key', key);
  showToast('Ключ сохранён'); ytLoadPopular();
});
modalClose.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) closeModal(); });
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  if (e.code === 'Space')      { e.preventDefault(); togglePlay(); }
  if (e.code === 'ArrowRight') playNext();
  if (e.code === 'ArrowLeft')  playPrev();
  if (e.code === 'KeyM')       btnMute.click();
});

// ══ LYRICS ══
const lyricsPanel  = $('lyricsPanel');
const lyricsBody   = $('lyricsBody');
const lyricsSongTitle  = $('lyricsSongTitle');
const lyricsSongArtist = $('lyricsSongArtist');
const btnLyrics    = $('btnLyrics');
const lyricsClose  = $('lyricsClose');

let lyricsOpen = false;
let lyricsCache = {}; // кэш { "artist|title": text }

function toggleLyrics() {
  if (!lyricsOpen) {
    lyricsPanel.classList.remove('hidden');
    requestAnimationFrame(() => lyricsPanel.classList.add('open'));
    lyricsOpen = true;
    btnLyrics.classList.add('lyrics-active');
    if (currentIndex !== -1) fetchLyrics(tracks[currentIndex]);
  } else {
    closeLyrics();
  }
}

function closeLyrics() {
  lyricsPanel.classList.remove('open');
  setTimeout(() => lyricsPanel.classList.add('hidden'), 350);
  lyricsOpen = false;
  btnLyrics.classList.remove('lyrics-active');
}

async function fetchLyrics(track) {
  if (!track) return;

  // Очищаем название от мусора: (Official Video), [Lyrics], ft. ...
  const cleanTitle  = track.name
    .replace(/\(.*?\)|\[.*?\]/g, '')
    .replace(/ft\..*|feat\..*|official.*|video.*|lyrics.*|audio.*/gi, '')
    .trim();
  const cleanArtist = track.artist
    .replace(/VEVO|Official|Music|Channel/gi, '')
    .replace(/-.*/, '') // убираем " - Topic"
    .trim();

  lyricsSongTitle.textContent  = track.name;
  lyricsSongArtist.textContent = cleanArtist;

  const cacheKey = `${cleanArtist}|${cleanTitle}`.toLowerCase();
  if (lyricsCache[cacheKey]) {
    renderLyrics(lyricsCache[cacheKey]);
    return;
  }

  lyricsBody.innerHTML = `
    <div class="lyrics-loading">
      <div class="lyrics-spinner"></div>
      <span>Ищем текст...</span>
    </div>`;

  try {
    // Пробуем lyrics.ovh
    const url = `https://api.lyrics.ovh/v1/${encodeURIComponent(cleanArtist)}/${encodeURIComponent(cleanTitle)}`;
    const res  = await fetch(url);
    const data = await res.json();

    if (data.lyrics && data.lyrics.trim().length > 20) {
      lyricsCache[cacheKey] = data.lyrics;
      renderLyrics(data.lyrics);
      return;
    }
  } catch (_) {}

  // Если не нашли — показываем сообщение с ссылкой на поиск
  lyricsBody.innerHTML = `
    <div class="lyrics-not-found">
      <strong>Текст не найден</strong>
      Попробуй найти вручную:<br/>
      <a href="https://genius.com/search?q=${encodeURIComponent(cleanArtist + ' ' + cleanTitle)}"
         target="_blank" style="color:var(--accent);text-decoration:none;margin-top:8px;display:inline-block">
        Открыть Genius →
      </a>
    </div>`;
}

function renderLyrics(text) {
  const lines = text.split('\n');
  const html = lines.map(line =>
    `<span class="lyrics-line">${line || '&nbsp;'}</span>`
  ).join('\n');
  lyricsBody.innerHTML = `
    <div class="lyrics-text">${html}</div>
    <div class="lyrics-source">Текст предоставлен lyrics.ovh</div>`;
}

btnLyrics.addEventListener('click', toggleLyrics);
lyricsClose.addEventListener('click', closeLyrics);

// ══ BOTTOM NAV ══
function initBottomNav() {
  document.querySelectorAll('#bottomNav .bottom-nav-item[data-page]').forEach(item => {
    item.addEventListener('click', () => {
      showPage(item.dataset.page);
    });
  });

  // Кнопка плейлистов — показывает мобильное меню плейлистов
  const btnLib = $('btnMobileLibrary');
  if (btnLib) {
    btnLib.addEventListener('click', () => {
      showMobileLibrary();
    });
  }
}

function updateBottomNavActive(name) {
  document.querySelectorAll('#bottomNav .bottom-nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.page === name);
  });
}

// Мобильное меню плейлистов
function showMobileLibrary() {
  // Снимаем активный с всех пунктов nav
  document.querySelectorAll('#bottomNav .bottom-nav-item').forEach(i => i.classList.remove('active'));
  $('btnMobileLibrary')?.classList.add('active');

  $('modalTitle').textContent = 'Мои плейлисты';
  modalBody.innerHTML = '';

  if (!playlists.length) {
    modalBody.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:13px">Нет плейлистов</div>';
  } else {
    playlists.forEach(pl => {
      const el = document.createElement('div');
      el.className = 'modal-pl-item';
      el.innerHTML = `<span class="modal-pl-item-icon">${pl.icon}</span><span class="modal-pl-item-name">${pl.name}</span><span class="modal-pl-item-count">${pl.tracks.length}</span>`;
      el.onclick = () => { closeModal(); openPlaylistPage(pl.id); };
      modalBody.appendChild(el);
    });
  }

  // Кнопка создать плейлист
  const newRow = document.createElement('div');
  newRow.className = 'modal-new-pl';
  newRow.innerHTML = `<input type="text" placeholder="Новый плейлист..." id="newPlInput2" /><button id="newPlBtn2">Создать</button>`;
  modalBody.appendChild(newRow);
  setTimeout(() => {
    $('newPlBtn2').onclick = () => {
      const name = $('newPlInput2').value.trim();
      if (!name) return;
      createPlaylist(name.trim());
      closeModal();
      showToast('Плейлист создан');
    };
  }, 0);

  modalOverlay.classList.remove('hidden');
}


loadYTScript();
setupMediaSession();
setupNativeMediaButtons();
initBottomNav();
renderSidebarPlaylists();
ytLoadPopular();

// Mood chips в поиске
function buildMoodChips() {
  const container = $('moodChips');
  if (!container) return;
  MOODS.forEach(m => {
    const chip = document.createElement('div');
    chip.className = 'mood-chip';
    chip.innerHTML = `<span class="mood-chip-emoji">${m.emoji}</span>${m.name}`;
    chip.addEventListener('click', () => {
      searchInput.value = m.name;
      $('searchHeading').textContent = `${m.emoji} ${m.name}`;
      $('searchYT').classList.remove('hidden');
      $('searchSC').classList.add('hidden');
      lastQuery = m.query; nextPageToken = '';
      ytSearch(m.query);
    });
    container.appendChild(chip);
  });
}
buildMoodChips();

// ══ SYNC APPLY — вызывается из firebase.js когда приходят данные с другого устройства ══
window.vtApplySync = function(data) {
  let changed = false;

  if (data.history) {
    listenHistory = data.history;
    forYouRendered = false;
    changed = true;
  }
  if (data.liked) {
    liked = data.liked;
    btnLike.classList.toggle('liked', currentIndex !== -1 && !!liked[tracks[currentIndex]?.id]);
    // Обновить иконки лайков в текущем списке
    document.querySelectorAll('.track-action-btn[data-action="like"]').forEach(btn => {
      const item = btn.closest('.track-item');
      if (!item) return;
      const idx = parseInt(item.dataset.index);
      if (!isNaN(idx) && tracks[idx]) {
        btn.classList.toggle('liked', !!liked[tracks[idx].id]);
      }
    });
    changed = true;
  }
  if (data.playlists) {
    playlists = data.playlists;
    renderSidebarPlaylists();
    // Если открыта страница плейлиста — обновить
    if ($('pagePlaylist').classList.contains('active')) {
      const title = $('plPageTitle').textContent;
      const pl = playlists.find(p => p.name === title);
      if (pl) openPlaylistPage(pl.id);
    }
    changed = true;
  }

  if (changed) {
    showToast('🔄 Данные синхронизированы');
  }
};
