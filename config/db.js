const mongoose = require('mongoose');

let isConnected = false;

const connectDB = async () => {
  // Skip if already connected
  if (isConnected) {
    return true;
  }

  // Check if MONGODB_URI is set
  if (!process.env.MONGODB_URI) {
    console.warn('⚠️  MONGODB_URI not set. Running in demo mode without database.');
    return false;
  }

  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      serverSelectionTimeoutMS: 5000, // 5 second timeout
      socketTimeoutMS: 45000,
    });

    isConnected = true;
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    
    // Handle connection events
    mongoose.connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
      isConnected = false;
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('MongoDB disconnected. Attempting to reconnect...');
      isConnected = false;
    });

    return true;
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    console.warn('⚠️  Server will continue running without database connection.');
    console.warn('   To connect to MongoDB:');
    console.warn('   1. Install MongoDB locally, or');
    console.warn('   2. Use MongoDB Atlas (free) and update MONGODB_URI in .env');
    return false;
  }
};

const isDBConnected = () => isConnected;

module.exports = { connectDB, isDBConnected };
