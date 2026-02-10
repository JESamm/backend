const mongoose = require('mongoose');

const CandidateSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  position: {
    type: String,
    required: true
  },
  manifesto: {
    type: String,
    maxlength: 1000
  },
  photo: String,
  slogan: String,
  votes: {
    type: Number,
    default: 0
  }
});

const ElectionSchema = new mongoose.Schema({
  // Basic Info
  title: {
    type: String,
    required: [true, 'Election title is required'],
    maxlength: [200, 'Title cannot exceed 200 characters'],
    trim: true
  },
  description: {
    type: String,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },

  // Positions being contested
  positions: [{
    type: String,
    required: true
  }],

  // Candidates
  candidates: [CandidateSchema],

  // Voting period
  startDate: {
    type: Date,
    required: [true, 'Start date is required']
  },
  endDate: {
    type: Date,
    required: [true, 'End date is required']
  },

  // Status
  status: {
    type: String,
    enum: ['upcoming', 'active', 'completed', 'cancelled'],
    default: 'upcoming'
  },

  // Voters (to prevent double voting)
  voters: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    votedAt: {
      type: Date,
      default: Date.now
    },
    // Store hashed vote for verification without revealing choice
    voteHash: String
  }],

  // Eligibility
  eligibleVoters: {
    type: String,
    enum: ['all', 'students', 'staff', 'department', 'faculty'],
    default: 'students'
  },
  eligibleDepartment: String,
  eligibleFaculty: String,

  // Results
  resultsPublished: {
    type: Boolean,
    default: false
  },
  publishedAt: Date,

  // Created by
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for total votes
ElectionSchema.virtual('totalVotes').get(function() {
  return this.voters ? this.voters.length : 0;
});

// Check if election is currently active
ElectionSchema.virtual('isActive').get(function() {
  const now = new Date();
  return now >= this.startDate && now <= this.endDate && this.status === 'active';
});

// Method to check if user has voted
ElectionSchema.methods.hasUserVoted = function(userId) {
  return this.voters.some(voter => voter.user.toString() === userId.toString());
};

// Index
ElectionSchema.index({ status: 1, startDate: 1, endDate: 1 });

module.exports = mongoose.model('Election', ElectionSchema);
