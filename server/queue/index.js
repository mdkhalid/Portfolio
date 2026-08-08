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
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: true,
          removeOnFail: false,
        },
        settings: {
          stalledInterval: 30000,
          maxStalledCount: 1,
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
  const queue = {
    async add(name, data, opts = {}) {
      const job = {
        id: String(Date.now()) + Math.random().toString(36).slice(2, 8),
        name,
        data,
        opts,
        attemptsMade: 0,
        async remove() {},
      };
      // Simulate processing synchronously in the background.
      setImmediate(() => {
        const fn = listeners.get(name);
        if (fn) {
          Promise.resolve(fn(job))
            .catch((err) => console.error('[queue:memory] job failed:', err.message));
        }
      });
      return job;
    },
    async process(name, fn) {
      listeners.set(name, fn);
    },
    async on() {},
    async close() {},
    async getJobCounts() {
      return { waiting: 0, active: 0, completed: 0, failed: 0 };
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
