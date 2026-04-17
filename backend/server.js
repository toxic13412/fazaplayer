const express = require('express');
const cors = require('cors');
const { Innertube } = require('youtubei.js');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

let yt = null;

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

// ══ ПОИСК ══
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

app.listen(PORT, () => {
  console.log(`VioletTunes backend running on port ${PORT}`);
});
