/**
 * Announcement Model - TMU Database
 */

const { Schema, createModel } = require('../database');

const announcementSchema = new Schema({
  author: {
    type: String, // User ID
    required: true
  },
  title: {
    type: String,
    required: true,
    maxlength: 200,
    trim: true
  },
  content: {
    type: String,
    required: true
  },
  category: {
    type: String,
    enum: ['general', 'academic', 'exam', 'event', 'emergency', 'administrative', 'sports', 'club'],
    default: 'general'
  },
  priority: {
    type: String,
    enum: ['low', 'normal', 'high', 'urgent'],
    default: 'normal'
  },
  targetAudience: {
    type: String,
    enum: ['all', 'students', 'staff', 'specific'],
    default: 'all'
  },
  targetDepartments: {
    type: Array,
    default: []
  },
  targetFaculties: {
    type: Array,
    default: []
  },
  targetYears: {
    type: Array,
    default: []
  },
  attachments: {
    type: Array, // Array of { type, url, name }
    default: []
  },
  isPinned: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  expiresAt: {
    type: Date,
    default: null
  },
  views: {
    type: Number,
    default: 0
  },
  acknowledgements: {
    type: Array, // Array of { user: userId, acknowledgedAt: Date }
    default: []
  }
}, { timestamps: true });

announcementSchema.index({ category: 1 });
announcementSchema.index({ priority: 1 });
announcementSchema.index({ createdAt: -1 });

let Announcement = null;

const initAnnouncementModel = () => {
  if (!Announcement) {
    Announcement = createModel('Announcement', announcementSchema);
  }
  return Announcement;
};

const getAnnouncementModel = () => {
  if (!Announcement) {
    throw new Error('Announcement model not initialized');
  }
  return Announcement;
};

module.exports = { initAnnouncementModel, getAnnouncementModel, announcementSchema };
