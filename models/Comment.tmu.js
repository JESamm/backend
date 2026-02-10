/**
 * Comment Model - TMU Database
 */

const { Schema, createModel } = require('../database');

const commentSchema = new Schema({
  author: {
    type: String, // User ID
    required: true
  },
  post: {
    type: String, // Post ID
    required: true
  },
  content: {
    type: String,
    required: true,
    maxlength: 280
  },
  parentComment: {
    type: String, // Comment ID for nested replies
    default: null
  },
  likes: {
    type: Array,
    default: []
  },
  isHidden: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

commentSchema.index({ post: 1 });
commentSchema.index({ author: 1 });

let Comment = null;

const initCommentModel = () => {
  if (!Comment) {
    Comment = createModel('Comment', commentSchema);
  }
  return Comment;
};

const getCommentModel = () => {
  if (!Comment) {
    throw new Error('Comment model not initialized');
  }
  return Comment;
};

module.exports = { initCommentModel, getCommentModel, commentSchema };
