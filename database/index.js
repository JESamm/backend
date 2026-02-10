/**
 * TMU Database Connection
 * Initialize and export the custom database instance
 */

const path = require('path');
const TMUDatabase = require('./TMUDatabase');
const { Schema, Model, SchemaTypes } = require('./Schema');

// Database instance
let db = null;
const models = {};

/**
 * Initialize the database
 */
const initDatabase = (dbPath) => {
  const dataPath = dbPath || path.join(__dirname, '..', 'data');
  db = new TMUDatabase(dataPath);
  db.models = models;
  
  console.log('');
  console.log('🗄️  TMU Custom Database Engine v1.0');
  console.log('   ─────────────────────────────────');
  
  return db;
};

/**
 * Get the database instance
 */
const getDatabase = () => {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
};

/**
 * Create a model
 */
const createModel = (name, schema) => {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  
  const model = new Model(name, schema, db);
  models[name] = model;
  db.models = models;
  
  return model;
};

/**
 * Get a model by name
 */
const getModel = (name) => {
  return models[name] || null;
};

/**
 * Check if database is connected
 */
const isConnected = () => {
  return db !== null;
};

/**
 * Get database stats
 */
const getStats = () => {
  if (!db) return null;
  return db.stats();
};

/**
 * Backup the database
 */
const backup = (backupPath) => {
  if (!db) return null;
  return db.backup(backupPath);
};

/**
 * Flush all pending writes
 */
const flush = () => {
  if (db) {
    db.flush();
  }
};

// Export everything
module.exports = {
  initDatabase,
  getDatabase,
  createModel,
  getModel,
  isConnected,
  getStats,
  backup,
  flush,
  Schema,
  SchemaTypes
};
