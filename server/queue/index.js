const Bull = require('bull');
const Redis = require('ioredis');
const env = require('../config/env');

const REDIS_URL = env.REDIS_URL || 'redis://127.0.0.1:6379';

/**
 * Queue infrastructure for the job automation pipeline.
 * Uses Bull backed by Redis. If Redis is unreachable we fall back to an
 * in-process queue (memory mode) so development keeps working; production
 * should always set REDIS_URL and rely on the Redis-backed queue.
 */

let _redisClient = null;
let _memoryMode = false;

const hasRedis = () =>
  new Promise((resolve) => {
    const probe = new Redis(REDIS_URL, {
      lazyConnect: true,
      connectTimeout: 2000,
      maxRetriesPerRequest: 0,
      retryStrategy: () => null,
    });
    probe
      .connect()
      .then(() => {
        probe.disconnect();
        resolve(true);
      })
      .catch(() => resolve(false));
  });

async function initQueue() {
  const redisAvailable = await hasRedis();
  if (redisAvailable) {
    try {
      const queue = new Bull('applyQueue', REDIS_URL, {
        defaultJobOptions: {
          // The process handler persists every failure itself (not_applied +
          // step error) and never rethrows, so Bull-level retries would just
          // re-run an already-handled pipeline — attempts stays 1 to reflect
          // reality. Retries go through the explicit user-facing retry route.
          attempts: 1,
          removeOnComplete: true,
          removeOnFail: false,
        },
        settings: {
          stalledInterval: 30000,
          maxStalledCount: 1,
          // AI generation / image upload jobs can legitimately run minutes;
          // a longer lock prevents false-stall reprocessing (double spends).
          lockDuration: 600000,
        },
      });
      _redisClient = queue;
      return queue;
    } catch (err) {
      console.error('[queue] Bull init failed, falling back to memory mode:', err.message);
    }
  } else {
    console.warn(
      '[queue] Redis not reachable at ' + REDIS_URL + ' — using in-memory queue (dev only, not persisted).'
    );
  }
  return initMemoryQueue();
}

function initMemoryQueue() {
  _memoryMode = true;
  const listeners = new Map();
  // Jobs added before a processor registers — buffered instead of dropped.
  const buffered = new Map();
  // Bull-style dedupe: `${name}:${jobId}` stays reserved while a job is
  // waiting/active, so a duplicate add is absorbed instead of double-run.
  const inFlight = new Set();
  const counts = { waiting: 0, active: 0, completed: 0, failed: 0 };
  let seq = 0;

  function run(job, dedupeKey) {
    setImmediate(async () => {
      counts.waiting = Math.max(0, counts.waiting - 1);
      counts.active++;
      const fn = listeners.get(job.name);
      try {
        if (fn) await fn(job);
        counts.completed++;
      } catch (err) {
        counts.failed++;
        console.error('[queue:memory] job failed:', err?.message || err);
      } finally {
        counts.active = Math.max(0, counts.active - 1);
        if (dedupeKey) inFlight.delete(dedupeKey);
      }
    });
  }

  const queue = {
    async add(name, data, opts = {}) {
      const dedupeKey = opts.jobId ? `${name}:${opts.jobId}` : null;
      if (dedupeKey && inFlight.has(dedupeKey)) {
        // Same jobId still waiting/active → dedupe like Bull does.
        return { id: opts.jobId, name, data, opts, deduped: true };
      }
      const job = {
        id: opts.jobId || String(Date.now()) + '-' + ++seq,
        name,
        data,
        opts,
        attemptsMade: 0,
        async remove() {},
      };
      counts.waiting++;
      if (dedupeKey) inFlight.add(dedupeKey);
      if (!listeners.has(name)) {
        if (!buffered.has(name)) buffered.set(name, []);
        buffered.get(name).push({ job, dedupeKey });
        return job;
      }
      run(job, dedupeKey);
      return job;
    },
    async process(name, fn) {
      listeners.set(name, fn);
      const queued = buffered.get(name) || [];
      buffered.set(name, []);
      for (const { job, dedupeKey } of queued) run(job, dedupeKey);
    },
    async on() {},
    async close() {},
    async getJobCounts() {
      return { ...counts };
    },
    async getJob() {
      return null;
    },
  };
  return queue;
}

async function getQueue() {
  if (!_redisClient) {
    _redisClient = await initQueue();
  }
  return _redisClient;
}

function isMemoryMode() {
  return _memoryMode;
}

module.exports = { getQueue, initQueue, isMemoryMode, REDIS_URL };
