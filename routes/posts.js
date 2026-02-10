const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const { protect, optionalAuth } = require('../middleware/auth');
const upload = require('../middleware/upload');

// @route   GET /api/posts
// @desc    Get all posts (feed)
// @access  Public
router.get('/', optionalAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const { type, hashtag, author } = req.query;

    // Build query
    let query = { isHidden: false, isScheduled: false };
    if (type) query.type = type;
    if (hashtag) query.hashtags = hashtag.toLowerCase();
    if (author) query.author = author;

    const posts = await Post.find(query)
      .populate('author', 'name handle avatar role isVerified')
      .populate('parentPost')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    const total = await Post.countDocuments(query);

    // Add user-specific data if authenticated
    const postsWithUserData = posts.map(post => {
      const postObj = post.toObject();
      if (req.user) {
        postObj.isLiked = post.likes.some(like => like.user.toString() === req.user.id);
        postObj.isReposted = post.reposts.some(repost => repost.user.toString() === req.user.id);
        postObj.isBookmarked = post.bookmarks.includes(req.user.id);
      }
      return postObj;
    });

    res.json({
      success: true,
      count: posts.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      posts: postsWithUserData
    });
  } catch (error) {
    console.error('Get posts error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/posts/:id
// @desc    Get single post
// @access  Public
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate('author', 'name handle avatar role isVerified')
      .populate('parentPost');

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    // Increment view count
    post.views += 1;
    await post.save();

    // Get comments
    const comments = await Comment.find({ post: post._id, isHidden: false })
      .populate('author', 'name handle avatar')
      .sort({ createdAt: -1 })
      .limit(20);

    const postObj = post.toObject();
    if (req.user) {
      postObj.isLiked = post.likes.some(like => like.user.toString() === req.user.id);
      postObj.isReposted = post.reposts.some(repost => repost.user.toString() === req.user.id);
      postObj.isBookmarked = post.bookmarks.includes(req.user.id);
    }
    postObj.comments = comments;

    res.json({
      success: true,
      post: postObj
    });
  } catch (error) {
    console.error('Get post error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST /api/posts
// @desc    Create a post
// @access  Private
router.post('/', protect, upload.array('media', 4), [
  body('content').notEmpty().withMessage('Content is required')
    .isLength({ max: 500 }).withMessage('Content cannot exceed 500 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { content, type, parentPost } = req.body;

    // Process media files
    let media = [];
    if (req.files && req.files.length > 0) {
      media = req.files.map(file => ({
        type: file.mimetype.startsWith('image/') ? 'image' : 'video',
        url: `/uploads/${file.filename}`
      }));
    }

    // Handle base64 media from frontend
    if (req.body.media) {
      try {
        const mediaData = JSON.parse(req.body.media);
        if (Array.isArray(mediaData)) {
          media = [...media, ...mediaData];
        }
      } catch (e) {
        // Not JSON, ignore
      }
    }

    const post = await Post.create({
      author: req.user.id,
      content,
      media,
      type: type || 'post',
      parentPost: parentPost || null
    });

    await post.populate('author', 'name handle avatar role isVerified');

    res.status(201).json({
      success: true,
      message: 'Post created successfully',
      post
    });
  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   DELETE /api/posts/:id
// @desc    Delete a post
// @access  Private
router.delete('/:id', protect, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    // Check ownership or admin
    if (post.author.toString() !== req.user.id && !['admin', 'moderator'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this post'
      });
    }

    await post.deleteOne();

    res.json({
      success: true,
      message: 'Post deleted successfully'
    });
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST /api/posts/:id/like
// @desc    Like a post
// @access  Private
router.post('/:id/like', protect, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    // Check if already liked
    const alreadyLiked = post.likes.some(like => like.user.toString() === req.user.id);

    if (alreadyLiked) {
      // Unlike
      post.likes = post.likes.filter(like => like.user.toString() !== req.user.id);
    } else {
      // Like
      post.likes.push({ user: req.user.id });
    }

    await post.save();

    res.json({
      success: true,
      liked: !alreadyLiked,
      likeCount: post.likes.length
    });
  } catch (error) {
    console.error('Like post error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST /api/posts/:id/repost
// @desc    Repost a post
// @access  Private
router.post('/:id/repost', protect, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    // Check if already reposted
    const alreadyReposted = post.reposts.some(repost => repost.user.toString() === req.user.id);

    if (alreadyReposted) {
      // Undo repost
      post.reposts = post.reposts.filter(repost => repost.user.toString() !== req.user.id);
    } else {
      // Repost
      post.reposts.push({ user: req.user.id });
    }

    await post.save();

    res.json({
      success: true,
      reposted: !alreadyReposted,
      repostCount: post.reposts.length
    });
  } catch (error) {
    console.error('Repost error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST /api/posts/:id/bookmark
// @desc    Bookmark a post
// @access  Private
router.post('/:id/bookmark', protect, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    // Check if already bookmarked
    const isBookmarked = post.bookmarks.includes(req.user.id);

    if (isBookmarked) {
      post.bookmarks = post.bookmarks.filter(id => id.toString() !== req.user.id);
    } else {
      post.bookmarks.push(req.user.id);
    }

    await post.save();

    res.json({
      success: true,
      bookmarked: !isBookmarked
    });
  } catch (error) {
    console.error('Bookmark error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST /api/posts/:id/comments
// @desc    Add comment to post
// @access  Private
router.post('/:id/comments', protect, [
  body('content').notEmpty().withMessage('Comment is required')
    .isLength({ max: 280 }).withMessage('Comment cannot exceed 280 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    const comment = await Comment.create({
      author: req.user.id,
      post: req.params.id,
      content: req.body.content,
      parentComment: req.body.parentComment || null
    });

    await comment.populate('author', 'name handle avatar');

    res.status(201).json({
      success: true,
      message: 'Comment added',
      comment
    });
  } catch (error) {
    console.error('Add comment error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/posts/:id/comments
// @desc    Get post comments
// @access  Public
router.get('/:id/comments', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const comments = await Comment.find({ post: req.params.id, isHidden: false })
      .populate('author', 'name handle avatar')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    const total = await Comment.countDocuments({ post: req.params.id, isHidden: false });

    res.json({
      success: true,
      count: comments.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      comments
    });
  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
