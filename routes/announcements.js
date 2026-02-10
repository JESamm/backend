const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Announcement = require('../models/Announcement');
const { protect, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');

// @route   GET /api/announcements
// @desc    Get all announcements
// @access  Public
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const { category, priority, department, faculty } = req.query;

    // Build query
    let query = { isActive: true };
    
    // Filter out expired announcements
    query.$or = [
      { expiresAt: { $exists: false } },
      { expiresAt: null },
      { expiresAt: { $gt: new Date() } }
    ];

    if (category) query.category = category;
    if (priority) query.priority = priority;
    if (department) query.targetDepartments = department;
    if (faculty) query.targetFaculties = faculty;

    const announcements = await Announcement.find(query)
      .populate('author', 'name handle avatar role')
      .skip(skip)
      .limit(limit)
      .sort({ isPinned: -1, priority: -1, createdAt: -1 });

    const total = await Announcement.countDocuments(query);

    res.json({
      success: true,
      count: announcements.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      announcements
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
    const announcement = await Announcement.findById(req.params.id)
      .populate('author', 'name handle avatar role');

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }

    // Increment views
    announcement.views += 1;
    await announcement.save();

    res.json({
      success: true,
      announcement
    });
  } catch (error) {
    console.error('Get announcement error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST /api/announcements
// @desc    Create announcement
// @access  Private (staff, hod, dean, vc, admin)
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

    const { 
      title, 
      content, 
      category, 
      priority, 
      targetAudience,
      targetDepartments, 
      targetFaculties,
      targetYears,
      expiresAt,
      isPinned
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

    const announcement = await Announcement.create({
      author: req.user.id,
      title,
      content,
      category: category || 'general',
      priority: priority || 'normal',
      targetAudience: targetAudience || 'all',
      targetDepartments: targetDepartments ? JSON.parse(targetDepartments) : [],
      targetFaculties: targetFaculties ? JSON.parse(targetFaculties) : [],
      targetYears: targetYears ? JSON.parse(targetYears) : [],
      attachments,
      expiresAt: expiresAt || null,
      isPinned: isPinned === 'true' || isPinned === true
    });

    await announcement.populate('author', 'name handle avatar role');

    res.status(201).json({
      success: true,
      message: 'Announcement created successfully',
      announcement
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
    let announcement = await Announcement.findById(req.params.id);

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }

    // Check ownership (unless admin)
    if (announcement.author.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this announcement'
      });
    }

    const updateFields = { ...req.body };
    
    // Parse JSON fields if they're strings
    if (typeof updateFields.targetDepartments === 'string') {
      updateFields.targetDepartments = JSON.parse(updateFields.targetDepartments);
    }
    if (typeof updateFields.targetFaculties === 'string') {
      updateFields.targetFaculties = JSON.parse(updateFields.targetFaculties);
    }
    if (typeof updateFields.targetYears === 'string') {
      updateFields.targetYears = JSON.parse(updateFields.targetYears);
    }

    announcement = await Announcement.findByIdAndUpdate(
      req.params.id,
      updateFields,
      { new: true, runValidators: true }
    ).populate('author', 'name handle avatar role');

    res.json({
      success: true,
      message: 'Announcement updated',
      announcement
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
    const announcement = await Announcement.findById(req.params.id);

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }

    // Check ownership (unless admin)
    if (announcement.author.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this announcement'
      });
    }

    await announcement.deleteOne();

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
    const announcement = await Announcement.findById(req.params.id);

    if (!announcement) {
      return res.status(404).json({
        success: false,
        message: 'Announcement not found'
      });
    }

    // Check if already acknowledged
    const alreadyAcknowledged = announcement.acknowledgements.some(
      ack => ack.user.toString() === req.user.id
    );

    if (alreadyAcknowledged) {
      return res.status(400).json({
        success: false,
        message: 'Already acknowledged'
      });
    }

    announcement.acknowledgements.push({ user: req.user.id });
    await announcement.save();

    res.json({
      success: true,
      message: 'Announcement acknowledged',
      acknowledgementsCount: announcement.acknowledgements.length
    });
  } catch (error) {
    console.error('Acknowledge error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
