const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { connectDB, isDBConnected } = require('./config/db');
const path = require('path');

// Load environment variables
dotenv.config();

// Connect to MongoDB (non-blocking)
connectDB();

// Initialize Express
const app = express();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3001',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Static files for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Database connection check middleware
app.use('/api', (req, res, next) => {
  // Skip health check
  if (req.path === '/health') return next();
  
  // For routes that need DB, check connection
  if (!isDBConnected()) {
    return res.status(503).json({
      success: false,
      message: 'Database not connected. Please check MongoDB configuration.',
      hint: 'Set MONGODB_URI in .env file or install MongoDB locally.'
    });
  }
  next();
});

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/posts', require('./routes/posts'));
app.use('/api/announcements', require('./routes/announcements'));
app.use('/api/elections', require('./routes/elections'));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'TMU TIMES API is running',
    database: isDBConnected() ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use(require('./middleware/errorHandler'));

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`
╔══════════════════════════════════════════════════════╗
║           TMU TIMES Backend Server                   ║
╠══════════════════════════════════════════════════════╣
║  🚀 Server running on port ${PORT}                      ║
║  📡 API: http://localhost:${PORT}/api                   ║
║  🏥 Health: http://localhost:${PORT}/api/health         ║
║  📝 Environment: ${process.env.NODE_ENV || 'development'}                    ║
╚══════════════════════════════════════════════════════╝
  `);
});

module.exports = app;
