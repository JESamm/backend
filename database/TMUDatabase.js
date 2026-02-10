/**
 * TMU TIMES Custom Database Engine
 * A lightweight, file-based JSON database system
 * Built from scratch - No external database dependencies
 * 
 * Features:
 * - Collections (like tables)
 * - CRUD operations
 * - Indexing for fast lookups
 * - Query support with operators
 * - Auto-save with write buffering
 * - Data validation
 * - Backup & Recovery
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class TMUDatabase {
  constructor(dbPath) {
    this.dbPath = dbPath;
    this.collections = {};
    this.indexes = {};
    this.writeBuffer = {};
    this.writeTimeout = null;
    this.WRITE_DELAY = 100; // ms delay before writing to disk
    
    // Ensure database directory exists
    if (!fs.existsSync(this.dbPath)) {
      fs.mkdirSync(this.dbPath, { recursive: true });
    }
    
    // Load existing collections
    this._loadCollections();
    
    console.log(`📦 TMU Database initialized at: ${this.dbPath}`);
  }

  /**
   * Load all existing collections from disk
   */
  _loadCollections() {
    try {
      const files = fs.readdirSync(this.dbPath);
      for (const file of files) {
        if (file.endsWith('.json') && !file.startsWith('_')) {
          const collectionName = file.replace('.json', '');
          this._loadCollection(collectionName);
        }
      }
    } catch (error) {
      console.error('Error loading collections:', error);
    }
  }

  /**
   * Load a single collection from disk
   */
  _loadCollection(name) {
    const filePath = path.join(this.dbPath, `${name}.json`);
    try {
      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf8');
        this.collections[name] = JSON.parse(data);
        this._rebuildIndexes(name);
        console.log(`  ✓ Loaded collection: ${name} (${this.collections[name].length} documents)`);
      } else {
        this.collections[name] = [];
      }
    } catch (error) {
      console.error(`Error loading collection ${name}:`, error);
      this.collections[name] = [];
    }
  }

  /**
   * Save collection to disk (with write buffering)
   */
  _saveCollection(name) {
    this.writeBuffer[name] = true;
    
    // Debounce writes
    if (this.writeTimeout) {
      clearTimeout(this.writeTimeout);
    }
    
    this.writeTimeout = setTimeout(() => {
      this._flushWrites();
    }, this.WRITE_DELAY);
  }

  /**
   * Flush all pending writes to disk
   */
  _flushWrites() {
    for (const name of Object.keys(this.writeBuffer)) {
      const filePath = path.join(this.dbPath, `${name}.json`);
      try {
        fs.writeFileSync(filePath, JSON.stringify(this.collections[name], null, 2));
      } catch (error) {
        console.error(`Error saving collection ${name}:`, error);
      }
    }
    this.writeBuffer = {};
  }

  /**
   * Force immediate save of all collections
   */
  flush() {
    if (this.writeTimeout) {
      clearTimeout(this.writeTimeout);
    }
    this._flushWrites();
  }

  /**
   * Generate a unique ID (similar to MongoDB ObjectId)
   */
  _generateId() {
    const timestamp = Math.floor(Date.now() / 1000).toString(16).padStart(8, '0');
    const random = crypto.randomBytes(8).toString('hex');
    return timestamp + random;
  }

  /**
   * Get or create a collection
   */
  collection(name) {
    if (!this.collections[name]) {
      this.collections[name] = [];
      this.indexes[name] = {};
    }
    return new Collection(this, name);
  }

  /**
   * Create an index on a field for faster lookups
   */
  createIndex(collectionName, field, options = {}) {
    if (!this.indexes[collectionName]) {
      this.indexes[collectionName] = {};
    }
    
    this.indexes[collectionName][field] = {
      unique: options.unique || false,
      data: new Map()
    };
    
    this._rebuildIndexes(collectionName, field);
    console.log(`  ✓ Created index on ${collectionName}.${field}`);
  }

  /**
   * Rebuild indexes for a collection
   */
  _rebuildIndexes(collectionName, specificField = null) {
    const collection = this.collections[collectionName] || [];
    const indexes = this.indexes[collectionName] || {};
    
    const fieldsToIndex = specificField ? [specificField] : Object.keys(indexes);
    
    for (const field of fieldsToIndex) {
      if (indexes[field]) {
        indexes[field].data = new Map();
        for (const doc of collection) {
          const value = this._getNestedValue(doc, field);
          if (value !== undefined) {
            if (!indexes[field].data.has(value)) {
              indexes[field].data.set(value, []);
            }
            indexes[field].data.get(value).push(doc._id);
          }
        }
      }
    }
  }

  /**
   * Get nested value from object using dot notation
   */
  _getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => 
      current && current[key] !== undefined ? current[key] : undefined, obj);
  }

  /**
   * Backup the entire database
   */
  backup(backupPath) {
    this.flush();
    const backupDir = backupPath || path.join(this.dbPath, '_backups', Date.now().toString());
    
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }
    
    for (const name of Object.keys(this.collections)) {
      const srcPath = path.join(this.dbPath, `${name}.json`);
      const destPath = path.join(backupDir, `${name}.json`);
      if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, destPath);
      }
    }
    
    console.log(`💾 Database backed up to: ${backupDir}`);
    return backupDir;
  }

  /**
   * Get database statistics
   */
  stats() {
    const stats = {
      collections: {},
      totalDocuments: 0,
      totalSize: 0
    };
    
    for (const [name, docs] of Object.entries(this.collections)) {
      const filePath = path.join(this.dbPath, `${name}.json`);
      let size = 0;
      try {
        if (fs.existsSync(filePath)) {
          size = fs.statSync(filePath).size;
        }
      } catch (e) {}
      
      stats.collections[name] = {
        documents: docs.length,
        size: size,
        indexes: Object.keys(this.indexes[name] || {})
      };
      stats.totalDocuments += docs.length;
      stats.totalSize += size;
    }
    
    return stats;
  }
}

/**
 * Collection class - handles operations on a single collection
 */
class Collection {
  constructor(db, name) {
    this.db = db;
    this.name = name;
  }

  /**
   * Get the raw data array
   */
  get _data() {
    return this.db.collections[this.name];
  }

  /**
   * Get indexes for this collection
   */
  get _indexes() {
    return this.db.indexes[this.name] || {};
  }

  /**
   * Insert a single document
   */
  async insertOne(doc) {
    const now = new Date();
    const newDoc = {
      _id: this.db._generateId(),
      ...doc,
      createdAt: doc.createdAt || now,
      updatedAt: doc.updatedAt || now
    };
    
    // Check unique indexes
    for (const [field, index] of Object.entries(this._indexes)) {
      if (index.unique) {
        const value = this.db._getNestedValue(newDoc, field);
        if (value !== undefined && index.data.has(value)) {
          throw new Error(`Duplicate key error: ${field} must be unique`);
        }
      }
    }
    
    this._data.push(newDoc);
    
    // Update indexes
    for (const [field, index] of Object.entries(this._indexes)) {
      const value = this.db._getNestedValue(newDoc, field);
      if (value !== undefined) {
        if (!index.data.has(value)) {
          index.data.set(value, []);
        }
        index.data.get(value).push(newDoc._id);
      }
    }
    
    this.db._saveCollection(this.name);
    
    return { insertedId: newDoc._id, document: newDoc };
  }

  /**
   * Insert multiple documents
   */
  async insertMany(docs) {
    const results = [];
    for (const doc of docs) {
      const result = await this.insertOne(doc);
      results.push(result);
    }
    return { insertedCount: results.length, insertedIds: results.map(r => r.insertedId) };
  }

  /**
   * Find documents matching a query
   */
  async find(query = {}, options = {}) {
    let results = this._matchQuery(query);
    
    // Apply sorting
    if (options.sort) {
      results = this._applySort(results, options.sort);
    }
    
    // Apply skip
    if (options.skip) {
      results = results.slice(options.skip);
    }
    
    // Apply limit
    if (options.limit) {
      results = results.slice(0, options.limit);
    }
    
    // Apply projection
    if (options.projection) {
      results = results.map(doc => this._applyProjection(doc, options.projection));
    }
    
    return results;
  }

  /**
   * Find a single document
   */
  async findOne(query = {}) {
    const results = await this.find(query, { limit: 1 });
    return results[0] || null;
  }

  /**
   * Find by ID
   */
  async findById(id) {
    // Use index if available
    if (this._indexes['_id']) {
      const ids = this._indexes['_id'].data.get(id);
      if (ids && ids.length > 0) {
        return this._data.find(doc => doc._id === id) || null;
      }
      return null;
    }
    return this._data.find(doc => doc._id === id) || null;
  }

  /**
   * Update a single document
   */
  async updateOne(query, update) {
    const doc = await this.findOne(query);
    if (!doc) {
      return { matchedCount: 0, modifiedCount: 0 };
    }
    
    const index = this._data.findIndex(d => d._id === doc._id);
    if (index === -1) return { matchedCount: 0, modifiedCount: 0 };
    
    // Apply update operations
    const updatedDoc = this._applyUpdate(this._data[index], update);
    updatedDoc.updatedAt = new Date();
    
    this._data[index] = updatedDoc;
    this.db._rebuildIndexes(this.name);
    this.db._saveCollection(this.name);
    
    return { matchedCount: 1, modifiedCount: 1, document: updatedDoc };
  }

  /**
   * Update multiple documents
   */
  async updateMany(query, update) {
    const docs = await this.find(query);
    let modifiedCount = 0;
    
    for (const doc of docs) {
      const index = this._data.findIndex(d => d._id === doc._id);
      if (index !== -1) {
        const updatedDoc = this._applyUpdate(this._data[index], update);
        updatedDoc.updatedAt = new Date();
        this._data[index] = updatedDoc;
        modifiedCount++;
      }
    }
    
    if (modifiedCount > 0) {
      this.db._rebuildIndexes(this.name);
      this.db._saveCollection(this.name);
    }
    
    return { matchedCount: docs.length, modifiedCount };
  }

  /**
   * Find and update a document, returning the updated version
   */
  async findByIdAndUpdate(id, update, options = {}) {
    const index = this._data.findIndex(d => d._id === id);
    if (index === -1) return null;
    
    const updatedDoc = this._applyUpdate(this._data[index], update);
    updatedDoc.updatedAt = new Date();
    this._data[index] = updatedDoc;
    
    this.db._rebuildIndexes(this.name);
    this.db._saveCollection(this.name);
    
    return options.new !== false ? updatedDoc : this._data[index];
  }

  /**
   * Delete a single document
   */
  async deleteOne(query) {
    const doc = await this.findOne(query);
    if (!doc) {
      return { deletedCount: 0 };
    }
    
    const index = this._data.findIndex(d => d._id === doc._id);
    if (index !== -1) {
      this._data.splice(index, 1);
      this.db._rebuildIndexes(this.name);
      this.db._saveCollection(this.name);
      return { deletedCount: 1 };
    }
    
    return { deletedCount: 0 };
  }

  /**
   * Delete multiple documents
   */
  async deleteMany(query) {
    const docs = await this.find(query);
    const idsToDelete = new Set(docs.map(d => d._id));
    
    const originalLength = this._data.length;
    this.db.collections[this.name] = this._data.filter(d => !idsToDelete.has(d._id));
    
    const deletedCount = originalLength - this._data.length;
    
    if (deletedCount > 0) {
      this.db._rebuildIndexes(this.name);
      this.db._saveCollection(this.name);
    }
    
    return { deletedCount };
  }

  /**
   * Count documents matching a query
   */
  async countDocuments(query = {}) {
    const results = this._matchQuery(query);
    return results.length;
  }

  /**
   * Check if any document matches a query
   */
  async exists(query) {
    const doc = await this.findOne(query);
    return doc !== null;
  }

  /**
   * Get distinct values for a field
   */
  async distinct(field, query = {}) {
    const docs = await this.find(query);
    const values = new Set();
    for (const doc of docs) {
      const value = this.db._getNestedValue(doc, field);
      if (value !== undefined) {
        values.add(value);
      }
    }
    return Array.from(values);
  }

  /**
   * Aggregate pipeline (simplified)
   */
  async aggregate(pipeline) {
    let results = [...this._data];
    
    for (const stage of pipeline) {
      const [operation, params] = Object.entries(stage)[0];
      
      switch (operation) {
        case '$match':
          results = results.filter(doc => this._matchDocument(doc, params));
          break;
        case '$sort':
          results = this._applySort(results, params);
          break;
        case '$limit':
          results = results.slice(0, params);
          break;
        case '$skip':
          results = results.slice(params);
          break;
        case '$project':
          results = results.map(doc => this._applyProjection(doc, params));
          break;
        case '$group':
          results = this._applyGroup(results, params);
          break;
      }
    }
    
    return results;
  }

  /**
   * Match documents against a query
   */
  _matchQuery(query) {
    if (Object.keys(query).length === 0) {
      return [...this._data];
    }
    
    // Try to use index for simple equality queries
    for (const [field, value] of Object.entries(query)) {
      if (typeof value !== 'object' && this._indexes[field]) {
        const ids = this._indexes[field].data.get(value) || [];
        const idSet = new Set(ids);
        const indexed = this._data.filter(doc => idSet.has(doc._id));
        // Apply remaining query conditions
        return indexed.filter(doc => this._matchDocument(doc, query));
      }
    }
    
    return this._data.filter(doc => this._matchDocument(doc, query));
  }

  /**
   * Check if a document matches a query
   */
  _matchDocument(doc, query) {
    for (const [field, condition] of Object.entries(query)) {
      // Handle special operators
      if (field === '$or') {
        if (!condition.some(subQuery => this._matchDocument(doc, subQuery))) {
          return false;
        }
        continue;
      }
      if (field === '$and') {
        if (!condition.every(subQuery => this._matchDocument(doc, subQuery))) {
          return false;
        }
        continue;
      }
      
      const value = this.db._getNestedValue(doc, field);
      
      if (typeof condition === 'object' && condition !== null && !Array.isArray(condition)) {
        // Handle comparison operators
        for (const [op, opValue] of Object.entries(condition)) {
          switch (op) {
            case '$eq':
              if (value !== opValue) return false;
              break;
            case '$ne':
              if (value === opValue) return false;
              break;
            case '$gt':
              if (!(value > opValue)) return false;
              break;
            case '$gte':
              if (!(value >= opValue)) return false;
              break;
            case '$lt':
              if (!(value < opValue)) return false;
              break;
            case '$lte':
              if (!(value <= opValue)) return false;
              break;
            case '$in':
              if (!opValue.includes(value)) return false;
              break;
            case '$nin':
              if (opValue.includes(value)) return false;
              break;
            case '$exists':
              if ((value !== undefined) !== opValue) return false;
              break;
            case '$regex':
              const regex = new RegExp(opValue, condition.$options || '');
              if (!regex.test(value)) return false;
              break;
            case '$elemMatch':
              if (!Array.isArray(value) || !value.some(el => this._matchDocument(el, opValue))) {
                return false;
              }
              break;
          }
        }
      } else {
        // Simple equality check
        if (Array.isArray(condition)) {
          if (!Array.isArray(value) || JSON.stringify(value) !== JSON.stringify(condition)) {
            return false;
          }
        } else if (value !== condition) {
          return false;
        }
      }
    }
    return true;
  }

  /**
   * Apply update operations to a document
   */
  _applyUpdate(doc, update) {
    const result = { ...doc };
    
    for (const [op, fields] of Object.entries(update)) {
      switch (op) {
        case '$set':
          for (const [field, value] of Object.entries(fields)) {
            this._setNestedValue(result, field, value);
          }
          break;
        case '$unset':
          for (const field of Object.keys(fields)) {
            this._deleteNestedValue(result, field);
          }
          break;
        case '$inc':
          for (const [field, value] of Object.entries(fields)) {
            const current = this.db._getNestedValue(result, field) || 0;
            this._setNestedValue(result, field, current + value);
          }
          break;
        case '$push':
          for (const [field, value] of Object.entries(fields)) {
            const current = this.db._getNestedValue(result, field) || [];
            if (value.$each) {
              current.push(...value.$each);
            } else {
              current.push(value);
            }
            this._setNestedValue(result, field, current);
          }
          break;
        case '$pull':
          for (const [field, value] of Object.entries(fields)) {
            const current = this.db._getNestedValue(result, field) || [];
            const filtered = current.filter(item => {
              if (typeof value === 'object') {
                return !this._matchDocument(item, value);
              }
              return item !== value;
            });
            this._setNestedValue(result, field, filtered);
          }
          break;
        case '$addToSet':
          for (const [field, value] of Object.entries(fields)) {
            const current = this.db._getNestedValue(result, field) || [];
            if (!current.includes(value)) {
              current.push(value);
            }
            this._setNestedValue(result, field, current);
          }
          break;
        default:
          // Direct field update (no operator)
          if (!op.startsWith('$')) {
            result[op] = fields;
          }
      }
    }
    
    return result;
  }

  /**
   * Set a nested value using dot notation
   */
  _setNestedValue(obj, path, value) {
    const keys = path.split('.');
    let current = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) {
        current[keys[i]] = {};
      }
      current = current[keys[i]];
    }
    current[keys[keys.length - 1]] = value;
  }

  /**
   * Delete a nested value using dot notation
   */
  _deleteNestedValue(obj, path) {
    const keys = path.split('.');
    let current = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!current[keys[i]]) return;
      current = current[keys[i]];
    }
    delete current[keys[keys.length - 1]];
  }

  /**
   * Apply sorting to results
   */
  _applySort(docs, sort) {
    return [...docs].sort((a, b) => {
      for (const [field, order] of Object.entries(sort)) {
        const aVal = this.db._getNestedValue(a, field);
        const bVal = this.db._getNestedValue(b, field);
        
        if (aVal < bVal) return -1 * order;
        if (aVal > bVal) return 1 * order;
      }
      return 0;
    });
  }

  /**
   * Apply projection to a document
   */
  _applyProjection(doc, projection) {
    const result = {};
    const include = Object.values(projection).some(v => v === 1);
    
    if (include) {
      // Include only specified fields
      result._id = doc._id; // Always include _id unless explicitly excluded
      for (const [field, value] of Object.entries(projection)) {
        if (value === 1) {
          result[field] = this.db._getNestedValue(doc, field);
        } else if (field === '_id' && value === 0) {
          delete result._id;
        }
      }
    } else {
      // Exclude specified fields
      Object.assign(result, doc);
      for (const [field, value] of Object.entries(projection)) {
        if (value === 0) {
          delete result[field];
        }
      }
    }
    
    return result;
  }

  /**
   * Apply grouping (simplified $group)
   */
  _applyGroup(docs, params) {
    const groups = new Map();
    
    for (const doc of docs) {
      let groupKey;
      if (params._id === null) {
        groupKey = 'null';
      } else if (typeof params._id === 'string' && params._id.startsWith('$')) {
        groupKey = this.db._getNestedValue(doc, params._id.slice(1));
      } else {
        groupKey = params._id;
      }
      
      if (!groups.has(groupKey)) {
        groups.set(groupKey, { _id: groupKey === 'null' ? null : groupKey, _docs: [] });
      }
      groups.get(groupKey)._docs.push(doc);
    }
    
    // Apply aggregation operators
    const results = [];
    for (const [key, group] of groups) {
      const result = { _id: group._id };
      
      for (const [field, op] of Object.entries(params)) {
        if (field === '_id') continue;
        
        const [opName, opField] = Object.entries(op)[0];
        const fieldName = opField.startsWith('$') ? opField.slice(1) : opField;
        
        switch (opName) {
          case '$sum':
            if (opField === 1) {
              result[field] = group._docs.length;
            } else {
              result[field] = group._docs.reduce((sum, d) => 
                sum + (this.db._getNestedValue(d, fieldName) || 0), 0);
            }
            break;
          case '$avg':
            const values = group._docs.map(d => this.db._getNestedValue(d, fieldName)).filter(v => v != null);
            result[field] = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
            break;
          case '$max':
            result[field] = Math.max(...group._docs.map(d => this.db._getNestedValue(d, fieldName) || 0));
            break;
          case '$min':
            result[field] = Math.min(...group._docs.map(d => this.db._getNestedValue(d, fieldName) || Infinity));
            break;
          case '$first':
            result[field] = this.db._getNestedValue(group._docs[0], fieldName);
            break;
          case '$last':
            result[field] = this.db._getNestedValue(group._docs[group._docs.length - 1], fieldName);
            break;
        }
      }
      
      results.push(result);
    }
    
    return results;
  }
}

// Export the database class
module.exports = TMUDatabase;
