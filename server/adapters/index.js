const naukriAdapter = require('./naukri');
const indeedAdapter = require('./indeed');
const genericAdapter = require('./generic');
const workatastartupAdapter = require('./workatastartup');
const wellfoundAdapter = require('./wellfound');
const founditAdapter = require('./foundit');

const SITES = {
  naukri: naukriAdapter,
  indeed: indeedAdapter,
  workatastartup: workatastartupAdapter,
  wellfound: wellfoundAdapter,
  foundit: founditAdapter,
};

const SITE_META = {
  naukri: {
    label: 'Naukri',
    requiresLogin: true,
    homeUrl: 'https://www.naukri.com',
    loginUrl: 'https://www.naukri.com/nlogin/login',
  },
  indeed: {
    label: 'Indeed',
    requiresLogin: true,
    homeUrl: 'https://www.indeed.com',
    loginUrl: 'https://secure.indeed.com/account/login',
  },
  workatastartup: {
    label: 'Work at a Startup',
    requiresLogin: true,
    homeUrl: 'https://www.workatastartup.com',
    // WATS has no /login route (404) — auth lives on YC's account portal and
    // redirects back to Work at a Startup on success.
    loginUrl: 'https://account.ycombinator.com/?continue=https%3A%2F%2Fwww.workatastartup.com%2F',
  },
  wellfound: {
    label: 'Wellfound',
    requiresLogin: true,
    homeUrl: 'https://wellfound.com',
    loginUrl: 'https://wellfound.com/login',
    // Cloudflare-fronted + rate-limited: interactive logins need a longer window.
    slowLogin: true,
  },
  foundit: {
    label: 'foundit (Monster)',
    requiresLogin: true,
    homeUrl: 'https://www.foundit.in',
    loginUrl: 'https://www.foundit.in/login',
    // Bot-fronted search pages: interactive logins need a longer window.
    slowLogin: true,
  },
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
