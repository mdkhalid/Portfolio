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

const getProviderAndKey = async () => {
  let provider = 'openai';
  try {
    const profile = await Profile.findOne();
    if (profile && profile.aiProvider) provider = profile.aiProvider;
  } catch {
    // DB unavailable — fall through to env default
  }
  if (provider === 'groq') {
    return { provider, apiKey: process.env.GROQ_API_KEY };
  }
  return { provider, apiKey: process.env.OPENAI_API_KEY };
};

async function getAIClient(purpose = 'chat') {
  const { provider, apiKey } = await getProviderAndKey();
  if (!apiKey) return { client: null, model: MODELS[provider]?.[purpose] || MODELS.openai[purpose] };

  const model = MODELS[provider]?.[purpose] || MODELS.openai[purpose];
  if (provider === 'groq') {
    return {
      client: new OpenAI({ apiKey, baseURL: GROQ_BASE_URL }),
      model,
    };
  }
  return { client: new OpenAI({ apiKey }), model };
}

module.exports = { getAIClient };
