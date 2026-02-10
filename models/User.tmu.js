/**
 * User Model - TMU Database
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Schema, createModel, getDatabase } = require('../database');

// Define the User schema
const userSchema = new Schema({
  regNumber: {
    type: String,
    required: [true, 'Registration number is required'],
    uppercase: true,
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters']
  },
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  handle: {
    type: String,
    lowercase: true,
    trim: true
  },
  avatar: {
    type: String,
    default: '👤'
  },
  profileImage: {
    type: String,
    default: null
  },
  coverImage: {
    type: String,
    default: null
  },
  bio: {
    type: String,
    maxlength: [280, 'Bio cannot exceed 280 characters'],
    default: ''
  },
  department: {
    type: String,
    trim: true,
    default: ''
  },
  faculty: {
    type: String,
    trim: true,
    default: ''
  },
  program: {
    type: String,
    trim: true,
    default: ''
  },
  yearOfStudy: {
    type: Number,
    min: 1,
    max: 7,
    default: 1
  },
  role: {
    type: String,
    enum: ['student', 'staff', 'hod', 'dean', 'vc', 'admin', 'moderator'],
    default: 'student'
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  followers: {
    type: Array,
    default: []
  },
  following: {
    type: Array,
    default: []
  },
  bookmarks: {
    type: Array,
    default: []
  },
  lastLogin: {
    type: Date,
    default: null
  }
}, { timestamps: true });

// Index for unique fields
userSchema.index({ regNumber: 1 }, { unique: true });
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ handle: 1 });

// Pre-save hook to hash password
userSchema.pre('save', async function() {
  // Only hash if password is modified (new or changed)
  if (this.password && !this.password.startsWith('$2a$')) {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  }
  
  // Generate handle if not set
  if (!this.handle && this.name) {
    this.handle = this.name.toLowerCase().replace(/\s+/g, '') + '_' + Date.now().toString(36);
  }
});

// Instance method: Match password
userSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Instance method: Get signed JWT
userSchema.methods.getSignedJwtToken = function() {
  return jwt.sign(
    { id: this._id, role: this.role },
    process.env.JWT_SECRET || 'tmu_secret_key_2024',
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );
};

// Static method: Find by credentials
userSchema.statics.findByCredentials = async function(regNumber, password) {
  const user = await this.findOne({ regNumber: regNumber.toUpperCase() });
  if (!user) return null;
  
  const isMatch = await user.matchPassword(password);
  if (!isMatch) return null;
  
  return user;
};

// Initialize model (will be called after DB init)
let User = null;

const initUserModel = () => {
  if (!User) {
    User = createModel('User', userSchema);
  }
  return User;
};

const getUserModel = () => {
  if (!User) {
    throw new Error('User model not initialized. Call initUserModel() first.');
  }
  return User;
};

module.exports = { initUserModel, getUserModel, userSchema };
