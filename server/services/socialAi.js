/**
 * AI generation for the Social Publisher.
 * Prompt builders run first (deterministic, free), then OpenAI-compatible
 * providers (zenmux / aihub / any /v1-style endpoint) generate the content
 * and the image through separate dedicated keys.
 */

const CONTENT_TIMEOUT_MS = 90_000;
const IMAGE_TIMEOUT_MS = 180_000;

/** Normalize a provider base URL: trim trailing slashes. */
function normalizeBase(baseUrl) {
  return String(baseUrl || '').trim().replace(/\/+$/, '');
}

async function fetchJson(url, options = {}, timeoutMs = 60_000) {
  let res;
  try {
    res = await fetch(url, { ...options, signal: AbortSignal.timeout(timeoutMs) });
  } catch (err) {
    if (err?.name === 'TimeoutError') {
      throw Object.assign(new Error(`Provider timed out after ${timeoutMs / 1000}s`), { expose: true });
    }
    throw Object.assign(new Error('Could not reach the AI provider'), { cause: err, expose: true });
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = data?.error?.message || data?.message || data?.error || `HTTP ${res.status}`;
    throw Object.assign(new Error(String(detail).slice(0, 300)), {
      response: { status: res.status, data },
      expose: true,
    });
  }
  return data;
}

/* ── Prompt builders ──────────────────────────────────────────────────────── */

function buildContentPrompt(topicNotes) {
  const notes = String(topicNotes).slice(0, 4000);
  return [
    'You are an expert LinkedIn ghostwriter for a senior software architect.',
    'Turn the raw topic notes below into ONE polished LinkedIn post.',
    '',
    'STRICT OUTPUT FORMAT — return only valid JSON, no markdown fences:',
    '{"title":string,"hook":string,"body":string,"hashtags":string[],"xMessage":string}',
    '',
    'RULES:',
    '- title: max 80 chars, plain summary used in lists.',
    '- hook: first 1-2 lines that stop the scroll; no hashtags; max 200 chars.',
    '- body: 900-1800 chars max. Short paragraphs, single-line breaks for rhythm.',
    '  Concrete insight > generic advice. End with one engaging question.',
    '- hashtags: exactly 4, each starting with #, camelCase or PascalCase.',
    '- xMessage: teaser under 220 chars + "Full breakdown on LinkedIn 👇" style CTA.',
    '  No link inside xMessage (the app appends it).',
    '- Professional but human voice; light emoji use (0-3 total); no clickbait lies.',
    '',
    'TOPIC NOTES FROM THE AUTHOR:',
    notes,
  ].join('\n');
}

function buildImagePrompt(topicNotes) {
  const notes = String(topicNotes).slice(0, 600);
  return [
    'Modern flat vector illustration representing this technology concept:',
    notes,
    'Style: clean minimal tech aesthetic, deep navy background with electric blue',
    'and teal gradient accents, subtle circuit/network motifs, soft glow, balanced',
    'composition with clear focal subject, generous negative space, premium and',
    'professional feel suitable for a social media post.',
    'Absolutely NO text, NO letters, NO words, NO watermarks, NO logos in the image.',
  ].join(' ');
}

/* ── Provider calls ───────────────────────────────────────────────────────── */

/** Call {baseUrl}/chat/completions and return the assistant text. */
async function chatCompletion(cfg, messages) {
  const url = `${normalizeBase(cfg.baseUrl)}/chat/completions`;
  const data = await fetchJson(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      messages,
      temperature: 0.8,
      max_tokens: 1600,
    }),
  }, CONTENT_TIMEOUT_MS);

  const text = data?.choices?.[0]?.message?.content;
  if (!text || typeof text !== 'string') {
    throw new Error('AI returned an empty response');
  }
  return text;
}

/** Parse the model's JSON answer defensively (handles code fences/prose). */
function parseContentJson(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) throw new Error('AI output was not valid JSON');
  let parsed;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new Error('AI output was not valid JSON');
  }

  const title = String(parsed.title || '').trim();
  const hook = String(parsed.hook || '').trim();
  const body = String(parsed.body || '').trim();
  const xMessage = String(parsed.xMessage || '').trim().slice(0, 260);
  const hashtags = Array.isArray(parsed.hashtags)
    ? parsed.hashtags.map((h) => String(h).trim()).filter(Boolean).slice(0, 6)
    : [];

  if (!hook || !body) throw new Error('AI response missing post body');
  const fullText = [hook, '', body].join('\n').slice(0, 3000);

  return { title: title.slice(0, 300), hook: hook.slice(0, 500), body: body.slice(0, 3000), hashtags, fullText, xMessage };
}

/** Generate the LinkedIn post content. Returns normalized fields. */
async function generateContent(cfg, contentPrompt) {
  const text = await chatCompletion(cfg, [{ role: 'user', content: contentPrompt }]);
  return parseContentJson(text);
}

/**
 * Generate the image via an OpenAI-compatible images endpoint.
 * Handles both b64_json and hosted-url responses. Returns { buffer, ext }.
 */
async function generateImage(cfg, imagePrompt) {
  const url = `${normalizeBase(cfg.baseUrl)}/images/generations`;
  const data = await fetchJson(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model: cfg.model,
      prompt: imagePrompt,
      n: 1,
      size: cfg.size || '1024x1024',
    }),
  }, IMAGE_TIMEOUT_MS);

  const item = data?.data?.[0];
  if (!item) throw new Error('Image provider returned no image');

  if (item.b64_json) {
    return { buffer: Buffer.from(item.b64_json, 'base64'), ext: '.png' };
  }
  if (item.url) {
    try {
      const imgRes = await fetch(item.url, { signal: AbortSignal.timeout(60_000) });
      if (!imgRes.ok) throw new Error(`image download failed (${imgRes.status})`);
      const type = (imgRes.headers.get('content-type') || 'image/png').toLowerCase();
      const ext = type.includes('jpeg') ? '.jpg' : type.includes('webp') ? '.webp' : '.png';
      const buf = Buffer.from(await imgRes.arrayBuffer());
      if (!buf.length) throw new Error('image download was empty');
      return { buffer: buf, ext };
    } catch (err) {
      throw new Error(`Generated image URL could not be downloaded: ${err.message}`);
    }
  }
  throw new Error('Image provider returned neither b64_json nor url');
}

/** Validate env config; returns per-provider cfg or throws a friendly error. */
function requireConfig(kind) {
  const prefix = kind === 'content' ? 'CONTENT_AI' : 'IMAGE_AI';
  const baseUrl = process.env[`${prefix}_BASE_URL`];
  const apiKey = process.env[`${prefix}_API_KEY`];
  const model = process.env[`${prefix}_MODEL`];
  if (!baseUrl || !apiKey || !model) {
    const err = new Error(
      `${kind === 'content' ? 'Content' : 'Image'} AI is not configured. Fill ${prefix}_BASE_URL, ${prefix}_API_KEY and ${prefix}_MODEL in the server .env.`
    );
    err.expose = true;
    throw err;
  }
  return {
    baseUrl,
    apiKey,
    model,
    ...(kind === 'image' ? { size: process.env.IMAGE_AI_SIZE || '1024x1024' } : {}),
  };
}

module.exports = {
  buildContentPrompt,
  buildImagePrompt,
  generateContent,
  generateImage,
  requireConfig,
};
