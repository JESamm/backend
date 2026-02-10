/**
 * Initialize all TMU Database models
 */

const { initUserModel, getUserModel } = require('./User.tmu');
const { initPostModel, getPostModel } = require('./Post.tmu');
const { initCommentModel, getCommentModel } = require('./Comment.tmu');
const { initAnnouncementModel, getAnnouncementModel } = require('./Announcement.tmu');
const { initElectionModel, getElectionModel } = require('./Election.tmu');

/**
 * Initialize all models
 * Call this after database is initialized
 */
const initAllModels = () => {
  console.log('');
  console.log('📋 Initializing models...');
  
  const User = initUserModel();
  console.log('   ✓ User model');
  
  const Post = initPostModel();
  console.log('   ✓ Post model');
  
  const Comment = initCommentModel();
  console.log('   ✓ Comment model');
  
  const Announcement = initAnnouncementModel();
  console.log('   ✓ Announcement model');
  
  const Election = initElectionModel();
  console.log('   ✓ Election model');
  
  console.log('');
  
  return { User, Post, Comment, Announcement, Election };
};

module.exports = {
  initAllModels,
  getUserModel,
  getPostModel,
  getCommentModel,
  getAnnouncementModel,
  getElectionModel
};
