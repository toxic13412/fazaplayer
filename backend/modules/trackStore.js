const { getDb } = require('./db');
const { deserialize } = require('./metadataSerializer');

function insertTrack(track) {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO tracks (
      id, title, artist, album, genre, duration_seconds,
      cover_url, lyrics, file_path, file_size_bytes, mime_type,
      source, source_url, uploaded_at, imported_at, play_count
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    track.id,
    track.title,
    track.artist,
    track.album || null,
    track.genre || null,
    track.durationSeconds || track.duration_seconds,
    track.coverUrl || track.cover_url || null,
    track.lyrics || null,
    track.filePath || track.file_path,
    track.fileSizeBytes || track.file_size_bytes,
    track.mimeType || track.mime_type,
    track.source || 'upload',
    track.sourceUrl || track.source_url || null,
    track.uploadedAt || track.uploaded_at,
    track.importedAt || track.imported_at || null,
    track.playCount || track.play_count || 0
  );

  return track.id;
}

function getTrackById(id) {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM tracks WHERE id = ?');
  const row = stmt.get(id);
  
  if (!row) {
    return null;
  }

  return deserialize(row);
}

function listTracks({ page = 1, limit = 20 }) {
  const db = getDb();
  
  // Get total count
  const countStmt = db.prepare('SELECT COUNT(*) as total FROM tracks');
  const { total } = countStmt.get();

  // Calculate pagination
  const offset = (page - 1) * limit;
  const totalPages = Math.ceil(total / limit);

  // Get tracks for current page
  const stmt = db.prepare('SELECT * FROM tracks ORDER BY uploaded_at DESC LIMIT ? OFFSET ?');
  const rows = stmt.all(limit, offset);

  const tracks = rows.map(deserialize).filter(t => t !== null);

  return {
    tracks,
    total,
    page,
    totalPages
  };
}

function incrementPlayCount(id) {
  const db = getDb();
  const stmt = db.prepare('UPDATE tracks SET play_count = play_count + 1 WHERE id = ?');
  stmt.run(id);
}

function trackExistsByArtistTitle(artist, title) {
  const db = getDb();
  const stmt = db.prepare(`
    SELECT id FROM tracks 
    WHERE LOWER(artist) = LOWER(?) AND LOWER(title) = LOWER(?)
    LIMIT 1
  `);
  const row = stmt.get(artist, title);
  return row !== undefined;
}

module.exports = {
  insertTrack,
  getTrackById,
  listTracks,
  incrementPlayCount,
  trackExistsByArtistTitle
};
