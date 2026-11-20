# Let staff define question formats as data, with finished uploaded media

Accepted 2026-11-20. Staff want to invent new question kinds (zoom, reversed audio, sped-up audio, black-and-white images and similar) from the dashboard without a release. Until now each format was a fixed enum value with its own wire type and its own rendering in the web and Flutter clients.

A **composed format** is now data: a name, a base (text, image or audio) and an ordered list of media slots, such as each hint stage and the answer. Staff prepare every slot elsewhere and upload the finished file to private R2; Sahsah never transforms media, and the client shows slot N at hint stage N and the answer slot on reveal. The twelve existing formats are not migrated: they keep their enum values, wire shapes and stored questions, so the Flutter app and current content are unaffected. Composed formats are rows in `question_formats` and questions point at one through `composed_format_id` (format `COMPOSED`). Memory, clue image and charades stay built-in, because their interaction is defined in code. A format is a base (text, picture or audio), up to three hint stages (each a picture or audio clip, replacing the previous stage, with suggested points falling from the tile value) and an optional answer picture or clip. The game sequence (board, hint stages, timer, points) does not change; a game copies the definition at start. Editing a format or a published question affects future games only, since games keep their own copies (ADR 0002). A format whose questions already carry files can change only its name, label and prompt switch, because changing its slots would silently invalidate those questions; a different shape needs a new format. Archiving hides a format from new questions and leaves existing ones valid.

## Considered Options

- Keep the fixed enum: no client changes, but every new kind needs a backend, web and mobile release.
- Apply effects on the server at upload: one-off processing cost and `ffmpeg` in the admin image. Rejected because staff already produce finished media.
- Apply effects in the client during play: free, but viewers would receive the unaltered original and could read the answer.

## Consequences

The wire contract gains one generic `COMPOSED` shape and the web client renders it. The Flutter app cannot draw it yet, and the API does not know the client type, so composed questions must not be published to mobile players until the app ships a generic renderer; the dashboard warns about this. Bulk import derives its CSV columns from the chosen format's slot list.
