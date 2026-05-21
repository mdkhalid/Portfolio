const OpenAI = require('openai');
const Profile = require('../models/Profile');

const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';

const MODELS = {
  openai: {
    chat: 'gpt-4o-mini',
    ats: 'gpt-4o-mini',
  },
  groq: {
    chat: 'llama-3.3-70b-versatile',
    ats: 'llama-3.3-70b-versatile',
  },
};

let cachedClient = null;
let cachedProvider = null;

/**
 * Returns an OpenAI-compatible client and model name based on the configured provider.
 * Provider is stored in the Profile document (aiProvider field).
 * Falls back to 'openai' if no profile or provider is set.
 * Caches the client instance — re-created only when provider changes.
 */
async function getAIClient(purpose = 'chat') {
  let provider = 'openai';
  try {
    const profile = await Profile.findOne();
    if (profile && profile.aiProvider) {
      provider = profile.aiProvider;
    }
  } catch {
    // If DB isn't connected yet, default to openai
  }

  const model = MODELS[provider]?.[purpose] || MODELS.openai[purpose];

  // Return cached client if provider hasn't changed
  if (cachedClient && cachedProvider === provider) {
    return { client: cachedClient, model };
  }

  // Create new client
  let client;
  if (provider === 'groq') {
    if (!process.env.GROQ_API_KEY) return { client: null, model };
    client = new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: GROQ_BASE_URL,
    });
  } else {
    if (!process.env.OPENAI_API_KEY) return { client: null, model };
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  cachedClient = client;
  cachedProvider = provider;
  return { client, model };
}

module.exports = { getAIClient };
