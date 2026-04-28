const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { insertTrack, trackExistsByArtistTitle } = require('../modules/trackStore');
const { getDb } = require('../modules/db');

const router = express.Router();

// Middleware to check admin authentication
function requireAdminKey(req, res, next) {
  const adminKey = req.headers['x-admin-key'];
  const expectedKey = process.env.ADMIN_KEY || 'default-admin-key';

  if (!adminKey || adminKey !== expectedKey) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '..', 'storage', 'tracks');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50 MB
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = ['audio/mpeg', 'audio/aac', 'audio/mp3'];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid format. Only MP3 and AAC are supported'));
    }
  }
});

// POST /admin/tracks - Upload a new track
router.post('/tracks', requireAdminKey, (req, res) => {
  upload.fields([
    { name: 'file', maxCount: 1 },
    { name: 'cover', maxCount: 1 }
  ])(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
          error: 'File too large',
          message: 'Max size is 50 MB'
        });
      }
      return res.status(400).json({
        error: 'Invalid format',
        message: err.message || 'Only MP3 and AAC are supported'
      });
    }

    try {
      const { title, artist, album, genre, lyrics } = req.body;

      // Validate required fields
      if (!title || !artist) {
        return res.status(400).json({
          error: 'Validation error',
          fields: ['title', 'artist'],
          message: 'title and artist are required'
        });
      }

      if (!req.files || !req.files.file || req.files.file.length === 0) {
        return res.status(400).json({
          error: 'Validation error',
          message: 'Audio file is required'
        });
      }

      const audioFile = req.files.file[0];
      const coverFile = req.files.cover ? req.files.cover[0] : null;

      // Get audio duration (simplified - in production use a library like music-metadata)
      const durationSeconds = 180; // Placeholder - should be extracted from file

      const trackId = uuidv4();
      const uploadedAt = new Date().toISOString();

      const track = {
        id: trackId,
        title,
        artist,
        album: album || null,
        genre: genre || null,
        durationSeconds,
        coverUrl: coverFile ? `/covers/${coverFile.filename}` : null,
        lyrics: lyrics || null,
        filePath: `storage/tracks/${audioFile.filename}`,
        fileSizeBytes: audioFile.size,
        mimeType: audioFile.mimetype,
        source: 'upload',
        sourceUrl: null,
        uploadedAt,
        importedAt: null,
        playCount: 0
      };

      insertTrack(track);

      res.status(201).json({
        id: trackId,
        title,
        artist,
        album,
        genre,
        durationSeconds,
        coverUrl: track.coverUrl,
        uploadedAt
      });
    } catch (error) {
      console.error('Error uploading track:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
});

// GET /admin/watched-artists - List all watched artists
router.get('/watched-artists', requireAdminKey, (req, res) => {
  try {
    const db = getDb();
    const artists = db.prepare(`
      SELECT wa.id, wa.name as artistName,
        GROUP_CONCAT(wap.platform) as platformsStr
      FROM watched_artists wa
      LEFT JOIN watched_artist_platforms wap ON wa.id = wap.artist_id
      GROUP BY wa.id
    `).all();

    res.json({
      artists: artists.map(a => ({
        id: a.id,
        artistName: a.artistName,
        platforms: a.platformsStr ? a.platformsStr.split(',') : []
      }))
    });
  } catch (error) {
    console.error('Error listing watched artists:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /admin/upload - Upload track (alias with simpler metadata format)
router.post('/upload', requireAdminKey, (req, res) => {
  const uploadMiddleware = multer({
    storage,
    limits: { fileSize: 100 * 1024 * 1024 },
    fileFilter: (req, file, cb) => cb(null, true)
  }).single('file');

  uploadMiddleware(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    try {
      let metadata = {};
      try { metadata = JSON.parse(req.body.metadata || '{}'); } catch(_) {}
      const name = metadata.name || req.body.name || 'Unknown';
      const artist = metadata.artist || req.body.artist || 'Unknown';
      const album = metadata.album || req.body.album || null;

      if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

      const trackId = uuidv4();
      const track = {
        id: trackId,
        title: name,
        artist,
        album,
        genre: null,
        durationSeconds: 0,
        coverUrl: null,
        lyrics: null,
        filePath: `storage/tracks/${req.file.filename}`,
        fileSizeBytes: req.file.size,
        mimeType: req.file.mimetype,
        source: 'upload',
        sourceUrl: null,
        uploadedAt: new Date().toISOString(),
        importedAt: null,
        playCount: 0
      };
      insertTrack(track);
      res.status(201).json({ id: trackId, name, artist, success: true });
    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
});

// POST /admin/watched-artists - Add artist to watch list
router.post('/watched-artists', requireAdminKey, (req, res) => {
  try {
    const { name, platforms } = req.body;

    if (!name || !platforms || !Array.isArray(platforms) || platforms.length === 0) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'name and platforms array are required'
      });
    }

    const db = getDb();
    const artistId = uuidv4();
    const createdAt = new Date().toISOString();

    // Insert artist
    const artistStmt = db.prepare(`
      INSERT INTO watched_artists (id, name, created_at)
      VALUES (?, ?, ?)
    `);
    artistStmt.run(artistId, name, createdAt);

    // Insert platforms
    const platformStmt = db.prepare(`
      INSERT INTO watched_artist_platforms (artist_id, platform, identifier)
      VALUES (?, ?, ?)
    `);

    platforms.forEach(p => {
      platformStmt.run(artistId, p.platform, p.identifier);
    });

    res.status(201).json({
      artistId,
      name,
      platforms
    });
  } catch (error) {
    console.error('Error adding watched artist:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /admin/watched-artists/:artistId - Remove artist from watch list
router.delete('/watched-artists/:artistId', requireAdminKey, (req, res) => {
  try {
    const db = getDb();
    const stmt = db.prepare('DELETE FROM watched_artists WHERE id = ?');
    const result = stmt.run(req.params.artistId);

    if (result.changes === 0) {
      return res.status(404).json({
        error: 'Artist not found',
        message: `Artist with ID ${req.params.artistId} does not exist`
      });
    }

    res.json({ status: 'removed' });
  } catch (error) {
    console.error('Error removing watched artist:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
