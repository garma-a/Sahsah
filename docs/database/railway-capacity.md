# Railway starting budget and load-test plan

Researched 2026-10-23 against official Railway, Cloudflare, PostgreSQL 18 and Node.js 24 documentation. This is a budget model and proposed validation plan, **not a benchmark or a confirmed capacity estimate**. No deployments, installations, paid actions or load tests were performed.

Updated 2026-10-24: six people includes the host. All connection/fanout arithmetic below is corrected to six devices per full game. See [the conditional single-instance estimate](single-instance-capacity.md) for the requested numerical planning range.

## Scope and assumptions

The requested model has one always-running NestJS service/process and one PostgreSQL service, with 4,000 questions and images for approximately 70% of them. Images are stored and delivered through Cloudflare rather than through NestJS. Redis, a worker service, additional API replicas and a Railway-hosted Next.js frontend are outside this two-service budget. Hosting Next.js on Railway adds a third service's usage; hosting it elsewhere has its own limits/costs.

The game limit is **six people total, including the host**, confirmed by the user. The tables below model one active game per room and one device per person: six sockets per full room. A separate display, multiple tabs and reconnect overlap can add connections independently of the player count; those are not silently included in the six-device arithmetic.

## What $5 and $20 buy

Hobby includes $5/month of resource usage; Pro includes $20/month. Usage above the allowance is charged as the difference, so an ordinary monthly pre-tax bill is approximately `max(plan minimum, total resource usage)`. These are usage commitments, **not fixed CPU/RAM bundles or user-count guarantees**. Both services draw from the same allowance. [Railway plans](https://docs.railway.com/pricing/plans), [invoice treatment of included usage](https://docs.railway.com/pricing/understanding-your-bill).

Published container rates used for this model:

| Resource | Approximate monthly rate |
| --- | --- |
| Average RAM actually used | $10 per GB-month |
| Average CPU actually used | $20 per vCPU-month |
| Persistent volume storage | $0.15 per GB-month |
| Public network egress | $0.05 per GB |

These are container rates, not Railway's separate VM/sandbox rates. Monthly projections are approximate; billing uses metered usage and the actual billing period. [Railway resource pricing](https://docs.railway.com/pricing/plans).

Volumes are billed for storage used, including filesystem metadata; their configured maximum is not the billable usage. PostgreSQL data, indexes, WAL and any separately retained backup data need to be accounted for. [Railway volume billing](https://docs.railway.com/volumes/reference).

An idle process retaining RAM still incurs cost. A high configured ceiling does not itself mean that all of that RAM/CPU is consumed or charged. [Railway right-sizing guide](https://docs.railway.com/guides/right-size-cpu-memory).

### Published ceilings are not provisioned resources

The plan documentation explicitly says its large service maxima include replica multiplication. It currently lists six Hobby replicas; the public pricing page says up to five, alongside aggregate limits inconsistent with five replicas at its stated per-replica values. The public page also lists Pro replica and aggregate ceilings. Treat these as **source-specific, dashboard-unverified limits**, not as RAM or CPU assigned to this proposed single process. Verify the workspace/service limits in Railway before deployment; there is no useful capacity inference from the advertised maxima. [Plan-resource table](https://docs.railway.com/pricing/plans), [public pricing page](https://railway.com/pricing).

### Hypothetical monthly arithmetic

Let `M` be combined average GB of RAM used by NestJS and PostgreSQL, `C` their combined average vCPU use, `D` the billed persistent-volume GB, and `E` public egress GB in the month:

```text
usage ≈ 10 × M + 20 × C + 0.15 × D + 0.05 × E
Hobby bill ≈ max(5, usage)
Pro bill   ≈ max(20, usage)
```

Every row below is an invented utilization scenario to show the budget boundary, **not measured NestJS/PostgreSQL consumption and not a recommended memory limit**. It assumes both services run throughout the month.

| Hypothetical combined averages | Volume | Egress | Resource subtotal | Hobby bill | Pro bill |
| --- | --- | --- | --- | --- | --- |
| 0.375 GB RAM; 0.01 vCPU | 1 GB | 1 GB | $4.15 | $5.00 | $20.00 |
| 0.50 GB RAM; 0.02 vCPU | 1 GB | 1 GB | $5.60 | $5.60 | $20.00 |
| 0.75 GB RAM; 0.05 vCPU | 2 GB | 5 GB | $9.05 | $9.05 | $20.00 |
| 1.25 GB RAM; 0.15 vCPU | 2 GB | 20 GB | $16.80 | $16.80 | $20.00 |
| 1.50 GB RAM; 0.25 vCPU | 5 GB | 20 GB | $21.75 | $21.75 | $21.75 |

The first row does not establish that the applications can run safely in that memory. The useful conclusion is narrower: even a combined **0.5 GB of retained RAM consumes $5/month before CPU, disk or egress**, so a strict $5 total budget leaves little room. Pro's $20 allowance gives more spending room; selecting Pro alone does not make the same process faster. Taxes, backups/additional storage, external services and another frontend host are excluded.

Use the private PostgreSQL connection URL between these services in the same project environment. Railway specifically recommends private networking to avoid service-to-service egress charges; the public database URL can create unnecessary egress. [Railway networking cost control](https://docs.railway.com/pricing/cost-control), [private networking](https://docs.railway.com/networking/private-networking).

## Images change delivery cost more than question-row count

Seventy percent of 4,000 is approximately **2,800 image-bearing questions**. That is not necessarily 2,800 objects: staged reveals, answer images, thumbnails, retained originals and alternate sizes can multiply it.

Illustrative raw image storage, assuming exactly one object per image-bearing question:

| Average encoded object size | 2,800 objects |
| --- | --- |
| 300 kB | 0.84 GB |
| 1 MB | 2.8 GB |
| 3 MB | 8.4 GB |

These are decimal size calculations, not a claim about the assets' actual sizes or quality. Audio, variants, originals and metadata are additional; video is outside the current quotation scope.

For R2 Standard, Cloudflare currently includes 10 GB-month storage, one million Class A operations and ten million Class B operations per month. Beyond that, listed rates are $0.015/GB-month, $4.50/million Class A and $0.36/million Class B; R2 egress is free. Additional metered products can still charge. Therefore a small image library may fit the R2 storage free allowance, but request volume and other account usage also matter. [R2 pricing](https://developers.cloudflare.com/r2/pricing/).

The intended data path is browser → Cloudflare for image bytes; NestJS handles authorization and small metadata/URL responses. Do not return base64 images in game payloads or proxy every image through Railway. An API route that streams all images would restore Railway egress and connection work even though R2's own egress is free.

Public, cacheable assets can use an R2 custom domain. `r2.dev` is rate-limited and intended for development. [R2 public buckets](https://developers.cloudflare.com/r2/buckets/public-buckets/), [R2 caching](https://developers.cloudflare.com/cache/interaction-cloudflare-products/r2/).

Question answers and unrevealed media may require protected access. Keep originals/answer assets private and issue short-lived object access only when allowed. R2 S3 presigned URLs authorize access until expiry and can be generated without an R2 request; they use the S3 API domain and **do not work on an R2 custom domain**. A public URL that hides only its filename is not a substitute for authorization. [R2 presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/).

If protected media needs a cached custom-domain path, select an explicit edge authorization design rather than assuming S3 signatures carry over. Cloudflare documents HMAC validation before cache access; feature/plan availability must be checked. A Worker is another possible access layer, but it introduces separate request/CPU limits and potentially a separate bill. [Cloudflare cache access control](https://developers.cloudflare.com/cache/interaction-cloudflare-products/waf-snippets/), [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/).

Batch resize/blur/zoom preparation can cause CPU and RAM spikes even with a small catalog. Precompute immutable variants during controlled ingestion, limit concurrent jobs and stream uploads/downloads rather than buffering whole batches. Do not run synchronous image/audio processing on the gameplay event loop. This is an implementation recommendation; Node's documentation explains how long callbacks and worker-pool work delay other clients. [Node event-loop guidance](https://nodejs.org/en/learn/asynchronous-work/dont-block-the-event-loop).

## A room is not a database connection

Six sockets can share the API's bounded PostgreSQL pool. There is no reason to dedicate a database connection to each connected player or hold a database transaction open while they think. A proposed initial experiment is an API pool capped at five connections, adjustable after measuring pool wait; the larger conditional capacity model explores ten connections. Neither is an accepted optimum. Leave additional database capacity for administration and maintenance. PostgreSQL documents increased resource allocation when `max_connections` rises. [PostgreSQL connection settings](https://www.postgresql.org/docs/18/runtime-config-connection.html).

Store a phase deadline and durable transitions; render countdowns in clients and let the server validate deadlines. Avoid database writes or reads every second per player. Heartbeats/presence should not touch PostgreSQL per beat. Persist meaningful actions such as joining, question selection, adjudication and completion according to the final recovery rules. A single service still needs durable state for restart/reconnect correctness.

Four thousand content records alone do not establish a need for Redis, sharding or partitioning. The first design can use PostgreSQL with explicit indexes and one API process, then measure. Historical game rows and anti-repeat exposure rows grow with play rather than with catalog size; their retention and identity scope still matter. A second API replica would require coordinated room fanout/presence and deployment behavior; that is a later architecture decision, not part of this two-service model.

Useful measurement model:

```text
open sockets       ≈ rooms × connected devices per room
commands/second    ≈ rooms × state-changing commands per room per second
DB queries/second  ≈ commands/second × queries per command + startup/admin work
outgoing messages  ≈ room events/second × recipients per event + heartbeat/reconnect traffic
API memory         ≈ idle baseline + socket overhead + retained room state + buffers/jobs
```

Query count per command and bytes per socket must be measured from the implementation. Database memory includes shared buffers and concurrent query work: `work_mem` applies to individual operations, and multiple operations/sessions can use it concurrently. Do not allocate the entire budget to shared buffers or simply multiply a single per-query estimate by the connection limit. [PostgreSQL memory settings](https://www.postgresql.org/docs/18/runtime-config-resource.html).

One Node process can serve many clients through asynchronous I/O, but extra advertised vCPUs do not automatically parallelize its main JavaScript callbacks. CPU-heavy serialization, media work and slow database operations can dominate before the socket count does. [Node event-loop guidance](https://nodejs.org/en/learn/asynchronous-work/dont-block-the-event-loop).

## Proposed staged tests, not promised capacity

Use the actual deployed code and schema in a disposable test environment when testing is scheduled. For this plan, start with one state-changing room command every ten seconds and one broadcast of each event to every connected device. No chat, continuous buzzer spam or per-second broadcasts are assumed; add them if the product needs them.

| Test stage | Rooms | Maximum modeled sockets | Room commands/sec | Outgoing event deliveries/sec |
| --- | --- | --- | --- | --- |
| A | 10 | 60 | 1 | 6 |
| B | 25 | 150 | 2.5 | 15 |
| C | 50 | 300 | 5 | 30 |
| D | 100 | 600 | 10 | 60 |

These numbers describe generated demand, **not demonstrated supported demand**. Heartbeats, handshakes, retries, snapshots, content fetches and admin traffic are extra. If all guests submit answers independently, model their individual submission rate rather than retaining the room-command assumption.

For each stage: ramp connections, run at least fifteen minutes of mixed gameplay, then disconnect/reconnect a group and synchronize one command across every room. Test duplicate commands and timer boundaries. Only progress if latency, errors, memory and correctness remain within agreed limits; soak the highest passing target for at least an hour. Also test a burst of room creation and content selection, since steady-state gameplay can hide that cost.

Record CPU/RAM separately for NestJS and PostgreSQL, API RSS/heap, event-loop delay/utilization, command acknowledgment p50/p95/p99, disconnects, errors, pool wait, transaction/query latency, lock waits, bytes egressed, media latency and cost per occupied room-hour. Node provides event-loop measurements and process memory APIs; PostgreSQL exposes connection/query/wait statistics. [Node 24 performance APIs](https://nodejs.org/docs/latest-v24.x/api/perf_hooks.html), [Node 24 process APIs](https://nodejs.org/docs/latest-v24.x/api/process.html), [PostgreSQL activity/statistics](https://www.postgresql.org/docs/18/monitoring-stats.html).

Latency/error targets are product decisions still to agree; for the first experiment, a proposed server-side command acknowledgment target is p95 below 250 ms with no lost/duplicate score or credit effects. It is not an existing requirement or measured result. Client-to-server latency must be recorded separately across expected user regions.

### Egress can exhaust a small budget before compute does

Assume, purely for arithmetic, that every broadcast payload is 2,000 bytes, six devices receive it, and a room broadcasts once per ten seconds:

```text
one occupied room-hour ≈ 6 × 0.1 × 2,000 × 3,600 = 4.32 MB outbound
100 rooms continuously for 30 days ≈ 311.04 GB ≈ $15.55 Railway egress
```

That excludes protocol overhead and all other traffic. Ten percent of those occupied room-hours would give approximately $1.56 for this payload component. Peak concurrent rooms and average occupancy through the month are different inputs. Use measured payloads/duty cycles; shrinking state deltas and serving images directly from Cloudflare can matter more than the catalog's 4,000-row size.

## Decision supported by this research

Keep the initial topology to one API and one PostgreSQL service, with direct Cloudflare media delivery, a bounded DB pool and no per-second DB countdown work. Treat **10 → 25 → 50 → 100 rooms as test stages**. A strict $5 total is constrained by idle memory alone; $20 provides a more useful initial spending envelope, while Hobby can also spend above $5. Neither amount establishes a defensible maximum room count until the implementation is measured.

Set budget alerts and review measured costs before choosing a hard spending cutoff: Railway notes that low resource limits can crash services and usage limits can stop workloads. This is an availability/budget choice, not a capacity optimization. [Railway cost control](https://docs.railway.com/pricing/cost-control).

Railway's current right-sizing guide states that the minimum hard limit is $10. Do not assume selecting Hobby creates a guaranteed $5 maximum invoice or that a $5 hard cutoff can be configured. [Railway right-sizing guide](https://docs.railway.com/guides/right-size-cpu-memory).
