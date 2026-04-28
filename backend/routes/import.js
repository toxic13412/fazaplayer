const express = require('express');
const { getAuthorizationUrl, handleCallback, getSession, revokeSession } = require('../modules/oauthManager');
const { importByUrl, importByOAuth, getJobStatus } = require('../modules/playlistImporter');
const importScheduler = require('../modules/importScheduler');
const { getDb } = require('../modules/db');
const { v4: uuidv4 } = require('uuid');
const { downloadWithYtDlp, extractMetadata } = require('../modules/importConverter');
const { insertTrack, trackExistsByArtistTitle } = require('../modules/trackStore');
const path = require('path');
const fs = require('fs');

const router = express.Router();

function requireAdminKey(req, res, next) {
  const key = req.headers['x-admin-key'];
  const expected = process.env.ADMIN_KEY || 'default-admin-key';
  if (!key || key !== expected) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

// POST /api/import/from-url - Import ALL tracks from URL (channel/playlist/artist)
router.post('/from-url', requireAdminKey, async (req, res) => {
  try {
    const { url, artistName, maxTracks } = req.body;
    if (!url) return res.status(400).json({ error: 'url is required' });
    
    res.json({ status: 'started', message: 'Import started in background' });
    
    // Run import in background
    (async () => {
      const tracks = await importScheduler.fetchAllFromUrl(url, maxTracks || 200);
      const outputDir = path.join(__dirname, '..', 'storage', 'tracks');
      if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
      
      let downloaded = 0, skipped = 0, failed = 0;
      
      for (const trackInfo of tracks) {
        const cleanTitle = trackInfo.title.replace(/\(official.*?\)/gi, '').replace(/\[.*?\]/g, '').trim();
        const artist = artistName || trackInfo.artist;
        
        if (trackExistsByArtistTitle(artist, cleanTitle)) {
          console.log(`  ⊘ Skipping duplicate: ${cleanTitle}`);
          skipped++;
          continue;
        }
        
        try {
          console.log(`  ↓ Downloading: ${cleanTitle}`);
          const filePath = await downloadWithYtDlp(trackInfo.url, outputDir);
          const metadata = await extractMetadata(filePath);
          const trackId = uuidv4();
          insertTrack({
            id: trackId,
            title: metadata.title !== 'Unknown' ? metadata.title : cleanTitle,
            artist: metadata.artist !== 'Unknown' ? metadata.artist : artist,
            album: metadata.album,
            genre: metadata.genre,
            durationSeconds: metadata.durationSeconds || trackInfo.duration,
            coverUrl: trackInfo.coverUrl,
            lyrics: null,
            filePath: `storage/tracks/${path.basename(filePath)}`,
            fileSizeBytes: fs.statSync(filePath).size,
            mimeType: 'audio/mpeg',
            source: 'url-import',
            sourceUrl: trackInfo.url,
            uploadedAt: new Date().toISOString(),
            importedAt: new Date().toISOString(),
            playCount: 0
          });
          console.log(`  ✓ Saved: ${cleanTitle}`);
          downloaded++;
        } catch (e) {
          console.error(`  ✗ Failed: ${cleanTitle}:`, e.message);
          failed++;
        }
      }
      
      console.log(`\n=== URL Import completed ===`);
      console.log(`Downloaded: ${downloaded}, Skipped: ${skipped}, Failed: ${failed}`);
    })();
  } catch (error) {
    console.error('Error starting URL import:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/import/run-now - Trigger import cycle immediately
router.post('/run-now', requireAdminKey, async (req, res) => {
  try {
    const result = await importScheduler.runOnce();
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('Error running import:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/import/watch-artist - Add artist to watch list
router.post('/watch-artist', requireAdminKey, (req, res) => {
  try {
    const { artistName, platforms } = req.body;
    if (!artistName || !platforms?.length) {
      return res.status(400).json({ error: 'artistName and platforms are required' });
    }
    const db = getDb();
    const artistId = uuidv4();
    db.prepare('INSERT INTO watched_artists (id, name, created_at) VALUES (?, ?, ?)').run(artistId, artistName, new Date().toISOString());
    const stmt = db.prepare('INSERT INTO watched_artist_platforms (artist_id, platform, identifier) VALUES (?, ?, ?)');
    platforms.forEach(p => stmt.run(artistId, p, artistName));
    res.json({ success: true, artistId });
  } catch (error) {
    console.error('Error adding watched artist:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/import/watched-artists - List watched artists
router.get('/watched-artists', requireAdminKey, (req, res) => {
  try {
    const db = getDb();
    const artists = db.prepare(`
      SELECT wa.id, wa.name as artistName, GROUP_CONCAT(wap.platform) as platformsStr
      FROM watched_artists wa
      LEFT JOIN watched_artist_platforms wap ON wa.id = wap.artist_id
      GROUP BY wa.id
    `).all();
    res.json({ artists: artists.map(a => ({ id: a.id, artistName: a.artistName, platforms: a.platformsStr ? a.platformsStr.split(',') : [] })) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/import/watched-artists/:id
router.delete('/watched-artists/:id', requireAdminKey, (req, res) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM watched_artists WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// POST /api/import/playlist-url - Import playlist by URL
router.post('/playlist-url', async (req, res) => {
  try {
    const { url, sessionId } = req.body;

    if (!url || !sessionId) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['url', 'sessionId']
      });
    }

    // Validate URL format (simplified)
    const supportedPlatforms = ['vk.com', 'spotify.com', 'music.yandex'];
    const isSupported = supportedPlatforms.some(platform => url.includes(platform));

    if (!isSupported) {
      return res.status(400).json({
        error: 'Unsupported URL format',
        message: 'URL must be from VK, Spotify, or Yandex Music'
      });
    }

    const jobId = await importByUrl(url, sessionId);

    res.status(202).json({ jobId });
  } catch (error) {
    console.error('Error importing playlist by URL:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/import/oauth/:platform/authorize - Start OAuth flow
router.get('/oauth/:platform/authorize', (req, res) => {
  try {
    const { platform } = req.params;
    const { sessionId } = req.query;

    if (!sessionId) {
      return res.status(400).json({
        error: 'Missing sessionId',
        message: 'sessionId query parameter is required'
      });
    }

    const validPlatforms = ['vk', 'spotify', 'yandex'];
    if (!validPlatforms.includes(platform)) {
      return res.status(400).json({
        error: 'Invalid platform',
        message: 'Platform must be one of: vk, spotify, yandex'
      });
    }

    const authUrl = getAuthorizationUrl(platform, sessionId);
    res.redirect(authUrl);
  } catch (error) {
    console.error('Error starting OAuth flow:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/import/oauth/:platform/callback - OAuth callback
router.get('/oauth/:platform/callback', async (req, res) => {
  try {
    const { platform } = req.params;
    const { code, state: sessionId } = req.query;

    if (!code || !sessionId) {
      return res.status(400).json({
        error: 'Missing OAuth parameters',
        message: 'code and state are required'
      });
    }

    await handleCallback(platform, code, sessionId);

    res.json({
      status: 'authorized',
      platform
    });
  } catch (error) {
    console.error('Error handling OAuth callback:', error);
    res.status(401).json({
      error: 'OAuth authorization failed',
      message: error.message
    });
  }
});

// GET /api/import/oauth/:platform/playlists - Get user's playlists
router.get('/oauth/:platform/playlists', (req, res) => {
  try {
    const { platform } = req.params;
    const { sessionId } = req.query;

    if (!sessionId) {
      return res.status(400).json({
        error: 'Missing sessionId',
        message: 'sessionId query parameter is required'
      });
    }

    const session = getSession(sessionId, platform);

    if (!session) {
      return res.status(401).json({
        error: 'Not authorized',
        message: `No active session found for ${platform}`
      });
    }

    // This is a placeholder - production would fetch actual playlists from platform API
    const playlists = [
      { id: 'playlist1', name: 'My Favorites', trackCount: 50, platform },
      { id: 'playlist2', name: 'Workout Mix', trackCount: 30, platform }
    ];

    res.json({ playlists });
  } catch (error) {
    console.error('Error getting playlists:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/import/oauth/:platform/import - Import playlist via OAuth
router.post('/oauth/:platform/import', async (req, res) => {
  try {
    const { platform } = req.params;
    const { sessionId, playlistId } = req.body;

    if (!sessionId || !playlistId) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['sessionId', 'playlistId']
      });
    }

    const session = getSession(sessionId, platform);

    if (!session) {
      return res.status(401).json({
        error: 'Not authorized',
        message: `No active session found for ${platform}`
      });
    }

    const jobId = await importByOAuth(platform, playlistId, sessionId);

    res.status(202).json({ jobId });
  } catch (error) {
    console.error('Error importing playlist via OAuth:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/import/oauth/:platform/session - Revoke OAuth session
router.delete('/oauth/:platform/session', (req, res) => {
  try {
    const { platform } = req.params;
    const { sessionId } = req.query;

    if (!sessionId) {
      return res.status(400).json({
        error: 'Missing sessionId',
        message: 'sessionId query parameter is required'
      });
    }

    const revoked = revokeSession(sessionId, platform);

    if (!revoked) {
      return res.status(404).json({
        error: 'Session not found',
        message: `No session found for ${platform}`
      });
    }

    res.json({ status: 'revoked' });
  } catch (error) {
    console.error('Error revoking session:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/import/jobs/:jobId - Get import job status
router.get('/jobs/:jobId', (req, res) => {
  try {
    const job = getJobStatus(req.params.jobId);

    if (!job) {
      return res.status(404).json({
        error: 'Job not found',
        message: `Job with ID ${req.params.jobId} does not exist`
      });
    }

    res.json({
      jobId: job.id,
      status: job.status,
      totalTracks: job.total_tracks,
      downloadedTracks: job.downloaded_tracks,
      skippedTracks: job.skipped_tracks,
      failedTracks: job.failed_tracks,
      createdAt: job.created_at,
      updatedAt: job.updated_at
    });
  } catch (error) {
    console.error('Error getting job status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
