const Message = require('../models/Message');
const Activity = require('../models/Activity');
const { asyncHandler, AppError } = require('../middleware/errorHandler');
const { str, email } = require('../middleware/validate');
const { cleanPlain } = require('../middleware/sanitize');
const { envInt } = require('../utils/security');

const MAX_NAME = 100;
const MAX_SUBJECT = 200;
const MAX_MESSAGE = 5000;

exports.send = asyncHandler(async (req, res) => {
  const honeypot = str(req.body, 'company', { max: 200, optional: true });
  if (honeypot) {
    return res.json({ success: true, message: 'Message sent successfully' });
  }

  const name = cleanPlain(str(req.body, 'name', { min: 2, max: MAX_NAME }));
  const senderEmail = email(req.body, 'email');
  const subject = req.body.subject
    ? cleanPlain(str(req.body, 'subject', { min: 1, max: MAX_SUBJECT }))
    : '';
  const message = cleanPlain(str(req.body, 'message', { min: 10, max: MAX_MESSAGE }));

  const minIntervalMs = envInt('CONTACT_MIN_INTERVAL_MS', 0);
  if (minIntervalMs > 0) {
    const lastMessage = await Message.findOne({ email: senderEmail }).sort({ createdAt: -1 });
    if (lastMessage && Date.now() - new Date(lastMessage.createdAt).getTime() < minIntervalMs) {
      throw new AppError('Please wait a moment before sending another message', 429, 'RATE_LIMIT');
    }
  }

  await Message.create({ name, email: senderEmail, subject, message });

  Activity.create({
    type: 'message',
    description: `New message from ${name}`,
    metadata: { name, email: senderEmail, subject },
  })
    .then(() => Activity.prune())
    .catch(() => {});

  res.json({ success: true, message: 'Message sent successfully' });
});
