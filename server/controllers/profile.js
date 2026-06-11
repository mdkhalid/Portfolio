const Profile = require('../models/Profile');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { str, int, pick } = require('../middleware/validate');
const { cleanPlain } = require('../middleware/sanitize');

const ALLOWED_FIELDS = [
  'name', 'title', 'email', 'phone', 'location', 'linkedIn', 'github',
  'summary', 'avatarUrl', 'experienceYears', 'aiProvider', 'calendlyUrl',
  'availabilityStatus',
];

exports.getAll = asyncHandler(async (req, res) => {
  const profile = await Profile.findOne();
  res.json(profile || {});
});

exports.update = asyncHandler(async (req, res) => {
  const updates = pick(req.body, ALLOWED_FIELDS);

  const sanitized = {};
  const stringFields = ['name', 'title', 'email', 'phone', 'location', 'linkedIn', 'github', 'summary', 'avatarUrl', 'calendlyUrl', 'availabilityStatus'];
  for (const f of stringFields) {
    if (updates[f] !== undefined) {
      sanitized[f] = cleanPlain(str({ [f]: updates[f] }, f, { min: 1, max: 5000, optional: true }) || '');
    }
  }
  if (updates.experienceYears !== undefined) {
    sanitized.experienceYears = int(updates, 'experienceYears', { min: 0, max: 80 });
  }
  if (updates.aiProvider !== undefined) {
    const v = cleanPlain(str({ aiProvider: updates.aiProvider }, 'aiProvider', { min: 1, max: 32, optional: true }) || '');
    if (!['openai', 'groq'].includes(v)) throw new AppError('Invalid aiProvider', 400, 'INVALID_VALUE');
    sanitized.aiProvider = v;
  }

  let profile = await Profile.findOne();
  if (!profile) profile = new Profile();
  Object.assign(profile, sanitized);
  await profile.save();
  res.json(profile);
});
