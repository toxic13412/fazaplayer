const express = require('express');
const cors = require('cors');
const { Innertube } = require('youtubei.js');
const { WebSocketServer } = require('ws');

// Import self-hosted music platform modules
const { getDb } = require('./modules/db');
const importScheduler = require('./modules/importScheduler');

// Import routes
const tracksRouter = require('./routes/tracks');
const searchRouter = require('./routes/search');
const recommendationsRouter = require('./routes/recommendations');
const downloadRouter = require('./routes/download');
const adminRouter = require('./routes/admin');
const importRouter = require('./routes/import');

const app = express();
const PORT = process.env.PORT || 3001;

const bridgeConnections = new Map();

app.use(cors());
app.use(express.json());
app.use(express.static(require('path').join(__dirname, 'public')));

let yt = null;

// Initialize database
getDb();
console.log('✓ Database initialized');

// Start import scheduler (runs every 15 minutes)
// NOTE: Requires ffmpeg/yt-dlp - use Railway.app or Render Docker (paid plan)
importScheduler.start(15 * 60 * 1000);
console.log('✓ Import scheduler started');

// Инициализация YouTube клиента
async function initYT() {
  try {
    yt = await Innertube.create({
      lang: 'ru',
      location: 'RU',
      retrieve_player: false,
    });
    console.log('YouTube client initialized');
  } catch (e) {
    console.error('Failed to init YouTube client:', e.message);
  }
}

initYT();

// ══ KEEP ALIVE — пингуем себя каждые 10 минут чтобы не засыпать ══
const SELF_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
setInterval(async () => {
  try {
    const fetch = require('node-fetch');
    await fetch(`${SELF_URL}/ping`);
    console.log('Keep-alive ping sent');
  } catch (_) {}
}, 10 * 60 * 1000);

// ══ PING ══
app.get('/ping', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// ══ ROOT ══
app.get('/', (req, res) => {
  res.json({
    name: 'VioletTunes Backend',
    status: 'running',
    version: '1.0.0',
    endpoints: {
      ping: '/ping',
      tracks: '/api/tracks',
      search: '/api/search?q=query',
      recommendations: '/api/recommendations',
      stream: '/stream/:id',
      download: '/download/:id',
    }
  });
});

// ══ SELF-HOSTED MUSIC PLATFORM ROUTES ══
app.use('/api/tracks', tracksRouter);
app.use('/stream', tracksRouter); // /stream/:id handled by tracks router
app.use('/api/search', searchRouter);
app.use('/api', recommendationsRouter); // /api/listen-events, /api/recommendations
app.use('/download', downloadRouter);
app.use('/admin', adminRouter);
app.use('/api/import', importRouter);

// ══ КЭШИРОВАНИЕ ТРЕКА ПРИ ПРОСЛУШИВАНИИ ══
// Когда пользователь слушает трек с YouTube — он автоматически сохраняется на сервер
app.post('/cache-track', async (req, res) => {
  const { videoId, name, artist, cover } = req.body;
  if (!videoId) return res.status(400).json({ error: 'videoId required' });

  // Отвечаем сразу, скачивание идёт в фоне
  res.json({ status: 'caching', videoId });

  (async () => {
    try {
      const { trackExistsByArtistTitle, insertTrack } = require('./modules/trackStore');
      const { downloadWithYtDlp, extractMetadata } = require('./modules/importConverter');
      const { v4: uuidv4 } = require('uuid');
      const path = require('path');
      const fs = require('fs');

      if (name && artist && trackExistsByArtistTitle(artist, name)) {
        console.log(`[Cache] Already exists: ${artist} - ${name}`);
        return;
      }

      const outputDir = path.join(__dirname, 'storage', 'tracks');
      if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

      const url = `https://www.youtube.com/watch?v=${videoId}`;
      console.log(`[Cache] Downloading: ${name || videoId}`);
      const filePath = await downloadWithYtDlp(url, outputDir);
      const metadata = await extractMetadata(filePath);

      insertTrack({
        id: uuidv4(),
        title: name || metadata.title,
        artist: artist || metadata.artist,
        album: metadata.album,
        genre: metadata.genre,
        durationSeconds: metadata.durationSeconds,
        coverUrl: cover || null,
        lyrics: null,
        filePath: `storage/tracks/${path.basename(filePath)}`,
        fileSizeBytes: fs.statSync(filePath).size,
        mimeType: 'audio/mpeg',
        source: 'youtube-cache',
        sourceUrl: url,
        uploadedAt: new Date().toISOString(),
        importedAt: new Date().toISOString(),
        playCount: 1
      });
      console.log(`[Cache] ✓ Saved: ${name || metadata.title}`);
    } catch (e) {
      console.error(`[Cache] Failed ${videoId}:`, e.message);
    }
  })();
});
app.get('/search', async (req, res) => {
  const { q, limit = 20 } = req.query;
  if (!q) return res.status(400).json({ error: 'Query required' });

  try {
    if (!yt) await initYT();
    const results = await yt.search(q, { type: 'video' });

    const tracks = [];
    for (const item of results.videos || []) {
      if (tracks.length >= +limit) break;
      if (!item.id) continue;

      tracks.push({
        id: item.id,
        name: item.title?.text || 'Unknown',
        artist: item.author?.name || 'Unknown',
        cover: getBestThumb(item.thumbnails),
        duration: item.duration?.seconds || 0,
        src: 'youtube',
      });
    }

    res.json({ tracks });
  } catch (e) {
    console.error('Search error:', e.message);
    res.status(500).json({ error: 'Search failed', details: e.message });
  }
});

// ══ ПОПУЛЯРНЫЕ ТРЕКИ (главная страница) ══
app.get('/trending', async (req, res) => {
  try {
    if (!yt) await initYT();
    const trending = await yt.getTrending();

    const tracks = [];
    const videos = trending.videos || [];

    for (const item of videos) {
      if (tracks.length >= 30) break;
      if (!item.id) continue;

      tracks.push({
        id: item.id,
        name: item.title?.text || 'Unknown',
        artist: item.author?.name || 'Unknown',
        cover: getBestThumb(item.thumbnails),
        duration: item.duration?.seconds || 0,
        src: 'youtube',
      });
    }

    res.json({ tracks });
  } catch (e) {
    console.error('Trending error:', e.message);
    // Fallback — поиск популярной музыки
    try {
      const results = await yt.search('популярная музыка 2024', { type: 'video' });
      const tracks = (results.videos || []).slice(0, 20).map(item => ({
        id: item.id,
        name: item.title?.text || 'Unknown',
        artist: item.author?.name || 'Unknown',
        cover: getBestThumb(item.thumbnails),
        duration: item.duration?.seconds || 0,
        src: 'youtube',
      }));
      res.json({ tracks });
    } catch (e2) {
      res.status(500).json({ error: 'Trending failed' });
    }
  }
});

// ══ ПОЛУЧИТЬ STREAM URL ══
app.get('/stream/:videoId', async (req, res) => {
  const { videoId } = req.params;
  if (!videoId) return res.status(400).json({ error: 'Video ID required' });

  try {
    if (!yt) await initYT();
    const info = await yt.getInfo(videoId);
    const format = info.chooseFormat({ type: 'audio', quality: 'best' });

    if (!format?.url) {
      return res.status(404).json({ error: 'No audio stream found' });
    }

    res.json({ url: format.url, mimeType: format.mime_type });
  } catch (e) {
    console.error('Stream error:', e.message);
    res.status(500).json({ error: 'Stream failed', details: e.message });
  }
});

// ══ РЕКОМЕНДАЦИИ по артисту ══
app.get('/recommendations', async (req, res) => {
  const { artist, limit = 15 } = req.query;
  if (!artist) return res.status(400).json({ error: 'Artist required' });

  try {
    if (!yt) await initYT();
    const results = await yt.search(`${artist} music`, { type: 'video' });

    const tracks = (results.videos || []).slice(0, +limit).map(item => ({
      id: item.id,
      name: item.title?.text || 'Unknown',
      artist: item.author?.name || 'Unknown',
      cover: getBestThumb(item.thumbnails),
      duration: item.duration?.seconds || 0,
      src: 'youtube',
    }));

    res.json({ tracks });
  } catch (e) {
    res.status(500).json({ error: 'Recommendations failed' });
  }
});

// ══ HELPER ══
function getBestThumb(thumbnails) {
  if (!thumbnails?.length) return '';
  // Берём среднее качество (обычно index 1-2)
  const sorted = [...thumbnails].sort((a, b) => (b.width || 0) - (a.width || 0));
  const medium = sorted.find(t => t.width >= 320 && t.width <= 640);
  return (medium || sorted[0])?.url || '';
}

// ══ DISCORD RPC ══
app.post('/discord-rpc/event', (req, res) => {
  const { sessionToken, ...event } = req.body;
  if (!sessionToken || typeof sessionToken !== 'string' ||
      sessionToken.length < 8 || sessionToken.length > 64) {
    return res.status(400).json({ error: 'invalid_token' });
  }
  const bridge = bridgeConnections.get(sessionToken);
  if (!bridge || bridge.readyState !== 1) {
    return res.status(202).json({ status: 'no_bridge' });
  }
  try {
    bridge.send(JSON.stringify({ type: event.clear ? 'clear' : 'track', ...event }));
    res.json({ status: 'delivered' });
  } catch (err) {
    bridgeConnections.delete(sessionToken);
    res.status(202).json({ status: 'no_bridge' });
  }
});

app.get('/discord-rpc/status/:token', (req, res) => {
  const { token } = req.params;
  const bridge = bridgeConnections.get(token);
  res.json({ connected: !!(bridge && bridge.readyState === 1) });
});

const server = app.listen(PORT, () => {
  console.log(`VioletTunes backend running on port ${PORT}`);
});

// ══ DISCORD RPC WebSocket ══
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (request, socket, head) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  if (url.pathname === '/discord-rpc/ws') {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

wss.on('connection', (ws) => {
  let registeredToken = null;

  ws.on('message', (data) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.type === 'register' && msg.token) {
        registeredToken = msg.token;
        bridgeConnections.set(msg.token, ws);
        console.log(`[Discord RPC] Bridge registered: ${msg.token.slice(0, 4)}****`);
      } else if (msg.type === 'pong') {
        // heartbeat ok
      }
    } catch (e) {
      console.error('[Discord RPC] Invalid message:', e.message);
    }
  });

  ws.on('close', () => {
    if (registeredToken) {
      bridgeConnections.delete(registeredToken);
      console.log(`[Discord RPC] Bridge disconnected: ${registeredToken.slice(0, 4)}****`);
    }
  });

  ws.on('error', (err) => {
    console.error('[Discord RPC] WS error:', err.message);
    if (registeredToken) bridgeConnections.delete(registeredToken);
  });
});
