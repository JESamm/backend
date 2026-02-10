const mongoose = require('mongoose');

const PostSchema = new mongoose.Schema({
  // Author
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // Content
  content: {
    type: String,
    required: [true, 'Post content is required'],
    maxlength: [500, 'Post cannot exceed 500 characters'],
    trim: true
  },

  // Media attachments
  media: [{
    type: {
      type: String,
      enum: ['image', 'video', 'gif'],
      required: true
    },
    url: {
      type: String,
      required: true
    },
    thumbnail: String,
    alt: String
  }],

  // Post type
  type: {
    type: String,
    enum: ['post', 'repost', 'reply', 'quote'],
    default: 'post'
  },

  // For replies and quotes
  parentPost: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post'
  },

  // Engagement
  likes: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  reposts: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  bookmarks: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],

  // Metrics
  views: {
    type: Number,
    default: 0
  },
  commentCount: {
    type: Number,
    default: 0
  },

  // Hashtags extracted from content
  hashtags: [{
    type: String,
    lowercase: true
  }],

  // Mentions extracted from content
  mentions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],

  // Moderation
  isHidden: {
    type: Boolean,
    default: false
  },
  isFlagged: {
    type: Boolean,
    default: false
  },
  flagReason: String,

  // Scheduling
  isScheduled: {
    type: Boolean,
    default: false
  },
  scheduledFor: Date,

  // Location
  location: {
    name: String,
    coordinates: {
      type: [Number], // [longitude, latitude]
      index: '2dsphere'
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for like count
PostSchema.virtual('likeCount').get(function() {
  return this.likes ? this.likes.length : 0;
});

PostSchema.virtual('repostCount').get(function() {
  return this.reposts ? this.reposts.length : 0;
});

// Extract hashtags before saving
PostSchema.pre('save', function(next) {
  if (this.isModified('content')) {
    const hashtagRegex = /#(\w+)/g;
    const matches = this.content.match(hashtagRegex);
    if (matches) {
      this.hashtags = matches.map(tag => tag.toLowerCase().substring(1));
    }
  }
  next();
});

// Index for searching
PostSchema.index({ content: 'text', hashtags: 'text' });
PostSchema.index({ author: 1, createdAt: -1 });
PostSchema.index({ hashtags: 1 });

module.exports = mongoose.model('Post', PostSchema);
