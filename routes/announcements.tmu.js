/**
 * Announcements Routes - TMU Database
 */

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { getAnnouncementModel, getUserModel } = require('../models/index.tmu');
const { protect, authorize } = require('../middleware/auth.tmu');
const upload = require('../middleware/upload');

// Helper to populate author
const populateAuthor = async (announcement) => {
  const User = getUserModel();
  const author = await User.findById(announcement.author);
  return {
    ...announcement,
    author: author ? {
      id: author._id,
      name: author.name,
      handle: author.handle,
      avatar: author.avatar,
      role: author.role
    } : null
  };
};

// @route   GET /api/announcements
// @desc    Get all announcements
// @access  Public
router.get('/', async (req, res) => {
  try {
    const Announcement = getAnnouncementModel();
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const { category, priority, department, faculty } = req.query;

    // Build query
    let query = { isActive: true };
    if (category) query.category = category;
    if (priority) query.priority = priority;

    let announcements = await Announcement.find(query);
    
    // Filter expired
    const now = new Date();
    announcements = announcements.filter(a => 
      !a.expiresAt || new Date(a.expiresAt) > now
    );

    // Filter by target if specified
    if (department) {
      announcements = announcements.filter(a => 
        !a.targetDepartments?.length || a.targetDepartments.includes(department)
      );
    }
    if (faculty) {
      announcements = announcements.filter(a => 
        !a.targetFaculties?.length || a.targetFaculties.includes(faculty)
      );
    }

    // Sort: pinned first, then by priority, then by date
    const priorityOrder = { urgent: 4, high: 3, normal: 2, low: 1 };
    announcements.sort((a, b) => {
      if (a.isPinned !== b.isPinned) return b.isPinned ? 1 : -1;
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[b.priority] - priorityOrder[a.priority];
      }
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    const total = announcements.length;
    const start = (page - 1) * limit;
    announcements = announcements.slice(start, start + limit);

    // Populate authors
    const announcementsWithAuthors = await Promise.all(
      announcements.map(a => populateAuthor(a.toObject ? a.toObject() : a))
    );

    res.json({
      success: true,
      count: announcementsWithAuthors.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      announcements: announcementsWithAuthors
    });
  } catch (error) {
    console.error('Get announcements error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/announcements/:id
// @desc    Get single announcement
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const Announcement = getAnnouncementModel();
    const announcement = await Announcement.findById(req.params.id);

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }

    // Increment views
    await Announcement.findByIdAndUpdate(announcement._id, { $inc: { views: 1 } });

    const announcementObj = await populateAuthor(
      announcement.toObject ? announcement.toObject() : announcement
    );

    res.json({
      success: true,
      announcement: announcementObj
    });
  } catch (error) {
    console.error('Get announcement error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST /api/announcements
// @desc    Create announcement
// @access  Private (staff+)
router.post('/', protect, authorize('staff', 'hod', 'dean', 'vc', 'admin'), upload.array('attachments', 5), [
  body('title').notEmpty().withMessage('Title is required')
    .isLength({ max: 200 }).withMessage('Title cannot exceed 200 characters'),
  body('content').notEmpty().withMessage('Content is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const Announcement = getAnnouncementModel();
    const { 
      title, content, category, priority, 
      targetAudience, targetDepartments, targetFaculties, targetYears,
      expiresAt, isPinned
    } = req.body;

    // Process attachments
    let attachments = [];
    if (req.files && req.files.length > 0) {
      attachments = req.files.map(file => ({
        type: file.mimetype.startsWith('image/') ? 'image' : 
              file.mimetype.startsWith('video/') ? 'video' : 'document',
        url: `/uploads/${file.filename}`,
        name: file.originalname
      }));
    }

    // Parse JSON fields
    let parsedDepartments = [];
    let parsedFaculties = [];
    let parsedYears = [];
    
    try {
      if (targetDepartments) parsedDepartments = JSON.parse(targetDepartments);
      if (targetFaculties) parsedFaculties = JSON.parse(targetFaculties);
      if (targetYears) parsedYears = JSON.parse(targetYears);
    } catch (e) {}

    const announcement = await Announcement.create({
      author: req.user.id,
      title,
      content,
      category: category || 'general',
      priority: priority || 'normal',
      targetAudience: targetAudience || 'all',
      targetDepartments: parsedDepartments,
      targetFaculties: parsedFaculties,
      targetYears: parsedYears,
      attachments,
      expiresAt: expiresAt || null,
      isPinned: isPinned === 'true' || isPinned === true
    });

    const announcementObj = await populateAuthor(
      announcement.toObject ? announcement.toObject() : announcement
    );

    res.status(201).json({
      success: true,
      message: 'Announcement created successfully',
      announcement: announcementObj
    });
  } catch (error) {
    console.error('Create announcement error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   PUT /api/announcements/:id
// @desc    Update announcement
// @access  Private (owner or admin)
router.put('/:id', protect, authorize('staff', 'hod', 'dean', 'vc', 'admin'), async (req, res) => {
  try {
    const Announcement = getAnnouncementModel();
    let announcement = await Announcement.findById(req.params.id);

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }

    // Check ownership
    if (announcement.author !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this announcement'
      });
    }

    const updateFields = { ...req.body };
    
    // Parse JSON fields
    if (typeof updateFields.targetDepartments === 'string') {
      try { updateFields.targetDepartments = JSON.parse(updateFields.targetDepartments); } catch (e) {}
    }
    if (typeof updateFields.targetFaculties === 'string') {
      try { updateFields.targetFaculties = JSON.parse(updateFields.targetFaculties); } catch (e) {}
    }
    if (typeof updateFields.targetYears === 'string') {
      try { updateFields.targetYears = JSON.parse(updateFields.targetYears); } catch (e) {}
    }

    announcement = await Announcement.findByIdAndUpdate(
      req.params.id,
      { $set: updateFields },
      { new: true }
    );

    const announcementObj = await populateAuthor(
      announcement.toObject ? announcement.toObject() : announcement
    );

    res.json({
      success: true,
      message: 'Announcement updated',
      announcement: announcementObj
    });
  } catch (error) {
    console.error('Update announcement error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   DELETE /api/announcements/:id
// @desc    Delete announcement
// @access  Private (owner or admin)
router.delete('/:id', protect, authorize('staff', 'hod', 'dean', 'vc', 'admin'), async (req, res) => {
  try {
    const Announcement = getAnnouncementModel();
    const announcement = await Announcement.findById(req.params.id);

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }

    if (announcement.author !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this announcement'
      });
    }

    await Announcement.deleteOne({ _id: announcement._id });

    res.json({
      success: true,
      message: 'Announcement deleted'
    });
  } catch (error) {
    console.error('Delete announcement error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST /api/announcements/:id/acknowledge
// @desc    Acknowledge an announcement
// @access  Private
router.post('/:id/acknowledge', protect, async (req, res) => {
  try {
    const Announcement = getAnnouncementModel();
    const announcement = await Announcement.findById(req.params.id);

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }

    const acknowledgements = announcement.acknowledgements || [];
    const alreadyAcknowledged = acknowledgements.some(a => a.user === req.user.id);

    if (alreadyAcknowledged) {
      return res.status(400).json({
        success: false,
        message: 'Already acknowledged'
      });
    }

    await Announcement.findByIdAndUpdate(announcement._id, {
      $push: { acknowledgements: { user: req.user.id, acknowledgedAt: new Date() } }
    });

    res.json({
      success: true,
      message: 'Announcement acknowledged',
      acknowledgementsCount: acknowledgements.length + 1
    });
  } catch (error) {
    console.error('Acknowledge error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
