# Derive admission capacity from the resources the deployment has now

Accepted 2026-11-20. The operator changes the Railway plan, and with it the API's CPU and memory, as demand grows. A ceiling fixed in code (the preview's 24 rooms) or pinned to one profile (exact database limits that refused admission when they changed) made a plan change either useless or an outage for newcomers.

Admission keeps the ADR 0015 gates, and every input is now relative to the current resources:

- **Pressure** is a fraction of the limits read at sample time: container CPU and memory from cgroup v2, event-loop p99 against 200 ms, the share of each second all database work slots were busy, and, in production, the exporter's own reported database limits.
- **Ceiling** comes from `platform/capacity.ts`. It is 60 rooms per useful vCPU (at most 2, because one Node process cannot use more) and 80 rooms per GB, whichever is lower, bounded between 4 and 2000. It is re-read every minute and logged as `platform.capacity` when it changes. Six members per room, two sockets per member.
- **Override:** a load test on the deployed profile replaces the rates (`GAMEPLAY_CAPACITY_ROOMS_PER_CPU`, `_PER_GB`) or pins a measured envelope (all three `GAMEPLAY_CAPACITY_*`).

The default rates are starting values, not measurements. The live pressure gates refuse first if a profile is weaker than they assume. Past about 2 vCPU, game capacity grows only with more API processes, which first needs shared state in place of the single gameplay process (`claimGameplayProcess`).
