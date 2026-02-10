const mongoose = require('mongoose');

const AnnouncementSchema = new mongoose.Schema({
  // Author (must be official - dean, hod, vc, admin)
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  // Content
  title: {
    type: String,
    required: [true, 'Announcement title is required'],
    maxlength: [200, 'Title cannot exceed 200 characters'],
    trim: true
  },
  content: {
    type: String,
    required: [true, 'Announcement content is required'],
    maxlength: [2000, 'Content cannot exceed 2000 characters'],
    trim: true
  },

  // Priority
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },

  // Category
  category: {
    type: String,
    enum: ['general', 'academic', 'events', 'administrative', 'emergency', 'sports', 'other'],
    default: 'general'
  },

  // Target audience
  targetAudience: {
    type: String,
    enum: ['all', 'students', 'staff', 'faculty', 'department'],
    default: 'all'
  },
  targetDepartment: String,
  targetFaculty: String,

  // Media attachments
  attachments: [{
    type: {
      type: String,
      enum: ['image', 'document', 'link']
    },
    url: String,
    name: String
  }],

  // Icon/emoji
  icon: {
    type: String,
    default: '📢'
  },

  // Scheduling
  isPublished: {
    type: Boolean,
    default: true
  },
  publishedAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: Date,

  // Pinned announcements
  isPinned: {
    type: Boolean,
    default: false
  },

  // Metrics
  views: {
    type: Number,
    default: 0
  },
  readBy: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    readAt: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Index for searching
AnnouncementSchema.index({ title: 'text', content: 'text' });
AnnouncementSchema.index({ priority: 1, createdAt: -1 });
AnnouncementSchema.index({ category: 1 });

module.exports = mongoose.model('Announcement', AnnouncementSchema);
