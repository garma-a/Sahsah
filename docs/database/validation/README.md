# Reproduce the database design checks

Run as a normal user with PostgreSQL 18, Python 3, Node 24 and npm available:

```sh
python3 docs/database/validation/validate_design.py
```

Use `--pg-bin /path/to/postgresql/18/bin` if binaries live elsewhere. `psql`, `node` and `npm` must be on PATH. The pinned DBML exporter uses npm's cache; no application packages/lockfiles are installed or changed. The script never accepts a production DSN: it creates its own temporary cluster, listens only on a private Unix socket, and stops/removes it on exit.

The runner loads DBML-exported SQL, `postgresql-supplement.sql` and `postgresql-guards.sql`, then exercises legitimate and rejected financial/lifecycle transitions, concurrent reference transactions and synthetic access paths. Results and raw plans are in [latest-results.json](latest-results.json). A custom `--report /tmp/results.json` avoids replacing the recorded report.

Checks cover atomic bank delivery, duplicate credit, proof families, source identity, checkout closure, native completion, room capacity/removal, deletion consent/funding, campaign limits, immutable history, redaction and content purge. Concurrent cases use separate PostgreSQL connections. These are SQL/reference-transaction tests, not tests of the starter NestJS API or real payment SDKs.

The measurement fixture compares sparse indexes with temporary full alternatives on the same local data. It records the planner's actual choice rather than forcing index scans. Timings vary by machine/cache and cannot predict Railway capacity. The [quality review](../design-quality-review.md) explains the changes and remaining implementation work.
