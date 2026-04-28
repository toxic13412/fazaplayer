/**
 * Serializes and deserializes Track metadata with validation
 */

function serialize(track) {
  return {
    id: track.id,
    title: track.title,
    artist: track.artist,
    album: track.album || null,
    genre: track.genre || null,
    durationSeconds: track.duration_seconds || track.durationSeconds,
    coverUrl: track.cover_url || track.coverUrl || null,
    uploadedAt: track.uploaded_at || track.uploadedAt
  };
}

function deserialize(row) {
  // Validate required fields
  if (!row.id || !row.title || !row.artist || !row.duration_seconds) {
    console.error('Missing required field in track metadata:', {
      id: row.id,
      title: row.title,
      artist: row.artist,
      duration_seconds: row.duration_seconds
    });
    return null;
  }

  // Validate durationSeconds is a positive integer
  if (!Number.isInteger(row.duration_seconds) || row.duration_seconds <= 0) {
    console.error('Invalid durationSeconds (must be positive integer):', row.duration_seconds);
    return null;
  }

  return {
    id: row.id,
    title: row.title,
    artist: row.artist,
    album: row.album || null,
    genre: row.genre || null,
    durationSeconds: row.duration_seconds,
    coverUrl: row.cover_url || null,
    lyrics: row.lyrics || null,
    uploadedAt: row.uploaded_at,
    source: row.source || 'upload',
    sourceUrl: row.source_url || null,
    playCount: row.play_count || 0
  };
}

module.exports = { serialize, deserialize };
