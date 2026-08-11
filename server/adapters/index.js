const naukriAdapter = require('./naukri');
const indeedAdapter = require('./indeed');
const genericAdapter = require('./generic');
const workatastartupAdapter = require('./workatastartup');

const SITES = {
  naukri: naukriAdapter,
  indeed: indeedAdapter,
  workatastartup: workatastartupAdapter,
};

const SITE_META = {
  naukri: { label: 'Naukri', requiresLogin: true, homeUrl: 'https://www.naukri.com' },
  indeed: { label: 'Indeed', requiresLogin: true, homeUrl: 'https://www.indeed.com' },
  workatastartup: { label: 'Work at a Startup', requiresLogin: true, homeUrl: 'https://www.workatastartup.com' },
};

function getAdapter(name) {
  const adapter = SITES[name];
  // Custom (user-added) sites fall back to the generic adapter.
  if (!adapter) return genericAdapter;
  return adapter;
}

const list = () => Object.keys(SITES);

/** True for built-in sites that have real automation (search/fetch/submit). */
function isAutomatedSite(name) {
  return Object.prototype.hasOwnProperty.call(SITES, name);
}

/** Merge built-in metadata with a custom site's stored label/baseUrl. */
function metaFor(name, doc) {
  const builtIn = SITE_META[name];
  if (builtIn) return { ...builtIn, custom: false };
  return { label: doc?.label || name, homeUrl: doc?.baseUrl || '', custom: true };
}

module.exports = { SITES, SITE_META, getAdapter, list, isAutomatedSite, metaFor, genericAdapter };
