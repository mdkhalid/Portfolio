require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const mongoose = require('mongoose');
const ApplyFlow = require('./models/ApplyFlow');

// Each fine-grained flow step carries `workerStep` — the matching key in the
// worker's STEPS array (fetch_jd / generate_resume / prepare_application /
// submit) — so the flow description lines up with the progress steps the UI
// renders. login/search belong to fetch_jd (session + job discovery), field
// detection to prepare_application, and everything on-site during the actual
// apply (upload/fill/submit/confirm) to submit.
const FLOWS = [
  {
    site: 'naukri',
    label: 'Naukri',
    steps: [
      { key: 'login', label: 'Log in (cookie then password form)', kind: 'login', order: 0, workerStep: 'fetch_jd' },
      { key: 'search', label: 'Search jobs by keyword/location', kind: 'search', order: 1, workerStep: 'fetch_jd' },
      { key: 'fetch_jd', label: 'Fetch job description', kind: 'fetch_jd', order: 2, workerStep: 'fetch_jd' },
      { key: 'detect_fields', label: 'Detect apply form fields', kind: 'detect_fields', order: 3, workerStep: 'prepare_application' },
      { key: 'upload_resume', label: 'Upload tailored resume', kind: 'upload_resume', order: 4, workerStep: 'submit' },
      { key: 'fill_fields', label: 'Fill detected fields', kind: 'fill_fields', order: 5, workerStep: 'submit' },
      { key: 'submit', label: 'Submit application', kind: 'submit', order: 6, workerStep: 'submit' },
      { key: 'confirm', label: 'Confirm "Applied" label', kind: 'confirm', order: 7, workerStep: 'submit' },
    ],
  },
  {
    site: 'indeed',
    label: 'Indeed',
    steps: [
      { key: 'login', label: 'Log in (cookie then password/SSO)', kind: 'login', order: 0, workerStep: 'fetch_jd' },
      { key: 'search', label: 'Search jobs by keyword/location', kind: 'search', order: 1, workerStep: 'fetch_jd' },
      { key: 'fetch_jd', label: 'Fetch job description', kind: 'fetch_jd', order: 2, workerStep: 'fetch_jd' },
      { key: 'detect_fields', label: 'Detect apply form fields', kind: 'detect_fields', order: 3, workerStep: 'prepare_application' },
      { key: 'apply_wizard', label: 'Walk apply wizard (Continue/Next up to 6 steps)', kind: 'fill_fields', order: 4, workerStep: 'submit' },
      { key: 'upload_resume', label: 'Upload tailored resume', kind: 'upload_resume', order: 5, workerStep: 'submit' },
      { key: 'submit', label: 'Submit application', kind: 'submit', order: 6, workerStep: 'submit' },
      { key: 'confirm', label: 'Confirm success/disabled button', kind: 'confirm', order: 7, workerStep: 'submit', branch: 'External redirect -> manual apply' },
    ],
  },
  {
    site: 'workatastartup',
    label: 'Work at a Startup',
    manualApply: true,
    manualApplyReason: 'YC applications go through the Work at a Startup profile form — apply in the browser.',
    steps: [
      { key: 'login', label: 'YC SSO two-step login (username -> password)', kind: 'login', order: 0, workerStep: 'fetch_jd' },
      { key: 'search', label: 'Search jobs with client-side keyword filter', kind: 'search', order: 1, workerStep: 'fetch_jd' },
      { key: 'fetch_jd', label: 'Fetch job description', kind: 'fetch_jd', order: 2, workerStep: 'fetch_jd' },
      { key: 'manual_apply', label: 'Manual apply only (YC single application)', kind: 'manual_apply', order: 3, workerStep: 'submit' },
    ],
  },
  {
    site: 'wellfound',
    label: 'Wellfound',
    // Wellfound's apply form has no resume upload — it uses the resume already
    // attached to the candidate's Wellfound profile. The worker reads this flag
    // (not a hardcoded site list) to skip resume generation.
    resumeFree: true,
    steps: [
      { key: 'login', label: 'Log in (cookie -> persistent profile -> password, Cloudflare)', kind: 'login', order: 0, workerStep: 'fetch_jd' },
      { key: 'search', label: 'Search jobs with rate-limit backoff', kind: 'search', order: 1, workerStep: 'fetch_jd' },
      { key: 'fetch_jd', label: 'Fetch job description', kind: 'fetch_jd', order: 2, workerStep: 'fetch_jd' },
      { key: 'apply_modal', label: 'Open apply modal', kind: 'detect_fields', order: 3, workerStep: 'prepare_application' },
      { key: 'fill_pitch', label: 'Fill note/pitch textarea', kind: 'fill_fields', order: 4, workerStep: 'submit' },
      { key: 'submit', label: 'Send application', kind: 'submit', order: 5, workerStep: 'submit' },
      { key: 'confirm', label: 'Confirm application state', kind: 'confirm', order: 6, workerStep: 'submit' },
    ],
  },
  {
    site: 'foundit',
    label: 'foundit (Monster)',
    steps: [
      { key: 'login', label: 'Log in (password form or cookie; bot-fronted)', kind: 'login', order: 0, workerStep: 'fetch_jd' },
      { key: 'search', label: 'Search jobs by keyword/location slug', kind: 'search', order: 1, workerStep: 'fetch_jd' },
      { key: 'fetch_jd', label: 'Fetch job description', kind: 'fetch_jd', order: 2, workerStep: 'fetch_jd' },
      { key: 'detect_fields', label: 'Detect apply form fields', kind: 'detect_fields', order: 3, workerStep: 'prepare_application' },
      { key: 'upload_resume', label: 'Upload tailored resume', kind: 'upload_resume', order: 4, workerStep: 'submit' },
      { key: 'fill_fields', label: 'Fill detected fields', kind: 'fill_fields', order: 5, workerStep: 'submit' },
      { key: 'submit', label: 'Submit application', kind: 'submit', order: 6, workerStep: 'submit' },
      { key: 'confirm', label: 'Confirm application state', kind: 'confirm', order: 7, workerStep: 'submit', branch: 'Bot wall / employer redirect -> manual apply' },
    ],
  },
  {
    site: 'generic',
    label: 'Custom site',
    manualApply: true,
    manualApplyReason: 'Custom sites have no auto-apply — add jobs manually and apply in the browser.',
    steps: [
      { key: 'login', label: 'Log in (cookie then password form)', kind: 'login', order: 0, workerStep: 'fetch_jd' },
      { key: 'manual_apply', label: 'Manual apply only', kind: 'manual_apply', order: 1, workerStep: 'submit' },
    ],
  },
];

const seed = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  for (const flow of FLOWS) {
    await ApplyFlow.updateOne(
      { site: flow.site },
      { $set: flow },
      { upsert: true }
    );
    console.log(`Upserted apply flow: ${flow.site}`);
  }

  await mongoose.connection.close();
  console.log('Apply flow seed complete');
};

seed().catch((err) => {
  console.error('Apply flow seed failed:', err);
  process.exit(1);
});
