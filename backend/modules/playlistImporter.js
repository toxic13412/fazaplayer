const { getDb } = require('./db');
const { v4: uuidv4 } = require('uuid');
const { downloadWithYtDlp, extractMetadata } = require('./importConverter');
const { insertTrack, trackExistsByArtistTitle } = require('./trackStore');
const path = require('path');
const fs = require('fs');

/**
 * Import playlist by URL
 */
async function importByUrl(url, sessionId) {
  const db = getDb();
  const jobId = uuidv4();
  const createdAt = new Date().toISOString();

  // Create import job
  const stmt = db.prepare(`
    INSERT INTO import_jobs (id, session_id, platform, playlist_id, source_url, status, total_tracks, downloaded_tracks, skipped_tracks, failed_tracks, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(jobId, sessionId, 'url', null, url, 'pending', 0, 0, 0, 0, createdAt, createdAt);

  // Start import asynchronously
  setImmediate(() => runImportJob(jobId));

  return jobId;
}

/**
 * Import playlist via OAuth
 */
async function importByOAuth(platform, playlistId, sessionId) {
  const db = getDb();
  const jobId = uuidv4();
  const createdAt = new Date().toISOString();

  // Create import job
  const stmt = db.prepare(`
    INSERT INTO import_jobs (id, session_id, platform, playlist_id, source_url, status, total_tracks, downloaded_tracks, skipped_tracks, failed_tracks, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(jobId, sessionId, platform, playlistId, null, 'pending', 0, 0, 0, 0, createdAt, createdAt);

  // Start import asynchronously
  setImmediate(() => runImportJob(jobId));

  return jobId;
}

/**
 * Run import job
 */
async function runImportJob(jobId) {
  const db = getDb();
  
  try {
    // Update status to running
    updateJobStatus(jobId, 'running');

    // Get job details
    const job = db.prepare('SELECT * FROM import_jobs WHERE id = ?').get(jobId);
    
    if (!job) {
      throw new Error('Job not found');
    }

    // Fetch tracks from source
    let tracks = [];
    
    if (job.source_url) {
      // Import by URL
      tracks = await fetchTracksFromUrl(job.source_url);
    } else if (job.playlist_id) {
      // Import via OAuth
      tracks = await fetchTracksFromOAuth(job.platform, job.playlist_id, job.session_id);
    }

    // Update total tracks
    const updateTotalStmt = db.prepare(`
      UPDATE import_jobs
      SET total_tracks = ?, updated_at = ?
      WHERE id = ?
    `);
    updateTotalStmt.run(tracks.length, new Date().toISOString(), jobId);

    // Process each track
    for (const trackInfo of tracks) {
      try {
        // Check for duplicates
        if (trackExistsByArtistTitle(trackInfo.artist, trackInfo.title)) {
          incrementJobCounter(jobId, 'skipped_tracks');
          continue;
        }

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
          source: job.platform,
          sourceUrl: trackInfo.url,
          uploadedAt: new Date().toISOString(),
          importedAt: new Date().toISOString(),
          playCount: 0
        };

        insertTrack(track);
        incrementJobCounter(jobId, 'downloaded_tracks');
      } catch (error) {
        console.error(`Failed to import track ${trackInfo.title}:`, error.message);
        incrementJobCounter(jobId, 'failed_tracks');
      }
    }

    // Mark job as completed
    updateJobStatus(jobId, 'completed');
  } catch (error) {
    console.error(`Import job ${jobId} failed:`, error.message);
    updateJobStatus(jobId, 'failed');
  }
}

/**
 * Fetch tracks from URL (simplified)
 */
async function fetchTracksFromUrl(url) {
  // This is a placeholder - production would parse playlist URL and extract tracks
  console.log(`Fetching tracks from URL: ${url}`);
  return [];
}

/**
 * Fetch tracks from OAuth (simplified)
 */
async function fetchTracksFromOAuth(platform, playlistId, sessionId) {
  // This is a placeholder - production would use platform APIs
  console.log(`Fetching tracks from ${platform} playlist ${playlistId}`);
  return [];
}

/**
 * Update job status
 */
function updateJobStatus(jobId, status) {
  const db = getDb();
  const stmt = db.prepare(`
    UPDATE import_jobs
    SET status = ?, updated_at = ?
    WHERE id = ?
  `);
  stmt.run(status, new Date().toISOString(), jobId);
}

/**
 * Increment job counter
 */
function incrementJobCounter(jobId, counter) {
  const db = getDb();
  const stmt = db.prepare(`
    UPDATE import_jobs
    SET ${counter} = ${counter} + 1, updated_at = ?
    WHERE id = ?
  `);
  stmt.run(new Date().toISOString(), jobId);
}

/**
 * Get job status
 */
function getJobStatus(jobId) {
  const db = getDb();
  const stmt = db.prepare('SELECT * FROM import_jobs WHERE id = ?');
  return stmt.get(jobId);
}

module.exports = {
  importByUrl,
  importByOAuth,
  runImportJob,
  getJobStatus
};
