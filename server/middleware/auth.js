const jwt = require('jsonwebtoken');

function getJwtSecrets() {
  const current = process.env.JWT_SECRET;
  const previous = process.env.JWT_SECRET_PREVIOUS;
  return previous ? [current, previous] : [current];
}

module.exports = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  const token = header.split(' ')[1];
  if (!token || token.length > 2048 || !/^[A-Za-z0-9._-]+$/.test(token)) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const secrets = getJwtSecrets();
  let decoded = null;
  let lastError = null;

  for (const secret of secrets) {
    try {
      decoded = jwt.verify(token, secret, { algorithms: ['HS256'] });
      break;
    } catch (err) {
      lastError = err;
    }
  }

  if (!decoded || !decoded.id) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  req.adminId = decoded.id;
  next();
};
