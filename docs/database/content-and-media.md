# Question authoring and retained media

Status: Q61–Q67 accepted. All launch questions/media are authored individually in AdminJS; Q82 excludes CSV imports. Concrete column/key choices are proposed in the working DBML.

## Authoring and publication

Each category contains authored packs; each current pack has six numbered slots. A question owns its presentation format, so a pack can mix formats. Arabic prompt/answer are required for playable content; Franco-Arabic fields are optional and independently fall back to Arabic. Empty optional fields are normalized to null. Do not infer language validity from a particular script: names and audio transcripts can contain mixed text.

Incomplete packs may remain drafts. Publishing or saving an already-public edit must validate the full six-slot set, original point bands, format payloads and ready required media under the pack lock. Save the set atomically after the public-edit warning. There is no separate reviewer approval. Media transfer/processing occurs outside this short transaction.

Archived categories hide their packs without rewriting individual publication/archival status. Archived packs are excluded from new starts. Existing games/progress remain unchanged; restoration still checks current content validity. Draft/archival filters are applied to both pack lists and the authoritative game-start selection, not only to the UI.

## Ten real formats

| Format | Required content and media | Proposed format-specific configuration |
| --- | --- | --- |
| `STANDARD` | Arabic question/answer; optional prompt image and answer-only image | No mandatory special configuration |
| `IMAGE_BLUR` | Private original, three ready blurred hint images, full answer image | Three blur strengths, recorded on generated assets |
| `IMAGE_ZOOM` | Private original, three ready cropped hint images, full answer image | Valid focal coordinates/zoom factors on generated assets |
| `AUDIO_GUESS` | Ready playable audio and textual answer | No replay limit; duration comes from inspected media |
| `AUDIO_REVERSE` | Private forward source and generated reversed question audio | Whether forward answer playback is allowed; textual transcript answer |
| `IMAGE_PERSON` | Portrait, question crop and identity answer; full image for reveal | Valid crop preset/focal parameters |
| `IMAGE_COLOR` | Question image in grayscale, original color image for reveal and textual color answer | Optional valid color swatch |
| `IMAGE_RIDDLE` | Visible illustration and textual Egyptian-proverb answer | No staged hints required |
| `AUDIO_VOICE` | Audio clip and textual identity answer | Optional localized hint/joke |
| `IMAGE_MEMORY` | Scene image, detail question and answer | Runtime manual show/hide/revisit, with 60 seconds from first hide |

This inventory is grounded in [public types](../../sahsah_prototype/src/lib/game-types.ts), [party-mode constructors](../../sahsah_prototype/src/demo/party-modes.ts) and [current publication validation](../../sahsah_prototype/src/lib/game-rules.ts). The prototype's admin/server accepts only five types; all ten are now accepted production scope, so demo category overlays must not become database classification rules.

For blur/zoom, stages 0/1/2 have positive strictly decreasing suggested points beginning at the owning slot's original 200/400/600 value. Defaults are 200→150→50, 400→250→150 and 600→400→200. Staff may edit these values. The host's accepted award override remains zero through the original tile cap, independent of the suggestion.

The prototype already generates stored blur/zoom stages, but uses CSS over full delivered originals for person/color. The proposed production pipeline creates appropriate question variants and keeps answer originals private until reveal. This is a technical recommendation; it does not add a new game format. Memory necessarily reveals its scene during the viewing phase and supports later revisits as agreed.

## Relational media references

`media_assets` identifies one physical object with kind, processing readiness, inspected metadata, immutable storage key and optional source/transform lineage. An asset can be reused; checksums are not unique and do not implement the deferred semantic duplicate detector.

`question_media` assigns current source/question/answer roles and the three numbered hint-image variants with suggested points. Non-hint roles use variant zero without hint points. At game start, copy ordered stage/config data into the typed content snapshot and create `game_question_media` pins for all its exact assets. Asset identity is relational because garbage collection cannot rely on searching arbitrary JSON documents.

The database checks broad shape and presence. Publication/start additionally validate role/kind compatibility, ready state, complete required roles, transform ranges, exact stage count/order and correspondence between JSON snapshot and relational pins. Original source/answer references are server data, not permission to emit a public URL.

## Private delivery and immutable objects

The schema stores provider/namespace/key, not bytes or expiring URLs. A Cloudflare R2 adapter is a researched fit for private objects; the actual deployment configuration is not provisioned by this design.

R2 buckets are private by default. Presigned URLs are reusable bearer credentials until their expiry, work on its S3 endpoint and can be generated locally. Issue short-lived URLs only after membership, question/stage, reveal or memory-visibility checks. Do not save them in frozen content. [Cloudflare private/public access](https://developers.cloudflare.com/r2/buckets/public-buckets/), [presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/).

Use a new object key for each revision/rendition; writes to the same key can replace bytes. R2 conditional create-once writes support preventing accidental replacement. Its upload version metadata is not a substitute for a separately retrievable retained object key. [Consistency and conditional writes](https://developers.cloudflare.com/r2/reference/consistency/), [object metadata](https://developers.cloudflare.com/r2/api/workers/workers-api-reference/).

Do not apply blind age-based object deletion to assets pinned by current content, derivative lineage or retained games. R2 lifecycle deletion is asynchronous, and cached public copies can outlive origin deletion; application retention and delivery authorization remain separate. [Object lifecycle](https://developers.cloudflare.com/r2/buckets/object-lifecycles/), [cache consistency](https://developers.cloudflare.com/r2/reference/consistency/#caching).

Image/audio processing uses durable outbox work/leases, bounded concurrency and validated upload limits. Handlers recheck asset state/references and immutable keys before acknowledgment. No image/audio bytes travel through PostgreSQL. Transfer, transformation and object deletion occur outside short database locks.
