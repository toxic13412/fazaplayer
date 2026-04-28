const { getDb } = require('./db');
const { downloadWithYtDlp, extractMetadata } = require('./importConverter');
const { insertTrack, trackExistsByArtistTitle } = require('./trackStore');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

let intervalId = null;

/**
 * Start the import scheduler
 * @param {number} intervalMs - Interval in milliseconds (minimum 15 minutes)
 */
function start(intervalMs = 15 * 60 * 1000) {
  if (intervalMs < 15 * 60 * 1000) {
    console.warn('Import interval must be at least 15 minutes. Setting to 15 minutes.');
    intervalMs = 15 * 60 * 1000;
  }

  console.log(`Starting import scheduler with interval: ${intervalMs / 1000 / 60} minutes`);

  // Run immediately on start
  runCycle().catch(err => console.error('Error in initial import cycle:', err));

  // Then run periodically
  intervalId = setInterval(() => {
    runCycle().catch(err => console.error('Error in import cycle:', err));
  }, intervalMs);
}

/**
 * Stop the import scheduler
 */
function stop() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log('Import scheduler stopped');
  }
}

/**
 * Run a single import cycle
 */
async function runCycle() {
  const startedAt = new Date().toISOString();
  console.log(`\n=== Import cycle started at ${startedAt} ===`);

  const db = getDb();
  const stats = {
    tracksChecked: 0,
    tracksDownloaded: 0,
    tracksSkipped: 0,
    errorsByPlatform: {}
  };

  try {
    // Get all watched artists
    const artistsStmt = db.prepare(`
      SELECT wa.id, wa.name, wap.platform, wap.identifier
      FROM watched_artists wa
      JOIN watched_artist_platforms wap ON wa.id = wap.artist_id
    `);
    const watchedArtists = artistsStmt.all();

    if (watchedArtists.length === 0) {
      console.log('No watched artists configured');
      return;
    }

    console.log(`Found ${watchedArtists.length} watched artist-platform combinations`);

    // Process each artist-platform combination
    for (const artist of watchedArtists) {
      try {
        await processArtistPlatform(artist, stats);
      } catch (error) {
        console.error(`Error processing ${artist.name} on ${artist.platform}:`, error.message);
        stats.errorsByPlatform[artist.platform] = (stats.errorsByPlatform[artist.platform] || 0) + 1;
      }
    }
  } catch (error) {
    console.error('Error in import cycle:', error);
  } finally {
    const completedAt = new Date().toISOString();
    
    // Log cycle summary
    const logStmt = db.prepare(`
      INSERT INTO import_cycle_logs (started_at, completed_at, tracks_checked, tracks_downloaded, tracks_skipped, errors_json)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    
    logStmt.run(
      startedAt,
      completedAt,
      stats.tracksChecked,
      stats.tracksDownloaded,
      stats.tracksSkipped,
      JSON.stringify(stats.errorsByPlatform)
    );

    console.log(`\n=== Import cycle completed ===`);
    console.log(`Checked: ${stats.tracksChecked}, Downloaded: ${stats.tracksDownloaded}, Skipped: ${stats.tracksSkipped}`);
    console.log(`Errors by platform:`, stats.errorsByPlatform);
  }
}

/**
 * Process a single artist-platform combination
 */
async function processArtistPlatform(artist, stats) {
  console.log(`\nProcessing ${artist.name} on ${artist.platform}...`);

  // This is a simplified implementation
  // In production, you would:
  // 1. Use platform-specific APIs to fetch new releases
  // 2. For YouTube: search for recent uploads from channel
  // 3. For VK/Spotify/etc: use their APIs with proper authentication

  // For now, we'll just log that we would check this artist
  console.log(`Would check ${artist.platform} for new releases from ${artist.name} (${artist.identifier})`);
  
  // Placeholder: In real implementation, fetch tracks from platform API
  const newTracks = []; // Would be populated from API

  for (const trackInfo of newTracks) {
    stats.tracksChecked++;

    // Check for duplicates
    if (trackExistsByArtistTitle(trackInfo.artist, trackInfo.title)) {
      console.log(`  ⊘ Skipping duplicate: ${trackInfo.artist} - ${trackInfo.title}`);
      stats.tracksSkipped++;
      continue;
    }

    try {
      // Download track
      const outputDir = path.join(__dirname, '..', 'storage', 'tracks');
      const filePath = await downloadWithYtDlp(trackInfo.url, outputDir);
      
      // Extract metadata
      const metadata = await extractMetadata(filePath);
      
      // Create track record
      const trackId = uuidv4();
      const track = {
        id: trackId,
        title: metadata.title || trackInfo.title,
        artist: metadata.artist || trackInfo.artist,
        album: metadata.album,
        genre: metadata.genre,
        durationSeconds: metadata.durationSeconds,
        coverUrl: trackInfo.coverUrl || null,
        lyrics: null,
        filePath: `storage/tracks/${path.basename(filePath)}`,
        fileSizeBytes: fs.statSync(filePath).size,
        mimeType: 'audio/mpeg',
        source: artist.platform,
        sourceUrl: trackInfo.url,
        uploadedAt: new Date().toISOString(),
        importedAt: new Date().toISOString(),
        playCount: 0
      };

      insertTrack(track);
      console.log(`  ✓ Downloaded: ${track.artist} - ${track.title}`);
      stats.tracksDownloaded++;
    } catch (error) {
      console.error(`  ✗ Failed to download ${trackInfo.title}:`, error.message);
      stats.errorsByPlatform[artist.platform] = (stats.errorsByPlatform[artist.platform] || 0) + 1;
    }
  }
}

module.exports = {
  start,
  stop,
  runCycle,
  runOnce: async () => {
    const result = { checked: 0, downloaded: 0, skipped: 0, errors: {} };
    const db = getDb();
    const artists = db.prepare(`
      SELECT wa.id, wa.name, wap.platform, wap.identifier
      FROM watched_artists wa
      JOIN watched_artist_platforms wap ON wa.id = wap.artist_id
    `).all();
    result.artistsCount = artists.length;
    if (!artists.length) return { ...result, message: 'No watched artists configured' };
    await runCycle();
    return { success: true, message: `Import cycle completed for ${artists.length} artist(s)` };
  }
};
