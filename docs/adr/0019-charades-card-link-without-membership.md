# Open charades cards by link without room membership

Accepted 2026-11-16 in the content import grilling session (Q4, Q13). A charades question shows a code on the shared screen; whoever scans it, or the host clicking it, opens the private charades card and acts it silently for their team. The scanner may be someone who never joined the room, so the card page does not check membership.

This is a deliberate exception to [ADR 0013](0013-private-r2-gameplay-media.md), which checks membership, audience and role before issuing private media. The code carries an unguessable token bound to one game question; it opens the card only while that question is open and stops working when the question closes. The card bytes still come from a short-lived presigned R2 read, and the shared-screen and viewer projections never receive the card itself. Anyone who sees the code can open the card, so a team that photographs the other team's code learns the answer; the game accepts that as table etiquette rather than a security boundary.

The code's address comes from a configured public app address: a local network address for testing on phones during development, and the real public site in production.
