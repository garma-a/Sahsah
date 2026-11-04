# Give regular Admin all operational access except staff management

Accepted Q89 on 2026-11-02 supersedes the content-only Q40 role. Keep two fixed roles, `admin` and `super_admin`: both manage content, prices, promotions, complimentary credits, support and financial cases through validated audited actions; only Super Admin manages staff accounts and roles. The earlier content-only split was an assistant recommendation to limit financial authority, not a technical requirement.

This changes the existing role field and authorization policy without adding staff/permission tables. Payment proofs, once-only credits and append-only audit/ledger rules still apply to both roles. The historical interview answers remain recorded; their Super-Admin-only operational restrictions are superseded by this decision, while staff management stays exclusive.
