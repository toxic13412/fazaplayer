const express = require('express');
const { getAuthorizationUrl, handleCallback, getSession, revokeSession } = require('../modules/oauthManager');
const { importByUrl, importByOAuth, getJobStatus } = require('../modules/playlistImporter');

const router = express.Router();

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
