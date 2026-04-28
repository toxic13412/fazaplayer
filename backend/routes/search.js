const express = require('express');
const { getDb } = require('../modules/db');
const { deserialize } = require('../modules/metadataSerializer');
const { serialize } = require('../modules/metadataSerializer');

const router = express.Router();

// GET /api/search - Full-text search across tracks
router.get('/', (req, res) => {
  try {
    const query = req.query.q;
    const limit = parseInt(req.query.limit) || 20;

    // Validate query length
    if (!query || query.length < 2) {
      return res.status(400).json({
        error: 'Query too short',
        minLength: 2,
        message: 'Search query must be at least 2 characters long'
      });
    }

    if (query.length > 200) {
      return res.status(400).json({
        error: 'Query too long',
        maxLength: 200,
        message: 'Search query must not exceed 200 characters'
      });
    }

    const db = getDb();
    
    // Use FTS5 for full-text search
    const stmt = db.prepare(`
      SELECT tracks.* FROM tracks
      INNER JOIN tracks_fts ON tracks.rowid = tracks_fts.rowid
      WHERE tracks_fts MATCH ?
      ORDER BY rank
      LIMIT ?
    `);

    const rows = stmt.all(query, limit);
    const tracks = rows.map(deserialize).filter(t => t !== null);

    res.json({
      tracks: tracks.map(serialize),
      total: tracks.length
    });
  } catch (error) {
    console.error('Error searching tracks:', error);
    
    // If FTS query fails, return empty results
    res.json({
      tracks: [],
      total: 0
    });
  }
});

module.exports = router;
