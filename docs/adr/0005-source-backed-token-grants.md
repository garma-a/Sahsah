---
status: superseded by ADR-0007
---

# Credit wallets from order or staff grants rather than payment callbacks

The separate grant-table proposal below was superseded on 2026-11-02 by [ADR 0007](0007-consolidate-launch-schema.md): positive ledger entries now carry their unique order/staff authorization directly. Source verification, exact beneficiary/quantity and once-only credit remain required. The original proposal is retained as decision history.

Purchased/gifted tokens belong to one frozen purchase quantity and beneficiary; complimentary tokens require a privileged staff action and reason. The proposed funding bridge is a source-backed grant, unique per order or staff action, with a single ledger credit whose account and amount must match the grant. A second real payment for one order is a financial exception to retain and reconcile, not another entitlement to issue; duplicate callbacks likewise must not grant again.

This adds a grant record and supporting membership keys instead of directly changing a balance from each callback. It keeps recipient/quantity provenance explicit for history and exceptional payment reconciliation without overloading the separate game-restoration flow. [ADR 0006](0006-one-bank-without-customer-cashout.md) excludes ordinary refund/source-lot accounting; grants do not imply separate banks or spending priorities. Provider verification, staff permission and atomic effects still require authenticated transaction paths; FK linkage alone does not establish those facts.
