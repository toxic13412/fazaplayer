const express = require('express');
const fs = require('fs');
const path = require('path');
const { getTrackById, listTracks } = require('../modules/trackStore');
const { serialize } = require('../modules/metadataSerializer');

const router = express.Router();

// GET /api/tracks - List tracks with pagination
router.get('/', (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const result = listTracks({ page, limit });
    
    res.json({
      tracks: result.tracks.map(serialize),
      total: result.total,
      page: result.page,
      totalPages: result.totalPages
    });
  } catch (error) {
    console.error('Error listing tracks:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/tracks/:id - Get track metadata
router.get('/:id', (req, res) => {
  try {
    const track = getTrackById(req.params.id);
    
    if (!track) {
      return res.status(404).json({
        error: 'Track not found',
        message: `Track with ID ${req.params.id} does not exist`
      });
    }

    res.json(serialize(track));
  } catch (error) {
    console.error('Error getting track:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /stream/:id - Stream audio file with range request support
router.get('/stream/:id', (req, res) => {
  try {
    const track = getTrackById(req.params.id);
    
    if (!track) {
      return res.status(404).json({
        error: 'Track not found',
        message: `Track with ID ${req.params.id} does not exist`
      });
    }

    const filePath = path.join(__dirname, '..', track.filePath || track.file_path);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        error: 'File not found',
        message: 'Audio file does not exist on server'
      });
    }

    const stat = fs.statSync(filePath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      // Parse range header
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = (end - start) + 1;

      const fileStream = fs.createReadStream(filePath, { start, end });

      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunkSize,
        'Content-Type': track.mimeType || track.mime_type || 'audio/mpeg'
      });

      fileStream.pipe(res);
    } else {
      // No range request - send entire file
      res.writeHead(200, {
        'Content-Length': fileSize,
        'Content-Type': track.mimeType || track.mime_type || 'audio/mpeg',
        'Accept-Ranges': 'bytes'
      });

      fs.createReadStream(filePath).pipe(res);
    }
  } catch (error) {
    console.error('Error streaming track:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/tracks/:id/lyrics - Get track lyrics
router.get('/:id/lyrics', (req, res) => {
  try {
    const track = getTrackById(req.params.id);
    
    if (!track) {
      return res.status(404).json({
        error: 'Track not found',
        message: `Track with ID ${req.params.id} does not exist`
      });
    }

    res.json({
      id: track.id,
      lyrics: track.lyrics || null
    });
  } catch (error) {
    console.error('Error getting lyrics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
