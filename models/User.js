const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const UserSchema = new mongoose.Schema({
  // Basic Info
  regNumber: {
    type: String,
    required: [true, 'Registration number is required'],
    unique: true,
    trim: true,
    uppercase: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false // Don't return password by default
  },

  // Profile Info
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [100, 'Name cannot exceed 100 characters']
  },
  handle: {
    type: String,
    unique: true,
    sparse: true,
    lowercase: true,
    trim: true
  },
  bio: {
    type: String,
    maxlength: [280, 'Bio cannot exceed 280 characters'],
    default: ''
  },
  avatar: {
    type: String,
    default: '👤'
  },
  profileImage: {
    type: String,
    default: ''
  },
  coverImage: {
    type: String,
    default: ''
  },

  // Academic Info
  department: {
    type: String,
    default: ''
  },
  faculty: {
    type: String,
    default: ''
  },
  yearOfStudy: {
    type: Number,
    min: 1,
    max: 7
  },
  program: {
    type: String,
    default: ''
  },

  // Role & Permissions
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

  // Social
  followers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  following: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  bookmarks: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post'
  }],

  // Voting
  hasVoted: [{
    election: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Election'
    },
    votedAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Timestamps
  lastLogin: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for follower count
UserSchema.virtual('followerCount').get(function() {
  return this.followers ? this.followers.length : 0;
});

UserSchema.virtual('followingCount').get(function() {
  return this.following ? this.following.length : 0;
});

// Hash password before saving
UserSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Generate handle from name if not provided
UserSchema.pre('save', function(next) {
  if (!this.handle) {
    this.handle = this.name.toLowerCase().replace(/\s+/g, '') + '_' + Date.now().toString(36);
  }
  next();
});

// Compare password method
UserSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Generate JWT token
UserSchema.methods.getSignedJwtToken = function() {
  return jwt.sign(
    { id: this._id, role: this.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );
};

module.exports = mongoose.model('User', UserSchema);
