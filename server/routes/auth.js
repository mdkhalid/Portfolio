const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const { asyncHandler } = require('../middleware/errorHandler');
const { str } = require('../middleware/validate');
const { redactEmail } = require('../utils/security');
const Activity = require('../models/Activity');

const USERNAME_RE = /^[A-Za-z0-9_.-]{3,32}$/;

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const username = str(req.body, 'username', { min: 3, max: 32 });
    const password = str(req.body, 'password', { min: 8, max: 200 });

    if (!USERNAME_RE.test(username)) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const admin = await Admin.findOne({ username });
    if (!admin) {
      await bcrypt.compare(password, '$2a$10$invalidsaltinvalidsaltinvali');
      Activity.create({
        type: 'login_failed',
        description: 'Failed login (unknown user)',
        metadata: { username, ip: req.ip },
      }).catch(() => {});
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const match = await bcrypt.compare(password, admin.password);
    if (!match) {
      Activity.create({
        type: 'login_failed',
        description: 'Failed login (bad password)',
        metadata: { username, ip: req.ip },
      }).catch(() => {});
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: admin._id.toString() }, process.env.JWT_SECRET, {
      expiresIn: '7d',
      algorithm: 'HS256',
    });
    res.json({ token, username: admin.username });
  })
);

module.exports = router;
