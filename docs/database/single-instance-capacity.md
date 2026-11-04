# Estimated capacity of one Sahsah API and one database

Date: 2026-10-24. Research uses official Railway, Socket.IO, Node.js and PostgreSQL documentation. This is an engineering estimate with explicit sensitivity assumptions, not a benchmark of Sahsah. No services were deployed and no load tests were run.

## Working estimate

For one reasonably implemented NestJS process and one writable PostgreSQL instance, **plan around 100 concurrent full rooms initially, with 100–250 rooms as a conditional working range**: 600–1,500 simultaneously connected people. **500 rooms / 3,000 people is a stretch case for quieter traffic and efficient commands**, not the initial capacity promise.

The estimate assumes approximately one usable API vCPU, up to 1 GiB API memory, a separate database allowed approximately one vCPU and 0.5–1 GiB memory, small indexed transactions, six people per room including the host, and direct Cloudflare image delivery. These are proposed sizing envelopes, **not resources purchased by a $5 or $20 plan**. The upper bound depends on actual command CPU time, burst behavior and database latency matching the assumptions below. Slow queries, synchronized answer bursts or CPU-heavy processing can make even 100 rooms too high; a leaner implementation may exceed 250.

Only two application services are counted: one API deployment/process and one database service. “One PostgreSQL instance” means one primary accepting both writes and reads, with no standby, read replica, external pooler, Redis or additional worker service. Railway documents its basic PostgreSQL template as a single node; high availability is a different deployment. [Railway PostgreSQL](https://docs.railway.com/databases/postgresql).

## What official limits and benchmarks establish

Railway publishes **10,000 concurrent connections** and approximately **11,000 HTTP requests/sec** in its public-network limits. These are networking ceilings, not a promise that a NestJS service or PostgreSQL database sustains that workload. WebSocket connections are supported and are exempt from the documented HTTP request duration/inactivity limits. The HTTP RPS ceiling is not a WebSocket message throughput benchmark. [Railway networking limits](https://docs.railway.com/networking/public-networking/specs-and-limits).

Dividing 10,000 by six gives 1,666 full rooms as a bare connection-count ceiling before allowing for other connections. That arithmetic does **not** establish application capacity, memory sufficiency, latency or affordability. Multiple tabs, reconnect overlap and HTTP polling also change the connection demand.

Socket.IO's official graph displays approximately 100 MB **heap usage** at 10,000 default-implementation clients. It is not total process RSS. The documented test used Ubuntu 22.04, Node.js 20.3.0, Socket.IO 4.7.2 and ws 8.11.0; it is not a NestJS/AdminJS/PostgreSQL game workload or a Railway hardware benchmark. The chart is useful evidence that connection count alone need not be the first bottleneck, but cannot supply Sahsah's room capacity. [Socket.IO memory study](https://socket.io/docs/v4/memory-usage/), [original graph](https://socket.io/assets/images/memory-usage-per-impl-0f33f953418d9d533b3c996ea134bc96.png).

## Bottom-up demand model

The following are **declared modeling assumptions**, not values found in a benchmark:

| Input | Assumption for the working range |
| --- | --- |
| Connected devices | Six per full room, one per person including host |
| State-changing commands | 0.2/sec per room on average: one every five seconds across all participants |
| Event recipients | Up to six per room event |
| Encoded event payload | 500–2,000 bytes, with image bytes excluded |
| API active CPU per command | Sensitivity band of 8–20 ms including validation, state changes and fanout work; excludes asynchronous DB waiting |
| API CPU occupancy target | Approximately 50% of one core for modeled commands, leaving room for bursts, GC, heartbeats, HTTP/admin and reconnect work |
| Database pool | At most ten API connections in this model; reuse them between commands |
| DB connection residence per command | 20–50 ms for a short transaction; no connection held during player thinking time |
| Database occupancy target | Approximately five of the ten connections occupied on average, leaving queueing/burst headroom |
| Additional API memory allowance | 64–128 KiB per socket, plus 64 KiB per room |
| API baseline and reserve | Illustrative 256 MiB baseline plus 128 MiB transient/GC reserve |

The per-socket memory allowance is deliberately a planning allowance for total additional memory; it is **not** the Socket.IO graph's measured heap cost. Baseline memory, native buffers, authentication/session objects and retained data must be measured. Node runs JavaScript callbacks through its event loop, so long callbacks delay other clients; merely allowing more vCPUs does not parallelize that main loop. [Node event-loop model](https://nodejs.org/en/learn/asynchronous-work/dont-block-the-event-loop).

### CPU sensitivity

```text
API core use ≈ rooms × commands_per_room_per_second × CPU_seconds_per_command
modeled room allowance ≈ 0.5 / (command_rate × CPU_seconds_per_command)
```

| Average commands per room | Modeled CPU room allowance at 8–20 ms/command |
| --- | --- |
| 0.1/sec: one every ten seconds | Approximately 250–625 rooms |
| 0.2/sec: one every five seconds | Approximately 125–312 rooms |
| 1/sec | Approximately 25–62 rooms |

This is why **100–250 rooms** is a reasonable conditional planning range for a low-frequency trivia game, rather than assuming every connected player sends continuously. A 500-room estimate requires quieter traffic, lower command costs or less headroom. All-player buzzer/answer activity must be included in the rate: “one action per room” cannot silently mean one action per participant. Repeatedly broadcasting countdowns also changes the model.

### Expected load at the three reference points

Using 0.2 commands/sec/room and six deliveries per event:

| Concurrent rooms | People / sockets | Commands/sec | Event deliveries/sec | Modeled API core use | Additional modeled API memory |
| --- | --- | --- | --- | --- | --- |
| 100 | 600 | 20 | 120 | 0.16–0.40 | 44–81 MiB |
| 250 | 1,500 | 50 | 300 | 0.40–1.00 | 109–203 MiB |
| 500 | 3,000 | 100 | 600 | 0.80–2.00 | 219–406 MiB |

At 250 rooms the slow end already occupies an entire core, so the top of the working range requires commands near the faster end. At 500 rooms this average workload does not meet the 50% CPU target; the stretch case assumes approximately half this command rate or significantly faster handlers. This table supplies demand estimates, not tested throughput.

With the illustrative baseline/reserve, a 512 MiB API memory envelope leaves 128 MiB for modeled room/socket growth: approximately **157–292 rooms by memory alone**. A 1 GiB envelope leaves 640 MiB: approximately **787–1,462 rooms by memory alone**. Those figures are not capacity predictions because CPU, database, queues and bursts impose separate limits. They explain why extra RAM can create headroom without making the main JavaScript loop faster.

### Database sensitivity

Using five average occupied connections and 20–50 ms residence time gives approximately **100–250 short transactions/sec**, or 500–1,250 rooms at 0.2 transactions/sec/room, before considering database CPU, disk or lock contention. This is a queueing arithmetic model, **not measured PostgreSQL throughput**. It assumes one bounded transaction per command; additional transactions change the calculation. Shared row contention, fsync latency, slow SQL and room-start queries can invalidate it.

Six hundred sockets do not require six hundred database connections. Use a bounded pool and short transactions; PostgreSQL allocates additional resources as its connection limit grows. [PostgreSQL connection settings](https://www.postgresql.org/docs/18/runtime-config-connection.html).

Persist deadlines and meaningful state transitions, then render countdowns on clients. Per-second database polling/writes, unbounded payload queues, image transformation in gameplay handlers and a database connection held for each room would all undermine this estimate. Four thousand content records do not independently justify another service or partitioning; game/exposure history and actual query plans need separate monitoring.

## Capacity and a strict monthly budget are different questions

Hobby and Pro include $5 and $20 of monthly usage respectively; both charge additional usage above that minimum. Published container rates are approximately $10/GB-month memory, $20/vCPU-month CPU, $0.15/GB-month used volume and $0.05/GB public egress. A retained combined 0.5 GB of memory already costs approximately $5/month before other resources. [Railway pricing](https://docs.railway.com/pricing/plans).

Therefore neither “Hobby supports X rooms” nor “Pro supports Y rooms” is a hardware-based statement. The same two services on Hobby can consume more than $5, and the same two services on Pro can consume more than $20. The technical estimate above is conditional on actual CPU/memory availability, while the bill follows average use over the month.

For **100 average full rooms continuously occupied for 30 days**, with six recipients per event:

| Room event rate | Encoded payload | Railway egress, payload bytes only | Egress charge |
| --- | --- | --- | --- |
| One event / 10 seconds | 500 bytes | 77.76 GB | $3.89 |
| One event / 5 seconds | 500 bytes | 155.52 GB | $7.78 |
| One event / 10 seconds | 2,000 bytes | 311.04 GB | $15.55 |
| One event / 5 seconds | 2,000 bytes | 622.08 GB | $31.10 |

These calculations exclude overhead, heartbeat messages, handshakes, snapshots, HTTP responses and uploads. They assume one broadcast per modeled event; a command emitting several events increases them. At ten average occupied rooms, the payload egress numbers are one tenth as large. Images delivered directly from Cloudflare R2 do not traverse the API, and R2's own egress is free; operations and other Cloudflare products can still be billed. [R2 pricing](https://developers.cloudflare.com/r2/pricing/).

To illustrate the budget sensitivity, hypothetical combined average memory of 1 GB, CPU use of 0.2 vCPU and 2 GB used volume cost approximately **$14.30/month before egress**. Adding the 100-room egress cases above produces approximately **$18.19–$45.40/month**. Keeping CPU constant here isolates the bandwidth effect; it does not assert that 0.2 vCPU can process every listed workload. These are cost calculations, not measured consumption.

A launch with 100–250 peak rooms for short periods can cost much less than continuously filling the same number. Conversely, idle memory remains billable between games. A strict $5 cap cannot be treated as a reliable always-running two-service budget before measuring idle usage. For a $20 target, small deltas, low event frequency and the ratio of peak to average occupancy can determine whether the deployment fits more than the peak socket count does.

## Concurrent people and daily sessions

Assuming six people in every room and a game lasting **45–60 minutes**, with no gaps between games:

| Concurrent full rooms | Concurrent people | Games completed per fully occupied hour | Games in four fully occupied hours |
| --- | --- | --- | --- |
| 100 | 600 | Approximately 100–133 | Approximately 400–533 |
| 250 | 1,500 | Approximately 250–333 | Approximately 1,000–1,333 |
| 500 | 3,000 | Approximately 500–667 | Approximately 2,000–2,667 |

These are game sessions, not unique users. Multiply by actual occupied hours, not automatically by 24. The 45–60 minute duration and full occupancy are planning assumptions; neither is a confirmed product metric. At continuous 24-hour full occupancy, the corresponding arithmetic is 2,400–3,200, 6,000–8,000 and 12,000–16,000 games/day, with the associated higher monthly utilization.

## Region and validation

Railway currently lists California, Virginia, Amsterdam and Singapore deploy regions; it does not list an Egyptian compute region. Amsterdam is a reasonable first candidate to test for Egyptian users, **an inference from geography, not a measured latency claim**. Keep API and PostgreSQL together and measure from expected Egyptian networks. Global media caching does not move the game process closer to players. [Railway regions](https://docs.railway.com/deployments/regions).

Use 100 rooms as the first working target, then 250, with 500 as the conditional stretch experiment. Measure command CPU time, event-loop delay/utilization, RSS, DB transaction residence, pool wait, locks, bytes per event and acknowledgment p95/p99. Test normal play, six simultaneous answers within each room, synchronized room creation and reconnect bursts; one restart also needs correct durable recovery. Node exposes event-loop measurements suitable for checking the CPU assumptions. [Node 24 performance APIs](https://nodejs.org/docs/latest-v24.x/api/perf_hooks.html).

The practical forecast to use now is **about 100 concurrent rooms / 600 people for the initial design target, 100–250 rooms / 600–1,500 people as an estimated working range on the declared small-instance envelope**, and 500 rooms only under a favorable measured workload. Treat $5/$20 as a separate monthly budget constraint until idle metrics, average occupancy and event sizes are known.
