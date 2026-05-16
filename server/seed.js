require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Profile = require('./models/Profile');
const Skill = require('./models/Skill');
const Experience = require('./models/Experience');
const Education = require('./models/Education');
const Certification = require('./models/Certification');
const Project = require('./models/Project');
const Admin = require('./models/Admin');

const seed = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  // Clear existing data
  await Promise.all([
    Profile.deleteMany({}), Skill.deleteMany({}),
    Experience.deleteMany({}), Education.deleteMany({}),
    Certification.deleteMany({}), Project.deleteMany({}),
    Admin.deleteMany({}),
  ]);

  // Profile
  await Profile.create({
    name: 'Mohammad Khalid',
    email: 'khalid_bib@yahoo.com',
    phone: '9811291878',
    location: 'Delhi, India',
    title: 'Senior Solution Architect',
    summary: 'Senior Solution Architect with 18 years of experience in designing and delivering scalable, enterprise-grade solutions. Expert in .NET Core, Angular, React, Node.js, and cloud platforms, with a proven record of leading teams, driving innovation, and building high-quality applications.',
    experienceYears: 18,
  });

  // Skills
  await Skill.insertMany([
    { category: 'Programming & Frameworks', items: [
      { name: 'C#', level: 95 }, { name: '.NET Core', level: 95 },
      { name: 'JavaScript', level: 90 }, { name: 'TypeScript', level: 90 },
      { name: 'Angular', level: 90 }, { name: 'React.js', level: 85 },
      { name: 'Node.js', level: 85 },
    ], order: 1 },
    { category: 'Database & API', items: [
      { name: 'SQL Server', level: 90 }, { name: 'REST API Design', level: 95 },
      { name: 'MongoDB', level: 80 }, { name: 'GraphQL', level: 70 },
    ], order: 2 },
    { category: 'Cloud & DevOps', items: [
      { name: 'Azure', level: 85 }, { name: 'AWS', level: 80 },
      { name: 'Docker', level: 80 }, { name: 'CI/CD', level: 85 },
    ], order: 3 },
    { category: 'AI & Generative AI', items: [
      { name: 'OpenAI API', level: 80 }, { name: 'Gemini API', level: 75 },
    ], order: 4 },
  ]);

  // Experience
  await Experience.insertMany([
    {
      company: 'LanceSoft Inc.',
      role: 'Senior Solution Architect | Full Stack Developer',
      location: 'Delhi, India (Remote)',
      startDate: 'Jun 2022',
      endDate: 'Jul 2025',
      bullets: [
        'Architected and developed an enterprise logistics management system using .NET Core and Angular 20, improving operational efficiency by 30%',
        'Led a team of 8 developers, managing a $500,000 budget with microservices and SOA principles',
        'Optimized Oracle database performance by 25% through PL/SQL enhancements and query tuning',
        'Implemented real-time ECD features using SignalR, reducing equipment downtime by 15%',
        'Enhanced user satisfaction by 20% building modern responsive UI with Angular 20, TypeScript, and RxJS',
        'Architected MERN-based solutions with React, Node.js, and RESTful services',
      ],
      order: 1,
    },
    {
      company: 'Infinity Quest',
      role: 'Senior Consultant | Full Stack Developer',
      location: 'Delhi, India (Remote)',
      startDate: 'Jun 2021',
      endDate: 'May 2022',
      bullets: [
        'Designed role-based LMS using .NET Core 5 and Angular 11, boosting course completion rates by 40%',
        'Implemented RESTful APIs improving backend communication efficiency by 35%',
        'Engineered Role-Based Access Control (RBAC) for Administrators, Learners, and Managers',
        'Enabled compliance tracking with 99% accuracy',
        'Applied security best practices mitigating risks by 95%',
      ],
      order: 2,
    },
    {
      company: 'AgreeYa Solutions',
      role: 'Sr Software Engineer',
      location: 'Noida, India',
      startDate: 'Nov 2015',
      endDate: 'May 2021',
      bullets: [
        'Developed document management solutions with SharePoint Online, Power Apps, and Power Automate, cutting processing time by 50%',
        'Built Extended Warranty Claim System using .NET Core, Angular 8, handling 10,000+ claims annually',
        'Integrated enterprise platforms connecting SharePoint 2013 with Collibra via REST APIs',
      ],
      order: 3,
    },
  ]);

  // Education
  await Education.insertMany([
    {
      degree: 'M. Sc.',
      field: 'Computer Science',
      institution: 'Karnataka State Open University (KSOU)',
      location: 'Delhi, India',
      startDate: 'Jan 2013',
      endDate: 'Jan 2014',
      order: 1,
    },
    {
      degree: 'BCA',
      field: 'Computers',
      institution: 'IBME',
      location: 'Delhi, India',
      startDate: 'Jan 1999',
      endDate: 'Jan 2002',
      order: 2,
    },
  ]);

  // Certifications
  await Certification.create({
    name: 'Exam 339: Managing Microsoft SharePoint Server 2016',
    issuer: 'Microsoft',
    date: 'Jan 2019',
  });

  // Projects
  await Project.insertMany([
    {
      name: 'Smart Inventory & Order Management System (SIOMS)',
      role: 'Senior Solution Architect | Full Stack Developer',
      location: 'Delhi, India',
      startDate: 'Jul 2025',
      endDate: 'Jan 2026',
      description: 'Smart Inventory & Order Management System using .NET 9, Angular 20, TypeScript and SQL Server 2022',
      techStack: ['.NET 9', 'Angular 20', 'TypeScript', 'SQL Server 2022', 'Clean Architecture', 'CQRS', 'JWT'],
      bullets: [
        'Implemented Clean Architecture Microservices with CQRS, Repository, and Unit of Work patterns',
        'Built secure RESTful APIs with JWT authentication, Fluent Validation, and AutoMapper',
        'Designed responsive Angular Material dashboard with real-time alerts and ngx-charts',
        'Integrated Serilog for centralized logging and background services for low-stock alerts',
      ],
      order: 1,
    },
    {
      name: 'AI-Powered E-Commerce Platform',
      role: 'Senior Solution Architect | Full Stack Developer',
      location: 'Delhi, India',
      startDate: 'Jul 2025',
      endDate: 'Jan 2026',
      description: 'Full-stack e-commerce platform using MERN stack deployed on AWS infrastructure',
      techStack: ['MongoDB', 'Express.js', 'React 18', 'Node.js', 'AWS EC2/S3', 'Docker', 'Redis', 'OpenAI', 'Stripe'],
      bullets: [
        'Built hybrid RESTful and GraphQL APIs, containerized using Docker and deployed via ECS',
        'Integrated Redis caching reducing average API latency by 40%',
        'Implemented AI-powered recommendation engine using OpenAI API',
        'Integrated Stripe for secure payments and role-based admin panel',
        'Configured CI/CD pipeline and monitored using CloudWatch',
      ],
      order: 2,
    },
  ]);

  // Admin
  const hashed = await bcrypt.hash('admin123', 10);
  await Admin.create({ username: 'admin', password: hashed });

  console.log('Seed complete!');
  console.log('Admin login: admin / admin123');
  process.exit();
};

seed();
