const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', 'db', 'violettunes.db');

let db = null;

function getDb() {
  if (!db) {
    // Ensure db directory exists
    const dbDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    
    runMigrations(db);
  }
  return db;
}

function runMigrations(db) {
  // Create tracks table
  db.exec(`
    CREATE TABLE IF NOT EXISTS tracks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      artist TEXT NOT NULL,
      album TEXT,
      genre TEXT,
      duration_seconds INTEGER NOT NULL CHECK(duration_seconds > 0),
      cover_url TEXT,
      lyrics TEXT,
      file_path TEXT NOT NULL,
      file_size_bytes INTEGER NOT NULL,
      mime_type TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'upload',
      source_url TEXT,
      uploaded_at TEXT NOT NULL,
      imported_at TEXT,
      play_count INTEGER NOT NULL DEFAULT 0
    );
  `);

  // Create FTS5 virtual table for full-text search
  db.exec(`
    CREATE VIRTUAL TABLE IF NOT EXISTS tracks_fts USING fts5(
      title,
      artist,
      album,
      lyrics,
      content='tracks',
      content_rowid='rowid'
    );
  `);

  // Create triggers to keep FTS table in sync
  db.exec(`
    CREATE TRIGGER IF NOT EXISTS tracks_ai AFTER INSERT ON tracks BEGIN
      INSERT INTO tracks_fts(rowid, title, artist, album, lyrics)
      VALUES (new.rowid, new.title, new.artist, new.album, new.lyrics);
    END;
  `);

  db.exec(`
    CREATE TRIGGER IF NOT EXISTS tracks_ad AFTER DELETE ON tracks BEGIN
      INSERT INTO tracks_fts(tracks_fts, rowid, title, artist, album, lyrics)
      VALUES('delete', old.rowid, old.title, old.artist, old.album, old.lyrics);
    END;
  `);

  db.exec(`
    CREATE TRIGGER IF NOT EXISTS tracks_au AFTER UPDATE ON tracks BEGIN
      INSERT INTO tracks_fts(tracks_fts, rowid, title, artist, album, lyrics)
      VALUES('delete', old.rowid, old.title, old.artist, old.album, old.lyrics);
      INSERT INTO tracks_fts(rowid, title, artist, album, lyrics)
      VALUES (new.rowid, new.title, new.artist, new.album, new.lyrics);
    END;
  `);

  // Create listen_events table
  db.exec(`
    CREATE TABLE IF NOT EXISTS listen_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      track_id TEXT NOT NULL REFERENCES tracks(id),
      session_id TEXT NOT NULL,
      listen_duration_seconds INTEGER NOT NULL,
      recorded_at TEXT NOT NULL
    );
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_listen_session ON listen_events(session_id);
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_listen_track ON listen_events(track_id);
  `);

  // Create watched_artists table
  db.exec(`
    CREATE TABLE IF NOT EXISTS watched_artists (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  // Create watched_artist_platforms table
  db.exec(`
    CREATE TABLE IF NOT EXISTS watched_artist_platforms (
      artist_id TEXT NOT NULL REFERENCES watched_artists(id) ON DELETE CASCADE,
      platform TEXT NOT NULL,
      identifier TEXT NOT NULL,
      PRIMARY KEY (artist_id, platform)
    );
  `);

  // Create import_cycle_logs table
  db.exec(`
    CREATE TABLE IF NOT EXISTS import_cycle_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at TEXT NOT NULL,
      completed_at TEXT NOT NULL,
      tracks_checked INTEGER NOT NULL DEFAULT 0,
      tracks_downloaded INTEGER NOT NULL DEFAULT 0,
      tracks_skipped INTEGER NOT NULL DEFAULT 0,
      errors_json TEXT NOT NULL DEFAULT '{}'
    );
  `);

  // Create oauth_sessions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS oauth_sessions (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      platform TEXT NOT NULL,
      access_token TEXT NOT NULL,
      refresh_token TEXT,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(session_id, platform)
    );
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_oauth_session_platform ON oauth_sessions(session_id, platform);
  `);

  // Create import_jobs table
  db.exec(`
    CREATE TABLE IF NOT EXISTS import_jobs (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      platform TEXT NOT NULL,
      playlist_id TEXT,
      source_url TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      total_tracks INTEGER NOT NULL DEFAULT 0,
      downloaded_tracks INTEGER NOT NULL DEFAULT 0,
      skipped_tracks INTEGER NOT NULL DEFAULT 0,
      failed_tracks INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_import_jobs_session ON import_jobs(session_id);
  `);

  console.log('✓ Database migrations completed');
}

module.exports = { getDb };
