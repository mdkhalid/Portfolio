const naukriAdapter = require('./naukri');
const indeedAdapter = require('./indeed');

const SITES = {
  naukri: naukriAdapter,
  indeed: indeedAdapter,
};

const SITE_META = {
  naukri: { label: 'Naukri', requiresLogin: true },
  indeed: { label: 'Indeed', requiresLogin: true },
};

function getAdapter(name) {
  const adapter = SITES[name];
  if (!adapter) throw new Error('Unsupported job site: ' + name);
  return adapter;
}

const list = () => Object.keys(SITES);

module.exports = { SITES, SITE_META, getAdapter, list };
