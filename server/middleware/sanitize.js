const sanitizeHtml = require('sanitize-html');
const { AppError } = require('./errorHandler');

const DEFAULT_OPTIONS = {
  allowedTags: [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'p', 'br', 'hr',
    'ul', 'ol', 'li',
    'strong', 'em', 'b', 'i', 'u', 's', 'code', 'pre', 'blockquote',
    'a', 'img',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'span', 'div',
  ],
  allowedAttributes: {
    a: ['href', 'title', 'target', 'rel'],
    img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
    code: ['class'],
    pre: ['class'],
    span: ['class'],
    div: ['class'],
    th: ['scope', 'colspan', 'rowspan'],
    td: ['colspan', 'rowspan'],
    '*': ['id'],
  },
  allowedSchemes: ['http', 'https', 'mailto', 'data'],
  allowedSchemesByTag: {
    img: ['http', 'https', 'data'],
  },
  allowProtocolRelative: false,
  transformTags: {
    a: (tagName, attribs) => {
      const href = attribs.href || '';
      if (/^javascript:/i.test(href) || /^vbscript:/i.test(href) || /^data:text\/html/i.test(href)) {
        return { tagName: 'a', attribs: {} };
      }
      return {
        tagName: 'a',
        attribs: {
          ...attribs,
          rel: 'noopener noreferrer nofollow',
          target: '_blank',
        },
      };
    },
  },
  disallowedTagsMode: 'discard',
};

const clean = (html, options = {}) => {
  if (html === undefined || html === null) return '';
  if (typeof html !== 'string') {
    throw new AppError('HTML content must be a string', 400, 'INVALID_TYPE');
  }
  return sanitizeHtml(html, { ...DEFAULT_OPTIONS, ...options });
};

const cleanPlain = (text) => {
  if (text === undefined || text === null) return '';
  if (typeof text !== 'string') {
    throw new AppError('Text content must be a string', 400, 'INVALID_TYPE');
  }
  return sanitizeHtml(text, { allowedTags: [], allowedAttributes: {} }).trim();
};

const slugify = (text) => {
  if (typeof text !== 'string') return '';
  return text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
};

module.exports = { clean, cleanPlain, slugify };
