const express = require('express');

const router = express.Router();

// Health check
router.getapp.get('/api/health', async (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime(), timestamp: Date.now() });
});

// Simple sample API route
router.get('/greet', (req, res) => {
  const name = req.query.name || 'Student';
  res.json({ message: `Welcome to English Maktabi, ${name}!` });
});

module.exports = router;
