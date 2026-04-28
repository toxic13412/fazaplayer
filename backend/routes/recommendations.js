const express = require('express');
const { recordListenEvent } = require('../modules/listenHistory');
const { getRecommendations } = require('../modules/recommendationEngine');
const { serialize } = require('../modules/metadataSerializer');

const router = express.Router();

// POST /api/listen-events - Record a listen event
router.post('/listen-events', (req, res) => {
  try {
    const { trackId, sessionId, listenDurationSeconds } = req.body;

    if (!trackId || !sessionId || !listenDurationSeconds) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['trackId', 'sessionId', 'listenDurationSeconds']
      });
    }

    recordListenEvent({ trackId, sessionId, listenDurationSeconds });

    res.json({ status: 'ok' });
  } catch (error) {
    console.error('Error recording listen event:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/recommendations - Get personalized recommendations
router.get('/recommendations', (req, res) => {
  try {
    const sessionId = req.query.sessionId;

    if (!sessionId) {
      return res.status(400).json({
        error: 'Missing sessionId',
        message: 'sessionId query parameter is required'
      });
    }

    const currentSessionTrackIds = req.query.currentTracks 
      ? req.query.currentTracks.split(',') 
      : [];

    const result = getRecommendations(sessionId, currentSessionTrackIds);

    // Serialize tracks in each section
    const sections = result.sections.map(section => ({
      title: section.title,
      tracks: section.tracks.map(serialize)
    }));

    res.json({ sections });
  } catch (error) {
    console.error('Error getting recommendations:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
