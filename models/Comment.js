const mongoose = require('mongoose');

const CommentSchema = new mongoose.Schema({
  // Author
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // Parent post
  post: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Post',
    required: true
  },

  // For nested comments (replies to comments)
  parentComment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Comment'
  },

  // Content
  content: {
    type: String,
    required: [true, 'Comment content is required'],
    maxlength: [280, 'Comment cannot exceed 280 characters'],
    trim: true
  },

  // Media (optional)
  media: {
    type: {
      type: String,
      enum: ['image', 'gif']
    },
    url: String
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

  // Moderation
  isHidden: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for like count
CommentSchema.virtual('likeCount').get(function() {
  return this.likes ? this.likes.length : 0;
});

// Update comment count on parent post
CommentSchema.post('save', async function() {
  const Post = require('./Post');
  const count = await this.model('Comment').countDocuments({ post: this.post });
  await Post.findByIdAndUpdate(this.post, { commentCount: count });
});

module.exports = mongoose.model('Comment', CommentSchema);
