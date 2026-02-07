const express = require('express');
const router = express.Router();
const { checkDatabaseHealth } = require('../database');

// GET /api/health - Server and database health check
router.get('/', (req, res) => {
  const dbHealth = checkDatabaseHealth();

  const health = {
    status: dbHealth.connected ? 'ok' : 'error',
    timestamp: new Date().toISOString(),
    server: {
      uptime: process.uptime(),
      nodeVersion: process.version,
      memoryUsage: process.memoryUsage().rss
    },
    database: dbHealth
  };

  const statusCode = dbHealth.connected ? 200 : 503;
  res.status(statusCode).json(health);
});

module.exports = router;
