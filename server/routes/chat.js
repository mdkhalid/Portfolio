const OpenAI = require('openai');
const Profile = require('../models/Profile');
const Skill = require('../models/Skill');
const Experience = require('../models/Experience');
const Education = require('../models/Education');
const Project = require('../models/Project');
const Certification = require('../models/Certification');
const Resume = require('../models/Resume');

let openai = null;

function getOpenAI() {
  if (!openai && process.env.OPENAI_API_KEY) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openai;
}

async function buildResumeContext() {
  const [profile, skills, experiences, education, projects, certifications, resumes] = await Promise.all([
    Profile.findOne(),
    Skill.find().sort('order'),
    Experience.find().sort('order'),
    Education.find().sort('order'),
    Project.find().sort('order'),
    Certification.find().sort('order'),
    Resume.find().sort('order'),
  ]);

  // Format as a structured, readable resume
  const sections = [];

  // Header
  if (profile) {
    sections.push(`=== PROFESSIONAL PROFILE ===
Name: ${profile.name || 'N/A'}
Title: ${profile.title || 'N/A'}
Email: ${profile.email || 'N/A'}
Phone: ${profile.phone || 'N/A'}
Location: ${profile.location || 'N/A'}
LinkedIn: ${profile.linkedIn || 'N/A'}
GitHub: ${profile.github || 'N/A'}
Total Experience: ${profile.experienceYears || 0}+ years

Professional Summary:
${profile.summary || 'N/A'}`);
  }

  // Skills
  if (skills && skills.length > 0) {
    const skillSection = skills.map(s =>
      `${s.category}: ${s.items?.map(i => `${i.name} (${i.level}% proficiency)`).join(', ') || 'None'}`
    ).join('\n');
    sections.push(`=== TECHNICAL SKILLS ===
${skillSection}`);
  }

  // Work Experience
  if (experiences && experiences.length > 0) {
    const expSection = experiences.map(e =>
      `${e.role} at ${e.company}
  ${e.location} | ${e.startDate} - ${e.endDate || 'Present'}${e.current ? ' (Current)' : ''}
  Key achievements:
${e.bullets?.map(b => `  • ${b}`).join('\n') || '  • No details available'}`
    ).join('\n\n');
    sections.push(`=== WORK EXPERIENCE ===
${expSection}`);
  }

  // Education
  if (education && education.length > 0) {
    const eduSection = education.map(e =>
      `${e.degree}${e.field ? ` in ${e.field}` : ''} — ${e.institution}
  ${e.location || ''} | ${e.startDate || ''} - ${e.endDate || ''}`
    ).join('\n\n');
    sections.push(`=== EDUCATION ===
${eduSection}`);
  }

  // Projects
  if (projects && projects.length > 0) {
    const projSection = projects.map(p =>
      `${p.name}
  Role: ${p.role || 'N/A'}
  ${p.location ? `Location: ${p.location}` : ''}
  Period: ${p.startDate || ''} - ${p.endDate || ''}
  Description: ${p.description || 'N/A'}
  Tech Stack: ${p.techStack?.join(', ') || 'N/A'}
  Key highlights:
${p.bullets?.map(b => `  • ${b}`).join('\n') || '  • No details available'}`
    ).join('\n\n');
    sections.push(`=== FEATURED PROJECTS ===
${projSection}`);
  }

  // Certifications
  if (certifications && certifications.length > 0) {
    const certSection = certifications.map(c =>
      `${c.name}
  Issuer: ${c.issuer || 'N/A'}
  Date: ${c.date || 'N/A'}
  ${c.link ? `Link: ${c.link}` : ''}`
    ).join('\n\n');
    sections.push(`=== CERTIFICATIONS ===
${certSection}`);
  }

  // Resume files
  if (resumes && resumes.length > 0) {
    const resumeFiles = resumes.map(r => `• ${r.label}: ${r.fileUrl}`).join('\n');
    sections.push(`=== RESUME DOWNLOADS ===
${resumeFiles}`);
  }

  return sections.join('\n\n');
}

const SYSTEM_PROMPT = `You are an AI resume assistant for Mohammad Khalid's professional resume/CV. You have access to his complete resume data below, formatted as a structured resume.

YOUR ROLE:
- Answer questions about Mohammad's resume — his professional experience, technical skills, education, projects, and certifications
- Think of yourself as an AI that has read his full resume and can answer questions about it
- Be friendly, professional, enthusiastic, and conversational
- Keep responses concise but informative (2-4 paragraphs max)
- Use specific details from the resume to back up your answers (company names, dates, metrics, technologies)
- If asked about something not in the resume data, politely say it's not covered in his resume
- If asked about hiring, consulting, or contacting him, direct them to get in touch via the Contact section of the website
- Do NOT make up information — only use what's in the provided resume data
- Format responses with clear structure, using bullet points when listing multiple items
- When discussing skills, mention the proficiency percentage if available
- When discussing projects, mention the tech stack and key achievements
- When discussing work experience, highlight measurable impacts (percentages, numbers, team sizes)

RESUME DATA:`;


const FALLBACK_RESPONSES = [
  "I'm Mohammad Khalid's AI resume assistant! I can tell you about his 18+ years of experience as a Senior Solution Architect, his technical skills across .NET, Angular, React, Azure, and AI, his work at companies like LanceSoft and Infinity Quest, his featured projects, education, and certifications. Ask me anything about his professional background!",
  "I'd be happy to help! I have access to Mohammad's full resume — including his work experience, technical skills at various proficiency levels, past projects, education history, and professional certifications. What would you like to know?",
  "Great question! I can look up details from Mohammad's resume. Ask me about his role at LanceSoft, his experience with .NET Core and Angular, the AI-powered e-commerce platform he built, his Microsoft certification, or anything else from his professional background.",
];

exports.chat = async (req, res) => {
  const { message } = req.body;

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Message is required' });
  }

  const client = getOpenAI();

  if (!client) {
    // No API key configured — use rule-based fallback
    const context = await buildResumeContext();
    const lower = message.toLowerCase();

    // Extract name from context for fallback responses
    const nameMatch = context.match(/Name: ([^\n]+)/);
    const name = nameMatch ? nameMatch[1].trim() : 'Mohammad Khalid';
    const titleMatch = context.match(/Title: ([^\n]+)/);
    const title = titleMatch ? titleMatch[1].trim() : 'Senior Solution Architect';

    if (lower.includes('hello') || lower.includes('hi ') || lower === 'hi' || lower.includes('hey')) {
      return res.json({ reply: `Hello! 👋 I'm an AI resume assistant for ${name}. Ask me anything about his professional experience, skills, projects, or background — I have his full resume right here!` });
    }

    if ((lower.includes('who') || lower.includes('tell me about')) && (lower.includes('mohammad') || lower.includes('you') || lower.includes('him') || lower.includes('his'))) {
      return res.json({ reply: `${name} is a ${title} with 18+ years of experience based in Delhi, India. He has deep expertise in .NET Core, Angular, React, Node.js, Azure cloud platforms, and AI integration. His resume shows a proven track record of leading teams, architecting enterprise solutions, and delivering measurable results — like improving operational efficiency by 30% at LanceSoft and boosting course completion rates by 40% at Infinity Quest.` });
    }

    if (lower.includes('skill') || lower.includes('technolog') || lower.includes('tech stack') || lower.includes('proficient') || lower.includes('expertise') || lower.includes('know')) {
      const skillsMatch = context.match(/=== TECHNICAL SKILLS ===\n([\s\S]*?)(?:\n\n===|\n$)/);
      const skillsText = skillsMatch ? skillsMatch[1].trim() : 'Not available in resume data.';
      return res.json({ reply: `Here's what Mohammad's resume shows for his technical skills:\n\n${skillsText}\n\nHe's particularly strong in C# (95%), .NET Core (95%), and REST API design (95%), with strong proficiency across the full stack from frontend (Angular, React) to cloud (Azure, AWS).` });
    }

    if (lower.includes('experience') || lower.includes('work') || lower.includes('job') || lower.includes('career') || lower.includes('employment') || lower.includes('company')) {
      const expMatch = context.match(/=== WORK EXPERIENCE ===\n([\s\S]*?)(?:\n\n===|\n$)/);
      const expText = expMatch ? expMatch[1].trim() : 'Not available in resume data.';
      return res.json({ reply: `Here's Mohammad's work experience from his resume:\n\n${expText}` });
    }

    if (lower.includes('project') || lower.includes('built') || lower.includes('developed') || lower.includes('create')) {
      const projMatch = context.match(/=== FEATURED PROJECTS ===\n([\s\S]*?)(?:\n\n===|\n$)/);
      const projText = projMatch ? projMatch[1].trim() : 'Not available in resume data.';
      return res.json({ reply: `Here are Mohammad's featured projects from his resume:\n\n${projText}` });
    }

    if (lower.includes('education') || lower.includes('study') || lower.includes('degree') || lower.includes('college') || lower.includes('university')) {
      const eduMatch = context.match(/=== EDUCATION ===\n([\s\S]*?)(?:\n\n===|\n$)/);
      const eduText = eduMatch ? eduMatch[1].trim() : 'Not available in resume data.';
      return res.json({ reply: `Here's Mohammad's education background from his resume:\n\n${eduText}` });
    }

    if (lower.includes('certification') || lower.includes('certificate') || lower.includes('credential')) {
      const certMatch = context.match(/=== CERTIFICATIONS ===\n([\s\S]*?)(?:\n\n===|\n$)/);
      const certText = certMatch ? certMatch[1].trim() : 'Not available in resume data.';
      return res.json({ reply: `Here are Mohammad's professional certifications from his resume:\n\n${certText}` });
    }

    return res.json({ reply: FALLBACK_RESPONSES[Math.floor(Math.random() * FALLBACK_RESPONSES.length)] });
  }

  try {
    const context = await buildResumeContext();

    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: `${SYSTEM_PROMPT}\n\n${context}` },
        { role: 'user', content: message },
      ],
      max_tokens: 800,
      temperature: 0.7,
    });

    const reply = completion.choices[0]?.message?.content || FALLBACK_RESPONSES[0];
    res.json({ reply });
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: 'Sorry, I encountered an error processing your request. Please try again.' });
  }
};
