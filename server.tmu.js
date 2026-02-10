/**
 * TMU TIMES Backend Server
 * Using Custom TMU Database Engine
 */

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config();

// Initialize Custom Database
const { initDatabase, getStats, backup } = require('./database');
const { initAllModels } = require('./models/index.tmu');

// Initialize the database first
const db = initDatabase(path.join(__dirname, 'data'));

// Initialize all models
const models = initAllModels();

// Initialize Express
const app = express();

// Middleware
app.use(cors({
  origin: true,  // Allow all origins for network access
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Static files for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Make models available to routes
app.use((req, res, next) => {
  req.models = models;
  next();
});

// API Routes
app.use('/api/auth', require('./routes/auth.tmu'));
app.use('/api/users', require('./routes/users.tmu'));
app.use('/api/posts', require('./routes/posts.tmu'));
app.use('/api/announcements', require('./routes/announcements.tmu'));
app.use('/api/elections', require('./routes/elections.tmu'));
app.use('/api/stats', require('./routes/stats.tmu'));

// Health check endpoint
app.get('/api/health', (req, res) => {
  const stats = getStats();
  res.json({ 
    status: 'OK', 
    message: 'TMU TIMES API is running',
    database: 'TMU Custom Database',
    stats: {
      collections: Object.keys(stats.collections).length,
      totalDocuments: stats.totalDocuments,
      totalSize: `${(stats.totalSize / 1024).toFixed(2)} KB`
    },
    timestamp: new Date().toISOString()
  });
});

// Database stats endpoint
app.get('/api/db/stats', (req, res) => {
  res.json({
    success: true,
    stats: getStats()
  });
});

// Database backup endpoint removed for production security

// Error handling middleware
app.use(require('./middleware/errorHandler'));

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║           TMU TIMES Backend Server                       ║
╠══════════════════════════════════════════════════════════╣
║  🚀 Server running on port ${PORT}                          ║
║  📡 API: http://localhost:${PORT}/api                       ║
║  🏥 Health: http://localhost:${PORT}/api/health             ║
║  📊 Stats: http://localhost:${PORT}/api/db/stats            ║
║  📝 Environment: ${process.env.NODE_ENV || 'development'}                        ║
║  🗄️  Database: TMU Custom Database (JSON-based)           ║
╚══════════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  const { flush } = require('./database');
  flush();
  console.log('💾 Database flushed');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down server...');
  const { flush } = require('./database');
  flush();
  console.log('💾 Database flushed');
  process.exit(0);
});
