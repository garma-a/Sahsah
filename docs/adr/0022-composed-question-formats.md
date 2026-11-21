# Let staff define question formats as data, with finished uploaded media

Accepted 2026-11-20. Staff want to invent new question kinds (zoom, reversed audio, sped-up audio, black-and-white images and similar) from the dashboard without a release. Until now each format was a fixed enum value with its own wire type and its own rendering in the web and Flutter clients.

A **composed format** is now data: a name, a base (text, image or audio) and an ordered list of media slots, such as each hint stage and the answer. Staff prepare every slot elsewhere and upload the finished file to private R2; Sahsah never transforms media, and the client shows slot N at hint stage N and the answer slot on reveal. The existing simple formats become seeded composed formats with the same behaviour. Memory, clue image and charades stay built-in, because their interaction is defined in code. The game sequence (board, hint stages, timer, points) does not change. Editing a format or a published question affects future games only, since games keep their own copies (ADR 0002).

## Considered Options

- Keep the fixed enum: no client changes, but every new kind needs a backend, web and mobile release.
- Apply effects on the server at upload: one-off processing cost and `ffmpeg` in the admin image. Rejected because staff already produce finished media.
- Apply effects in the client during play: free, but viewers would receive the unaltered original and could read the answer.

## Consequences

The question schema, the wire contract and both clients need a generic slot-based renderer. The Flutter part ships as its own PR. Bulk import derives its CSV columns from the chosen format's slot list.
