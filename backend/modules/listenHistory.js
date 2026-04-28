const { getDb } = require('./db');

function recordListenEvent({ trackId, sessionId, listenDurationSeconds }) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO listen_events (track_id, session_id, listen_duration_seconds, recorded_at)
    VALUES (?, ?, ?, ?)
  `);

  const recordedAt = new Date().toISOString();
  stmt.run(trackId, sessionId, listenDurationSeconds, recordedAt);
}

function getListenEventsBySession(sessionId) {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT * FROM listen_events
    WHERE session_id = ?
    ORDER BY recorded_at DESC
  `);

  return stmt.all(sessionId);
}

module.exports = {
  recordListenEvent,
  getListenEventsBySession
};
