const { getDb } = require('./db');
const { getListenEventsBySession } = require('./listenHistory');
const { deserialize } = require('./metadataSerializer');

function computeScore(events) {
  // Group events by track
  const trackStats = {};
  
  events.forEach(event => {
    if (!trackStats[event.track_id]) {
      trackStats[event.track_id] = {
        playCount: 0,
        totalListenMinutes: 0,
        lastPlayedAt: null
      };
    }
    
    trackStats[event.track_id].playCount += 1;
    trackStats[event.track_id].totalListenMinutes += event.listen_duration_seconds / 60;
    
    const eventDate = new Date(event.recorded_at);
    if (!trackStats[event.track_id].lastPlayedAt || eventDate > trackStats[event.track_id].lastPlayedAt) {
      trackStats[event.track_id].lastPlayedAt = eventDate;
    }
  });

  // Compute scores
  const scores = {};
  const now = new Date();
  
  Object.keys(trackStats).forEach(trackId => {
    const stats = trackStats[trackId];
    
    // Calculate recency decay: 2^(-(daysSince / 7))
    const daysSince = (now - stats.lastPlayedAt) / (1000 * 60 * 60 * 24);
    const recencyDecay = Math.pow(2, -(daysSince / 7));
    
    // Score formula: playCount * 2.0 + totalListenMinutes * 1.0 * recencyDecay
    scores[trackId] = (stats.playCount * 2.0) + (stats.totalListenMinutes * 1.0 * recencyDecay);
  });

  return scores;
}

function getRecommendations(sessionId, currentSessionTrackIds = []) {
  const db = getDb();
  const events = getListenEventsBySession(sessionId);

  // Fallback: if < 3 events, return top tracks by play_count
  if (events.length < 3) {
    const stmt = db.prepare(`
      SELECT * FROM tracks
      ORDER BY play_count DESC
      LIMIT 20
    `);
    const rows = stmt.all();
    const tracks = rows.map(deserialize).filter(t => t !== null);

    return {
      sections: [
        {
          title: 'Популярное',
          tracks
        }
      ]
    };
  }

  // Compute scores
  const scores = computeScore(events);

  // Get all tracks with scores
  const trackIds = Object.keys(scores);
  if (trackIds.length === 0) {
    return { sections: [] };
  }

  const placeholders = trackIds.map(() => '?').join(',');
  const stmt = db.prepare(`
    SELECT * FROM tracks
    WHERE id IN (${placeholders})
  `);
  
  const rows = stmt.all(...trackIds);
  const tracks = rows.map(deserialize).filter(t => t !== null);

  // Attach scores and sort
  tracks.forEach(track => {
    track.score = scores[track.id];
  });

  // Exclude tracks played in current session
  const filteredTracks = tracks.filter(track => !currentSessionTrackIds.includes(track.id));

  // Sort by score descending
  filteredTracks.sort((a, b) => b.score - a.score);

  // Take top 20
  const topTracks = filteredTracks.slice(0, 20);

  // Group into sections by genre/artist
  const sections = [];
  
  // Section 1: Based on dominant genre
  const genreCounts = {};
  events.forEach(event => {
    const track = tracks.find(t => t.id === event.track_id);
    if (track && track.genre) {
      genreCounts[track.genre] = (genreCounts[track.genre] || 0) + 1;
    }
  });
  
  const dominantGenre = Object.keys(genreCounts).sort((a, b) => genreCounts[b] - genreCounts[a])[0];
  
  if (dominantGenre) {
    const genreTracks = topTracks.filter(t => t.genre === dominantGenre).slice(0, 10);
    if (genreTracks.length > 0) {
      sections.push({
        title: `Твой микс: ${dominantGenre}`,
        tracks: genreTracks
      });
    }
  }

  // Section 2: Based on dominant artist
  const artistCounts = {};
  events.forEach(event => {
    const track = tracks.find(t => t.id === event.track_id);
    if (track) {
      artistCounts[track.artist] = (artistCounts[track.artist] || 0) + 1;
    }
  });
  
  const dominantArtist = Object.keys(artistCounts).sort((a, b) => artistCounts[b] - artistCounts[a])[0];
  
  if (dominantArtist) {
    const artistTracks = topTracks.filter(t => t.artist === dominantArtist).slice(0, 10);
    if (artistTracks.length > 0) {
      sections.push({
        title: `Похожие исполнители: ${dominantArtist}`,
        tracks: artistTracks
      });
    }
  }

  // If we don't have 2 sections yet, add a general "For You" section
  if (sections.length < 2) {
    sections.push({
      title: 'Для тебя',
      tracks: topTracks.slice(0, 10)
    });
  }

  return { sections };
}

module.exports = {
  computeScore,
  getRecommendations
};
