require('dotenv').config({ quiet: true });

const required = (name) => {
  const v = process.env[name];
  if (!v || !v.trim()) {
    console.error(`[startup] FATAL: Environment variable ${name} is required but missing.`);
    process.exit(1);
  }
  return v;
};

const optional = (name, def) => {
  const v = process.env[name];
  return v && v.trim() ? v.trim() : def;
};

const env = {
  PORT: optional('PORT', 5000),
  NODE_ENV: optional('NODE_ENV', 'development'),
  MONGODB_URI: required('MONGODB_URI'),
  JWT_SECRET: required('JWT_SECRET'),
  CLIENT_URL: optional('CLIENT_URL', ''),
  EMAIL_USER: optional('EMAIL_USER', ''),
  EMAIL_PASS: optional('EMAIL_PASS', ''),
  OPENAI_API_KEY: optional('OPENAI_API_KEY', ''),
  GROQ_API_KEY: optional('GROQ_API_KEY', ''),
  TRUST_PROXY: optional('TRUST_PROXY', '1'),
  ANALYTICS_SALT: optional('ANALYTICS_SALT', ''),
};

if (env.JWT_SECRET === 'your_jwt_secret_here' || env.JWT_SECRET.length < 32) {
  console.error('[startup] FATAL: JWT_SECRET must be set to a strong value (>= 32 chars) and not the placeholder.');
  process.exit(1);
}

const trustProxyN = Number(env.TRUST_PROXY);
if (Number.isInteger(trustProxyN) && trustProxyN >= 0) {
  // 1 hop for direct reverse proxies; tunable via env
  // eslint-disable-next-line global-require
  process.env.TRUST_PROXY_VALUE = String(trustProxyN);
}

module.exports = env;
