/**
 * Database Seed Script - TMU TIMES
 * Populates the database with sample data
 */

const path = require('path');
const bcrypt = require('bcryptjs');

// Initialize database
const { initDatabase } = require('./database');
const db = initDatabase(path.join(__dirname, 'data'));

// Initialize models
const { initAllModels, getUserModel, getPostModel, getAnnouncementModel, getElectionModel } = require('./models/index.tmu');
initAllModels();

// Sample data
const sampleUsers = [
  {
    name: 'Prof. Michael Johnson',
    email: 'vc@tmu.edu',
    password: 'password123',
    regNumber: 'ADMIN-001',
    handle: '@vc_tmu',
    role: 'admin',
    department: 'Administration',
    faculty: 'Administration',
    isVerified: true,
    avatar: '👨‍💼',
    bio: 'Vice Chancellor of TMU. Committed to excellence in education.'
  },
  {
    name: 'Dr. Sarah Williams',
    email: 'dean.eng@tmu.edu',
    password: 'password123',
    regNumber: 'STAFF-001',
    handle: '@dean_eng',
    role: 'staff',
    department: 'Engineering',
    faculty: 'Engineering',
    isVerified: true,
    avatar: '👩‍💼',
    bio: 'Dean of Engineering Faculty. PhD in Mechanical Engineering.'
  },
  {
    name: 'Dr. James Chen',
    email: 'hod.cs@tmu.edu',
    password: 'password123',
    regNumber: 'STAFF-002',
    handle: '@hod_cs',
    role: 'staff',
    department: 'Computer Science',
    faculty: 'Engineering',
    isVerified: true,
    avatar: '👨‍🏫',
    bio: 'Head of Computer Science Department. AI & ML Researcher.'
  },
  {
    name: 'Samuel Okonkwo',
    email: 'samuel.o@student.tmu.edu',
    password: 'password123',
    regNumber: 'STU-2024-001',
    handle: '@studentsam',
    role: 'student',
    department: 'Computer Science',
    faculty: 'Engineering',
    year: 3,
    isVerified: false,
    avatar: '👤',
    bio: 'CS student | Tech enthusiast | Football lover ⚽'
  },
  {
    name: 'Amara Nwosu',
    email: 'amara.n@student.tmu.edu',
    password: 'password123',
    regNumber: 'STU-2024-002',
    handle: '@amara_codes',
    role: 'student',
    department: 'Computer Science',
    faculty: 'Engineering',
    year: 2,
    isVerified: false,
    avatar: '👩‍💻',
    bio: 'Aspiring Software Developer | Web Dev Club President'
  },
  {
    name: 'David Ibrahim',
    email: 'david.i@student.tmu.edu',
    password: 'password123',
    regNumber: 'STU-2024-003',
    handle: '@david_tmu',
    role: 'student',
    department: 'Electrical Engineering',
    faculty: 'Engineering',
    year: 4,
    isVerified: false,
    avatar: '🧑‍🔬',
    bio: 'Final year EE student | Robotics Club Lead'
  },
  {
    name: 'Tech Club TMU',
    email: 'techclub@tmu.edu',
    password: 'password123',
    regNumber: 'CLUB-001',
    handle: '@techclub_tmu',
    role: 'student',
    department: 'Computer Science',
    faculty: 'Engineering',
    isVerified: true,
    avatar: '💻',
    bio: 'Official TMU Tech Club | Hackathons | Workshops | Innovation'
  },
  {
    name: 'Campus Life TMU',
    email: 'campuslife@tmu.edu',
    password: 'password123',
    regNumber: 'CLUB-002',
    handle: '@campuslife_tmu',
    role: 'student',
    department: 'Student Affairs',
    faculty: 'Administration',
    isVerified: true,
    avatar: '🎉',
    bio: 'Your guide to campus events, culture, and student life!'
  }
];

const getSamplePosts = (userIds) => [
  {
    author: userIds['ADMIN-001'],
    type: 'post',
    category: 'official',
    content: '🎓 Welcome to a new semester at TMU!\n\nUniversity reopens on Monday. All facilities including libraries, labs, and sports centers will be fully operational.\n\nLooking forward to welcoming everyone back! Let\'s make this semester great.\n\n#TMU2026 #NewSemester',
    hashtags: ['tmu2026', 'newsemester'],
    views: 4521,
    likes: generateLikes(userIds, 245),
    commentCount: 32,
    reposts: generateReposts(userIds, 18)
  },
  {
    author: userIds['STAFF-001'],
    type: 'post',
    category: 'official',
    content: '🚀 BREAKING: New research grant worth $100,000 approved for AI Lab!\n\nApply now if you\'re interested in machine learning, computer vision, or NLP research.\n\nDeadline: Feb 15th\n\nContact Dr. Chen for more information.\n\n#AIResearch #TMUEngineering',
    hashtags: ['airesearch', 'tmuengineering'],
    views: 2890,
    likes: generateLikes(userIds, 156),
    commentCount: 28,
    reposts: generateReposts(userIds, 45)
  },
  {
    author: userIds['STU-2024-001'],
    type: 'post',
    category: 'student',
    content: 'Football trials tomorrow at 4PM at the main field! ⚽\n\nAll interested students welcome. Bring your boots and water.\n\nSee you there!\n\n#TMUSports #FootballTrials',
    hashtags: ['tmusports', 'footballtrials'],
    views: 892,
    likes: generateLikes(userIds, 89),
    commentCount: 15,
    reposts: generateReposts(userIds, 12)
  },
  {
    author: userIds['CLUB-001'],
    type: 'post',
    category: 'student',
    content: '🔥 HACKATHON 2026 IS HERE!\n\nPrize pool: $5,000\n📅 Date: Feb 20-22\n📍 Location: Engineering Block\n\nTeam size: 2-4 members\nRegister now at techclub.tmu.edu\n\n#TMUHackathon #Coding #Tech',
    hashtags: ['tmuhackathon', 'coding', 'tech'],
    views: 3456,
    likes: generateLikes(userIds, 234),
    commentCount: 45,
    reposts: generateReposts(userIds, 67)
  },
  {
    author: userIds['CLUB-002'],
    type: 'post',
    category: 'event',
    content: '📸 Cultural fest photos are up! What an amazing night 🌟\n\nThank you to everyone who made it unforgettable. The energy was incredible!\n\nCheck out the full gallery on our website.\n\n#TMUFest #CollegeLife #Campus',
    hashtags: ['tmufest', 'collegelife', 'campus'],
    views: 8901,
    likes: generateLikes(userIds, 567),
    commentCount: 89,
    reposts: generateReposts(userIds, 34)
  },
  {
    author: userIds['STAFF-002'],
    type: 'post',
    category: 'official',
    content: '📢 New AI & Machine Learning Lab is now OPEN!\n\nFeatures:\n• 50 High-performance workstations\n• GPU cluster for deep learning\n• VR/AR development corner\n• 24/7 access for research students\n\nBook your lab sessions through the portal.\n\n#AIML #TMULabs',
    hashtags: ['aiml', 'tmulabs'],
    views: 1567,
    likes: generateLikes(userIds, 189),
    commentCount: 23,
    reposts: generateReposts(userIds, 56)
  },
  {
    author: userIds['STU-2024-002'],
    type: 'post',
    category: 'student',
    content: 'Just finished my first React project! 🎉\n\nBuilt a task management app with dark mode, drag-and-drop, and real-time sync.\n\nOpen source on my GitHub - link in bio!\n\n#WebDev #React #OpenSource',
    hashtags: ['webdev', 'react', 'opensource'],
    views: 456,
    likes: generateLikes(userIds, 78),
    commentCount: 12,
    reposts: generateReposts(userIds, 8)
  },
  {
    author: userIds['STU-2024-003'],
    type: 'post',
    category: 'event',
    content: '🤖 Robotics Club meeting this Friday!\n\nAgenda:\n• Arduino workshop for beginners\n• Planning for national competition\n• New project assignments\n\nTime: 3PM @ Engineering Lab 2\n\n#TMURobotics #Arduino',
    hashtags: ['tmurobotics', 'arduino'],
    views: 234,
    likes: generateLikes(userIds, 45),
    commentCount: 8,
    reposts: generateReposts(userIds, 5)
  },
  {
    author: userIds['ADMIN-001'],
    type: 'post',
    category: 'official',
    content: '📚 Library hours extended during exam period!\n\nNew hours: 6AM - 12AM (midnight)\n\nAdditional quiet study rooms available on Floor 3.\n\nGood luck with your exams!\n\n#ExamSeason #TMULibrary',
    hashtags: ['examseason', 'tmulibrary'],
    views: 2345,
    likes: generateLikes(userIds, 312),
    commentCount: 18,
    reposts: generateReposts(userIds, 25)
  },
  {
    author: userIds['CLUB-001'],
    type: 'post',
    category: 'event',
    content: '💡 Workshop Alert!\n\n"Introduction to Cloud Computing with AWS"\n\n📅 Next Tuesday, 2PM\n📍 CS Lab 1\n👨‍🏫 Guest Speaker: AWS Solutions Architect\n\nFree for all TMU students!\n\n#Cloud #AWS #Workshop',
    hashtags: ['cloud', 'aws', 'workshop'],
    views: 678,
    likes: generateLikes(userIds, 123),
    commentCount: 34,
    reposts: generateReposts(userIds, 28)
  }
];

const getSampleAnnouncements = (userIds) => [
  {
    title: 'Campus Closure Notice',
    content: 'The university will be closed on Friday, February 7th for institutional development day. All classes are cancelled and facilities will be unavailable. Regular operations resume Monday.',
    author: userIds['ADMIN-001'],
    category: 'general',
    priority: 'high',
    targetAudience: 'all',
    icon: '⚠️',
    isPinned: true
  },
  {
    title: 'Final Exam Schedule Released',
    content: 'Final examination schedules for all programs have been released on the student portal. Please check your personalized exam timetable and report any conflicts within 48 hours.',
    author: userIds['STAFF-001'],
    category: 'academic',
    priority: 'normal',
    targetAudience: 'students',
    icon: '📚'
  },
  {
    title: 'Scholarship Applications Open',
    content: 'Applications for 2026-2027 academic year scholarships are now open. Merit-based, need-based, and athletic scholarships available. Deadline: March 31, 2026.',
    author: userIds['ADMIN-001'],
    category: 'general',
    priority: 'normal',
    targetAudience: 'students',
    icon: '🎓'
  },
  {
    title: 'New Cafeteria Menu',
    content: 'The main cafeteria has introduced new healthy meal options including vegetarian, vegan, and gluten-free choices. Check out the new salad bar and smoothie station!',
    author: userIds['ADMIN-001'],
    category: 'general',
    priority: 'low',
    targetAudience: 'all',
    icon: '🍽️'
  },
  {
    title: 'Career Fair 2026',
    content: 'Annual Career Fair happening on March 15, 2026! Over 50 top companies including Google, Microsoft, Amazon, and local startups. Bring your resume and dress professionally.',
    author: userIds['STAFF-001'],
    category: 'event',
    priority: 'normal',
    targetAudience: 'students',
    icon: '💼'
  }
];

const getSampleElections = (userIds) => [
  {
    title: 'Student Union President 2026',
    description: 'Election for the next Student Union President. The president represents all students and leads the Student Union Executive Council.',
    position: 'President',
    type: 'general',
    startDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Started yesterday
    endDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000), // Ends in 5 days
    status: 'active',
    createdBy: userIds['ADMIN-001'],
    candidates: [
      {
        user: userIds['STU-2024-001'],
        name: 'Ahmed Okonkwo',
        manifesto: 'I promise to fight for better facilities, more student events, and improved cafeteria services.',
        votes: Math.floor(Math.random() * 200) + 100
      },
      {
        user: userIds['STU-2024-002'],
        name: 'Zainab Ibrahim',
        manifesto: 'My focus is on mental health support, academic excellence, and building a stronger community.',
        votes: Math.floor(Math.random() * 200) + 100
      }
    ],
    voterCount: 0,
    totalEligibleVoters: 500
  },
  {
    title: 'VP Academic Affairs 2026',
    description: 'Election for Vice President of Academic Affairs. Responsible for representing student academic interests.',
    position: 'Vice President Academic',
    type: 'general',
    startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
    endDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    status: 'active',
    createdBy: userIds['ADMIN-001'],
    candidates: [
      {
        user: userIds['STU-2024-003'],
        name: 'David Chen',
        manifesto: 'I will push for curriculum updates, more lab hours, and better industry partnerships.',
        votes: Math.floor(Math.random() * 150) + 100
      },
      {
        user: userIds['STU-2024-002'],
        name: 'Maria Santos',
        manifesto: 'Academic support programs, tutoring services, and research opportunities for all.',
        votes: Math.floor(Math.random() * 150) + 100
      }
    ],
    voterCount: 0,
    totalEligibleVoters: 500
  }
];

// Helper functions
function generateLikes(userIds, count) {
  const ids = Object.values(userIds);
  const likes = [];
  for (let i = 0; i < Math.min(count, ids.length); i++) {
    likes.push({ user: ids[i], createdAt: new Date(Date.now() - Math.random() * 86400000) });
  }
  return likes;
}

function generateReposts(userIds, count) {
  const ids = Object.values(userIds);
  const reposts = [];
  for (let i = 0; i < Math.min(count, ids.length); i++) {
    reposts.push({ user: ids[i], createdAt: new Date(Date.now() - Math.random() * 86400000) });
  }
  return reposts;
}

// Main seed function
async function seedDatabase() {
  console.log('🌱 Starting database seed...\n');

  try {
    const User = getUserModel();
    const Post = getPostModel();
    const Announcement = getAnnouncementModel();
    const Election = getElectionModel();

    // Clear existing data
    console.log('🗑️  Clearing existing data...');
    await User.deleteMany({});
    await Post.deleteMany({});
    await Announcement.deleteMany({});
    await Election.deleteMany({});
    console.log('   ✓ Data cleared\n');

      // TMU TIMES Production Seed Script (No-Op)
      // This script is intentionally left blank for production to avoid accidental seeding.
      console.log('Seed script: No operation performed.');

    // Create announcements
    console.log('📢 Creating announcements...');
    const announcementsData = getSampleAnnouncements(userIds);
    let announcementCount = 0;
    
    for (const annData of announcementsData) {
      const createdAt = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000);
      await Announcement.create({
        ...annData,
        createdAt,
        publishedAt: createdAt
      });
      announcementCount++;
    }
    console.log(`   ✓ Created ${announcementCount} announcements\n`);

    // Create elections
    console.log('🗳️  Creating elections...');
    const electionsData = getSampleElections(userIds);
    let electionCount = 0;
    
    for (const elecData of electionsData) {
      await Election.create(elecData);
      electionCount++;
    }
    console.log(`   ✓ Created ${electionCount} elections\n`);

    // Print summary
    console.log('═══════════════════════════════════════════');
    console.log('🎉 DATABASE SEEDED SUCCESSFULLY!');
    console.log('═══════════════════════════════════════════');
    console.log(`\n📊 Summary:`);
    console.log(`   • Users: ${Object.keys(userIds).length}`);
    console.log(`   • Posts: ${postCount}`);
    console.log(`   • Announcements: ${announcementCount}`);
    console.log(`   • Elections: ${electionCount}`);
    console.log(`\n🔑 Test Credentials:`);
    console.log(`   Admin:   ADMIN-001 / password123`);
    console.log(`   Staff:   STAFF-001 / password123`);
    console.log(`   Student: STU-2024-001 / password123`);
    console.log(`\n✅ Ready to use!\n`);

  } catch (error) {
    console.error('❌ Seed error:', error);
    process.exit(1);
  }
}

// Run seed
   // No operation performed in production
   console.log('Seed script: No operation performed.');
