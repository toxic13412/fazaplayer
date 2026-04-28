const express = require('express');
const fs = require('fs');
const path = require('path');
const { getTrackById } = require('../modules/trackStore');

const router = express.Router();

// GET /download/:trackId - Download track as MP3
router.get('/:trackId', (req, res) => {
  try {
    const track = getTrackById(req.params.trackId);
    
    if (!track) {
      return res.status(404).json({
        error: 'Track not found',
        message: `Track with ID ${req.params.trackId} does not exist`
      });
    }

    const filePath = path.join(__dirname, '..', track.filePath || track.file_path);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        error: 'File not found',
        message: 'Audio file does not exist on server'
      });
    }

    const filename = `${track.artist} - ${track.title}.mp3`;
    
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'audio/mpeg');
    
    fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    console.error('Error downloading track:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
