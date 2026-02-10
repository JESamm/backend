/**
 * Post Model - TMU Database
 */

const { Schema, createModel } = require('../database');

// Define the Post schema
const postSchema = new Schema({
  author: {
    type: String, // User ID reference
    required: [true, 'Author is required']
  },
  content: {
    type: String,
    required: [true, 'Content is required'],
    maxlength: [500, 'Content cannot exceed 500 characters']
  },
  media: {
    type: Array, // Array of { type: 'image'|'video', url: string }
    default: []
  },
  type: {
    type: String,
    enum: ['post', 'reply', 'repost', 'quote'],
    default: 'post'
  },
  category: {
    type: String,
    enum: ['official', 'student', 'announcement', 'event'],
    default: 'student'
  },
  parentPost: {
    type: String, // Post ID reference for replies/quotes
    default: null
  },
  hashtags: {
    type: Array,
    default: []
  },
  mentions: {
    type: Array,
    default: []
  },
  likes: {
    type: Array, // Array of { user: userId, createdAt: Date }
    default: []
  },
  reposts: {
    type: Array, // Array of { user: userId, createdAt: Date }
    default: []
  },
  bookmarks: {
    type: Array, // Array of user IDs
    default: []
  },
  views: {
    type: Number,
    default: 0
  },
  replyCount: {
    type: Number,
    default: 0
  },
  isHidden: {
    type: Boolean,
    default: false
  },
  isPinned: {
    type: Boolean,
    default: false
  },
  isScheduled: {
    type: Boolean,
    default: false
  },
  scheduledAt: {
    type: Date,
    default: null
  }
}, { timestamps: true });

// Indexes
postSchema.index({ author: 1 });
postSchema.index({ hashtags: 1 });
postSchema.index({ createdAt: -1 });

// Pre-save: Extract hashtags and mentions
postSchema.pre('save', function() {
  if (this.content) {
    // Extract hashtags
    const hashtagRegex = /#(\w+)/g;
    const hashtags = [];
    let match;
    while ((match = hashtagRegex.exec(this.content)) !== null) {
      hashtags.push(match[1].toLowerCase());
    }
    this.hashtags = [...new Set(hashtags)];
    
    // Extract mentions
    const mentionRegex = /@(\w+)/g;
    const mentions = [];
    while ((match = mentionRegex.exec(this.content)) !== null) {
      mentions.push(match[1].toLowerCase());
    }
    this.mentions = [...new Set(mentions)];
  }
});

// Instance methods
postSchema.methods.addLike = function(userId) {
  if (!this.likes.some(l => l.user === userId)) {
    this.likes.push({ user: userId, createdAt: new Date() });
  }
  return this;
};

postSchema.methods.removeLike = function(userId) {
  this.likes = this.likes.filter(l => l.user !== userId);
  return this;
};

postSchema.methods.addRepost = function(userId) {
  if (!this.reposts.some(r => r.user === userId)) {
    this.reposts.push({ user: userId, createdAt: new Date() });
  }
  return this;
};

postSchema.methods.removeRepost = function(userId) {
  this.reposts = this.reposts.filter(r => r.user !== userId);
  return this;
};

postSchema.methods.toggleBookmark = function(userId) {
  const index = this.bookmarks.indexOf(userId);
  if (index === -1) {
    this.bookmarks.push(userId);
  } else {
    this.bookmarks.splice(index, 1);
  }
  return this;
};

// Initialize model
let Post = null;

const initPostModel = () => {
  if (!Post) {
    Post = createModel('Post', postSchema);
  }
  return Post;
};

const getPostModel = () => {
  if (!Post) {
    throw new Error('Post model not initialized');
  }
  return Post;
};

module.exports = { initPostModel, getPostModel, postSchema };
