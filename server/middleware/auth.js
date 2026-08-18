const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');

function getJwtSecrets() {
  const current = process.env.JWT_SECRET;
  const previous = process.env.JWT_SECRET_PREVIOUS;
  return previous ? [current, previous] : [current];
}

/**
 * Verify a JWT against the current (and previous, during rotation) secrets.
 * Returns the decoded payload, or null if the token is missing/invalid/expired.
 */
function verifyJwt(token) {
  if (!token || token.length > 2048 || !/^[A-Za-z0-9._-]+$/.test(token)) {
    return null;
  }

  const secrets = getJwtSecrets();
  for (const secret of secrets) {
    try {
      const decoded = jwt.verify(token, secret, { algorithms: ['HS256'] });
      if (decoded && decoded.id) return decoded;
    } catch (err) {
      // try next secret
    }
  }
  return null;
}

const authMiddleware = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  const token = header.split(' ')[1];

  const decoded = verifyJwt(token);
  if (!decoded) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  // A token signed before the last password change carries a stale tv and must
  // not authenticate, even though its signature and expiry are still valid.
  try {
    const admin = await Admin.findById(decoded.id).select('tokenVersion').lean();
    if (!admin || (admin.tokenVersion || 0) !== (decoded.tv || 0)) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  } catch (err) {
    return next(err);
  }

  req.adminId = decoded.id;
  next();
};

module.exports = authMiddleware;
module.exports.verifyJwt = verifyJwt;
