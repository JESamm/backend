/**
 * Statistics & Trending Routes - TMU Database
 * Real-time platform statistics and trending content
 */

const express = require('express');
const router = express.Router();
const { getPostModel, getUserModel, getAnnouncementModel, getElectionModel } = require('../models/index.tmu');
const { optionalAuth } = require('../middleware/auth.tmu');

// @route   GET /api/stats
// @desc    Get platform statistics
// @access  Public
router.get('/', async (req, res) => {
  try {
    const Post = getPostModel();
    const User = getUserModel();
    const Announcement = getAnnouncementModel();
    const Election = getElectionModel();

    // Get counts
    const posts = await Post.find({});
    const users = await User.find({});
    const announcements = await Announcement.find({});
    const elections = await Election.find({});

    // Calculate engagement stats
    let totalLikes = 0;
    let totalViews = 0;
    let totalComments = 0;
    let totalReposts = 0;

    posts.forEach(post => {
      totalLikes += post.likes?.length || 0;
      totalViews += post.views || 0;
      totalComments += post.commentCount || 0;
      totalReposts += post.reposts?.length || 0;
    });

    // Active elections
    const now = new Date();
    const activeElections = elections.filter(e => 
      e.status === 'active' && 
      new Date(e.startDate) <= now && 
      new Date(e.endDate) >= now
    );

    // New users today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const newUsersToday = users.filter(u => new Date(u.createdAt) >= today).length;

    // Posts today
    const postsToday = posts.filter(p => new Date(p.createdAt) >= today).length;

    res.json({
      success: true,
      stats: {
        users: {
          total: users.length,
          students: users.filter(u => u.role === 'student').length,
          staff: users.filter(u => u.role === 'staff').length,
          faculty: users.filter(u => u.role === 'faculty').length,
          verified: users.filter(u => u.isVerified).length,
          newToday: newUsersToday
        },
        posts: {
          total: posts.length,
          today: postsToday,
          official: posts.filter(p => p.type === 'official').length,
          student: posts.filter(p => p.type === 'student').length
        },
        engagement: {
          totalLikes,
          totalViews,
          totalComments,
          totalReposts,
          averageLikes: posts.length > 0 ? Math.round(totalLikes / posts.length) : 0,
          averageViews: posts.length > 0 ? Math.round(totalViews / posts.length) : 0
        },
        announcements: {
          total: announcements.length,
          active: announcements.filter(a => a.isPublished && !a.expiresAt || new Date(a.expiresAt) > now).length,
          pinned: announcements.filter(a => a.isPinned).length
        },
        elections: {
          total: elections.length,
          active: activeElections.length,
          completed: elections.filter(e => e.status === 'completed').length
        }
      }
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/stats/trending
// @desc    Get trending topics and hashtags
// @access  Public
router.get('/trending', async (req, res) => {
  try {
    const Post = getPostModel();
    
    // Get posts from last 7 days
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    
    const recentPosts = await Post.find({});
    const postsInRange = recentPosts.filter(p => new Date(p.createdAt) >= weekAgo);

    // Extract and count hashtags
    const hashtagCounts = {};
    postsInRange.forEach(post => {
      (post.hashtags || []).forEach(tag => {
        const normalizedTag = tag.toLowerCase();
        if (!hashtagCounts[normalizedTag]) {
          hashtagCounts[normalizedTag] = { 
            tag: normalizedTag, 
            count: 0, 
            posts: 0,
            engagement: 0 
          };
        }
        hashtagCounts[normalizedTag].posts++;
        hashtagCounts[normalizedTag].engagement += 
          (post.likes?.length || 0) + 
          (post.reposts?.length || 0) + 
          (post.commentCount || 0);
      });
    });

    // Sort by engagement and get top 10
    const trendingHashtags = Object.values(hashtagCounts)
      .sort((a, b) => b.engagement - a.engagement)
      .slice(0, 10);

    // Get trending topics (most engaging posts)
    const trendingPosts = [...postsInRange]
      .sort((a, b) => {
        const engagementA = (a.likes?.length || 0) + (a.reposts?.length || 0) * 2 + (a.views || 0) * 0.1;
        const engagementB = (b.likes?.length || 0) + (b.reposts?.length || 0) * 2 + (b.views || 0) * 0.1;
        return engagementB - engagementA;
      })
      .slice(0, 5)
      .map(post => ({
        id: post._id,
        content: post.content.substring(0, 100) + (post.content.length > 100 ? '...' : ''),
        likes: post.likes?.length || 0,
        views: post.views || 0
      }));

    res.json({
      success: true,
      trending: {
        hashtags: trendingHashtags,
        posts: trendingPosts
      }
    });
  } catch (error) {
    console.error('Trending error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/stats/who-to-follow
// @desc    Get suggested users to follow
// @access  Public (returns different results if authenticated)
router.get('/who-to-follow', optionalAuth, async (req, res) => {
  try {
    const User = getUserModel();
    
    let users = await User.find({});
    
    // Filter verified or popular users
    let suggestions = users
      .filter(u => u.isVerified || (u.followers?.length || 0) > 0)
      .map(u => ({
        id: u._id,
        name: u.name,
        handle: u.handle,
        avatar: u.avatar || '👤',
        role: u.role,
        isVerified: u.isVerified,
        followers: u.followers?.length || 0,
        bio: u.bio?.substring(0, 60) || ''
      }));

    // If user is logged in, exclude users they already follow
    if (req.user) {
      const currentUser = await User.findById(req.user.id);
      if (currentUser) {
        const following = currentUser.following || [];
        suggestions = suggestions.filter(s => 
          s.id !== req.user.id && !following.includes(s.id)
        );
      }
    }

    // Randomize and limit to 5
    suggestions = suggestions
      .sort(() => 0.5 - Math.random())
      .slice(0, 5);

    res.json({
      success: true,
      users: suggestions
    });
  } catch (error) {
    console.error('Who to follow error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/stats/live
// @desc    Get live activity feed
// @access  Public
router.get('/live', async (req, res) => {
  try {
    const Post = getPostModel();
    const User = getUserModel();
    
    // Get most recent activity
    const hourAgo = new Date();
    hourAgo.setHours(hourAgo.getHours() - 1);
    
    const recentPosts = await Post.find({});
    const postsInHour = recentPosts.filter(p => new Date(p.createdAt) >= hourAgo);

    const users = await User.find({});
    const activeUsers = users.filter(u => u.lastActive && new Date(u.lastActive) >= hourAgo).length;

    res.json({
      success: true,
      live: {
        postsThisHour: postsInHour.length,
        activeUsers,
        recentActivity: postsInHour.slice(0, 5).map(p => ({
          type: 'post',
          content: p.content.substring(0, 50),
          timestamp: p.createdAt
        }))
      }
    });
  } catch (error) {
    console.error('Live stats error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
