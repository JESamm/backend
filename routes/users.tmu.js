/**
 * Users Routes - TMU Database
 */

const express = require('express');
const router = express.Router();
const { getUserModel } = require('../models/index.tmu');
const { protect, authorize, optionalAuth } = require('../middleware/auth.tmu');
const upload = require('../middleware/upload');

// @route   GET /api/users
// @desc    Get all users (admin only)
// @access  Private/Admin
router.get('/', protect, authorize('admin', 'moderator'), async (req, res) => {
  try {
    const User = getUserModel();
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const users = await User.find({}, { password: 0 });
    const total = users.length;
    
    // Manual pagination
    const start = (page - 1) * limit;
    const paginatedUsers = users.slice(start, start + limit);

    res.json({
      success: true,
      count: paginatedUsers.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      users: paginatedUsers
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/users/:id
// @desc    Get user by ID or handle
// @access  Public
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const User = getUserModel();
    let user;
    
    // Try by ID first, then by handle
    user = await User.findById(req.params.id);
    if (!user) {
      user = await User.findOne({ handle: req.params.id.toLowerCase() });
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Don't expose password
    const userObj = user.toObject ? user.toObject() : { ...user };
    delete userObj.password;

    res.json({
      success: true,
      user: userObj
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   PUT /api/users/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', protect, async (req, res) => {
  try {
    const User = getUserModel();
    const { name, bio, department, faculty, program, yearOfStudy, avatar } = req.body;

    const updateFields = {};
    if (name) updateFields.name = name;
    if (bio !== undefined) updateFields.bio = bio;
    if (department) updateFields.department = department;
    if (faculty) updateFields.faculty = faculty;
    if (program) updateFields.program = program;
    if (yearOfStudy) updateFields.yearOfStudy = yearOfStudy;
    if (avatar) updateFields.avatar = avatar;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updateFields },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const userObj = user.toObject ? user.toObject() : { ...user };
    delete userObj.password;

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: userObj
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   PUT /api/users/profile/image
// @desc    Upload profile image
// @access  Private
router.put('/profile/image', protect, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload an image'
      });
    }

    const User = getUserModel();
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: { profileImage: `/uploads/${req.file.filename}` } },
      { new: true }
    );

    const userObj = user.toObject ? user.toObject() : { ...user };
    delete userObj.password;

    res.json({
      success: true,
      message: 'Profile image updated',
      user: userObj
    });
  } catch (error) {
    console.error('Upload image error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST /api/users/:id/follow
// @desc    Follow a user
// @access  Private
router.post('/:id/follow', protect, async (req, res) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'You cannot follow yourself'
      });
    }

    const User = getUserModel();
    const userToFollow = await User.findById(req.params.id);
    
    if (!userToFollow) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const currentUser = await User.findById(req.user.id);

    // Check if already following
    if (currentUser.following && currentUser.following.includes(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'Already following this user'
      });
    }

    // Update both users
    await User.findByIdAndUpdate(req.user.id, {
      $push: { following: req.params.id }
    });

    await User.findByIdAndUpdate(req.params.id, {
      $push: { followers: req.user.id }
    });

    res.json({
      success: true,
      message: `You are now following ${userToFollow.name}`
    });
  } catch (error) {
    console.error('Follow error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   DELETE /api/users/:id/follow
// @desc    Unfollow a user
// @access  Private
router.delete('/:id/follow', protect, async (req, res) => {
  try {
    const User = getUserModel();
    const userToUnfollow = await User.findById(req.params.id);
    
    if (!userToUnfollow) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const currentUser = await User.findById(req.user.id);

    if (!currentUser.following || !currentUser.following.includes(req.params.id)) {
      return res.status(400).json({
        success: false,
        message: 'You are not following this user'
      });
    }

    // Update both users
    await User.findByIdAndUpdate(req.user.id, {
      $pull: { following: req.params.id }
    });

    await User.findByIdAndUpdate(req.params.id, {
      $pull: { followers: req.user.id }
    });

    res.json({
      success: true,
      message: `You have unfollowed ${userToUnfollow.name}`
    });
  } catch (error) {
    console.error('Unfollow error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/users/:id/followers
// @desc    Get user's followers
// @access  Public
router.get('/:id/followers', async (req, res) => {
  try {
    const User = getUserModel();
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get follower details
    const followers = [];
    for (const followerId of (user.followers || [])) {
      const follower = await User.findById(followerId);
      if (follower) {
        followers.push({
          id: follower._id,
          name: follower.name,
          handle: follower.handle,
          avatar: follower.avatar,
          bio: follower.bio
        });
      }
    }

    res.json({
      success: true,
      count: followers.length,
      followers
    });
  } catch (error) {
    console.error('Get followers error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/users/:id/following
// @desc    Get users that user is following
// @access  Public
router.get('/:id/following', async (req, res) => {
  try {
    const User = getUserModel();
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get following details
    const following = [];
    for (const followingId of (user.following || [])) {
      const followedUser = await User.findById(followingId);
      if (followedUser) {
        following.push({
          id: followedUser._id,
          name: followedUser.name,
          handle: followedUser.handle,
          avatar: followedUser.avatar,
          bio: followedUser.bio
        });
      }
    }

    res.json({
      success: true,
      count: following.length,
      following
    });
  } catch (error) {
    console.error('Get following error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
