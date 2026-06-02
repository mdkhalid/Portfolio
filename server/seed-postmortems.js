require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const mongoose = require('mongoose');
const Postmortem = require('./models/Postmortem');

const POSTMORTEMS = [
  {
    title: 'Cache Stampede During Peak Traffic Took Down Checkout for 14 Minutes',
    slug: 'cache-stampede-checkout-outage',
    excerpt: 'A 30-day TTL on a single Redis key expired during a 50K req/sec traffic spike, sending 12,000 concurrent requests to the primary database and freezing checkout for 14 minutes.',
    severity: 'SEV1',
    status: 'resolved',
    incidentDate: new Date('2023-11-24T14:02:00Z'),
    resolvedDate: new Date('2023-11-24T14:16:00Z'),
    durationMinutes: 14,
    systemsAffected: ['Checkout API', 'Redis Cache', 'Primary Database', 'Order Pipeline'],
    customerImpact: 'Approximately 18% of checkout attempts during the 14-minute window returned a 503. Estimated 2,400 abandoned carts. No financial loss; no double-charges.',
    detectionSource: 'synthetic',
    rootCause: 'A single Redis key holding a "featured products" list used a 30-day TTL with no jitter and no negative caching. When the key expired, every checkout-flow request for the next 60 seconds attempted to rebuild it from the database. The rebuild was non-atomic and took ~1.8s. Under normal load this is fine. Under a 50K req/sec spike from a flash sale, 12,000 concurrent rebuilds stacked and saturated the database connection pool, cascading into checkout timeouts.',
    contributingFactors: [
      'Cache TTL had no jitter — all keys on the same node expired in the same wall-clock second',
      'Database connection pool was sized for 5x average load, not 50x peak',
      'Synthetic monitor only checked the homepage, not the checkout hot path',
      'No circuit breaker between checkout and the product-reads cache',
    ],
    whatWentWell: [
      'Synthetic monitor on the homepage fired within 22 seconds, paging the primary on-call',
      'Database stayed up — it was the connection pool, not the queries, that saturated',
      'Rollback to last-known-good cache state took 90 seconds',
      'Customer support had a status page update within 5 minutes of the page',
    ],
    whatDidntGoWell: [
      'Runbook for "checkout slow" assumed database problem, not cache problem — initial response went to the wrong team',
      'Synthetic monitor coverage missed the checkout flow entirely',
      'No dashboard tile showed cache hit-rate in real time',
      'We learned about the second affected cache key (settings blob) only after the first incident',
    ],
    actionItems: [
      { action: 'Add 60-120s TTL jitter to all product-cache keys', owner: 'Platform', status: 'done', priority: 'P0' },
      { action: 'Wrap cache rebuilds in a single-flight lock (per-key mutex)', owner: 'Platform', status: 'done', priority: 'P0' },
      { action: 'Add synthetic monitor for checkout happy path with 5s SLO', owner: 'SRE', status: 'done', priority: 'P1' },
      { action: 'Increase database connection pool ceiling and add pool-saturation alert', owner: 'Platform', status: 'done', priority: 'P1' },
      { action: 'Add Grafana tile for cache hit-rate by key prefix', owner: 'SRE', status: 'in_progress', priority: 'P2' },
      { action: 'Document "cache stampede" runbook with diagnostic steps', owner: 'Platform', status: 'todo', priority: 'P2' },
    ],
    timeline: [
      { time: '14:02 UTC', label: 'Featured-products cache key expires. TTL had no jitter.' },
      { time: '14:02:18', label: 'Synthetic monitor on homepage fails 3 consecutive checks. Page fired to on-call.' },
      { time: '14:03:40', label: 'On-call paged. Initial assumption: database regression. Wrong team engaged first.' },
      { time: '14:05:12', label: 'Database connection pool at 100% saturation. Queries are fine; pool is exhausted.' },
      { time: '14:08:30', label: 'Root cause identified: concurrent cache rebuilds stacking. Rebuilt key under mutex; 4 instances were already racing.' },
      { time: '14:14:50', label: 'Patched all 7 product-cache keys with mutex-protected rebuild. Rolled out via feature flag in 90s.' },
      { time: '14:16:00', label: 'Checkout p99 returned to baseline. Status page updated to monitoring.' },
    ],
    content: `# Cache Stampede During Peak Traffic Took Down Checkout for 14 Minutes

## Summary

A single Redis cache key with a 30-day TTL expired during a flash-sale traffic spike. Without jitter or a single-flight rebuild guard, ~12,000 concurrent requests hit the primary database at the same moment, saturating the connection pool. Checkout returned 503s for 14 minutes. No data loss, no double-charges, but 2,400 abandoned carts.

## Impact

| Dimension | Value |
| --- | --- |
| User-visible duration | 14 minutes |
| Failed checkout rate | ~18% during window |
| Affected revenue (estimate) | ~$48,000 in abandoned carts |
| Customer support tickets | 312 in the 4 hours following |
| Data integrity issues | None |

## Root cause

A long-TTL Redis key (\`featured_products_v2\`) had been stable for 28 days. When it expired, every checkout-flow request for the next minute attempted to rebuild it. The rebuild logic was non-atomic and took ~1.8 seconds. Under a 50K req/sec peak, this stacked.

\`\`\`mermaid
sequenceDiagram
    participant U as User Request
    participant C as Checkout API
    participant R as Redis
    participant DB as Primary DB

    Note over R: featured_products_v2 expires
    U->>C: GET /checkout/items
    C->>R: GET featured_products_v2
    R-->>C: (null)
    par 12,000 concurrent rebuilds
        C->>DB: SELECT * FROM products WHERE featured=1
    end
    DB--xC: Connection pool exhausted
    C-->>U: 503 Service Unavailable
\`\`\`

## What we changed

1. **TTL jitter**: every cache key now has its TTL randomized by 60-120 seconds, so a fleet-wide expiry is impossible.
2. **Single-flight rebuild**: each key gets a per-key mutex. The first request to miss the cache rebuilds; the rest wait. Implemented in C# with a distributed lock backed by Redis \`SETNX\`.
3. **Negative caching**: misses are cached for 5 seconds with a "null" marker, so a thundering herd does not even reach the database.

\`\`\`csharp
public async Task<List<Product>> GetFeaturedAsync()
{
    var key = "featured_products_v2";
    var cached = await _redis.GetAsync<List<Product>>(key);
    if (cached != null) return cached;

    // Single-flight: only one rebuild across the fleet
    var lockKey = "lock:" + key;
    if (!await _redis.SetNXAsync(lockKey, "1", TimeSpan.FromSeconds(5)))
    {
        await Task.Delay(200);
        return await _redis.GetAsync<List<Product>>(key) ?? new();
    }

    try
    {
        var fresh = await _db.Products.Where(p => p.Featured).ToListAsync();
        await _redis.SetAsync(key, fresh, TimeSpan.FromDays(30).Add(
            TimeSpan.FromSeconds(Random.Shared.Next(60, 120))));
        return fresh;
    }
    finally
    {
        await _redis.DeleteAsync(lockKey);
    }
}
\`\`\`

## Lessons

The painful lesson was not "we needed a mutex." The painful lesson was that **our monitoring was aimed at the wrong layer.** We had beautiful database dashboards. We had no cache hit-rate tile. We had a synthetic monitor on the homepage but not on checkout. We had a runbook for "checkout slow" that pointed at the database, so the first 6 minutes of the response went to the wrong team.

A cache stampede is a coordination problem between cache and origin. Treating it as a database problem is a category error that costs you minutes you do not have.

## What we would do differently today

- **Treat cache as a tiered system, not a single layer.** Per-key TTLs, per-key hit-rate dashboards, per-key alert thresholds.
- **Single-flight everywhere a cache miss is expensive.** The pattern is short enough to be a default, not a special case.
- **Test the failure mode.** We have a chaos test now that force-expires a random cache key at peak load and asserts checkout p99 stays under 500ms. It has caught two regressions since.`,
    tags: ['Cache', 'Redis', 'Performance', 'Postmortem', 'SEV1'],
    published: true,
  },

  {
    title: 'Timezone Bug Billed Customers Twice at Month Boundaries',
    slug: 'timezone-bug-double-billing',
    excerpt: 'A naive DateTime stored in the local server timezone caused 1,847 customers to be billed twice or skipped entirely at month boundaries. The bug shipped to production 6 months earlier and nobody noticed until the first leap-month hit.',
    severity: 'SEV2',
    status: 'resolved',
    incidentDate: new Date('2024-02-29T09:14:00Z'),
    resolvedDate: new Date('2024-03-02T17:30:00Z'),
    durationMinutes: 4526,
    systemsAffected: ['Billing Service', 'Subscription Scheduler', 'Customer Portal'],
    customerImpact: '1,847 customers billed twice (total $94,200 overcharged). 612 customers skipped (next cycle charged early). All refunds processed within 5 business days. No chargebacks.',
    detectionSource: 'customer_report',
    rootCause: 'The subscription scheduler was written in 2018 and stored \`nextBillingDate\` as a \`DateTime\` (no kind, no offset) in SQL Server. The scheduler compared it against \`DateTime.Now\` which the server, hosted in UTC, returned in UTC. The comparison "is it time to bill?" worked correctly for most of the month. At the boundary — between 18:30 IST and 00:30 IST on the first of the month — the local-time-stored value and the UTC comparison diverged by 5h30m. Customers in IST between those hours got billed at the wrong time, leading to double billing on the next cycle (because the "skip if already billed" check used a 24-hour window that did not align) or skipping the next cycle entirely.',
    contributingFactors: [
      'DateTime stored without timezone kind — the original developer assumed the server timezone was always IST',
      'No integration test for boundary conditions (00:00, 23:59, month rollover, leap day)',
      'Server migration 6 months prior moved the app to UTC, but data was not migrated',
      'Customer support escalation only happened after a Twitter thread went viral in the support team',
    ],
    whatWentWell: [
      'Refunds were processed in a single batch script in under 2 hours once the bug was found',
      'Engineering wrote a deterministic replay test from production logs',
      'The financial controller signed off on the refund approach in under 4 hours — pre-existing playbook paid off',
    ],
    whatDidntGoWell: [
      'The bug existed in production for 6 months. Detection relied on customer complaints.',
      'The original developer was unreachable — context lived only in their head',
      'No "billing anomaly" alert existed',
      'We found 3 more timezone-related bugs in adjacent code paths after this one was fixed',
    ],
    actionItems: [
      { action: 'Migrate all DateTime columns to DateTimeOffset (UTC) in billing schema', owner: 'Platform', status: 'done', priority: 'P0' },
      { action: 'Audit every DateTime usage in the codebase for missing kind/offset', owner: 'Platform', status: 'done', priority: 'P0' },
      { action: 'Add billing-anomaly alert: variance > 3 std-dev from daily revenue baseline', owner: 'SRE', status: 'done', priority: 'P1' },
      { action: 'Add boundary-condition test suite (00:00, 23:59, leap day, DST)', owner: 'QA', status: 'in_progress', priority: 'P1' },
      { action: 'Document "always use UTC, render local" as a non-negotiable in the engineering handbook', owner: 'Architect', status: 'done', priority: 'P1' },
      { action: 'Quarterly audit: random sample 50 production records and verify timezone integrity', owner: 'Platform', status: 'todo', priority: 'P2' },
    ],
    timeline: [
      { time: '09:14 UTC, Feb 29', label: 'First customer tweet about a duplicate charge. Support escalates to engineering.' },
      { time: '11:40 UTC, Feb 29', label: 'Engineering finds 1,847 duplicate charges in the previous 18 hours.' },
      { time: '13:25 UTC, Feb 29', label: 'Hypothesized race condition in the scheduler. Wrong.' },
      { time: '15:50 UTC, Feb 29', label: 'Hypothesized duplicate webhook from payment provider. Wrong.' },
      { time: '17:30 UTC, Feb 29', label: 'Senior engineer looks at the actual data. Notices stored DateTime has no offset. Server is in UTC. Customer is in IST. The arithmetic does not match.' },
      { time: 'Next day', label: 'Decision made: freeze billing, fix code, replay from yesterday.' },
      { time: 'Mar 1, 17:00 UTC', label: 'Fix deployed. All customers billed correctly. Refund script run. 1,847 refunds processed.' },
      { time: 'Mar 2, 17:30 UTC', label: 'Postmortem circulated. Action items assigned.' },
    ],
    content: `# Timezone Bug Billed Customers Twice at Month Boundaries

## Summary

A \`DateTime\` column with no timezone kind, written in 2018, survived a server migration in 2024 and began causing duplicate and skipped billings at month boundaries. The bug existed for 6 months in production. It was finally caught when a customer posted a thread on X (formerly Twitter) and a support agent saw it.

## Why it took 6 months to detect

The bug was deterministic but rare. For most of any given month, the comparison "is it time to bill?" worked fine because the customer's billing time (e.g. "the 15th of each month at 10:00") was far enough from midnight that a 5h30m drift did not matter. The window where it mattered was the few hours straddling 00:00 IST on the first of the month. And the first time the scheduler ran on a freshly migrated UTC server, the customers hit were a small fraction — most were billed correctly by the time anyone noticed.

\`\`\`mermaid
flowchart LR
    A[Scheduler: 'is it time?'] --> B{DateTime.Now vs nextBillingDate}
    B -- "10:00 UTC == 15:30 IST" --> C[Skip, not yet]
    B -- "18:30 UTC == 00:00 IST next day" --> D[Bill now]
    B -- "23:30 UTC == 05:00 IST same day" --> E[BUG: wrong comparison]
    E --> F[Bill the wrong day]
    F --> G[Next cycle sees 'recently billed' flag]
    G --> H[Skip this cycle - customer never charged]
    style E fill:#ef444420,stroke:#ef4444
    style F fill:#ef444420,stroke:#ef4444
    style H fill:#ef444420,stroke:#ef4444
\`\`\`

## The fix in one line

\`\`\`csharp
// Before
DateTime nextBillingDate; // ambiguous, server-time

// After
DateTimeOffset nextBillingDate; // always UTC, render local in UI
\`\`\`

The actual change touched 14 files. The principle change was one sentence in the engineering handbook:

> **All datetimes in the system are stored in UTC. Conversion to local happens only at the presentation layer, never in business logic.**

## The unsatisfying part

This was not a clever bug. It was a boring, mechanical mistake that lived in code for 6 years across two companies' worth of developers. The original developer had moved on. The migration engineer did not touch business logic. The reviewer of the migration said "looks fine, just config changes." Nobody wrote a test for "what happens at 00:00 IST."

The lesson is not "always use UTC." Most people already know that. The lesson is **timezones are the kind of correctness property you cannot trust human review to catch.** They demand either a static rule enforced by tooling, or a property-based test that generates thousands of boundary cases.

## What we did about it

- Migrated the schema. \`DateTimeOffset(7)\` everywhere in billing. A lint rule fails the build if a \`DateTime\` is used in a billing-related file.
- Wrote a property-based test that generates random customer creation times in 200 timezones and verifies that "bill on the 15th" always bills on the 15th in the customer's local time, regardless of when the scheduler runs.
- Added an alert: "daily revenue is more than 3 standard deviations from the rolling 30-day mean" — would have caught this in week 1.

## What we would still do if we had time

- A "chaos" job that replays historical billing logs through the current code nightly. If the new run produces different results, the test fails. This is the only way to catch "the code is correct today but was wrong yesterday and we never noticed."`,
    tags: ['Timezone', 'Billing', 'Data Integrity', 'Postmortem', 'SEV2'],
    published: true,
  },

  {
    title: 'Silent Consumer Crash Stalled Order Pipeline for 3 Hours',
    slug: 'silent-consumer-crash-orders-stalled',
    excerpt: 'A RabbitMQ consumer crashed on an unhandled exception type, the framework silently disabled the channel, and orders queued in the dead-letter queue for 3 hours before DLQ depth triggered an alert.',
    severity: 'SEV1',
    status: 'resolved',
    incidentDate: new Date('2024-06-12T22:41:00Z'),
    resolvedDate: new Date('2024-06-13T01:47:00Z'),
    durationMinutes: 186,
    systemsAffected: ['Order Pipeline', 'Inventory Service', 'Notification Service'],
    customerImpact: '14,200 orders stuck in "pending" for 3 hours. Customers saw successful checkouts but no order confirmations. 2,100 customers sent support emails. Full backlog drained within 90 minutes of fix.',
    detectionSource: 'internal_monitoring',
    rootCause: 'A new release of the order-fulfillment consumer added a JSON deserializer for a third-party payload. The deserializer threw a \`JsonReaderException\` (subclass of \`JsonException\`) on a malformed response. The consumer caught the base \`Exception\` class but the deserializer library had a new internal exception type that the catch block did not handle correctly. The .NET runtime terminated the message handler but the channel itself remained "open" from the broker\'s perspective. Subsequent messages were acked automatically as if processed successfully. They were not. They went to the DLQ.',
    contributingFactors: [
      'Catch block was too broad (caught \`Exception\`) but too narrow in practice (a library threw a custom exception that bypassed the retry policy)',
      'No consumer health check — the framework reported "consumer is alive" even though it was not processing',
      'DLQ depth alert had a 60-minute window to suppress noise; the actual stall took 2h45m to surface',
      'The library that changed was a transitive dependency upgraded by another team the week before',
    ],
    whatWentWell: [
      'DLQ depth alert finally fired, paging the on-call',
      'Replay tooling for the DLQ existed and was tested — drained 14,200 messages in 80 minutes',
      'Customer-facing status page was updated within 4 minutes of page',
      'No partial state — orders were either fully processed or never touched, so the replay was safe',
    ],
    whatDidntGoWell: [
      '3 hours of customer-facing impact is too long for a "silent" failure',
      'Catch block was a code smell the team knew about and never refactored',
      'A transitive dependency upgrade was not flagged to the order-pipeline team',
      'The "DLQ depth" alert was tuned too loose to suppress other noise',
    ],
    actionItems: [
      { action: 'Replace all \`catch (Exception)\` blocks in consumers with explicit exception type handlers', owner: 'Platform', status: 'done', priority: 'P0' },
      { action: 'Add consumer health check: process N messages in M minutes or page', owner: 'SRE', status: 'done', priority: 'P0' },
      { action: 'Pin transitive dependency versions in the package lock, review upgrades weekly', owner: 'Platform', status: 'done', priority: 'P1' },
      { action: 'Tighten DLQ depth alert: 10-message threshold with 5-minute sustained window', owner: 'SRE', status: 'done', priority: 'P1' },
      { action: 'Add end-to-end test: "malformed payload must not silently ack"', owner: 'QA', status: 'in_progress', priority: 'P1' },
      { action: 'Document "consumer health" pattern in the engineering handbook', owner: 'Architect', status: 'todo', priority: 'P2' },
    ],
    timeline: [
      { time: '22:41 UTC', label: 'New release deployed. Order-fulfillment consumer starts. First malformed payload arrives 3 minutes later.' },
      { time: '22:44 UTC', label: 'Consumer crashes internally. Channel appears open. Messages start acking without processing.' },
      { time: '23:15 UTC', label: 'DLQ depth crosses 1,000. Alert does not fire (60-min window).' },
      { time: '00:15 UTC, Jun 13', label: 'DLQ depth crosses 10,000. Sustained 60-min alert fires. Paging on-call.' },
      { time: '00:18 UTC', label: 'On-call confirms: consumer process is running, but DLQ is filling. Consumer is silently broken.' },
      { time: '00:32 UTC', label: 'Consumer restarted with new logging. Root cause identified in 14 minutes.' },
      { time: '00:55 UTC', label: 'Patch deployed. Consumer resumes processing. DLQ replay tool started in background.' },
      { time: '01:47 UTC', label: 'DLQ drained. All 14,200 stuck orders processed. Status page resolved.' },
    ],
    content: `# Silent Consumer Crash Stalled Order Pipeline for 3 Hours

## Summary

A malformed payload triggered an unhandled exception in an order-fulfillment consumer. The .NET runtime terminated the message handler, but the RabbitMQ channel remained "open" from the broker's perspective. New messages were acked without being processed. The dead-letter queue (DLQ) filled up for 3 hours before an alert fired. 14,200 orders were stuck in "pending" state.

## The failure mode

\`\`\`mermaid
sequenceDiagram
    participant B as RabbitMQ
    participant C as Order Consumer
    participant DLQ as Dead-Letter Queue
    participant Alert as DLQ Depth Alert

    B->>C: order.created
    C->>C: JSON.parse(payload)
    C--xC: JsonReaderException (uncaught)
    Note over C: Channel "alive", handler dead
    B->>C: order.created
    C-->>B: ack (nothing happened)
    B->>C: order.created
    C-->>B: ack (nothing happened)
    Note over DLQ: Fills silently
    DLQ->>Alert: depth > 10,000
    Alert->>OnCall: PAGE
\`\`\`

The consumer's "catch (Exception)" block was meant to be a safety net, but the deserializer library had a custom exception type that the catch was misclassifying. From the broker's perspective, the messages were being acked. From the application's perspective, the consumer was running. From the customer's perspective, the order had disappeared.

## Why detection took 3 hours

Three issues compounded:

1. **The alert was tuned loose.** A 60-minute sustained window was added to suppress noise from a noisy third party. It suppressed this incident for the first hour.
2. **No consumer health check existed.** The right primitive is: "this consumer has processed N messages in the last M minutes. If zero, page." We had nothing.
3. **The right signal existed but was missed.** Application logs showed the exception was thrown. The catch block ran. The handler returned. Nobody grep'd the logs.

## The fix

The actual code fix is small. Replace the broad catch with explicit handlers, and have the catch re-throw on truly unexpected exceptions so the framework can nack the message:

\`\`\`csharp
// Before
try
{
    var payload = JsonSerializer.Deserialize<OrderPayload>(message.Body);
    await _handler.HandleAsync(payload);
}
catch (Exception ex)
{
    _logger.LogWarning(ex, "Order processing failed");
    // silently ack — message gone forever
}

// After
try
{
    var payload = JsonSerializer.Deserialize<OrderPayload>(message.Body);
    await _handler.HandleAsync(payload);
}
catch (JsonException ex)
{
    // Malformed payload — bad data, not our fault
    _logger.LogError(ex, "Malformed order payload");
    await _channel.BasicNackAsync(deliveryTag, multiple: false, requeue: false);
    // → goes to DLQ where it belongs
}
catch (HttpRequestException ex)
{
    // Downstream service issue — retry with backoff
    _metrics.Increment("order.handler.http_retry");
    await Task.Delay(_retryPolicy.NextDelay());
    throw; // nack + requeue
}
\`\`\`

The bigger change is cultural: **a consumer that silently acks a message it did not process is worse than a consumer that crashes.** Crashes are visible. Silence is not.

## What we did about it

- Audited every consumer in the system. Found 4 more with the "broad catch + silent ack" pattern. Fixed all of them.
- Added a "consumer liveness" SLO: each consumer must process at least 1 message per 5 minutes during peak hours, or page. False positives are an acceptable cost compared to a 3-hour silent stall.
- Pinned the transitive dependency that caused the exception. The team that owns the package now notifies downstream consumers on every minor version bump.

## Lessons

1. **Silent failures are the most expensive kind.** Loud failures wake people up. Silent failures erode trust without anyone noticing until a customer complains.
2. **Health checks are about flow, not liveness.** "The process is running" is not the same as "the process is doing its job." Measure the work, not the heartbeat.
3. **Catch blocks are a place to be explicit, not defensive.** Catching \`Exception\` and "log and move on" is almost always wrong. Either you know what to do, or you should not catch it.

The most senior lesson: a code path that "always works in practice" is a code path that "will fail catastrophically the one time nobody is watching." Add the watcher.`,
    tags: ['RabbitMQ', 'Message Queue', 'Observability', 'Postmortem', 'SEV1'],
    published: true,
  },
];

const seed = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  let inserted = 0, updated = 0;
  for (const pm of POSTMORTEMS) {
    const result = await Postmortem.findOneAndUpdate(
      { slug: pm.slug },
      { $set: pm },
      { upsert: true, new: true, returnDocument: 'after', setDefaultsOnInsert: true }
    );
    if (result.createdAt.getTime() === result.updatedAt.getTime()) inserted++;
    else updated++;
    console.log(`  ${result.severity.padEnd(4)} | ${result.title}`);
  }

  console.log('');
  console.log(`Seeded ${POSTMORTEMS.length} postmortems (${inserted} inserted, ${updated} updated).`);

  const counts = await Postmortem.aggregate([
    { $group: { _id: '$severity', n: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);
  console.log('By severity:', counts.map(c => `${c._id}=${c.n}`).join(' '));

  await mongoose.disconnect();
  process.exit(0);
};

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
