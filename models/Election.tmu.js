/**
 * Election Model - TMU Database
 */

const { Schema, createModel } = require('../database');

const electionSchema = new Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  position: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    enum: ['general', 'department', 'faculty', 'club'],
    default: 'general'
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  candidates: {
    type: Array, // Array of { user, manifesto, slogan, photo, votes }
    default: []
  },
  voters: {
    type: Array, // Array of { user, votedAt }
    default: []
  },
  eligibility: {
    type: Object, // { departments: [], faculties: [], years: [], roles: [] }
    default: {}
  },
  maxVotes: {
    type: Number,
    default: 1
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: String, // User ID
    required: true
  }
}, { timestamps: true });

electionSchema.index({ startDate: 1 });
electionSchema.index({ endDate: 1 });
electionSchema.index({ type: 1 });

// Instance methods
electionSchema.methods.getStatus = function() {
  const now = new Date();
  if (now < this.startDate) return 'upcoming';
  if (now >= this.startDate && now <= this.endDate) return 'ongoing';
  return 'completed';
};

electionSchema.methods.hasVoted = function(userId) {
  return this.voters.some(v => v.user === userId);
};

electionSchema.methods.canVote = function(user) {
  // Check if election is ongoing
  const status = this.getStatus();
  if (status !== 'ongoing') return false;
  
  // Check if already voted
  if (this.hasVoted(user._id)) return false;
  
  // Check eligibility
  if (this.eligibility.departments && this.eligibility.departments.length > 0) {
    if (!this.eligibility.departments.includes(user.department)) return false;
  }
  if (this.eligibility.faculties && this.eligibility.faculties.length > 0) {
    if (!this.eligibility.faculties.includes(user.faculty)) return false;
  }
  if (this.eligibility.years && this.eligibility.years.length > 0) {
    if (!this.eligibility.years.includes(user.yearOfStudy)) return false;
  }
  
  return true;
};

electionSchema.methods.getResults = function() {
  const results = this.candidates
    .map(c => ({
      user: c.user,
      manifesto: c.manifesto,
      slogan: c.slogan,
      votes: c.votes || 0
    }))
    .sort((a, b) => b.votes - a.votes);
  
  const totalVotes = results.reduce((sum, r) => sum + r.votes, 0);
  
  return {
    results,
    totalVotes,
    totalVoters: this.voters.length,
    winner: results[0] || null
  };
};

let Election = null;

const initElectionModel = () => {
  if (!Election) {
    Election = createModel('Election', electionSchema);
  }
  return Election;
};

const getElectionModel = () => {
  if (!Election) {
    throw new Error('Election model not initialized');
  }
  return Election;
};

module.exports = { initElectionModel, getElectionModel, electionSchema };
