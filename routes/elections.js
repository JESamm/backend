const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Election = require('../models/Election');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');

// @route   GET /api/elections
// @desc    Get all elections
// @access  Public
router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const { status, type } = req.query;

    // Build query
    let query = {};
    
    if (status) {
      const now = new Date();
      if (status === 'upcoming') {
        query.startDate = { $gt: now };
      } else if (status === 'ongoing') {
        query.startDate = { $lte: now };
        query.endDate = { $gte: now };
      } else if (status === 'completed') {
        query.endDate = { $lt: now };
      }
    }
    
    if (type) query.type = type;

    const elections = await Election.find(query)
      .populate('createdBy', 'name handle avatar')
      .populate('candidates.user', 'name handle avatar department faculty')
      .skip(skip)
      .limit(limit)
      .sort({ startDate: -1 });

    const total = await Election.countDocuments(query);

    // Add status to each election
    const electionsWithStatus = elections.map(election => {
      const electionObj = election.toObject();
      const now = new Date();
      if (now < election.startDate) {
        electionObj.status = 'upcoming';
      } else if (now >= election.startDate && now <= election.endDate) {
        electionObj.status = 'ongoing';
      } else {
        electionObj.status = 'completed';
      }
      return electionObj;
    });

    res.json({
      success: true,
      count: elections.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      elections: electionsWithStatus
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
    const election = await Election.findById(req.params.id)
      .populate('createdBy', 'name handle avatar')
      .populate('candidates.user', 'name handle avatar department faculty bio')
      .populate('voters.user', 'name handle');

    if (!election) {
      return res.status(404).json({
        success: false,
        message: 'Election not found'
      });
    }

    const electionObj = election.toObject();
    const now = new Date();
    if (now < election.startDate) {
      electionObj.status = 'upcoming';
    } else if (now >= election.startDate && now <= election.endDate) {
      electionObj.status = 'ongoing';
    } else {
      electionObj.status = 'completed';
    }

    // Hide voter details unless admin
    electionObj.voterCount = election.voters.length;
    electionObj.voters = undefined;

    res.json({
      success: true,
      election: electionObj
    });
  } catch (error) {
    console.error('Get election error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST /api/elections
// @desc    Create election
// @access  Private (admin only)
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

    const { 
      title, 
      description, 
      position, 
      type,
      startDate, 
      endDate,
      eligibility,
      maxVotes
    } = req.body;

    // Validate dates
    if (new Date(startDate) >= new Date(endDate)) {
      return res.status(400).json({
        success: false,
        message: 'End date must be after start date'
      });
    }

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

    await election.populate('createdBy', 'name handle avatar');

    res.status(201).json({
      success: true,
      message: 'Election created successfully',
      election
    });
  } catch (error) {
    console.error('Create election error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST /api/elections/:id/candidates
// @desc    Add candidate to election
// @access  Private (admin)
router.post('/:id/candidates', protect, authorize('admin', 'dean', 'vc'), [
  body('userId').notEmpty().withMessage('User ID is required'),
  body('manifesto').optional().isLength({ max: 1000 }).withMessage('Manifesto cannot exceed 1000 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const election = await Election.findById(req.params.id);
    if (!election) {
      return res.status(404).json({
        success: false,
        message: 'Election not found'
      });
    }

    // Check if voting has started
    if (new Date() >= election.startDate) {
      return res.status(400).json({
        success: false,
        message: 'Cannot add candidates after voting has started'
      });
    }

    const { userId, manifesto, slogan, photo } = req.body;

    // Verify user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if already a candidate
    if (election.candidates.some(c => c.user.toString() === userId)) {
      return res.status(400).json({
        success: false,
        message: 'User is already a candidate'
      });
    }

    election.candidates.push({
      user: userId,
      manifesto,
      slogan,
      photo,
      votes: 0
    });

    await election.save();
    await election.populate('candidates.user', 'name handle avatar department faculty');

    res.json({
      success: true,
      message: 'Candidate added successfully',
      candidates: election.candidates
    });
  } catch (error) {
    console.error('Add candidate error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   DELETE /api/elections/:id/candidates/:candidateId
// @desc    Remove candidate from election
// @access  Private (admin)
router.delete('/:id/candidates/:candidateId', protect, authorize('admin', 'dean', 'vc'), async (req, res) => {
  try {
    const election = await Election.findById(req.params.id);
    if (!election) {
      return res.status(404).json({
        success: false,
        message: 'Election not found'
      });
    }

    // Check if voting has started
    if (new Date() >= election.startDate) {
      return res.status(400).json({
        success: false,
        message: 'Cannot remove candidates after voting has started'
      });
    }

    election.candidates = election.candidates.filter(
      c => c._id.toString() !== req.params.candidateId
    );

    await election.save();

    res.json({
      success: true,
      message: 'Candidate removed'
    });
  } catch (error) {
    console.error('Remove candidate error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST /api/elections/:id/vote
// @desc    Cast vote in election
// @access  Private
router.post('/:id/vote', protect, async (req, res) => {
  try {
    const election = await Election.findById(req.params.id);
    if (!election) {
      return res.status(404).json({
        success: false,
        message: 'Election not found'
      });
    }

    const now = new Date();

    // Check if voting is open
    if (now < election.startDate) {
      return res.status(400).json({
        success: false,
        message: 'Voting has not started yet'
      });
    }

    if (now > election.endDate) {
      return res.status(400).json({
        success: false,
        message: 'Voting has ended'
      });
    }

    // Check if already voted
    if (election.voters.some(v => v.user.toString() === req.user.id)) {
      return res.status(400).json({
        success: false,
        message: 'You have already voted in this election'
      });
    }

    // Check eligibility
    const user = await User.findById(req.user.id);
    
    if (election.eligibility.departments && election.eligibility.departments.length > 0) {
      if (!election.eligibility.departments.includes(user.department)) {
        return res.status(403).json({
          success: false,
          message: 'You are not eligible to vote in this election'
        });
      }
    }

    if (election.eligibility.faculties && election.eligibility.faculties.length > 0) {
      if (!election.eligibility.faculties.includes(user.faculty)) {
        return res.status(403).json({
          success: false,
          message: 'You are not eligible to vote in this election'
        });
      }
    }

    if (election.eligibility.years && election.eligibility.years.length > 0) {
      if (!election.eligibility.years.includes(user.yearOfStudy)) {
        return res.status(403).json({
          success: false,
          message: 'You are not eligible to vote in this election'
        });
      }
    }

    const { candidateIds } = req.body;

    if (!candidateIds || !Array.isArray(candidateIds) || candidateIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please select at least one candidate'
      });
    }

    if (candidateIds.length > election.maxVotes) {
      return res.status(400).json({
        success: false,
        message: `You can only vote for up to ${election.maxVotes} candidate(s)`
      });
    }

    // Validate candidates
    for (const candidateId of candidateIds) {
      const candidate = election.candidates.find(c => c._id.toString() === candidateId);
      if (!candidate) {
        return res.status(400).json({
          success: false,
          message: 'Invalid candidate selected'
        });
      }
      candidate.votes += 1;
    }

    // Record vote
    election.voters.push({
      user: req.user.id,
      votedAt: new Date()
    });

    await election.save();

    res.json({
      success: true,
      message: 'Vote cast successfully'
    });
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
    const election = await Election.findById(req.params.id)
      .populate('candidates.user', 'name handle avatar department');

    if (!election) {
      return res.status(404).json({
        success: false,
        message: 'Election not found'
      });
    }

    const now = new Date();
    if (now <= election.endDate) {
      return res.status(400).json({
        success: false,
        message: 'Results will be available after the election ends'
      });
    }

    // Sort candidates by votes
    const results = election.candidates
      .map(c => ({
        candidate: c.user,
        manifesto: c.manifesto,
        slogan: c.slogan,
        votes: c.votes
      }))
      .sort((a, b) => b.votes - a.votes);

    const totalVotes = results.reduce((sum, r) => sum + r.votes, 0);
    const totalVoters = election.voters.length;

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
    const election = await Election.findById(req.params.id);

    if (!election) {
      return res.status(404).json({
        success: false,
        message: 'Election not found'
      });
    }

    await election.deleteOne();

    res.json({
      success: true,
      message: 'Election deleted'
    });
  } catch (error) {
    console.error('Delete election error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
