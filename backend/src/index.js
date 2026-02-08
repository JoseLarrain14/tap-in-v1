const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const { initializeDatabase, initializeSchema, seedDefaultData, closeDb } = require('./database');

async function startServer() {
  // Initialize database (async for sql.js)
  console.log('[Server] Initializing database...');
  await initializeDatabase();
  initializeSchema();
  seedDefaultData();

  const app = express();
  const PORT = process.env.PORT || 3001;

  // Middleware
  app.use(cors({
    origin: function(origin, callback) { callback(null, true); },
    credentials: true
  }));
  app.use(express.json({ limit: '10mb' }));
  app.use(morgan('dev'));

  // Serve uploaded files
  app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

  // Routes
  app.use('/api/health', require('./routes/health'));
  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/transactions', require('./routes/transactions'));
  app.use('/api/payment-requests', require('./routes/payment-requests'));
  app.use('/api/users', require('./routes/users'));
  app.use('/api/categories', require('./routes/categories'));
  app.use('/api/dashboard', require('./routes/dashboard'));
  app.use('/api/debug/schema', require('./routes/debug-schema'));

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.path}` });
  });

  // Error handler
  app.use((err, req, res, next) => {
    console.error('[Error]', err.stack);
    res.status(500).json({ error: 'Error interno del servidor' });
  });

  // Start server
  const server = app.listen(PORT, () => {
    console.log(`[Server] Tap In V1 backend running on http://localhost:${PORT}`);
    console.log(`[Server] Health check: http://localhost:${PORT}/api/health`);
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n[Server] Shutting down gracefully...');
    closeDb();
    server.close(() => {
      process.exit(0);
    });
  });

  process.on('SIGTERM', () => {
    console.log('\n[Server] Received SIGTERM...');
    closeDb();
    server.close(() => {
      process.exit(0);
    });
  });

  return app;
}

startServer().catch(err => {
  console.error('[Server] Failed to start:', err);
  process.exit(1);
});
