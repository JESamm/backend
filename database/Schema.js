/**
 * TMU Database Schema & Model System
 * Provides Mongoose-like schema validation and model methods
 */

const crypto = require('crypto');

class Schema {
  constructor(definition, options = {}) {
    this.definition = definition;
    this.options = {
      timestamps: true,
      ...options
    };
    this.methods = {};
    this.statics = {};
    this.virtuals = {};
    this.preHooks = {};
    this.postHooks = {};
    this.indexes = [];
  }

  /**
   * Add a pre-hook (middleware)
   */
  pre(action, fn) {
    if (!this.preHooks[action]) {
      this.preHooks[action] = [];
    }
    this.preHooks[action].push(fn);
    return this;
  }

  /**
   * Add a post-hook
   */
  post(action, fn) {
    if (!this.postHooks[action]) {
      this.postHooks[action] = [];
    }
    this.postHooks[action].push(fn);
    return this;
  }

  /**
   * Add an index
   */
  index(fields, options = {}) {
    this.indexes.push({ fields, options });
    return this;
  }

  /**
   * Add a virtual property
   */
  virtual(name) {
    const virtual = {
      get: null,
      set: null
    };
    this.virtuals[name] = virtual;
    return {
      get: (fn) => { virtual.get = fn; return this; },
      set: (fn) => { virtual.set = fn; return this; }
    };
  }
}

class Model {
  constructor(name, schema, db) {
    this.modelName = name;
    this.schema = schema;
    this.db = db;
    this.collection = db.collection(name.toLowerCase() + 's');
    
    // Create indexes
    for (const idx of schema.indexes) {
      for (const [field, order] of Object.entries(idx.fields)) {
        db.createIndex(name.toLowerCase() + 's', field, idx.options);
      }
    }
    
    // Always index _id
    db.createIndex(name.toLowerCase() + 's', '_id', { unique: true });
    
    // Add static methods
    for (const [methodName, fn] of Object.entries(schema.statics)) {
      this[methodName] = fn.bind(this);
    }
  }

  /**
   * Create a document instance with methods
   */
  _wrapDocument(doc) {
    if (!doc) return null;
    
    const wrapped = { ...doc };
    const schema = this.schema;
    const model = this;
    
    // Add instance methods
    for (const [methodName, fn] of Object.entries(schema.methods)) {
      wrapped[methodName] = fn.bind(wrapped);
    }
    
    // Add virtuals
    for (const [name, virtual] of Object.entries(schema.virtuals)) {
      Object.defineProperty(wrapped, name, {
        get: virtual.get ? virtual.get.bind(wrapped) : undefined,
        set: virtual.set ? virtual.set.bind(wrapped) : undefined,
        enumerable: true
      });
    }
    
    // Add save method
    wrapped.save = async function(options = {}) {
      // Run pre-save hooks
      for (const hook of (schema.preHooks['save'] || [])) {
        await hook.call(this);
      }
      
      const result = await model.findByIdAndUpdate(this._id, { $set: this }, { new: true });
      
      // Run post-save hooks
      for (const hook of (schema.postHooks['save'] || [])) {
        await hook.call(result);
      }
      
      return result;
    };
    
    // Add toObject method
    wrapped.toObject = function() {
      const obj = { ...this };
      delete obj.save;
      delete obj.toObject;
      delete obj.toJSON;
      // Remove methods
      for (const methodName of Object.keys(schema.methods)) {
        delete obj[methodName];
      }
      return obj;
    };
    
    wrapped.toJSON = wrapped.toObject;
    
    return wrapped;
  }

  /**
   * Validate a document against the schema
   */
  _validate(doc) {
    const errors = [];
    
    for (const [field, rules] of Object.entries(this.schema.definition)) {
      const value = doc[field];
      const fieldRules = typeof rules === 'function' ? { type: rules } : rules;
      
      // Required check
      if (fieldRules.required) {
        const isRequired = typeof fieldRules.required === 'function' 
          ? fieldRules.required() 
          : fieldRules.required;
        if (isRequired && (value === undefined || value === null || value === '')) {
          const message = Array.isArray(fieldRules.required) 
            ? fieldRules.required[1] 
            : `${field} is required`;
          errors.push({ field, message });
          continue;
        }
      }
      
      if (value === undefined || value === null) continue;
      
      // Type check
      if (fieldRules.type) {
        const type = fieldRules.type;
        let isValid = true;
        
        if (type === String && typeof value !== 'string') isValid = false;
        if (type === Number && typeof value !== 'number') isValid = false;
        if (type === Boolean && typeof value !== 'boolean') isValid = false;
        if (type === Date && !(value instanceof Date) && isNaN(Date.parse(value))) isValid = false;
        if (type === Array && !Array.isArray(value)) isValid = false;
        
        if (!isValid) {
          errors.push({ field, message: `${field} must be of type ${type.name}` });
        }
      }
      
      // Enum check
      if (fieldRules.enum && !fieldRules.enum.includes(value)) {
        errors.push({ field, message: `${field} must be one of: ${fieldRules.enum.join(', ')}` });
      }
      
      // Min/Max length for strings
      if (typeof value === 'string') {
        if (fieldRules.minlength && value.length < fieldRules.minlength) {
          errors.push({ field, message: `${field} must be at least ${fieldRules.minlength} characters` });
        }
        if (fieldRules.maxlength && value.length > fieldRules.maxlength) {
          errors.push({ field, message: `${field} cannot exceed ${fieldRules.maxlength} characters` });
        }
        // Handle match as RegExp or [RegExp, message] array
        if (fieldRules.match) {
          let regex = fieldRules.match;
          if (Array.isArray(fieldRules.match)) {
            regex = fieldRules.match[0];
          }
          if (regex && typeof regex.test === 'function' && !regex.test(value)) {
            errors.push({ field, message: `${field} format is invalid` });
          }
        }
      }
      
      // Min/Max for numbers
      if (typeof value === 'number') {
        if (fieldRules.min !== undefined && value < fieldRules.min) {
          errors.push({ field, message: `${field} must be at least ${fieldRules.min}` });
        }
        if (fieldRules.max !== undefined && value > fieldRules.max) {
          errors.push({ field, message: `${field} cannot exceed ${fieldRules.max}` });
        }
      }
    }
    
    if (errors.length > 0) {
      const error = new Error('Validation failed');
      error.name = 'ValidationError';
      error.errors = errors;
      throw error;
    }
    
    return true;
  }

  /**
   * Apply default values
   */
  _applyDefaults(doc) {
    const result = { ...doc };
    
    for (const [field, rules] of Object.entries(this.schema.definition)) {
      if (result[field] === undefined) {
        const fieldRules = typeof rules === 'function' ? { type: rules } : rules;
        if (fieldRules.default !== undefined) {
          result[field] = typeof fieldRules.default === 'function' 
            ? fieldRules.default() 
            : fieldRules.default;
        }
      }
    }
    
    return result;
  }

  /**
   * Transform values (lowercase, trim, etc.)
   */
  _transform(doc) {
    const result = { ...doc };
    
    for (const [field, rules] of Object.entries(this.schema.definition)) {
      if (result[field] !== undefined && typeof result[field] === 'string') {
        const fieldRules = typeof rules === 'function' ? { type: rules } : rules;
        if (fieldRules.lowercase) result[field] = result[field].toLowerCase();
        if (fieldRules.uppercase) result[field] = result[field].toUpperCase();
        if (fieldRules.trim) result[field] = result[field].trim();
      }
    }
    
    return result;
  }

  /**
   * Create a new document
   */
  async create(data) {
    // Handle array of documents
    if (Array.isArray(data)) {
      const results = [];
      for (const item of data) {
        results.push(await this.create(item));
      }
      return results;
    }
    
    // Apply defaults and transforms
    let doc = this._applyDefaults(data);
    doc = this._transform(doc);
    
    // Run pre-save hooks
    for (const hook of (this.schema.preHooks['save'] || [])) {
      await hook.call(doc);
    }
    
    // Validate
    this._validate(doc);
    
    // Insert
    const result = await this.collection.insertOne(doc);
    const wrapped = this._wrapDocument(result.document);
    
    // Run post-save hooks
    for (const hook of (this.schema.postHooks['save'] || [])) {
      await hook.call(wrapped);
    }
    
    return wrapped;
  }

  /**
   * Find documents
   */
  async find(query = {}, projection = null) {
    const options = {};
    if (projection) options.projection = projection;
    
    const docs = await this.collection.find(query, options);
    return docs.map(doc => this._wrapDocument(doc));
  }

  /**
   * Find one document
   */
  async findOne(query = {}) {
    const doc = await this.collection.findOne(query);
    return this._wrapDocument(doc);
  }

  /**
   * Find by ID
   */
  async findById(id) {
    if (!id) return null;
    const doc = await this.collection.findById(id);
    return this._wrapDocument(doc);
  }

  /**
   * Find by ID and update
   */
  async findByIdAndUpdate(id, update, options = {}) {
    if (!id) return null;
    
    // Handle $set shorthand
    let updateOp = update;
    if (!Object.keys(update).some(k => k.startsWith('$'))) {
      updateOp = { $set: update };
    }
    
    const doc = await this.collection.findByIdAndUpdate(id, updateOp, options);
    return this._wrapDocument(doc);
  }

  /**
   * Find by ID and delete
   */
  async findByIdAndDelete(id) {
    if (!id) return null;
    const doc = await this.findById(id);
    if (doc) {
      await this.collection.deleteOne({ _id: id });
    }
    return doc;
  }

  /**
   * Find one and update
   */
  async findOneAndUpdate(query, update, options = {}) {
    const result = await this.collection.updateOne(query, update);
    if (result.matchedCount > 0) {
      return this._wrapDocument(result.document);
    }
    return null;
  }

  /**
   * Update one document
   */
  async updateOne(query, update) {
    return await this.collection.updateOne(query, update);
  }

  /**
   * Update many documents
   */
  async updateMany(query, update) {
    return await this.collection.updateMany(query, update);
  }

  /**
   * Delete one document
   */
  async deleteOne(query) {
    return await this.collection.deleteOne(query);
  }

  /**
   * Delete many documents
   */
  async deleteMany(query) {
    return await this.collection.deleteMany(query);
  }

  /**
   * Count documents
   */
  async countDocuments(query = {}) {
    return await this.collection.countDocuments(query);
  }

  /**
   * Check if document exists
   */
  async exists(query) {
    return await this.collection.exists(query);
  }

  /**
   * Get distinct values
   */
  async distinct(field, query = {}) {
    return await this.collection.distinct(field, query);
  }

  /**
   * Aggregate
   */
  async aggregate(pipeline) {
    return await this.collection.aggregate(pipeline);
  }

  /**
   * Populate references (simplified)
   */
  async populate(doc, path, model) {
    if (!doc || !doc[path]) return doc;
    
    const refId = doc[path];
    const refModel = this.db.models ? this.db.models[model] : null;
    
    if (refModel) {
      const refDoc = await refModel.findById(refId);
      doc[path] = refDoc;
    }
    
    return doc;
  }
}

/**
 * Schema types
 */
const SchemaTypes = {
  String,
  Number,
  Boolean,
  Date,
  Array,
  Object,
  ObjectId: String, // We use string IDs
  Mixed: Object
};

module.exports = { Schema, Model, SchemaTypes };
