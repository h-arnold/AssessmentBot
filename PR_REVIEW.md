# Slides Parser Review — `src/backend/DocumentParsers/SlidesParser.js`

- **Generated:** 2026-09-14 (module review, not a pre-PR diff review)
- **Health gate:** SKIPPED — read-only module review of committed code; no branch diff under review
- **Focus:** Edge-case bugs and accumulated patch debt (maintainer-reported "difficult to pin down" failures)
- **Method:** Two parallel review agents (edge-case correctness; de-sloppification), synthesised below

## Verdict

**Fail (2 Critical)** — a degenerate tag text crashes the entire deck parse, and a catch-and-return
persists corrupted-but-valid-looking table data with a real content hash. Both are plausible
explanations for the intermittent, hard-to-pin-down behaviour reported.

---

## Critical

### C1. Crash: empty `tagText` reaches `new TaskDefinition` and aborts the entire deck parse

- **Evidence:** `SlidesParser.js:226-233` (`parseDescriptionTag` returns `tagText: rawText.slice(1).trim()` — a description of `"#"`, `"~"`, `"|"`, or `"# "` yields `tagText: ''`); `SlidesParser.js:82-84` (`'#'` → `handleDefinitionTitleElement`), `SlidesParser.js:90-93` (`'~'`/`'|'` → `handleImageArtifactElement`); `SlidesParser.js:112-113` and `:160-161` both call `ensureTaskDefinition` unguarded; `:185-196` calls `new TaskDefinition({ taskTitle, ... })` with no empty-title check; `TaskDefinition.js:29` throws `'TaskDefinition requires taskTitle'`.
- **Trigger:** any page element whose alt-text/description is exactly `"#"`, `"~"`, `"|"` (or tag char + whitespace only — very plausible as a teacher placeholder, unfinished annotation, or stray alt-text character). The throw propagates uncaught through `processSlidesForDefinitions` → `extractTaskDefinitions` → `SlidesAssignment.populateTasks` (`SlidesAssignment.js:73-97`, no try/catch) — the whole assignment population fails, not just the one bad element.
- **Patch-accumulation evidence:** `appendNotesToDefinitions` (`:136-140`) _does_ guard `if (!taskTitle)` with a warn — the `'#'`, `'~'`, `'|'` handlers were patched separately and never got the same guard.
- **Fix direction:** validate `tagText` non-empty before dispatch (skip + warn, matching the `'^'` handler), or make `ensureTaskDefinition` fail fast with contextual error (pageId, role, rawText). Consistency across all four tag handlers is the point.

### C2. `extractTableCells` catch-and-return persists a corrupted-but-valid-looking empty TABLE (and hashes it)

- **Evidence:** `SlidesParser.js:512-532` — `catch (error) { ABLogger...error('extractTableCells failed', error); return []; }`. The `[]` return is indistinguishable from a legitimately empty table downstream.
- **Downstream chain (verified):**
  - Reference side: `:255-259` wraps `[]` as `{ artifactType: 'TABLE', elementContent: [] }` → stored → `TaskDefinition.validate()` passes because `artifacts.reference.length > 0`. The task becomes "valid" with a phantom empty table.
  - Submission side: `SlidesAssignment.js:124-137` → `StudentSubmission.upsertItemFromExtraction` → `_mergeExtractedContent` (`StudentSubmission.js:300-307`): `normalizeContent([])` (`TableTaskArtifact.js:150-163`) converts `[]` into a padded one-row table which is **not null**, so `ensureHash()` runs and a real content hash is computed over the phantom table.
- **Trigger:** any transient SlidesApp failure inside the cell loop during definition building or student extraction. Result: stored as a genuine-looking empty TABLE artifact with a valid hash — indistinguishable from a student who legitimately submitted an empty table. The log line carries no task, document, page, or row context, and the pipeline continues as if nothing happened. This is precisely the "difficult to pin down" class.
- **Fix direction:** remove the try/catch or log-and-rethrow with context (documentId/pageId/taskTitle/row/col). If partial-table tolerance is genuinely wanted, return a distinguishable failure — never a value that collides with legitimate empty input.

---

## Improvement

### I1. Tag-character hijack: any element description starting `#`/`^`/`~`/`|` is parsed as a tag regardless of element type or intent

- **Evidence:** `SlidesParser.js:74-98` runs `parseDescriptionTag` on **every** page element's description (shapes, images, videos, lines); `:226-227` treats any leading tag char as a tag; `handleImageArtifactElement` (`:160-176`) creates an IMAGE task from the tag text with no check that the tagged element is an image.
- **Triggers:**
  - Image alt-text `"~ rotated 90°"` or `"#1 priority"` creates a ghost TaskDefinition. If similar alt text exists in both reference and template decks, `validate()` passes and a phantom task ships; student decks won't contain it, so every student gets a null placeholder artifact and an error log (`:314-327`).
  - A `'#'`-tagged element of an unsupported type (IMAGE, WORD_ART, LINE…): `handleDefinitionTitleElement` (`:112-115`) creates the definition **first**, then `extractDefinitionContent` returns `null` and the method silently returns — no log at all. The definition stays in the map with zero artifacts, having consumed an `orderState` index (`:194`); it later fails `validate()` with the misleading message `"Task X is missing required slide artifacts"` (`SlidesAssignment.js:82-87`).
- **Fix direction:** (a) restrict tag parsing to element types that can legitimately carry tags (or at minimum warn when `extractDefinitionContent` returns null for a `'#'` element); (b) require the tag to be followed by a non-empty token (overlaps C1).

### I2. Duplicate `'#'` titles within one deck: second element silently becomes an unmatched shadow artifact

- **Evidence:** `ensureTaskDefinition` (`:185-198`) returns the existing definition on title collision with no warn; `addArtifactToDefinition` (`:271-277`) appends a second artifact. Submission extraction only consults the primary artifact's type (`:295-296`) and matches by that type (`:392-424`).
- **Trigger:** teacher duplicates a slide (extremely common in Slides) leaving two `# Task 1` shapes. Both become reference artifacts; if the first is TEXT and the second TABLE, the TABLE content can never be matched for any student. The definition's `pageId` also remains the _first_ slide's. No ambiguity warning is ever emitted.
- **Fix direction:** warn (or fail) on duplicate title-tagged elements within a deck; decide and document whether duplicates append artifacts or overwrite.

### I3. Submission matching: first-match-wins with no ambiguity logging; bare-title collisions can shadow the real answer

- **Evidence:** `buildSubmissionIndex` (`:357-380`) buckets every element under both `rawText` and `tagText`; `collectSubmissionArtifact` (`:406-421`) returns on the **first** bucket entry passing the tag/type guard; `collectTaggedImageSubmissionArtifact` (`:434-444`) same. Nothing is logged when >1 candidate matches.
- **Triggers:**
  - Bare-title matching is a documented feature (`slidesParserMatchingAndDocumentIds.test.js:190-215`), but any untagged element whose description coincidentally equals a task title (heading text box, caption, decorative alt-text) enters the same bucket. If it appears earlier in slide/element order and satisfies `typeNeeded`, it **silently wins** and the student's actual tagged answer is ignored — wrong-content extraction with zero diagnostics.
  - Student copies a task slide (draft + final). The draft (earlier slide) always wins; no log.
- **Fix direction:** when a candidate bucket has multiple entries (or when a bare-title match beats a `#`-tagged match), emit a `warn` with candidate, matched pageId, and bucket size. Optionally prefer tag-qualified matches over bare-title matches before falling back.

### I4. Three inconsistent submission-artifact payload shapes; redundant `contentHash` contradicts hash ownership

- **Evidence:**
  - TEXT/TABLE success: `:414-419` → `{ taskId, pageId, documentId, content }` (no `type`, no `role`, no `contentHash`, no `metadata`).
  - IMAGE success: `:453-463` → adds `content: null, contentHash: null, metadata` (still no `type`/`role`).
  - Placeholder: `:314-323` → adds `type`, `role: 'submission'`, `metadata: {}` **and** `contentHash: null`.
- **Why it matters:** the only consumer, `SlidesAssignment.processAllSubmissions` (`SlidesAssignment.js:125-137`), reads only `taskId/pageId/content/metadata/documentId`, and `StudentSubmission._mergeExtractedContent` owns `contentHash`. So `contentHash: null` in the parser payload is dead data, and the placeholder's justification comment (`:309-313`) describes a shape the success paths don't share — classic accreted patching. The base-class contract (`DocumentParser.js:34-37`, "primitive… no hashing") is also violated by the placeholder.
- **Fix direction:** pick one canonical primitive shape (mirroring the JSDoc contract at `:283`), include `type` on all paths, and drop `contentHash`/`role` from parser output.

### I5. Missing-task logging duplicated across three layers with inconsistent levels

- **Evidence:** for one missing student artifact: (1) `:324-326` `ABLogger.error("Failed to extract artifact for task …")`; then (2) `StudentSubmission.js:279-283` `warn('No content found for …')`; and for TABLE tasks (3) `TableTaskArtifact.js:102-105` `warn('Table task content which is null …')`. Policy §5.4: "Avoid duplicate per-field detail spam across layers".
- **Fix direction:** log once at the parser boundary with full context (task title, taskId, documentId, primary type); drop or gate the downstream duplicates for this path.

### I6. `generateSlideImageUrl`: no parameter validation, context-less error, double-log interaction

- **Evidence:** `:21-29`. `Validate.isValidUrl` (`Validate.js:111-145`) is a strict HTTPS/hostname validator applied to a URL just interpolated from two trusted GAS object IDs — near-dead check. Its regex failure path logs via `ProgressTracker.logError` (`Validate.js:119-126`) and then `generateSlideImageUrl` throws an _additional_ uncaught `Error('Invalid URL produced.')` — double signal, no `documentId`/`pageId` in the message. Its whitespace/hostname failure paths (`Validate.js:116, 129-142`) return false **silently**.
- **Trigger:** a malformed `pageId`/`documentId` (corrupted stored definition) → `:162-165` or `:461` throws → aborts the _entire_ run for one bad element, with a message that names nothing.
- **Fix direction:** `Validate.requireParams({ documentId, pageId }, 'SlidesParser.generateSlideImageUrl')` at entry; replace the post-hoc URL validation with validation of the two inputs; put `documentId`/`pageId` into the thrown error.

### I7. Defensive-guard policy violations (feature detection on known GAS APIs) that mask wiring failures as empty data

- **Evidence:**
  - `:514` `if (!table || !(table.getNumRows && table.getNumColumns)) return [];` — feature detection on the known GAS `Table` API (AGENTS §5). Combined with C2, a wiring/object-shape problem becomes a silent `[]`. Tests entrench this (`slidesParserMergedCells.test.js:267-276`).
  - `:482` `if (!shape?.getText)` — same violation for `Shape`; silently returns `''` with only a warn.
  - `:207` `taskTitle || ''` — dead defensive fallback: `TaskDefinition`'s constructor throws for falsy title (`TaskDefinition.js:29`) immediately after, so the fallback's output is never observably used.
- **Fix direction:** remove the feature-detection guards (let misconfiguration throw visibly); drop the `|| ''`.

### I8. Public methods lack `Validate.requireParams`

- **Evidence:** `extractTaskDefinitions` (`:42-64`), `extractSubmissionArtifacts` (`:288-331`), `generateSlideImageUrl` (`:21-29`) — none call `Validate.requireParams` (AGENTS §3). A missing `referenceDocumentId` surfaces as an opaque GAS error from `SlidesApp.openById(undefined)`.
- **Fix direction:** add `requireParams` at each public entry point.

### I9. Notes (`^`) handling: order-dependent silent data loss and cross-deck asymmetry

- **Evidence:** `appendNotesToDefinitions` (`:136-150`) looks up `definitionMap.get(taskTitle)` at the moment the `^` element is visited. Decks are processed reference-first, then template (`:58-61`), slides/elements in document order.
- **Triggers:**
  - A `^ Task 1` element appearing on a slide _before_ the `# Task 1` definition element → warn + notes permanently dropped. Teachers naturally put instructions above the task box.
  - A `^` note in the reference deck for a task whose `#` definition only exists in the template deck → same loss. Conversely, template-deck notes for a reference-defined task work — an asymmetry that makes the behaviour feel random.
  - Empty notes content: `:148-149` appends a stray newline or sets `taskNotes` to `''` rather than leaving null.
- **Fix direction:** two-pass processing (collect `^` notes, apply after all `#` definitions are registered), and skip empty notes content.

### I10. Merged-cell handling: geometry distortion in the Markdown path and header-row pipe corruption in the shared converter

- **Evidence:** `extractCellText` (`:539-553`) returns HEAD text at the head position and `''` for every other cell of the merged region; `extractTextFromTable` (`:501-505`) feeds that to `DocumentParser.convertToMarkdownTable` (`DocumentParser.js:48-74`).
- **Consequences:**
  - A 2×2 merge renders as row 1 `[Header, '', …]` and row 2 `['', '', …]` — spanning semantics lost, column counts inflated; a student who un-merges cells produces a structurally different table for the same logical content.
  - `convertToMarkdownTable` escapes pipes **only in data rows** (`DocumentParser.js:63-69`); the header row is joined un-escaped (`DocumentParser.js:57`). A header cell containing `|` corrupts the Markdown column structure.
- **Fix direction:** document the geometry limitation on the artifact; fix header-row escaping in `convertToMarkdownTable`.

---

## Nitpick

- **N1.** `getPageId` (`:466-474`): JSDoc/inline comments reference Sheets tab IDs — copy-paste residue from the Sheets parser. Delete the Sheets comments (or inline the wrapper).
- **N2.** Malformed JSDoc type annotations `>}>>` at `:336`, `:352`, `:385` — extra `>` breaks type-tooling parsing.
- **N3.** Per-merged-cell debug log (`:544-549`): `message` field duplicates the log message; high-volume noise for large merged tables, and `ABLogger.debug` is itself ungated (see Incidental A3). Log once per table with a merged-cell count instead.
- **N4.** Notes on an IMAGE element (`:570-572`, `:585-590`): a `^`-tagged image contributes its alt-text as task notes. Semantically surprising; document or restrict `^` to text-bearing types.
- **N5.** Placeholder comment overstates the shape (`:309-313`): claims "content/contentHash present as null" as a differentiator, but the TEXT/TABLE success path carries no `contentHash` key at all (fold into I4).
- **N6.** `generateSlideImageUrl` (`:24-28`): else-after-return; `Invalid URL produced.` carries no documentId/pageId context (fold into I6).
- **N7.** `orderState = { value: 0 }` counter wrapper (`:50`, `:186`, `:194`): one-field object emulating by-reference mutation — coy-reference idiom.
- **N8.** `tagText: rawText` in the untagged parse result (`:235-239`): field name is only coherent for tagged input; double meaning.
- **N9.** `appendNotesToDefinitions` (`:136`): plural name but appends to exactly one definition.
- **N10.** Redundant empty-template guard (`:59-61`): `forEach` over an empty array is already a no-op.
- **N11.** Dead switch default (`:95-97`): unreachable — `parseDescriptionTag` only returns the four tags or `null`, and `null` is filtered at `:80`.
- **N12.** Redundant `|| ''` on `trim()` (`:552`) and the `!text` guard family in `extractTextFromShape` (`:490-493`).

---

## Slop / tech-debt observations (from the de-sloppification pass)

- **Stale class docblock** (`:12`): "Handles per-document rate limiting" — verified false; rate limiting lives in `BaseRequestManager.js:65`/`z_apiHandler.js`. Delete the line.
- **Duplicated stable-ID plumbing** across three files: `SLIDES_TASK_ID_HASH_LENGTH` (`SlidesParser.js:4`) vs `TASK_DEFINITION_HASH_LENGTH` (`TaskDefinition.js:7`) vs `StudentSubmission.js:40` — all `'<prefix>' + Utils.generateHash(base).slice(0, 12)`. Note the two `t_` schemes are deliberately _not_ identical: Slides hashes title-only (`:207`), `TaskDefinition._deriveId` hashes `title::pageId` (`TaskDefinition.js:55`) and is still live via `SheetsParser`. Careless "unification" would silently change Slides IDs and break stored submission matching. Extract a shared helper while keeping base strings explicit per call site.
- **Undocumented dual image-tag syntax** (`~` / `|`): literal-checked in three places (`:227`, `:90-91`, `:438`) with no explanation anywhere; the `extractTaskDefinitions` docblock (`:36`) documents only `~ImageId`. Both tags must stay (tests exercise `|`), but name the rule — e.g. an `IMAGE_TAGS` set / `isImageTag(tag)` helper used by all three sites.
- **Repeated role→documentId ternary** `role === 'reference' ? context.referenceDocumentId : context.templateDocumentId` at `:123`, `:163`, `:172` — store a `documentIdByRole` map on the context or resolve once per slide batch.
- **`addArtifactToDefinition`** (`:271-277`): pass-through if/else re-implementing `TaskDefinition.createArtifact(role, parameters)` role dispatch (`TaskDefinition.js:75-91`); call `createArtifact` directly (its throw on invalid role is the correct fail-fast).
- **JSDoc slop:** the same anonymous structural type spelled out inline four times (`:336`, `:352-353`, `:385`, `:429`), once malformed; unverified perf claim in `@remarks` (`:337-338`) that `getDescription()` is "relatively expensive". Define one `@typedef` and trim the remark to the structural fact.

---

## Incidental (triage — surrounding files, not module defects)

- **A1 (Improvement).** `SlidesAssignment.js:44, 59, 61, 119, 128` — direct `console.log/warn/error`, violating AGENTS §4; opportunistic refactor to `ABLogger` next time the file is touched.
- **A2 (Improvement).** `SlidesAssignment.js:62-64` — `typeof this.progressTracker.logError === 'function'` feature-detection guard on the class's own inherited member (AGENTS §5 violation); the optional chaining at `:48/:54` has the same masking character.
- **A3 (Improvement).** `SlidesAssignment.js:60-65` — `processImages` catch logs but never rethrows; whole image-hydration step fails silently from the caller's perspective (AGENTS §4 fail-fast).
- **A4 (Improvement).** `DocumentParser.js:50` — `console.log` in `convertToMarkdownTable` (§4 violation); also buries a data-shape problem in a log line.
- **A5 (Improvement).** `ABLogger.debug` (`ABLogger.js:159-162`) logs unconditionally, contrary to logging-policy §7 (debug should be gated) — amplifies N3.
- **A6 (Nitpick).** `DocumentParser.js:15-18` — `typeof ProgressTracker !== 'undefined'` constructor guard; Node-test-compat defensiveness in production code; address only if `tests/setupGlobals.js` can seed it cleanly.
- **A7 (Nitpick).** `TableTaskArtifact.js:19` — header JSDoc claims "null -> throws after logging (fatal input)" but implementation warns and returns null (`:99-106`); stale doc.
- **A8 (Note).** `SlidesAssignment.js:126-129` — "unknown taskId" warn is currently unreachable (placeholder and matched artifacts both use `definition.getId()` from the same `taskDefs` list); harmless dead path.

---

## Summary counts

| Severity    | Count | Items  |
| ----------- | ----- | ------ |
| Critical    | 2     | C1, C2 |
| Improvement | 10    | I1–I10 |
| Nitpick     | 12    | N1–N12 |
| Incidental  | 8     | A1–A8  |

## Performance findings (follow-up review — earmarked, no decisions yet)

- **Generated:** 2026-09-14 — GAS V8 runtime; RPC-accounting based (each SlidesApp getter ≈ 1 remote round-trip; table cell read ≈ 4 RPCs)
- **Reference scale:** 30 students; 50 slides × 20 elements; 15 tasks (5 TABLE, 10×10 tables)
- **Unavoidable floor:** ~2 + 2S + W ≈ 1,100 RPCs/student ≈ 33k/run — not reducible with the current SlidesApp API (no batch reads exist). The only lever is eliminating _wasted_ reads.

### High

- **[P-H1] Type-check after extraction in submission matching** — `collectSubmissionArtifact` (`SlidesParser.js:406-421`) calls `extractDefinitionContent` on every bucket candidate _before_ the `typeNeeded` check at `:412`; the type probe (`getPageElementType`, 1 RPC) is ordered after the O(R×C) extraction it should gate. A wrong-type TABLE candidate costs ~400 RPCs then is discarded. ~36,000 wasted RPC-equivalents/run in the bare-title-collision scenario. Fix: probe type first, extract only on match. **No conflict — implement together with I3** (same loop); also shrinks C2's failure surface.
- **[P-H2] Per-MERGED-cell debug log in the R×C loop** (`:544-549`) — ~3,000 ungated log emissions/run at scale, roughly doubling per-merged-cell cost. **Covered by decisions N3 + A5**; quantified here for prioritisation.

### Medium

- **[P-M1] Eager `getObjectId()` on every slide** (`:342`) though `pageId` is needed only for matched slides — lazy resolution saves ~1,050 RPCs/run. Zero-risk; **author the planned `@typedef` after/with this change** so it describes the final entry shape.
- **[P-M2] Missing-task log volume scales T×N** (worst case 450 parser errors/run + downstream duplicates). **Covered by decision I5** — the dedup is also a failure-mode perf win.

### Low / Micro (explicitly not worth standalone action)

- **[P-L1]** `matchCandidates` Set-spread rebuilt per definition per student (`:393-395`) — pure CPU; fold into I4's payload unification if convenient, not worth a dedicated change.
- **[P-L2]** `buildSubmissionSlideContexts` retains W element proxies for one extraction — verified acceptable (lightweight RPC stubs, per-call scope).
- **[P-Micro]** Set-spread allocations in `buildSubmissionIndex` (`:364-366`), `parseDescriptionTag` string ops, `generateSlideImageUrl` regex (perf-neutral; I6 removes it anyway), `convertToMarkdownTable` concatenation (dies with I9), `Utils.generateHash` calls (unavoidable, off hot path) — all negligible on GAS V8; **do not action**.

### Verified non-issues

- No `getDescription` re-fetch (cached once at `:345`); no O(T²) anywhere; per-student index rebuild is necessary (different document per student); nothing hoistable out of the `SlidesAssignment.js:117-138` loop beyond what's already hoisted (`taskDefs` at `:115`).
- Side benefits already decided: I9 removes the `^`-tagged-TABLE O(R×C) notes read; I2 prevents the only cross-definition duplicate-extraction path; I6 removes the per-image regex.

---

## Decisions

### Critical

- **[C1] `SlidesParser.js:226-233, 185-196` — empty `tagText` crashes entire deck parse.**
  Decision: Fix now — fail fast. Approach: validate `tagText` non-empty before task-definition
  creation and throw a contextual error (pageId, role, rawText) rather than skip-and-continue;
  `ABLogger` reports a useful error message suitable for passing back to the frontend. Rationale:
  user prefers loud failure over silent degradation for degenerate decks; the asymmetry with the
  `'^'` handler guard was the root patch debt.

- **[C2] `SlidesParser.js:512-532` — catch-and-return persists phantom empty TABLE with valid hash.**
  Decision: Fix now — log-and-rethrow. Approach: remove the swallow; log with context
  (documentId/pageId/taskTitle/row/col) at the catch boundary then rethrow so a transient SlidesApp
  failure can never be stored as a legitimate-looking empty table. Entrenching tests in
  `slidesParserMergedCells.test.js` to be updated by Testing Specialist.

### Improvement

- **[I1] Tag-character hijack (`:74-98`, `:160-176`, `:247-262`).**
  Decision: Warn only. Approach: add the missing warn when a `'#'`-tagged element yields no
  extractable content; do NOT restrict tag parsing by element type. Rationale: user chose
  `#/^/~/|` deliberately because they are highly unlikely to appear in real alt-text; hijack risk
  accepted by design.

- **[I2] Duplicate `'#'` titles (`:185-198`).**
  Decision: Fix now — fail. Approach: treat a duplicate title-tagged element within one
  extraction run as an error (fail the parse with contextual message) rather than silently
  appending an unmatchable shadow artifact. Rationale: duplicated-slide shadow artifacts can never
  match at submission time, so failing loudly beats storing dead artifacts.

- **[I3] First-match-wins submission matching (`:357-380`, `:406-424`, `:434-444`).**
  Decision: Fix both. Approach: prefer tag-qualified (`#`/`~`/`|`) matches over bare-title matches
  before falling back, and emit a warn with candidate, matched pageId, and bucket size when a
  candidate bucket has >1 entry. Rationale: prevents untagged headings/captions and duplicated
  student slides from silently shadowing the real tagged answer.

- **[I4] Three inconsistent submission-artifact payload shapes (`:414-419`, `:453-463`, `:314-323`).**
  Decision: Fix — unify, with verification caveat recorded. Verification performed during decision
  pass: `contentHash` does drive caching (`CacheManager.generateCacheKey`,
  `LLMRequestManager.js:79-91`), but it is read from **stored artifact objects** whose hashes are
  computed downstream by `BaseTaskArtifact.ensureHash()` / `StudentSubmission._mergeExtractedContent`
  (`StudentSubmission.js:300-307`) — never from the parser's raw payload. Approach: unify all three
  paths to one canonical shape `{ taskId, pageId, content, metadata, documentId, type }`, drop
  `contentHash`/`role` from parser output, correct the JSDoc and placeholder comment, and update
  `documentParserPhase2.test.js` expectations. Rationale: user asked to double-check cache usage
  before dropping the field; confirmed dead data at the parser boundary.

- **[I5] Triple logging of missing artifacts (`:324-326`, `StudentSubmission.js:279-283`,
  `TableTaskArtifact.js:102-105`).**
  Decision: Fix — log once. Approach: single parser-boundary log with full context (task title,
  taskId, documentId, primary type); drop or gate the downstream duplicates on this path.

- **[I6] `generateSlideImageUrl` (`:21-29`).**
  Decision: Fix. Approach: validate `documentId`/`pageId` at entry, drop the near-dead post-hoc
  URL validation, include both ids in the thrown error message.

- **[I7] Feature-detection guards (`:514`, `:482`, `:207`).**
  Decision: Fix. Approach: remove the `table.getNumRows && table.getNumColumns` and
  `shape?.getText` guards (let misconfiguration throw visibly per the defensive-guard policy), and
  drop the dead `taskTitle || ''` fallback. Entrenching tests updated by Testing Specialist.

- **[I8] Missing `Validate.requireParams`.**
  Decision: Fix. Approach: add `Validate.requireParams` to `extractTaskDefinitions`,
  `extractSubmissionArtifacts`, and `generateSlideImageUrl`.

- **[I9] `'^'` notes handling (`:136-150`).**
  Decision: Fix by removal. Approach: **remove the `'^'` notes tagging feature entirely** — parser,
  tests, and documentation of the tag. Rationale: never used in practice by teachers, and notes are
  better placed in the frontend in future. This also resolves N4 (alt-text-as-notes) as a
  consequence.

- **[I10] Merged-cell geometry + header-row escaping (`:539-553`, `DocumentParser.js:57`).**
  Decision: Fix both. Approach: fix header-row pipe escaping in
  `DocumentParser.convertToMarkdownTable` (align with the data-row escaping at `:63-69`); document
  the merged-cell geometry limitation ('' slots, lost span semantics) on the TABLE artifact.

### Nitpick

- **[N1/N2] Sheets residue comments + malformed `>}>>` JSDoc.** Decision: Fix now.
- **[N3] Per-merged-cell debug spam (`:544-549`).** Decision: Fix — replace with one count-based
  log per table.
- **[N4] Alt-text as notes.** Decision: Resolved by I9 (feature removed).
- **[N5–N12] Small cleanups.** Decision: Apply all — placeholder comment trim, else-after-return +
  error context in `generateSlideImageUrl` (with I6), remove `orderState` coy-reference wrapper,
  resolve `tagText` double meaning in untagged parse result, drop empty-template guard, drop dead
  switch default, drop redundant `|| ''`/`!text` guards. Note: the `appendNotesToDefinition`
  rename (N9 in agent report) is moot — the method is deleted with I9.

### Slop / tech-debt

- **Decision: Apply all.** Stale rate-limiting docblock line deleted; `IMAGE_TAGS` set /
  `isImageTag(tag)` helper introduced and used at all three `~/|` literal-check sites, dual-tag
  syntax documented in the `extractTaskDefinitions` docblock; role→documentId ternary resolved via
  a `documentIdByRole` map on the context; `addArtifactToDefinition` removed in favour of calling
  `TaskDefinition.createArtifact(role, parameters)` directly; one `@typedef` for the submission
  context shape replaces four inline repetitions; hash-length constants consolidated into a shared
  helper **while keeping the Slides title-only hash base explicit** (unifying base strings would
  silently change stored Slides task IDs and break submission matching — explicitly out of scope).

### Incidental

- **[A1–A3] `SlidesAssignment.js`.** Decision: Fix — replace `console.*` ×5 with `ABLogger`,
  remove the `typeof progressTracker.logError === 'function'` feature-detection guard, and make
  `processImages` log-and-rethrow instead of swallowing.
- **[A4] `DocumentParser.js:50` console.log.** Decision: Fix (with I10 work on the same method).
- **[A5] Ungated `ABLogger.debug`.** Decision: Fix — gate per logging-policy §7.
- **[A6] `ProgressTracker` typeof guard in `DocumentParser` constructor.** Decision: Leave —
  address only if `tests/setupGlobals.js` can seed it cleanly.
- **[A7] Stale `TableTaskArtifact` JSDoc.** Decision: Fix.
- **[A8] Dead "unknown taskId" warn path.** Decision: Leave — harmless dead path.

### Implementation follow-up

- Decision: delegate test updates and new coverage (empty-tag fail-fast, table rethrow, duplicate-
  title failure, tag-preferred matching with ambiguity warn, `'^'` removal, payload-shape
  unification, guard removal) to **Testing Specialist** as part of implementation.
- This was a review-only exercise; no code changes have been made yet. Use this document as the
  fix backlog for the `chore/slides-parser-tech-debt-cleanup` branch.

### Data-shapes check (I4 contract assessment)

- Verified: `docs/developer/data-shapes/assignment.md` documents the _stored_
  `StudentSubmissionItem`/artifact serialisation; the canonical contract boundary starts at the
  artifact, not the parser's internal extraction payload. The parser payload is an in-process
  parameter to `StudentSubmission.upsertItemFromExtraction` (`StudentSubmission.js:232`). I4's
  payload unification therefore does **not** touch canonical data shapes; no mandatory Data Shapes
  Agent pass. (Note for the implementing agent: if I4 is later extended to change the _stored_
  artifact shape, the Data Shapes Agent becomes mandatory per AGENTS.md §6.7.)

## Suggested implementation batches

Work the decisions in three coherent passes (each pass = one `Implementation` handoff followed by
one `Code Reviewer` pass, per the AGENTS.md §6 loop), then test updates, then decomposition.
Batching by shared code rather than by severity: several fixes touch the same loops and would
conflict if interleaved.

### Pass A — extraction phase (`extractTaskDefinitions` and its helpers)

- C1: empty-`tagText` fail-fast with contextual error (pageId, role, rawText) surfaced via
  `ABLogger` for frontend relay.
- I1: warn when a `'#'` element yields no extractable content (warn only — hijack-by-design
  accepted).
- I2: fail on duplicate `'#'` titles within one extraction run.
- I7 (extraction-side): remove `shape?.getText` guard (`:482`), dead `taskTitle || ''` (`:207`).
- I8: `Validate.requireParams` on `extractTaskDefinitions` and `generateSlideImageUrl`.
- I6: `generateSlideImageUrl` — validate inputs at entry, drop post-hoc URL check, context in
  error; fold in N6 (else-after-return).
- I9: remove the `'^'` notes feature entirely (parser, docs of the tag) — also deletes
  `appendNotesToDefinition(s)`, `extractTextFromPageElement`, `extractImageDescription`, the
  `extractTextFromTable`/`convertToMarkdownTable` notes path, and resolves N4.
- I10: header-row pipe escaping in `DocumentParser.convertToMarkdownTable` + document merged-cell
  geometry limitation.
- Slop batch: stale rate-limiting docblock, `IMAGE_TAGS`/`isImageTag` helper (3 sites), docblock
  documents `|` tag, `documentIdByRole` map, direct `createArtifact` call (delete
  `addArtifactToDefinition`), dead switch default, empty-template guard, `tagText` double-meaning,
  `orderState` wrapper, N1/N2 JSDoc fixes.

### Pass B — submission phase (`extractSubmissionArtifacts` and matching)

- C2: `extractTableCells` log-and-rethrow (serves both phases; implemented here since both
  consumers are touched).
- I3 + P-H1 together (same loop, `:406-421`): tag-preferred matching, ambiguity warn, type-probe
  before content extraction.
- I4 + P-L1 together: unify payload shape `{ taskId, pageId, content, metadata, documentId, type }`
  on all paths, drop `contentHash`/`role`, correct JSDoc + placeholder comment, hoist per-run
  candidate plan. Data-shapes check above confirms no canonical contract impact.
- I5: log-once at parser boundary with full context; drop/gate downstream duplicates.
- P-M1: lazy `getObjectId()`; author the `@typedef` for the final submission-context shape
  (replaces the four inline JSDoc repetitions — slop item).
- I7 (submission-side) + I8 (`extractSubmissionArtifacts`): remove `table.getNumRows &&` feature
  detection (`:514`), add `requireParams`.
- N3: one count-based merged-cell log per table.

### Pass C — consumer and incidental files

- A1–A3: `SlidesAssignment.js` — `console.*` ×5 → `ABLogger`, remove
  `typeof progressTracker.logError === 'function'` guard, `processImages` log-and-rethrow.
- A4: `DocumentParser.js:50` `console.log` → `ABLogger` (with I10 work).
- A5: gate `ABLogger.debug` per logging-policy §7.
- A7: fix stale `TableTaskArtifact` JSDoc.

### Test updates (delegate to Testing Specialist; run after each pass where behaviour changed)

- Update pinned expectations: `extractTableCells` swallow → rethrow (`slidesParserMergedCells.test.js`),
  feature-detection guard removal (`:267-276`), placeholder payload shape
  (`documentParserPhase2.test.js`, `slidesParserMatchingAndDocumentIds.test.js:290-305`).
- New coverage: empty-tag fail-fast, duplicate-title failure, tag-preferred matching + ambiguity
  warn, type-probe ordering, `'^'` removal (delete `:133-147` notes tests), header-row escaping,
  `requireParams` rejections.

### Pass D — file decomposition (deferred, see below)

- Only after Passes A–C land, reassess line count and split per AGENTS.md §11 if still warranted.
  Rationale: the fixes reshape the code substantially (I9 deletes several methods, slop cleanups
  delete wrappers); decomposing first would churn files that are about to be rewritten.

### Explicitly out of scope (decisions recorded, no action)

- A6 (ProgressTracker typeof guard), A8 (dead warn path) — left as-is per decision pass.
- P-L2, P-Micro — verified acceptable/not worth doing.

### Progress update — Pass A complete

- **Status:** Implemented, tested, reviewed clean, and ready for regression comparison.
- **Addressed:** C1, I1, I2, I6, I7 (extraction side), I8 (extraction entry points), I9, I10 header escaping, N1, N2, N4, N5/N6/N7/N8/N10/N11/N12, and the extraction-side slop items.
- **Additional quality work:** Added hermetic backend coverage tests and restored the unchanged 85% backend coverage gate: 91.79% statements, 85.19% branches, 91.49% functions, and 92.35% lines.
- **Review outcome:** Final Pass A reviewer verdict **CLEAN**. Deferred Pass D decomposition remains intentionally out of scope until Passes A–C are complete.
- **Checks:** 165 backend test files / 2,411 tests passed; backend lint has no errors and only the documented/deferred max-lines warnings; `git diff --check` passed.
- **Next:** Pass B will address submission matching, table failure propagation, payload unification, missing-artifact logging, lazy page IDs, and merged-cell logging.

### Progress update — Pass B complete

- **Status:** Implemented, tested, reviewed clean, and regression comparison clear.
- **Addressed:** C2, I3, I4, I5, I7 (submission side), I8 (`extractSubmissionArtifacts`), P-H1, P-L1, P-M1, and N3.
- **Behaviour:** Table reads now fail loudly with contextual logging and rethrow; matching prefers tagged candidates and reports ambiguity; parser payloads use one six-field shape and leave hashing downstream; missing parser placeholders have one diagnostic boundary; page IDs are resolved lazily.
- **Checks:** 167 backend test files / 2,426 tests passed; backend coverage remains above all unchanged 85% thresholds (91.87% statements, 85.16% branches, 91.53% functions, 92.41% lines); backend lint has no errors.
- **Review outcome:** Final Pass B reviewer verdict **CLEAN**. Pass C remains for consumer/incidental logging and documentation policy fixes.

### Progress update — Pass C and decomposition complete

- **Status:** Implemented, tested, reviewed clean. The deferred parser decomposition was brought forward because the regression checker identified the Pass B file-size lint failure as a regression; it now uses `SlidesParser/00_…`, `01_…`, and `index.js` with helper-before-facade deployment order.
- **Addressed:** A1–A5 and A7; the stale security-policy wording caused by A5; and the required Pass D decomposition/load-order and facade-dispatch corrections.
- **Behaviour:** Consumer logs now use ABLogger with structured context; image hydration presents a stable safe user message, preserves developer error context, and rethrows; debug logging is explicitly gated by `DEBUG_UI`; security docs describe the conditional raw-parameter risk accurately.
- **Checks:** 169 backend test files / 2,432 tests passed; backend coverage remains above all unchanged 85% thresholds (91.91% statements, 85.11% branches, 91.68% functions, 92.44% lines); builder compile, builder tests, production bundle, and targeted parser suites passed; touched files have no lint errors or new warnings.
- **Review outcome:** Final Pass C/security-docs reviewer verdict **CLEAN**. A6 and A8 remain intentionally unchanged.

### Final regression comparison

- **Session:** `slides-parser-tech-debt`.
- **Result:** No regressions or new failures relative to the baseline; 6 of 8 checks pass, with one backend-lint fix recorded (the SlidesParser max-lines failure was removed). The baseline's frontend lint failure and ten unrelated backend max-lines warnings remain unchanged.
- **Passing checks:** backend coverage, frontend tests/coverage, frontend E2E, builder lint/tests/compile.
- **Repository health caveat:** the checker remains overall **FAILING** only because the pre-existing frontend lint failure and unrelated backend max-lines warnings are baseline debt, not introduced by this work.
