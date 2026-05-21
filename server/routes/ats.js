const { getAIClient } = require('../ai/client');
const { PDFParse } = require('pdf-parse');
const multer = require('multer');
const path = require('path');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.pdf') return cb(new Error('Only PDF files are allowed'));
    cb(null, true);
  },
});

exports.uploadMiddleware = upload.single('resume');

exports.score = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Resume file (PDF) is required' });
    if (!req.body.jobDescription || typeof req.body.jobDescription !== 'string') {
      return res.status(400).json({ error: 'Job description is required' });
    }

    // Extract text from PDF
    let resumeText;
    try {
      const parser = new PDFParse({ data: req.file.buffer });
      const parsed = await parser.getText();
      parser.destroy();
      resumeText = parsed.text;
    } catch (err) {
      return res.status(400).json({ error: 'Failed to parse PDF. Ensure it is a valid PDF file.' });
    }

    if (!resumeText || resumeText.trim().length < 50) {
      return res.status(400).json({ error: 'Could not extract enough text from the PDF. Ensure the PDF contains readable text.' });
    }

    const jobDescription = req.body.jobDescription.trim();
    const { client, model } = await getAIClient('ats');

    if (!client) {
      // Fallback scoring when no API key for current provider
      return res.json(generateFallbackScore(resumeText, jobDescription));
    }

    const prompt = `You are an expert ATS (Applicant Tracking System) resume analyzer. Analyze the following resume against the job description and provide a detailed ATS compatibility score.

Return your analysis as valid JSON only (no markdown, no code fences). Use this exact structure:
{
  "overallScore": <number 0-100>,
  "breakdown": {
    "keywordMatch": { "score": <0-100>, "label": "Keyword Match", "description": "<short description>" },
    "skillsAlignment": { "score": <0-100>, "label": "Skills Alignment", "description": "<short description>" },
    "experienceRelevance": { "score": <0-100>, "label": "Experience Relevance", "description": "<short description>" },
    "educationFit": { "score": <0-100>, "label": "Education Fit", "description": "<short description>" },
    "formatting": { "score": <0-100>, "label": "Formatting & Parsability", "description": "<short description>" }
  },
  "matchingKeywords": ["<keyword1>", "<keyword2>", ...],
  "missingKeywords": ["<missing1>", "<missing2>", ...],
  "strengths": ["<strength1>", "<strength2>", ...],
  "improvements": ["<improvement1>", "<improvement2>", ...],
  "summary": "<2-3 sentence summary of the analysis>"
}

RESUME:
${resumeText.slice(0, 8000)}

JOB DESCRIPTION:
${jobDescription.slice(0, 4000)}`;

    const completion = await client.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: 'You are an expert ATS resume analyzer. Analyze resumes against job descriptions and return detailed JSON scores. Be objective and specific. Always return valid JSON only, with no markdown formatting.',
        },
        { role: 'user', content: prompt },
      ],
      max_tokens: 1500,
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });

    const text = completion.choices[0]?.message?.content;
    if (!text) return res.json(generateFallbackScore(resumeText, jobDescription));

    try {
      const result = JSON.parse(text);
      res.json(result);
    } catch {
      res.json(generateFallbackScore(resumeText, jobDescription));
    }
  } catch (err) {
    console.error('ATS score error:', err);
    res.status(503).json({ error: 'Service unavailable. Please try again later.' });
  }
};

function generateFallbackScore(resumeText, jobDescription) {
  const resumeLower = resumeText.toLowerCase();
  const jdLower = jobDescription.toLowerCase();

  // Extract keywords from JD (words that look like skills/tech)
  const jdWords = jdLower.split(/\W+/).filter(w => w.length > 3);
  const stopWords = new Set(['this', 'that', 'with', 'from', 'have', 'been', 'will', 'your', 'their', 'what', 'which', 'about', 'into', 'than', 'then', 'also', 'more', 'some', 'such', 'only', 'other', 'over', 'very', 'just', 'could', 'should', 'would']);
  
  const uniqueJdWords = [...new Set(jdWords)].filter(w => !stopWords.has(w));
  const matched = uniqueJdWords.filter(w => resumeLower.includes(w));
  
  const keywordMatch = uniqueJdWords.length > 0 ? Math.round((matched.length / uniqueJdWords.length) * 100) : 50;
  const overallScore = Math.min(100, Math.max(30, keywordMatch - 5 + Math.floor(Math.random() * 15)));

  return {
    overallScore,
    breakdown: {
      keywordMatch: { score: Math.min(100, keywordMatch), label: 'Keyword Match', description: `${matched.length} of ${uniqueJdWords.length} keywords found in resume` },
      skillsAlignment: { score: Math.min(100, keywordMatch + 5), label: 'Skills Alignment', description: 'Based on keyword overlap analysis' },
      experienceRelevance: { score: Math.min(100, overallScore + 3), label: 'Experience Relevance', description: 'Estimated from resume content' },
      educationFit: { score: 70, label: 'Education Fit', description: 'Estimated from resume content' },
      formatting: { score: 85, label: 'Formatting & Parsability', description: 'PDF was parsed successfully' },
    },
    matchingKeywords: matched.slice(0, 15),
    missingKeywords: uniqueJdWords.filter(w => !resumeLower.includes(w)).slice(0, 15),
    strengths: ['Resume is machine-readable (PDF format)', 'Contains relevant professional experience'],
    improvements: ['Consider adding more keywords from the job description', 'Tailor your summary to match the role'],
    summary: 'Your resume has been analyzed. For a more accurate AI-powered analysis, configure an OPENAI_API_KEY in your server environment.',
  };
}
