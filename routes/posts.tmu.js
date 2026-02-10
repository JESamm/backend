/**
 * Posts Routes - TMU Database
 */

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { getPostModel, getCommentModel, getUserModel } = require('../models/index.tmu');
const { protect, optionalAuth } = require('../middleware/auth.tmu');
const upload = require('../middleware/upload');

// Helper to populate author info
const populateAuthor = async (post) => {
  const User = getUserModel();
  const author = await User.findById(post.author);
  return {
    ...post,
    author: author ? {
      id: author._id,
      name: author.name,
      handle: author.handle,
      avatar: author.avatar,
      role: author.role,
      isVerified: author.isVerified
    } : null
  };
};

// @route   GET /api/posts
// @desc    Get all posts (feed)
// @access  Public
router.get('/', optionalAuth, async (req, res) => {
  try {
    const Post = getPostModel();
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const { type, hashtag, author } = req.query;

    // Build query
    let query = { isHidden: false, isScheduled: false };
    if (type) query.type = type;
    if (hashtag) query.hashtags = hashtag.toLowerCase();
    if (author) query.author = author;

    let posts = await Post.find(query);
    
    // Sort by createdAt descending
    posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    const total = posts.length;
    
    // Pagination
    const start = (page - 1) * limit;
    posts = posts.slice(start, start + limit);

    // Populate authors and add user-specific data
    const postsWithData = await Promise.all(posts.map(async (post) => {
      const postObj = await populateAuthor(post.toObject ? post.toObject() : post);
      
      if (req.user) {
        postObj.isLiked = post.likes?.some(l => l.user === req.user.id) || false;
        postObj.isReposted = post.reposts?.some(r => r.user === req.user.id) || false;
        postObj.isBookmarked = post.bookmarks?.includes(req.user.id) || false;
      }
      
      postObj.likeCount = post.likes?.length || 0;
      postObj.repostCount = post.reposts?.length || 0;
      postObj.bookmarkCount = post.bookmarks?.length || 0;
      
      return postObj;
    }));

    res.json({
      success: true,
      count: postsWithData.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      posts: postsWithData
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
    const Post = getPostModel();
    const Comment = getCommentModel();
    
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    // Increment views
    await Post.findByIdAndUpdate(post._id, { $inc: { views: 1 } });

    const postObj = await populateAuthor(post.toObject ? post.toObject() : post);

    // Get comments
    let comments = await Comment.find({ post: post._id, isHidden: false });
    comments = await Promise.all(comments.map(async (c) => {
      const User = getUserModel();
      const author = await User.findById(c.author);
      return {
        ...c,
        author: author ? {
          id: author._id,
          name: author.name,
          handle: author.handle,
          avatar: author.avatar
        } : null
      };
    }));

    if (req.user) {
      postObj.isLiked = post.likes?.some(l => l.user === req.user.id) || false;
      postObj.isReposted = post.reposts?.some(r => r.user === req.user.id) || false;
      postObj.isBookmarked = post.bookmarks?.includes(req.user.id) || false;
    }

    postObj.comments = comments;
    postObj.likeCount = post.likes?.length || 0;
    postObj.repostCount = post.reposts?.length || 0;

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

    const Post = getPostModel();
    const { content, type, parentPost } = req.body;

    // Process uploaded files (multipart/form-data)
    let media = [];
    if (req.files && req.files.length > 0) {
      media = req.files.map(file => ({
        type: file.mimetype.startsWith('image/') ? 'image' : 'video',
        url: `/uploads/${file.filename}`
      }));
    }

    // Handle media from frontend (JSON body)
    if (req.body.media) {
      let mediaData = req.body.media;
      
      // If it's a string, try to parse it as JSON
      if (typeof mediaData === 'string') {
        try {
          mediaData = JSON.parse(mediaData);
        } catch (e) {
          mediaData = null;
        }
      }
      
      // If it's an array, add the media items
      if (Array.isArray(mediaData)) {
        media = [...media, ...mediaData.map(m => ({
          type: m.type || 'image',
          url: m.url
        }))];
      }
    }

    const post = await Post.create({
      author: req.user.id,
      content,
      media,
      type: type || 'post',
      parentPost: parentPost || null
    });

    const postObj = await populateAuthor(post.toObject ? post.toObject() : post);

    res.status(201).json({
      success: true,
      message: 'Post created successfully',
      post: postObj
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
    const Post = getPostModel();
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    // Check ownership or admin
    if (post.author !== req.user.id && !['admin', 'moderator'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this post'
      });
    }

    await Post.deleteOne({ _id: post._id });

    res.json({
      success: true,
      message: 'Post deleted successfully'
    });
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   PUT /api/posts/:id
// @desc    Update a post
// @access  Private
router.put('/:id', protect, async (req, res) => {
  try {
    const Post = getPostModel();
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    // Check ownership - only the author can edit their post
    if (post.author !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to edit this post'
      });
    }

    const { content } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Content is required'
      });
    }

    if (content.length > 500) {
      return res.status(400).json({
        success: false,
        message: 'Content cannot exceed 500 characters'
      });
    }

    // Update the post
    const updatedPost = await Post.findByIdAndUpdate(
      req.params.id,
      { content: content.trim(), updatedAt: new Date() },
      { new: true }
    );

    const postObj = await populateAuthor(updatedPost.toObject ? updatedPost.toObject() : updatedPost);

    res.json({
      success: true,
      message: 'Post updated successfully',
      post: postObj
    });
  } catch (error) {
    console.error('Update post error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST /api/posts/:id/like
// @desc    Like/unlike a post
// @access  Private
router.post('/:id/like', protect, async (req, res) => {
  try {
    const Post = getPostModel();
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    const likes = post.likes || [];
    const alreadyLiked = likes.some(l => l.user === req.user.id);

    if (alreadyLiked) {
      // Unlike
      await Post.findByIdAndUpdate(post._id, {
        $pull: { likes: { user: req.user.id } }
      });
    } else {
      // Like
      await Post.findByIdAndUpdate(post._id, {
        $push: { likes: { user: req.user.id, createdAt: new Date() } }
      });
    }

    res.json({
      success: true,
      liked: !alreadyLiked,
      likeCount: alreadyLiked ? likes.length - 1 : likes.length + 1
    });
  } catch (error) {
    console.error('Like post error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST /api/posts/:id/repost
// @desc    Repost/unrepost a post
// @access  Private
router.post('/:id/repost', protect, async (req, res) => {
  try {
    const Post = getPostModel();
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    const reposts = post.reposts || [];
    const alreadyReposted = reposts.some(r => r.user === req.user.id);

    if (alreadyReposted) {
      await Post.findByIdAndUpdate(post._id, {
        $pull: { reposts: { user: req.user.id } }
      });
    } else {
      await Post.findByIdAndUpdate(post._id, {
        $push: { reposts: { user: req.user.id, createdAt: new Date() } }
      });
    }

    res.json({
      success: true,
      reposted: !alreadyReposted,
      repostCount: alreadyReposted ? reposts.length - 1 : reposts.length + 1
    });
  } catch (error) {
    console.error('Repost error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST /api/posts/:id/bookmark
// @desc    Bookmark/unbookmark a post
// @access  Private
router.post('/:id/bookmark', protect, async (req, res) => {
  try {
    const Post = getPostModel();
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    const bookmarks = post.bookmarks || [];
    const isBookmarked = bookmarks.includes(req.user.id);

    if (isBookmarked) {
      await Post.findByIdAndUpdate(post._id, {
        $pull: { bookmarks: req.user.id }
      });
    } else {
      await Post.findByIdAndUpdate(post._id, {
        $push: { bookmarks: req.user.id }
      });
    }

    res.json({
      success: true,
      bookmarked: !isBookmarked
    });
  } catch (error) {
    console.error('Bookmark error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST /api/posts/:id/view
// @desc    Track a post view
// @access  Public
router.post('/:id/view', optionalAuth, async (req, res) => {
  try {
    const Post = getPostModel();
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    // Increment view count
    await Post.findByIdAndUpdate(post._id, {
      $inc: { views: 1 }
    });

    res.json({
      success: true,
      views: (post.views || 0) + 1
    });
  } catch (error) {
    console.error('View tracking error:', error);
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

    const Post = getPostModel();
    const Comment = getCommentModel();
    
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

    // Populate author
    const User = getUserModel();
    const author = await User.findById(req.user.id);
    const commentObj = comment.toObject ? comment.toObject() : comment;
    commentObj.author = author ? {
      id: author._id,
      name: author.name,
      handle: author.handle,
      avatar: author.avatar
    } : null;

    res.status(201).json({
      success: true,
      message: 'Comment added',
      comment: commentObj
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
    const Comment = getCommentModel();
    const User = getUserModel();
    
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    let comments = await Comment.find({ post: req.params.id, isHidden: false });
    
    // Sort by createdAt
    comments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    const total = comments.length;
    const start = (page - 1) * limit;
    comments = comments.slice(start, start + limit);

    // Populate authors
    const commentsWithAuthors = await Promise.all(comments.map(async (c) => {
      const author = await User.findById(c.author);
      const commentObj = c.toObject ? c.toObject() : { ...c };
      return {
        ...commentObj,
        author: author ? {
          id: author._id,
          name: author.name,
          handle: author.handle,
          avatar: author.avatar
        } : null
      };
    }));

    res.json({
      success: true,
      count: commentsWithAuthors.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      comments: commentsWithAuthors
    });
  } catch (error) {
    console.error('Get comments error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
