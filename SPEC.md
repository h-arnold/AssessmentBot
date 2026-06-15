# Test-Data Sanitiser Specification

## Status

- Draft v1.2 (addressing Planner Reviewer iteration-2 findings)
- Replaces the standalone `scripts/testDataSanitiser/sanitiser.ts` script (to be removed) with a first-class builder-area CLI under `scripts/builder/src/test-data-sanitiser/`.
- Updated from v1.0 to: (a) broaden the input scope to **any valid JSON** rather than only `ABClass` partial/full hydration shapes; (b) address the Planner Reviewer's Critical findings on category split, UID format detection, idempotency, CLI architecture, and pipeline mutation semantics; (c) fix the British-spelling nitpick.

## Purpose

This document defines the intended behaviour for a developer-facing CLI that converts **any JSON file or directory tree of JSON files** into a sanitised counterpart suitable for use as safe, GDPR-respecting test data.

The feature will be used to:

- Produce a fresh sanitised snapshot of arbitrary JSON inputs (production dumps, fixtures, or hand-written test seeds) on demand, for use as read-only test-data input.
- Guarantee that the listed PII categories — names, emails, user identifiers, document identifiers, and composite leaky fields — are removed or replaced in the output, regardless of where they appear in the JSON tree.
- Provide a deterministic-feeling output for a single run (test data stays stable for the lifetime of the snapshot) while preventing cross-run correlation (mappings change every run because the seed changes).
- Emit a post-run summary that lists, for each input file, the number of substitutions performed per PII category, so the operator can audit the sanitisation.

This feature is **not** intended to:

- Run inside GAS or the production backend. It is a Node developer tool only.
- Round-trip — the sanitised output is consumed read-only and is not expected to be re-parsed by the production model classes.
- Anonymise or pseudonymise at the API layer or in production data. Sanitisation is a one-shot developer workflow.
- Replace privacy review of the data pipeline. The sanitiser reduces the blast radius of leaked test data; it does not absolve the operator from handling production data with care prior to sanitisation.
- Support non-JSON inputs (CSV, YAML, Protobuf, etc.). The CLI is JSON-only.

## Agreed product decisions

1. The sanitiser lives in the builder area at `scripts/builder/src/test-data-sanitiser/`. This places it under the existing builder lint, type-check, Vitest, and 85% coverage gates without re-creating the toolchain.
2. The existing `scripts/testDataSanitiser/sanitiser.ts` is removed. There are no external callers in the repository (verified by grep at planning time).
3. The sanitiser is invoked via a CLI entrypoint: `npm run sanitise:test-data -- --input <path-or-glob>... --output <dir>`. A pure orchestration function `runSanitiserCli(options, deps)` is exported from the CLI module for testability; the package script is a thin wrapper that parses `process.argv` and wires the dependencies.
4. **Input scope**: any valid JSON file is accepted. Top-level values may be objects, arrays, or primitives. Arrays at the root are processed element-by-element with the report recording per-file (not per-element) counts. The walker is shape-agnostic.
5. Output is one sanitised JSON per input file, written to the output directory with the prefix `sanitised_` prepended to the original basename. Originals are never read in place and never overwritten.
6. Internal consistency is guaranteed by a translation map: the same input value always maps to the same sanitised value within a single run. The translation map is **global across all input files in a single run**: a student name appearing in file A and file B maps to the same placeholder (e.g. `studentName3`). File processing order is deterministic (alphabetical by absolute path) so placeholder assignment is reproducible given a fixed seed. Per-file `counts` in the report reflect substitutions applied to that file, but placeholder identity is run-global.
7. The mapping is regenerated every run from a fresh random seed by default. Mappings therefore differ between runs, so test data from two runs cannot be correlated by comparing placeholders.
8. A `--seed <value>` flag is supported for reproducibility. When provided, the string is SHA-256-hashed and the first 4 bytes are used as the mulberry32 initial state (see Seeded-RNG contract). The same `--seed` value + same input therefore always produces the same output. When omitted, a fresh 32-byte `crypto.randomBytes` value is generated (hex-encoded) and used as the seed input string. The effective 8-hex-char seed prefix is recorded in the sanitisation report for audit.
9. PII categories handled explicitly (key-name allowlist matched anywhere in the tree; an explicit match runs before any regex fallback):
   - Student names: `name` (typically in `students[]`), `studentName` (typically in submissions)
   - Teacher names: `teacherName` (typically in `classOwner`, `teachers[]`)
   - Emails: `email` (typically in `classOwner`, `teachers[]`, `students[]`)
   - **User identifiers** (per-student or per-user): `id` (students), `userId` (classOwner, teachers), `studentId` (submissions)
   - **Classroom identifiers** (per-classroom or per-assignment): `classId` (ABClass root), `courseId` (Assignment root)
   - **Submission item identifiers**: recognised by **shape only**, via a regex matched anywhere in the tree. The pattern is `^ssi_[A-Za-z0-9]{16,}$` (matches `ssi_` followed by a 16+ character hash; the canonical length is 16 but the pattern allows more for forward-compat). The walker does not need parent-context inspection: a bare `id` key is **not** interpreted as a submission-item identifier (it falls through to the per-person `userIdentifier` category via the explicit `id` key-match). This avoids the context-sensitive matching that the tree-walker API cannot naturally express.
   - Document identifiers: `documentId` (submissions, artifacts), `referenceDocumentId` (AssignmentDefinition), `templateDocumentId` (AssignmentDefinition)
   - Composite UID fields: `uid` (the serialised artifact identity field emitted by `BaseTaskArtifact.toJSON()`) and `_uid` (the internal constructor name; not present in JSON output but listed for completeness in case a non-standard object is passed in) — only the embedded studentId token is scrambled; the surrounding `taskId`/`role`/`pageId`/`artifactIndex` segments are preserved. See "UID format detection" below.
10. Explicit key-match operates on key name only, independent of nesting level. A `classId` appearing in a nested object is matched the same way as a `classId` at the ABClass root. This is consistent with the existing sanitiser's approach.
11. Schema-agnostic regex fallbacks operate on any string value in the JSON tree, regardless of key. They are the primary safety net for unknown fields (e.g. PII appearing inside `taskNotes`, `metadata`, or artifact `content`):
    - Email regex: standard `local@domain.tld` pattern.
    - Numeric user/student ID regex: word-bounded 15–25 digit numbers (`\b\d{15,25}\b`). Broadened from the current 21-digit assumption; covers Google user IDs that are predominantly numeric. Word boundaries prevent false matches inside longer numeric runs.
    - Loose Google resource ID regex: 25–100 character `[A-Za-z0-9_-]` runs (no leading-character assumption). Word-bounded (`\b[A-Za-z0-9_-]{25,100}\b`).
    - Google Drive URL extraction: extracts IDs from path-based URLs covering `docs.google.com` (Docs, Sheets, Slides, Forms) and `drive.google.com` (folders, files, shared-drive variants), plus query-based URLs (`/open?id=<id>`, `/uc?id=<id>`, etc.). The trailing path segment is permissive (`/.*`) so all known URL variants are matched, e.g. `…/file/d/<id>/view`, `…/file/d/<id>/edit`, `…/file/d/<id>/preview`, `…/document/d/<id>/edit?usp=sharing`, `…/presentation/d/<id>/export/png?id=<id>&pageid=…`. Specifically, the extraction must match all of the following:
      - `https?://docs.google.com/(document|spreadsheets|presentation|forms)/d/<id>(/.*)?` (Docs, Sheets, Slides, Forms — trailing path optional)
      - `https?://drive.google.com/drive/(u/<userIndex>/)?folders/<id>` (folders, with optional user index)
      - `https?://drive.google.com/file/d/<id>(/.*)?` (file-by-id — trailing path optional, e.g. `/view`, `/edit`, `/preview`)
      - `https?://drive.google.com/open?id=<id>` (open by id)
      - `https?://drive.google.com/uc?id=<id>` (download by id)
        The ID length is 25–100 characters from the alphabet `[A-Za-z0-9_-]`. IDs extracted from Google Drive URLs are classified as `documentIdentifier` (see PII category enumeration).
12. Idempotency model: the **translation map is the within-run idempotency guard**. In Pass 1, when the walker encounters a string value, it first checks `translationMap.has(value)`. If present, the value is already in the map (either from a previous key in the same run, or from the explicit-idempotency check below) and is not re-registered. In Pass 2, the rewriter replaces any value found in the map with its registered replacement, and any value not in the map passes through unchanged. This prevents double-scrambling within a single run.
    Placeholder patterns for cross-run recognition (recognising values produced by a previous sanitiser run with a different seed) are a secondary concern. Numbered placeholders (`studentName1`, `userIdentifier2`, etc.) are matched by `^(studentName|teacherName|userIdentifier|classCourseIdentifier|submissionItemIdentifier|documentIdentifier)\d+(_(First|Last(?:2|3)?))?$` (sub-token suffixes are `_First`, `_Last`, `_Last2`, `_Last3`; further sub-tokens are not produced by the scrambler); submission item IDs by `^ssi_[A-Za-z0-9]{16,}$`. Cross-run recognition for emails and Google resource IDs is **not** a goal: the shape-preserving scrambler preserves `@`/`.` and character-class patterns, so a previously-scrambled email will re-match the email regex and be re-scrambled to a new shape-preserving value. This is acceptable and aligns with the user's stated policy that mappings differ between runs.
13. The sanitiser walks the parsed JSON structurally (not by raw string replacement) to avoid corrupting JSON structure, preserve key names, and correctly handle nested arrays and objects.
14. The walker is cycle-safe: it uses a `WeakSet` of visited object references to avoid infinite recursion on cyclic structures. The walker handles all JSON value types: `object`, `array`, `string`, `number`, `boolean`, `null`. Non-string primitives (`null`, `number`, `boolean`) are traversed but produce no PII matches and no translation-map entries.
15. The sanitiser does not mutate the input. The input JSON is parsed, **Pass 1 (discover) reads it read-only**, a deep clone is created, **Pass 2 (apply) mutates the clone**, and the clone is stringified into the output.
16. A post-run summary is written to stdout and to `sanitisation-report.json` in the output directory, listing per-file counts of substitutions per PII category, plus the run seed, totals, and per-file status.
17. The CLI exits `0` on full success, `2` when one or more files errored but at least one succeeded, `1` on fatal error. Fatal errors are strictly **pre-processing** conditions: invalid CLI args (Zod validation failure), the output directory cannot be created or is not writable, the report path is not writable, the random-seed generator throws, or the dependency wiring itself throws before any file is processed. Any failure that occurs **during file processing** (read, parse, deep-clone, walk, rewrite, write) is a **per-file error**: the file gets a `status: 'error'` entry in the report, the error is logged to stderr, and the CLI continues to the next file. The report is always written when at least one file was attempted; it is not written on a fatal pre-processing error. The CLI never exits non-zero on a "no PII found" outcome (that is `0`).
18. The CLI does **not** auto-fix or re-scramble outputs that are already sanitised. Running the CLI on a previously sanitised snapshot is a no-op (idempotency guard) and the exit code remains `0`.
19. UID format detection rule: the walker distinguishes submission-format UIDs from reference/template-format UIDs by **scanning for the `role` segment** rather than by fixed index. The canonical formats are:
    - Submission: `${taskId}-${studentId}-${resolvedPageId ?? 'na'}-0` — 4 segments separated by `-`. The 2nd segment is the student ID (numeric or alphanumeric). No `role` segment. The 2nd segment must match a student-ID pattern (15–25 digits, the same regex used for `userIdentifier`).
    - Reference/template: `${taskId}-${taskIndex}-${role}-${pageId}-${artifactIndex}` — 5 segments separated by `-`. The 3rd segment is the role (`reference`, `template`, or `submission`).
      The detection algorithm: split the UID by `-`; **scan the segments for any segment whose value matches `^(reference|template|submission)$`**. If found at any position, the UID is a reference/template/submission artifact and is left **untouched** (no PII to scrub). If no role segment is found, the UID is a candidate submission-format UID and is processed as follows:
    - Require **exactly 4 segments** (the canonical submission format). UIDs with 3 or fewer, or 5 or more, segments and no role match are **not** recognised as submission UIDs and are left untouched. (For 3-or-fewer segments, the "2nd segment" is missing or near the end and scrambling it would corrupt the format. For 5+ segments, the format is ambiguous and a no-op is the safe choice.)
    - The 2nd segment must match the student-ID pattern (`\b\d{15,25}\b` or the alphanumeric convention from fixtures). If it does not match, the UID is left untouched.
    - Otherwise, **only the 2nd segment is scrambled** (preserving the surrounding `taskId`/`pageId`/`artifactIndex`); the result is reassembled with `-` separators.
      Rationale: the `role` segment is a stable, well-known set of three values; scanning for it (rather than relying on fixed index) avoids fragility if `taskId` ever contains hyphens. The spec assumes `taskId` is in the canonical format `t_<12-char-hash>` (no hyphens) per `TaskDefinition._deriveId`, so in practice the role segment is always at index 2 for reference/template UIDs and at index 1 (i.e. absent) for submission UIDs. The scan-based algorithm is defensive against future changes to the `taskId` format. The 4-segment + student-ID-pattern gate is the additional validation that makes the algorithm robust to non-canonical inputs.
      Edge cases:
    - UIDs with 3 or fewer segments and no role match → **left untouched** (not a canonical submission UID; the 2nd segment does not exist or is the trailing `0`).
    - UIDs with exactly 4 segments and no role match, where segment 2 matches the student-ID pattern → scrambled (canonical submission).
    - UIDs with exactly 4 segments and no role match, where segment 2 does **not** match the student-ID pattern → **left untouched** (not a submission UID; could be an arbitrary hyphenated string).
    - UIDs with 5+ segments and no role match → **left untouched** (not a canonical submission UID; reference/template formats include 5 segments and 5+ suggests an unknown format).
    - UIDs where multiple segments match the role pattern → first match wins; treated as reference/template. This is a defensive no-op (the second match would be a degenerate artifact format).

## Existing system constraints

### Backend or API constraints already in place

- Backend runtime is GAS V8 JavaScript and lives in `src/backend`. The sanitiser is **not** a backend module and is **not** part of the GAS bundle. It is a Node tool.
- The production data shapes are defined by `toJSON()` on the backend models: `ABClass`, `Assignment`, `AssignmentDefinition`, `TaskDefinition`, `StudentSubmission`, `StudentSubmissionItem`, `BaseTaskArtifact`, `Student`, `Teacher`. The sanitiser treats these `toJSON()` outputs as one expected shape among many — not the only supported shape.

### Current data-shape context (informational, not a constraint)

The following shapes are the canonical production payloads the sanitiser is most likely to encounter. The walker is shape-agnostic; this list is for test-fixture construction and operator documentation.

- `ABClass` top-level: `classId`, `className`, `cohortKey`, `courseLength`, `yearGroupKey`, `classOwner`, `teachers`, `students`, `assignments`, `active`.
- `Teacher` shape: `email`, `userId`, optional `teacherName`.
- `Student` shape: `name`, `email`, `id`.
- `StudentSubmission` shape: `studentId`, `studentName`, `assignmentId`, `documentId`, `items`, `createdAt`, `updatedAt`.
- `StudentSubmissionItem` shape: `id` (e.g. `ssi_<hash>`), `taskId`, `artifact`, `assessments`, `feedback`.
- `BaseTaskArtifact` shape: `taskId`, `role`, `pageId`, `documentId`, `content`, `contentHash`, `metadata`, `uid`, `type`. The constructor stores this in `_uid`; the serialised field is `uid`. Both are targeted.
- `Assignment` shape: `courseId`, `assignmentId`, `assignmentName`, `dueDate`, `lastUpdated`, `documentType`, optional root-level `referenceDocumentId`/`templateDocumentId`/`tasks`, embedded `assignmentDefinition`, `submissions`.
- `AssignmentDefinition` shape: includes `referenceDocumentId`, `templateDocumentId`, and a `tasks` map.

### Builder quality-gate constraints

- Builder code lives under `scripts/builder/src/`. The sanitiser must be a subfolder under that root.
- The builder's `tsconfig.json` uses `module: NodeNext` and `moduleResolution: NodeNext` and emits to `scripts/builder/dist/`.
- The builder's `vitest.config.ts` enforces 85% coverage on `src/**/*.ts` (excluding spec files) — this applies to the new sanitiser module.
- The builder's ESLint config (`scripts/builder/eslint.config.js`) is limited to `scripts/builder/src/**/*.ts`. The new sanitiser module is covered automatically.
- The regression-checker CLI is the in-repo precedent for a builder-area CLI: `scripts/builder/src/regression-checker/cli/index.ts`, with separate `cli/`, `config/`, `runners/`, `compare/`, and `storage/` folders. The new sanitiser should follow the same structural conventions, including a pure orchestration function with injected dependencies for testability.

### Runtime and tool constraints

- Node 24 with `@types/node` and `vitest@4` are already installed.
- `zod` is the canonical validation library per the builder AGENTS contract. Configuration shapes for the CLI should be defined as Zod schemas with `z.infer<...>` derived types.
- The builder emits compiled JS into `scripts/builder/dist/`. The sanitiser entrypoint is `scripts/builder/src/test-data-sanitiser/cli/index.ts`, compiled to `scripts/builder/dist/test-data-sanitiser/cli/index.js`.
- The CLI uses `fast-glob` for cross-platform glob expansion. This is added as a `devDependency` in the root `package.json`. (The regression-checker CLI does not need globs, so the precedent does not include this dependency; the sanitiser introduces it.)

## Domain and contract recommendations

### Why this approach is preferable

- **Reusing the builder area** keeps the tool under one set of quality gates, prevents toolchain fragmentation, and provides a battle-tested CLI scaffolding pattern.
- **A JSON-aware walker** eliminates the corruption risk of raw-string replacement and makes the sanitiser correct under arbitrary nesting, key ordering, and whitespace.
- **An explicit key-match layer before any regex fallback** gives fast, provable coverage of the required PII categories. Regex remains the primary safety net for PII that appears in unexpected string fields (e.g. inside `taskNotes`, `metadata`, or artifact `content`).
- **Per-run randomised mapping with internal consistency** matches the GDPR-respecting interpretation the user confirmed: a single run is internally consistent (the same input maps to the same replacement), but two runs of the same input will produce different replacements, so leaked test data from one run cannot be cross-correlated with another. A `--seed` flag enables reproducibility for debugging and audit.

### Recommended data shapes

#### CLI configuration (Zod schema)

```ts
// scripts/builder/src/test-data-sanitiser/config/sanitiser-config.zod.ts
import { z } from 'zod';

export const SanitiserCliOptionsSchema = z.object({
  inputs: z.array(z.string().min(1)).min(1), // file paths or globs
  output: z.string().min(1), // output directory
  report: z.string().optional(), // optional explicit report path
  seed: z.string().min(1).optional(), // optional seed for reproducibility (non-empty)
});

export type SanitiserCliOptions = z.infer<typeof SanitiserCliOptionsSchema>;
```

#### CLI dependencies (injected for testability)

The pure orchestration function `runSanitiserCli(options, deps)` accepts the following injected dependencies. The CLI entrypoint (`cli/index.ts`) wires these to concrete implementations; tests inject mocks.

```ts
// scripts/builder/src/test-data-sanitiser/lib/sanitiser-cli-deps.ts
export type SanitiserCliDeps = {
  /** Read a JSON file from disk and return the parsed value. Throws on parse error. */
  readJsonFile: (path: string) => Promise<unknown>;
  /** Write a string payload to disk. Throws on write error. */
  writeTextFile: (path: string, content: string) => Promise<void>;
  /** Ensure a directory exists, creating it recursively if missing. */
  ensureDirectory: (path: string) => Promise<void>;
  /** List JSON files in a directory recursively; returns absolute paths. */
  listJsonFiles: (dir: string) => Promise<string[]>;
  /** Expand glob patterns into concrete file paths. Returned paths are absolute. */
  expandGlobs: (patterns: string[]) => Promise<string[]>;
  /** Generate a fresh random seed as a hex string. */
  generateRandomSeed: () => string;
  /** Log a normal message to stdout. */
  log: (message: string) => void;
  /** Log an error message to stderr. */
  logError: (message: string) => void;
  /** Current working directory resolver (defaults to process.cwd()). */
  getCwd: () => string;
};
```

#### PII category enumeration

The PII categories are split so the sanitisation report can audit specific identifier types, not just a single "user identifier" bucket.

```ts
type PiiCategory =
  | 'studentName'
  | 'teacherName'
  | 'email'
  | 'userIdentifier' // id, userId, studentId (per-person)
  | 'classCourseIdentifier' // classId, courseId (per-classroom)
  | 'submissionItemIdentifier' // id on StudentSubmissionItem (ssi_*)
  | 'documentIdentifier' // documentId, referenceDocumentId, templateDocumentId,
  //   plus schema-agnostic Google resource IDs matched
  //   by the regex fallback (drive file/folder IDs)
  | 'compositeUid'; // uid / _uid — embedded studentId token

type SanitisationCounts = Record<PiiCategory, number>;
```

#### Translation map entry shape

```ts
type TranslationMap = Map<string, string>; // original PII value -> sanitised value
```

#### Run counters

`RunCounters` tracks only the categories that use **numbered placeholders** during a run (one counter increment per new translation-map entry).

```ts
type RunCounters = {
  studentName: number;
  teacherName: number;
  userIdentifier: number;
  classCourseIdentifier: number;
  submissionItemIdentifier: number;
  documentIdentifier: number; // includes explicit-key matches AND regex-fallback Google resource IDs
};
```

#### Per-file count derivation

Per-file `SanitisationCounts` includes all 8 categories. The numbered-placeholder categories are derived by tagging each translation-map entry with its `PiiCategory` and counting entries that were used by that file. Categories that use **shape-preserving scrambles** (`email`, `compositeUid`) do not have per-run counters and are counted as follows:

- `email`: count of translation-map entries tagged with `email` category that were applied to the file.
- `compositeUid`: count of translation-map entries tagged with `compositeUid` category that were applied to the file (one per submission-format UID scrambled).

A translation-map entry's category is recorded alongside the entry so the report can derive per-file counts without re-walking. The implementation provides a helper `deriveShapePreservingCounts(translationMap, fileOccurrences): { email: number; compositeUid: number }`. Contract:

```ts
// Translation-map value shape (replaces the prior Map<string, string>):
type TranslationMapEntry = { placeholder: string; category: PiiCategory };
type TranslationMap = Map<string, TranslationMapEntry>;

// fileOccurrences is a Set<string> of translation-map keys that were substituted
// during Pass 2 for the current file. The rewriter populates this set as it
// applies each substitution: when it finds a match in translationMap, it adds
// the key to fileOccurrences before writing the replacement. After the rewriter
// completes, deriveShapePreservingCounts is called with the populated set.
//
// Returns the per-file counts for the two shape-preserving categories.
function deriveShapePreservingCounts(
  translationMap: TranslationMap,
  fileOccurrences: Set<string>
): { email: number; compositeUid: number };
```

The helper iterates `fileOccurrences` once, looks up each key in `translationMap`, and increments a counter for `category === 'email'` or `category === 'compositeUid'`. Other categories are ignored (they are tracked via `RunCounters` in the walker, not via the translation map).

#### Sanitisation report shape

```ts
type SanitisationReport = {
  generatedAt: string; // ISO 8601 UTC with milliseconds, e.g. '2026-06-15T12:34:56.789Z'
  //   produced by `new Date().toISOString()` in Node
  runSeed: string; // 8-hex-char effective PRNG seed (see Seeded-RNG contract)
  totalsByCategory: SanitisationCounts;
  files: Array<{
    input: string;
    output: string;
    status: 'ok' | 'error';
    error?: string;
    counts: SanitisationCounts;
  }>;
};
```

### Seeded-RNG contract

The PRNG is a single **mulberry32** instance (a 32-bit-state, well-known non-cryptographic PRNG) created once per CLI run. It is shared across all files and all scrambler calls in that run. The contract:

- **Algorithm**: mulberry32. A pure function `mulberry32(state: number) => number` that, given a 32-bit state, returns a new state and a uniform random number in `[0, 1)`. The implementation is fixed; do not swap PRNGs.
- **Effective seed (32 bits)**: derived from the user-supplied `--seed` value (or auto-generated seed string) by:
  1. Compute SHA-256 of the input string.
  2. Take the **first 4 bytes** of the digest as a big-endian unsigned 32-bit integer.
  3. This 32-bit integer is the mulberry32 initial state.
- **Fresh seed generation**: when `--seed` is omitted, the CLI generates a 32-byte (256-bit) random value via `crypto.randomBytes(32).toString('hex')` and uses that as the user-supplied input string to the derivation above. The hex string is logged for audit; the effective 32-bit seed is what mulberry32 receives.
- **Report `runSeed`**: the **8-character hex prefix** of the SHA-256 digest (i.e. the first 4 bytes), formatted as 8 lowercase hex chars (e.g. `a3b9c2d1`). This is the value an operator can paste back into `--seed` to reproduce a run; pasting the prefix as the user-supplied input is supported (the derivation is deterministic and idempotent on the input string).
- **One instance per run**: the PRNG state is never reset between files. Within a run, the PRNG output depends only on the effective seed and the number of calls made, so placeholder assignment is deterministic given a fixed seed.
- **Per-run uniqueness**: omitting `--seed` produces a fresh 32-byte value, so two runs of the same input produce different outputs.

This contract makes the `runSeed` field in the report self-describing: an operator can copy the 8-hex-char prefix from the report and pass it to a future `--seed` to reproduce the run.

### Naming recommendations

Prefer:

- `studentName<N>`, `teacherName<N>` for full-name placeholders. Sub-token suffixes: `_First`, `_Last`, `_Last2`, …
- `userIdentifier<N>` for `id`/`userId`/`studentId` (per-person). Per-run counter.
- `classCourseIdentifier<N>` for `classId`/`courseId`. Per-run counter.
- `submissionItemIdentifier<N>` for `ssi_*` IDs. Per-run counter.
- `documentIdentifier<N>` for any document id (`documentId`, `referenceDocumentId`, `templateDocumentId`), plus schema-agnostic Google resource IDs matched by the regex fallback. Per-run counter.
- Composite UID: the **scrambled studentId token** in-place; the surrounding UID structure is left untouched.

Avoid:

- Reusing the original value as part of the placeholder (defeats the purpose).
- Generating placeholders shorter than 1 character or longer than 64 characters.
- Including any non-alphanumeric characters in placeholder names other than `_`.

Sub-token registration (splitting a full name into first/last parts and registering each separately for cross-field consistency) applies **only to name categories** (`studentName`, `teacherName`). Identifier categories use direct value-to-placeholder mapping without sub-token decomposition — the assumption is that identifiers do not appear in free-text fields, so cross-field consistency is not required.

### Validation recommendation

CLI input validation:

- All `--input` paths must exist and resolve to regular files or directories (recursive). Globs are expanded by the CLI using `fast-glob` so behaviour is consistent on Windows and POSIX.
- Missing files produce a fatal error and a non-zero exit.
- `--output` must be a writable directory. It is created if it does not exist.
- At least one input must be supplied; otherwise the CLI exits non-zero with a usage message.
- `--seed`, if supplied, must be a non-empty string. The CLI does not validate the seed value itself; any string is acceptable.

Per-file validation:

- Each input file must parse as valid JSON. Parse errors are reported per-file and counted in the report; the CLI continues with the remaining files but exits with code `2` if any file failed.

### Display-resolution recommendation

- Placeholders are deterministic-looking within a run (e.g. `studentName1`, `userIdentifier2`) but are not human-readable. The operator is expected to diff the sanitised output against the original to confirm coverage.
- The `--seed` flag enables reproducing a specific sanitised output for debugging.
- No `--verbose` mode in v1.

## Feature architecture

### Placement

- Source root: `scripts/builder/src/test-data-sanitiser/`
- CLI entrypoint: `scripts/builder/src/test-data-sanitiser/cli/index.ts`
- Configuration: `scripts/builder/src/test-data-sanitiser/config/`
- Core logic (pure modules, no I/O): `scripts/builder/src/test-data-sanitiser/core/`
- Shared helpers (injected dependencies, patterns): `scripts/builder/src/test-data-sanitiser/lib/`
- Tests: `*.spec.ts` alongside source.
- Compiled output: `scripts/builder/dist/test-data-sanitiser/`
- npm script: `"sanitise:test-data": "npm run builder:compile && node scripts/builder/dist/test-data-sanitiser/cli/index.js"` in root `package.json`.
- Removal: `scripts/testDataSanitiser/` directory and its sole file are deleted as part of this change.

### Proposed high-level tree

```text
scripts/builder/src/test-data-sanitiser/
├── cli/
│   ├── index.ts                  # CLI entrypoint: process.argv parsing + dependency wiring + runSanitiserCli invocation
│   ├── run-sanitiser-cli.ts      # Pure orchestration: runSanitiserCli(options, deps)
│   ├── run-sanitiser-cli.spec.ts
│   └── cli-entrypoint.spec.ts    # Tests for argv parsing and dependency wiring
├── config/
│   ├── sanitiser-config.zod.ts   # Zod schema + inferred types
│   └── sanitiser-config.spec.ts
├── core/
│   ├── target-fields.ts          # Explicit field allowlist by category
│   ├── target-fields.spec.ts
│   ├── regex-patterns.ts         # Email / numeric ID / Google ID / URL patterns
│   ├── regex-patterns.spec.ts
│   ├── translation-map.ts        # Translation map + sub-token registration + idempotency guard
│   ├── translation-map.spec.ts
│   ├── pii-walker.ts             # JSON-aware walker (Pass 1: discover)
│   ├── pii-walker.spec.ts
│   ├── sanitise-tree.ts          # Tree rewriter (Pass 2: apply)
│   ├── sanitise-tree.spec.ts
│   ├── scrambler.ts              # Shape-preserving scrambler (seeded)
│   ├── scrambler.spec.ts
│   ├── uid-parser.ts             # Detects submission vs reference/template UID format
│   ├── uid-parser.spec.ts
│   ├── sanitisation-report.ts    # Report shape + writer
│   └── sanitisation-report.spec.ts
├── lib/
│   ├── fs-helpers.ts             # Injected filesystem helpers (readJsonFile, writeJsonFile, listJsonFiles)
│   ├── fs-helpers.spec.ts
│   ├── glob-helpers.ts           # Injected glob expansion (fast-glob wrapper)
│   ├── glob-helpers.spec.ts
│   ├── idempotency-patterns.ts   # Placeholder regexes for all categories
│   ├── idempotency-patterns.spec.ts
│   ├── seeded-rng.ts             # Seeded PRNG for deterministic scrambling
│   └── seeded-rng.spec.ts
├── __fixtures__/                 # Synthetic test fixtures (no real PII)
│   └── abclass-partial.json      # Hand-written fixture mirroring ABClass partial hydration
└── README.md                     # Usage, flags, examples, limitations
```

### Out of scope for this surface

- Round-trip parsing through the production model classes (`Student.fromJSON`, etc.) — the sanitiser works on raw JSON only.
- Anonymisation at the API or production layer.
- Re-running the sanitiser on already-sanitised data to produce a "doubly sanitised" output. The idempotency guard treats already-sanitised data as a no-op.
- Streaming mode for files larger than available memory. The sanitiser loads each input file fully into memory.
- Hash-based or HMAC-based scrambling. v1 uses a seeded PRNG; this is adequate for test data, not for cryptographic anonymisation.
- Diff or comparison against the original input. The CLI only writes sanitised output and a report; the operator is responsible for diffing if they need to audit.
- Renaming the `scripts/builder/` directory itself. The user flagged this as a future consideration but it is out of scope for this spec.

## Data loading and orchestration

### Required datasets or dependencies

- One or more input JSON files (top-level may be object, array, or primitive).
- Writable filesystem access to the output directory.
- `fast-glob` (new devDependency) for cross-platform glob expansion.
- Node 24's `crypto.randomBytes` for fresh seed generation when `--seed` is omitted.

### Prefetch or initialisation policy

#### Startup

- The CLI resolves the working directory to `process.cwd()`.
- The CLI collects the concrete input file list: each `--input` argument is either a direct file path or a glob pattern. Globs are expanded via the injected `expandGlobs` helper. The resulting list (direct paths + expanded globs) is **de-duplicated** and **sorted alphabetically by absolute path**. This is the global file-processing order for the run; it is deterministic regardless of how the operator ordered `--input` arguments or how the underlying glob library returns matches.
- The CLI validates the Zod-shaped options. Invalid options exit `1` with a usage message.
- The CLI generates or accepts the run seed. With `--seed`, the string is SHA-256-hashed and the first 4 bytes are used as the mulberry32 initial state (see Seeded-RNG contract). Without `--seed`, a fresh 32-byte `crypto.randomBytes` value is generated (hex-encoded) and used as the seed input string. The effective 8-hex-char seed prefix is recorded in the report.
- The CLI constructs the in-memory `TranslationMap` and resets `RunCounters` to zero.
- The CLI ensures the output directory exists (creates it if missing).

#### Per-file processing

- Read the input file as UTF-8 text via the injected `fs-helpers.readJsonFile`.
- Parse as JSON. On parse error, log the error to stderr, add a per-file entry to the report with `status: 'error'`, and continue to the next file.
- Pass 1: `piiWalker.discover(parsedJson, translationMap, runCounters)`. The walker traverses the structure, applies the explicit key-match allowlist, registers sub-tokens for names, and applies the regex fallbacks for email, numeric ID, and Google resource ID patterns. Pass 1 is read-only.
- Create a deep clone of the parsed JSON via `structuredClone` (Node 24 native) or equivalent. The clone is wrapped in try/catch; any clone failure (e.g. non-cloneable values, out-of-memory) is treated as a per-file error (`status: 'error'`, exit code contribution to overall `2`).
- **`structuredClone` limitations** (documented for operator awareness): `structuredClone` cannot clone functions, DOM nodes, live `Error` objects with prototype chains, symbols, or class instances whose prototypes have non-cloneable properties. Since the input is the parsed output of `JSON.parse`, all values are guaranteed to be JSON-representable: `string`, `number` (finite; `NaN`/`Infinity` are not valid JSON but are normalised to `null` by some parsers — the sanitiser assumes strict JSON), `boolean`, `null`, plain `Object`, and plain `Array`. None of these trigger the `structuredClone` failure paths. (Note: `JSON.parse` does **not** produce `Date` objects; ISO timestamps are parsed as plain strings. This is by design — JSON has no Date type. The sanitiser does not invoke `JSON.parse` with a reviver.) The try/catch is defensive (e.g. against future input sources) and never fires in practice for JSON input.
- Pass 2: `sanitiseTree.apply(clonedJson, translationMap)`. The rewriter walks the cloned tree and substitutes string values using the translation map.
- Stringify the sanitised tree with **fixed 2-space indentation** (matches the regression-checker convention; the spec does not preserve input formatting because `JSON.parse` discards it).
- Write to `<outputDir>/sanitised_<basename>` via the injected `fs-helpers.writeJsonFile`. On write error, log the error, mark the file entry as `status: 'error'`, and continue.
- Accumulate per-file counts and run-level totals.

#### Manual refresh

- The CLI is invoked on demand. There is no "refresh" — the operator reruns the CLI with the same arguments to regenerate the sanitised output (which will use a fresh seed and therefore differ from the previous run, unless `--seed` is supplied).

### Query or transport additions

- None. The CLI is a local filesystem tool. No network access, no GAS calls, no database connections.

## Core view model or behavioural model

This section is intentionally brief because the sanitiser is a CLI tool with no user-facing UI. The "view model" is the `SanitisationReport` shape defined in the data-shapes section.

### Sanitisation states (per file)

1. **Discovered** — Pass 1 complete, PII entries registered in the translation map.
2. **Sanitised** — Pass 2 complete, sanitised tree in memory.
3. **Persisted** — Sanitised JSON written to the output directory.
4. **Errored** — Parse failure, write failure, or unexpected exception. The file is skipped; the CLI continues.

### Run-level states

1. **In progress** — One or more files not yet processed.
2. **Complete (clean)** — All files processed without error. Exit `0`.
3. **Complete (with errors)** — At least one file errored. Exit `2`. The report indicates which files failed.
4. **Fatal error** — Invalid CLI args or unwritable output directory. Exit `1`. No report is written.

## Main user-facing surface specification

This is a CLI tool, not a UI. The "surface" is the command-line interface and the report file.

### Recommended CLI primitives

- The CLI follows the regression-checker pattern: `cli/index.ts` parses `process.argv` and wires dependencies; `cli/run-sanitiser-cli.ts` exports a pure orchestration function `runSanitiserCli(options, deps)` that accepts injected filesystem and glob helpers. This makes the orchestration testable without filesystem side effects.
- Error output: stderr.
- Normal output: stdout (the report summary).
- Report file: JSON, written to the output directory (default `<output>/sanitisation-report.json`).
- CLI log lines use plain text markers (e.g. `[PASS 1]`, `[PASS 2]`, `[REPORT]`, `[ERROR]`), matching the regression-checker convention rather than emoji.

### Flags

| Flag                          | Required | Description                                                                                                                                                           |
| ----------------------------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--input <path>` (repeatable) | yes      | One or more input file paths or glob patterns. Globs are expanded by the CLI using `fast-glob` so behaviour is consistent on Windows and POSIX.                       |
| `--output <dir>`              | yes      | Output directory. Created if missing.                                                                                                                                 |
| `--report <path>`             | no       | Explicit report path. Defaults to `<output>/sanitisation-report.json`.                                                                                                |
| `--seed <value>`              | no       | Seed for the PRNG. When supplied, the run is deterministic and reproducible. When omitted, a fresh random seed is generated. The seed used is recorded in the report. |

### Visible output (stdout)

After the run, the CLI prints a fixed-structure summary to stdout. The summary includes:

- Total input files processed (and errored).
- Total substitutions per PII category.
- Output directory path.
- Report file path.
- The run seed (truncated to a short prefix for readability; full seed in the report file).
- Exit code (implicit via process exit).

The sanitisation report is a **single aggregated JSON file** written once at the end of the run, summarising all input files. It is not written per-file.

### Sample run

```bash
$ npm run sanitise:test-data -- \
    --input snapshots/abclass-full.json \
    --output test-data/sanitised
[PASS 1] Discovering PII across 1 file(s)...
[PASS 1] Discovered 87 unique translation rules.
[PASS 2] Sanitising 1 file(s)...
[PASS 2] Wrote test-data/sanitised/sanitised_abclass-full.json
[REPORT] Wrote test-data/sanitised/sanitisation-report.json
         studentName: 24
         teacherName: 3
         email: 27
         userIdentifier: 24
         classCourseIdentifier: 2
         submissionItemIdentifier: 24
         documentIdentifier: 4
         compositeUid: 24
[DONE] 1 file(s) sanitised, 0 errored. Seed: a1b2c3d4...
```

## Workflow specification

### Workflow 1: Generate a sanitised snapshot

#### Eligible inputs or preconditions

- The operator has exported data (production or otherwise) into one or more JSON files.
- The output directory is writable (or can be created).
- The CLI is invoked from a shell with `node` available via the project's `node_modules`.

#### Inputs, fields, or confirmation copy

- CLI flags as defined in "Flags" above.

#### Behaviour

- The CLI resolves the inputs, expands globs, and validates that each input exists and is readable.
- The CLI generates or accepts the run seed.
- The CLI processes each file through the two-pass discover/apply pipeline described above.
- The CLI writes the report to the output directory.
- The CLI prints the summary to stdout and exits `0` on full success, `2` on any per-file error.

#### Failure or partial-success behaviour

- A per-file parse error or write error does not abort the entire run. The error is recorded in the report and the next file is processed.
- The CLI exits `2` if at least one file errored.
- A fatal error (invalid CLI args, unwritable output directory) exits `1` with a usage message.

### Workflow 2: Re-generate with a specific seed (reproducibility)

#### Eligible inputs or preconditions

- The operator wants to reproduce a previous run exactly (e.g. for a failed test or audit).

#### Behaviour

- The operator supplies the original seed via `--seed <value>`. The original seed is typically the `runSeed` value from a previous report (the 8-hex-char effective seed prefix), or any other string the operator wants to seed with.
- The CLI SHA-256-hashes the supplied string and uses the first 4 bytes as the mulberry32 initial state. Because the derivation is deterministic, the same `--seed` value + same input always produces the same output.
- The report's `runSeed` matches the 8-hex-char effective seed derived from the supplied string.

#### Failure or partial-success behaviour

- None beyond the per-file error handling in Workflow 1.

### Workflow 3: Re-generate from a previously sanitised snapshot

#### Eligible inputs or preconditions

- The input is itself a sanitised snapshot (or any file containing placeholder values).

#### Behaviour

- The idempotency guard recognises placeholder values and treats them as already-sanitised. Substitutions are minimal (only any PII that escaped a previous run).
- A re-run without `--seed` produces a new snapshot with **different** placeholders (because the seed is fresh) and near-zero substitution counts. The only substitutions would be for any PII that escaped the previous run.

#### Failure or partial-success behaviour

- None beyond the per-file error handling in Workflow 1.

## Error, loading, and empty-state rules

### Blocking failure

- Invalid CLI arguments → exit `1` with a usage message on stderr.
- Output directory is not writable and cannot be created → exit `1` with a clear error.
- At least one input file failed to parse or write → exit `2`, report indicates which file(s).

### Partial-load or partial-success failure

- Some files sanitised, some errored → the CLI exits `2`. The summary explicitly states how many errored and points to the report for details. The operator inspects the report to decide whether to retry.

### Empty states

#### No PII found

- If Pass 1 finds no PII in any file, the substitution counts are all zero. The CLI still writes the sanitised output (which is identical to the input) and a report. Exit `0`.

#### No input files

- If `--input` resolves to zero files, the CLI exits `1` with a usage message ("at least one input file is required"). The report is not written.

#### Output directory is empty after run

- Not applicable; the output directory is always written to if at least one file is sanitised.

## Accessibility and usability notes

- The CLI is a developer tool with no UI accessibility surface.
- The report is plain JSON; consumers should use standard JSON tooling.
- The CLI uses stderr for errors and stdout for normal output, following the POSIX convention. This makes it safe to pipe the summary or the report to other tools.

## Backend changes required to support agreed behaviour

None. The sanitiser is a standalone Node tool that does not interact with the backend runtime. No changes to `src/backend/**` are required.

The cleanup of `scripts/testDataSanitiser/` (the old standalone script) is the only production-tree change outside the builder area, and it is a deletion of a deprecated file.

## Planning handoff notes

- The action plan must sequence work so that the explicit field allowlist (`target-fields.ts`) and the regex patterns (`regex-patterns.ts`) land before the walker; the walker lands before the rewriter; the rewriter lands before the orchestrator and CLI. This is TDD-first and matches the recommended builder-area structure.
- The action plan must include a section that removes the old `scripts/testDataSanitiser/` directory and updates any references in the root `package.json` or docs.
- The action plan must include a documentation section that updates `docs/developer/builder/builder-script.md` with a pointer to a new `docs/developer/builder/test-data-sanitiser.md` (mirroring `regression-checker-how-to.md`). The canonical doc for shared-helper planning entries is `docs/developer/builder/test-data-sanitiser.md`. Cross-references in `docs/developer/builder/builder-script.md` are permitted but sanitiser-specific helpers should not be the primary entry point.
- The shared-helper planning gate applies: the rewriter, walker, scrambler, seeded RNG, idempotency pattern matcher, and filesystem helpers are all candidates for shared-helper classification. The plan should record helper decisions and add planned entries to the relevant canonical doc with status `Not implemented` before implementation starts.

## Testing expectations

- All new code under `scripts/builder/src/test-data-sanitiser/` must have Vitest unit tests alongside the source.
- Coverage must meet the 85% threshold (lines, functions, statements, branches) enforced by `scripts/builder/vitest.config.ts`.
- Tests must cover at minimum:
  - Each explicit PII category (student name, teacher name, email, user identifier, class/course identifier, submission item identifier, document identifier, composite UID) is matched and sanitised.
  - Sub-token registration (first name, last name) works and is consistent.
  - Schema-agnostic regex fallbacks (email, numeric ID, Google resource ID, Google Drive URL) match expected patterns in arbitrary string values.
  - Cycle-safe traversal: a cyclic input does not cause infinite recursion.
  - Idempotency: re-running on an already-sanitised input is a no-op. Verified for each category's placeholder pattern.
  - JSON structural integrity: a deep nested input is sanitised without corrupting the structure.
  - UID token-segment scrambling: the studentId segment of a submission UID is scrambled; the surrounding taskId/role/pageId/artifactIndex segments are preserved.
  - UID format detection: a UID with `role === 'reference' | 'template' | 'submission'` in the 3rd segment is left untouched; a UID with the submission format has only its 2nd segment scrambled.
  - Top-level array input: a JSON array at the root is processed and the report records per-file counts.
  - The report writer produces the expected JSON shape, including the run seed.
  - The CLI orchestration function (`runSanitiserCli`) produces the correct exit code for clean, partial-failure, and fatal-error runs, with injected filesystem/glob helpers.
  - The CLI entrypoint parses `--input`/`--output`/`--report`/`--seed` flags and wires the dependencies.
  - Determinism: with the same `--seed` and the same input, two runs produce identical output.
  - Per-run randomness: without `--seed`, two runs on the same input produce different output.
- Integration test: an end-to-end run on a fixture file produces the expected sanitised output and a non-empty report.
- Lint: `npm run lint:builder` passes with no new warnings.
- Type-check: `npm run builder:compile` passes.
- The test fixtures must be **synthetic** (no real PII). A small, hand-written fixture set is enough.

## Documentation and rollout notes

- Canonical docs to update:
  - `docs/developer/builder/builder-script.md` — add a "Test-data sanitiser" section describing the CLI, flags, and use case.
  - `scripts/builder/src/test-data-sanitiser/README.md` — usage, flags, examples, and limitations.
- `package.json` script `sanitise:test-data` is added. `fast-glob` is added as a `devDependency`.
- Rollout dependency: none. The CLI is opt-in. Existing developers who do not run it are unaffected.
- Explicitly deferred follow-up work:
  - Renaming `scripts/builder/` to a broader name (e.g. `scripts/tooling/`) — flagged by the user as a future consideration; not part of this spec.
  - Adding `--verbose` mode for development.
  - Supporting streaming mode for very large inputs.
  - Supporting non-JSON inputs (CSV, YAML, etc.).
  - Round-trip support (parsing the sanitised output through the production model classes to confirm validity).

## V1 scope recommendation

### Include in v1

- CLI entrypoint with `--input`, `--output`, `--report`, `--seed` flags.
- All PII categories explicitly handled (key match): student name, teacher name, email, user identifier, class/course identifier, submission item identifier, document identifier, composite UID.
- Schema-agnostic regex fallbacks for email, numeric ID, Google resource ID, and Google Drive URLs.
- JSON-aware walker with cycle safety and idempotency.
- Two-pass discover/apply pipeline with internal-consistency translation map.
- Per-run randomised seed by default; `--seed` flag for reproducibility; seed recorded in report.
- Sub-token registration for names (first, last, last2, …).
- Sanitisation report (JSON, per-file and per-category counts).
- Removal of the old `scripts/testDataSanitiser/` directory.
- Vitest unit tests meeting 85% coverage.
- Lint and type-check passing.
- README and developer-doc updates.
- `fast-glob` as a new devDependency.

### Defer from v1

- `--verbose` mode.
- Streaming mode for very large inputs.
- Support for non-JSON inputs.
- Round-trip support (parsing the sanitised output through the production model classes to confirm validity).
- Hash-based or HMAC-based scrambling.
- Renaming `scripts/builder/`.

## Open questions

1. **Folder rename.** The user flagged that `scripts/builder/` now houses more than the builder script (regression-checker, sanitiser, possibly more). The user is thinking about renaming it. This is a deferred decision outside this spec's scope. Recorded for future planning.
2. **Glob library.** The spec recommends `fast-glob` for cross-platform glob expansion. The operator should confirm this choice (alternatives: `glob`, `tinyglobby`, or a small in-house helper). Recorded for confirmation during implementation, not blocking.
3. **Top-level array input support.** Resolved by the user's v1.1 message: any valid JSON is accepted, including top-level arrays. The walker already handles arrays naturally. Recorded in the "Agreed product decisions" section.
4. **Canonical doc target for shared helpers.** Resolved: `docs/developer/builder/test-data-sanitiser.md` (mirroring `regression-checker-how-to.md`). All shared-helper entries for the sanitiser go there.
