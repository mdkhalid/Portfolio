const env = require('../config/env');
const connectDB = require('../config/db');
const Application = require('../models/Application');
const Job = require('../models/Job');
const { getQueue } = require('./index');

const STEPS = ['fetch_jd', 'generate_resume', 'prepare_application', 'submit'];

const STEP_LABELS = {
  fetch_jd: 'Fetching job description',
  generate_resume: 'Preparing ATS-friendly resume',
  prepare_application: 'Filling standard profile fields',
  submit: 'Submitting application',
};

async function markStep(app, key, patch) {
  const application = await Application.findById(app._id).exec();
  if (!application) return;
  let step = application.progress.steps.find((s) => s.key === key);
  if (!step) {
    step = { key, label: STEP_LABELS[key] || key, status: 'queued' };
    application.progress.steps.push(step);
  }
  const prevStatus = step.status;
  Object.assign(step, patch);
  if (patch.status === 'running') application.progress.currentStep = key;
  application.lastAction = step?.label || key;
  if (patch.status !== prevStatus) {
    const details = patch.error || (patch.status === 'done' ? '' : patch.status);
    application.timeline.push({
      event: `${step?.label || key} ${patch.status === 'done' ? '' : '(' + patch.status + ')'}`.trim(),
      details,
    });
  }
  if (patch.status === 'failed') application.status = 'not_applied';
  await application.save();
}

async function runStep(applicationId, key) {
  const app = await Application.findById(applicationId).exec();
  if (!app) throw new Error('Application not found');
  const application = { _id: app._id };
  await markStep(application, key, { status: 'running', startedAt: new Date() });

  // ── Step implementations (stubs in Phase 0) ──────────────────────────────
  switch (key) {
    case 'fetch_jd':
      await new Promise((r) => setTimeout(r, 200));
      await markStep(application, key, { status: 'done', finishedAt: new Date() });
      break;
    case 'generate_resume':
      await new Promise((r) => setTimeout(r, 200));
      await markStep(application, key, { status: 'done', finishedAt: new Date() });
      break;
    case 'prepare_application':
      await new Promise((r) => setTimeout(r, 100));
      await markStep(application, key, { status: 'done', finishedAt: new Date() });
      break;
    case 'submit':
      await new Promise((r) => setTimeout(r, 200));
      await markStep(application, key, { status: 'done', finishedAt: new Date() });
      await Application.updateOne(
        { _id: applicationId },
        { $set: { status: 'applied', appliedAt: new Date() } }
      );
      await Job.updateOne(
        { _id: app.jobId },
        { $set: { status: 'applied', applied: true, appliedAt: new Date(), appliedVia: 'system' } }
      );
      break;
    default:
      throw new Error('Unknown step: ' + key);
  }
}

async function startWorker() {
  const mongoose = require('mongoose');
  // Wait for the main server's in-flight DB connection if one exists.
  if (mongoose.connection.readyState !== 1) {
    await new Promise((resolve) => {
      if (mongoose.connection.readyState === 1) return resolve();
      const onConnected = () => resolve();
      const onErr = (err) => {
        console.error('[worker] DB connection error:', err.message);
        resolve();
      };
      mongoose.connection.once('connected', onConnected);
      mongoose.connection.once('error', onErr);
      setTimeout(onErr, 12000); // fallback timeout
    });
  }
  if (mongoose.connection.readyState !== 1) {
    await connectDB();
  }
  const queue = await getQueue();

  queue.process('apply', async (job) => {
    const { applicationId } = job.data;
    const app = await Application.findById(applicationId).exec();
    if (!app || app.status === 'canceled') return { skipped: true };

    for (const key of STEPS) {
      if (app.status === 'canceled') break;
      try {
        await runStep(applicationId, key);
      } catch (err) {
        const a = await Application.findById(applicationId).exec();
        if (a) {
          await Application.updateOne(
            { _id: applicationId },
            { $set: { status: 'not_applied', notAppliedReason: 'site_error' } }
          );
        }
        throw err;
      }
    }
    return { done: true };
  });

  console.log('[worker] applyQueue worker started');
}

if (require.main === module) {
  startWorker().catch((err) => {
    console.error('[worker] failed to start:', err);
    process.exit(1);
  });
}

module.exports = { startWorker };
