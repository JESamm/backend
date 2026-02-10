/**
 * Elections Routes - TMU Database
 */

const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { getElectionModel, getUserModel } = require('../models/index.tmu');
const { protect, authorize } = require('../middleware/auth.tmu');

// Helper to populate user info
const populateUser = async (userId, fields = ['name', 'handle', 'avatar', 'department', 'faculty']) => {
  const User = getUserModel();
  const user = await User.findById(userId);
  if (!user) return null;
  
  const result = { id: user._id };
  fields.forEach(f => result[f] = user[f]);
  return result;
};

// @route   GET /api/elections
// @desc    Get all elections
// @access  Public
router.get('/', async (req, res) => {
  try {
    const Election = getElectionModel();
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const { status, type } = req.query;

    let elections = await Election.find(type ? { type } : {});
    const now = new Date();

    // Filter by status
    if (status) {
      elections = elections.filter(e => {
        if (status === 'upcoming') return now < new Date(e.startDate);
        if (status === 'ongoing') return now >= new Date(e.startDate) && now <= new Date(e.endDate);
        if (status === 'completed') return now > new Date(e.endDate);
        return true;
      });
    }

    // Sort by start date
    elections.sort((a, b) => new Date(b.startDate) - new Date(a.startDate));

    const total = elections.length;
    const start = (page - 1) * limit;
    elections = elections.slice(start, start + limit);

    // Populate data
    const electionsWithData = await Promise.all(elections.map(async (election) => {
      const e = election.toObject ? election.toObject() : election;
      
      // Add status
      if (now < new Date(e.startDate)) e.status = 'upcoming';
      else if (now >= new Date(e.startDate) && now <= new Date(e.endDate)) e.status = 'ongoing';
      else e.status = 'completed';
      
      // Populate creator
      e.createdBy = await populateUser(e.createdBy);
      
      // Populate candidates
      e.candidates = await Promise.all((e.candidates || []).map(async (c) => ({
        ...c,
        user: await populateUser(c.user)
      })));
      
      e.voterCount = (e.voters || []).length;
      delete e.voters; // Don't expose voter list
      
      return e;
    }));

    res.json({
      success: true,
      count: electionsWithData.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      elections: electionsWithData
    });
  } catch (error) {
    console.error('Get elections error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/elections/:id
// @desc    Get single election
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const Election = getElectionModel();
    const election = await Election.findById(req.params.id);

    if (!election) {
      return res.status(404).json({
        success: false,
        message: 'Election not found'
      });
    }

    const e = election.toObject ? election.toObject() : election;
    const now = new Date();

    // Add status
    if (now < new Date(e.startDate)) e.status = 'upcoming';
    else if (now >= new Date(e.startDate) && now <= new Date(e.endDate)) e.status = 'ongoing';
    else e.status = 'completed';

    // Populate
    e.createdBy = await populateUser(e.createdBy);
    e.candidates = await Promise.all((e.candidates || []).map(async (c) => ({
      ...c,
      user: await populateUser(c.user, ['name', 'handle', 'avatar', 'department', 'faculty', 'bio'])
    })));
    
    e.voterCount = (e.voters || []).length;
    delete e.voters;

    res.json({
      success: true,
      election: e
    });
  } catch (error) {
    console.error('Get election error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST /api/elections
// @desc    Create election
// @access  Private (admin)
router.post('/', protect, authorize('admin', 'dean', 'vc'), [
  body('title').notEmpty().withMessage('Title is required'),
  body('description').notEmpty().withMessage('Description is required'),
  body('position').notEmpty().withMessage('Position is required'),
  body('startDate').isISO8601().withMessage('Valid start date is required'),
  body('endDate').isISO8601().withMessage('Valid end date is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const { title, description, position, type, startDate, endDate, eligibility, maxVotes } = req.body;

    if (new Date(startDate) >= new Date(endDate)) {
      return res.status(400).json({
        success: false,
        message: 'End date must be after start date'
      });
    }

    const Election = getElectionModel();
    const election = await Election.create({
      title,
      description,
      position,
      type: type || 'general',
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      eligibility: eligibility || {},
      maxVotes: maxVotes || 1,
      createdBy: req.user.id
    });

    const e = election.toObject ? election.toObject() : election;
    e.createdBy = await populateUser(e.createdBy);

    res.status(201).json({
      success: true,
      message: 'Election created successfully',
      election: e
    });
  } catch (error) {
    console.error('Create election error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST /api/elections/:id/candidates
// @desc    Add candidate
// @access  Private (admin)
router.post('/:id/candidates', protect, authorize('admin', 'dean', 'vc'), [
  body('userId').notEmpty().withMessage('User ID is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const Election = getElectionModel();
    const User = getUserModel();
    
    const election = await Election.findById(req.params.id);
    if (!election) {
      return res.status(404).json({ success: false, message: 'Election not found' });
    }

    if (new Date() >= new Date(election.startDate)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot add candidates after voting has started'
      });
    }

    const { userId, manifesto, slogan, photo } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const candidates = election.candidates || [];
    if (candidates.some(c => c.user === userId)) {
      return res.status(400).json({ success: false, message: 'User is already a candidate' });
    }

    // Generate candidate ID
    const candidateId = Date.now().toString(36) + Math.random().toString(36).substr(2);
    
    await Election.findByIdAndUpdate(election._id, {
      $push: { 
        candidates: {
          _id: candidateId,
          user: userId,
          manifesto: manifesto || '',
          slogan: slogan || '',
          photo: photo || user.avatar,
          votes: 0
        }
      }
    });

    const updatedElection = await Election.findById(election._id);
    const populatedCandidates = await Promise.all(
      (updatedElection.candidates || []).map(async (c) => ({
        ...c,
        user: await populateUser(c.user)
      }))
    );

    res.json({
      success: true,
      message: 'Candidate added successfully',
      candidates: populatedCandidates
    });
  } catch (error) {
    console.error('Add candidate error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   DELETE /api/elections/:id/candidates/:candidateId
// @desc    Remove candidate
// @access  Private (admin)
router.delete('/:id/candidates/:candidateId', protect, authorize('admin', 'dean', 'vc'), async (req, res) => {
  try {
    const Election = getElectionModel();
    const election = await Election.findById(req.params.id);
    
    if (!election) {
      return res.status(404).json({ success: false, message: 'Election not found' });
    }

    if (new Date() >= new Date(election.startDate)) {
      return res.status(400).json({
        success: false,
        message: 'Cannot remove candidates after voting has started'
      });
    }

    await Election.findByIdAndUpdate(election._id, {
      $pull: { candidates: { _id: req.params.candidateId } }
    });

    res.json({ success: true, message: 'Candidate removed' });
  } catch (error) {
    console.error('Remove candidate error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST /api/elections/:id/vote
// @desc    Cast vote
// @access  Private
router.post('/:id/vote', protect, async (req, res) => {
  try {
    const Election = getElectionModel();
    const User = getUserModel();
    
    const election = await Election.findById(req.params.id);
    if (!election) {
      return res.status(404).json({ success: false, message: 'Election not found' });
    }

    const now = new Date();
    if (now < new Date(election.startDate)) {
      return res.status(400).json({ success: false, message: 'Voting has not started yet' });
    }
    if (now > new Date(election.endDate)) {
      return res.status(400).json({ success: false, message: 'Voting has ended' });
    }

    const voters = election.voters || [];
    if (voters.some(v => v.user === req.user.id)) {
      return res.status(400).json({ success: false, message: 'You have already voted' });
    }

    // Check eligibility
    const user = await User.findById(req.user.id);
    const eligibility = election.eligibility || {};
    
    if (eligibility.departments?.length && !eligibility.departments.includes(user.department)) {
      return res.status(403).json({ success: false, message: 'Not eligible to vote in this election' });
    }
    if (eligibility.faculties?.length && !eligibility.faculties.includes(user.faculty)) {
      return res.status(403).json({ success: false, message: 'Not eligible to vote in this election' });
    }
    if (eligibility.years?.length && !eligibility.years.includes(user.yearOfStudy)) {
      return res.status(403).json({ success: false, message: 'Not eligible to vote in this election' });
    }

    const { candidateIds } = req.body;
    if (!candidateIds || !Array.isArray(candidateIds) || candidateIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Please select at least one candidate' });
    }
    if (candidateIds.length > (election.maxVotes || 1)) {
      return res.status(400).json({ success: false, message: `You can only vote for up to ${election.maxVotes} candidate(s)` });
    }

    // Validate and update candidate votes
    const candidates = election.candidates || [];
    for (const candidateId of candidateIds) {
      const candidate = candidates.find(c => c._id === candidateId);
      if (!candidate) {
        return res.status(400).json({ success: false, message: 'Invalid candidate selected' });
      }
    }

    // Update votes for each selected candidate
    for (const candidateId of candidateIds) {
      const candidateIndex = candidates.findIndex(c => c._id === candidateId);
      if (candidateIndex !== -1) {
        candidates[candidateIndex].votes = (candidates[candidateIndex].votes || 0) + 1;
      }
    }

    // Record vote
    await Election.findByIdAndUpdate(election._id, {
      $set: { candidates },
      $push: { voters: { user: req.user.id, votedAt: new Date() } }
    });

    res.json({ success: true, message: 'Vote cast successfully' });
  } catch (error) {
    console.error('Vote error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/elections/:id/results
// @desc    Get election results
// @access  Public (after election ends)
router.get('/:id/results', async (req, res) => {
  try {
    const Election = getElectionModel();
    const election = await Election.findById(req.params.id);

    if (!election) {
      return res.status(404).json({ success: false, message: 'Election not found' });
    }

    if (new Date() <= new Date(election.endDate)) {
      return res.status(400).json({
        success: false,
        message: 'Results will be available after the election ends'
      });
    }

    // Get results
    const results = await Promise.all(
      (election.candidates || []).map(async (c) => ({
        candidate: await populateUser(c.user),
        manifesto: c.manifesto,
        slogan: c.slogan,
        votes: c.votes || 0
      }))
    );

    results.sort((a, b) => b.votes - a.votes);

    const totalVotes = results.reduce((sum, r) => sum + r.votes, 0);
    const totalVoters = (election.voters || []).length;

    res.json({
      success: true,
      election: {
        id: election._id,
        title: election.title,
        position: election.position,
        startDate: election.startDate,
        endDate: election.endDate
      },
      results,
      stats: {
        totalVotes,
        totalVoters,
        winner: results[0] || null
      }
    });
  } catch (error) {
    console.error('Get results error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   DELETE /api/elections/:id
// @desc    Delete election
// @access  Private (admin)
router.delete('/:id', protect, authorize('admin'), async (req, res) => {
  try {
    const Election = getElectionModel();
    const election = await Election.findById(req.params.id);

    if (!election) {
      return res.status(404).json({ success: false, message: 'Election not found' });
    }

    await Election.deleteOne({ _id: election._id });
    res.json({ success: true, message: 'Election deleted' });
  } catch (error) {
    console.error('Delete election error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
