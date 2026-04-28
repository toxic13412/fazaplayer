const { getDb } = require('./db');
const { v4: uuidv4 } = require('uuid');

/**
 * OAuth Manager - handles OAuth flows for VK, Spotify, Yandex Music
 * This is a simplified implementation - production would use proper OAuth libraries
 */

const OAUTH_CONFIGS = {
  vk: {
    authUrl: 'https://oauth.vk.com/authorize',
    tokenUrl: 'https://oauth.vk.com/access_token',
    clientId: process.env.VK_CLIENT_ID || '',
    clientSecret: process.env.VK_CLIENT_SECRET || ''
  },
  spotify: {
    authUrl: 'https://accounts.spotify.com/authorize',
    tokenUrl: 'https://accounts.spotify.com/api/token',
    clientId: process.env.SPOTIFY_CLIENT_ID || '',
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET || ''
  },
  yandex: {
    authUrl: 'https://oauth.yandex.ru/authorize',
    tokenUrl: 'https://oauth.yandex.ru/token',
    clientId: process.env.YANDEX_CLIENT_ID || '',
    clientSecret: process.env.YANDEX_CLIENT_SECRET || ''
  }
};

function getAuthorizationUrl(platform, sessionId) {
  const config = OAUTH_CONFIGS[platform];
  if (!config) {
    throw new Error(`Unsupported platform: ${platform}`);
  }

  const redirectUri = `${process.env.BASE_URL || 'http://localhost:3000'}/api/import/oauth/${platform}/callback`;
  const state = sessionId;

  // Build authorization URL
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    state,
    scope: 'playlist-read-private' // Adjust per platform
  });

  return `${config.authUrl}?${params.toString()}`;
}

async function handleCallback(platform, code, sessionId) {
  const config = OAUTH_CONFIGS[platform];
  if (!config) {
    throw new Error(`Unsupported platform: ${platform}`);
  }

  // Exchange code for tokens
  // This is simplified - production would make actual HTTP requests
  const accessToken = `mock_access_token_${code}`;
  const refreshToken = `mock_refresh_token_${code}`;
  const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString();

  const db = getDb();
  const id = uuidv4();
  const createdAt = new Date().toISOString();

  // Store session
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO oauth_sessions (id, session_id, platform, access_token, refresh_token, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(id, sessionId, platform, accessToken, refreshToken, expiresAt, createdAt);

  return { accessToken, refreshToken, expiresAt };
}

function getSession(sessionId, platform) {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT * FROM oauth_sessions
    WHERE session_id = ? AND platform = ?
  `);

  return stmt.get(sessionId, platform);
}

async function refreshToken(sessionId, platform) {
  const session = getSession(sessionId, platform);
  if (!session) {
    throw new Error('Session not found');
  }

  // Refresh token logic
  // This is simplified - production would make actual HTTP requests
  const newAccessToken = `refreshed_${session.access_token}`;
  const newExpiresAt = new Date(Date.now() + 3600 * 1000).toISOString();

  const db = getDb();
  const stmt = db.prepare(`
    UPDATE oauth_sessions
    SET access_token = ?, expires_at = ?
    WHERE session_id = ? AND platform = ?
  `);

  stmt.run(newAccessToken, newExpiresAt, sessionId, platform);

  return { accessToken: newAccessToken, expiresAt: newExpiresAt };
}

function revokeSession(sessionId, platform) {
  const db = getDb();
  const stmt = db.prepare(`
    DELETE FROM oauth_sessions
    WHERE session_id = ? AND platform = ?
  `);

  const result = stmt.run(sessionId, platform);
  return result.changes > 0;
}

module.exports = {
  getAuthorizationUrl,
  handleCallback,
  getSession,
  refreshToken,
  revokeSession
};
