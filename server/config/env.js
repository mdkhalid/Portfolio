const path = require('path');
// override: true makes the .env file the single source of truth, so a stale
// OS-level environment variable (e.g. an old OPENAI_API_KEY) can never shadow
// the value configured in .env.
require('dotenv').config({ path: path.resolve(__dirname, '..', '.env'), override: true, quiet: true });

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
  // ─── Job Automation (Phase 0 foundations) ───────────────────────────────
  REDIS_URL: optional('REDIS_URL', ''),
  JOB_CREDENTIALS_KEY: optional('JOB_CREDENTIALS_KEY', ''),
  JOB_FETCH_SCHEDULE: optional('JOB_FETCH_SCHEDULE', '0 9 * * *'),
  JOB_STALE_DAYS: optional('JOB_STALE_DAYS', '7'),
  JOB_AI_DAILY_BUDGET: optional('JOB_AI_DAILY_BUDGET', '100'),
  JOB_AI_WEEKLY_BUDGET: optional('JOB_AI_WEEKLY_BUDGET', '500'),
  JOB_NOTIFY_FROM: optional('JOB_NOTIFY_FROM', ''),
  // ─── Social Publisher (LinkedIn + X posting) ─────────────────────────────
  CONTENT_AI_BASE_URL: optional('CONTENT_AI_BASE_URL', ''),
  CONTENT_AI_API_KEY: optional('CONTENT_AI_API_KEY', ''),
  CONTENT_AI_MODEL: optional('CONTENT_AI_MODEL', ''),
  IMAGE_AI_BASE_URL: optional('IMAGE_AI_BASE_URL', ''),
  IMAGE_AI_API_KEY: optional('IMAGE_AI_API_KEY', ''),
  IMAGE_AI_MODEL: optional('IMAGE_AI_MODEL', ''),
  IMAGE_AI_SIZE: optional('IMAGE_AI_SIZE', '1024x1024'),
  LINKEDIN_CLIENT_ID: optional('LINKEDIN_CLIENT_ID', ''),
  LINKEDIN_CLIENT_SECRET: optional('LINKEDIN_CLIENT_SECRET', ''),
  LINKEDIN_REDIRECT_URI: optional('LINKEDIN_REDIRECT_URI', ''),
  X_CLIENT_ID: optional('X_CLIENT_ID', ''),
  X_CLIENT_SECRET: optional('X_CLIENT_SECRET', ''),
  X_REDIRECT_URI: optional('X_REDIRECT_URI', ''),
  SERVER_BASE_URL: optional('SERVER_BASE_URL', ''),
  SOCIAL_CREDENTIALS_KEY: optional('SOCIAL_CREDENTIALS_KEY', ''),
};

const isKnownPlaceholder =
  env.JWT_SECRET === 'your_jwt_secret_here' ||
  env.JWT_SECRET === 'generate_a_random_secret_that_is_at_least_32_chars_long' ||
  env.JWT_SECRET.includes('generate_a_random_secret');
if (isKnownPlaceholder || env.JWT_SECRET.length < 32) {
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
