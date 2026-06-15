# Test-Data Sanitiser — Feature Delivery Plan (TDD-First)

## Read-First Context

Before writing or executing this plan:

1. Read the current `SPEC.md` (the source of truth for product behaviour, contracts, and scope boundaries for the test-data sanitiser).
2. This feature does not require a layout spec — it is a CLI tool with no user-facing UI.
3. Companion planning docs: none yet. If a layout spec becomes necessary later (it shouldn't, per the SPEC), it must be derived from `SPEC.md` rather than re-deriving decisions here.
4. The plan below splits delivery into small, independently testable sections following a strict TDD-first workflow.

## Scope and assumptions

### Scope

- Implement the test-data sanitiser described in `SPEC.md` as a CLI tool in the builder area at `scripts/builder/src/test-data-sanitiser/`.
- Remove the old standalone script at `scripts/testDataSanitiser/sanitiser.ts`.
- Add an `npm run sanitise:test-data` script to the root `package.json`.
- Add `fast-glob` as a devDependency for cross-platform glob expansion.
- Update developer documentation to cover the new CLI.

### Out of scope

- Renaming `scripts/builder/` to a broader name (e.g. `scripts/tooling/`). Deferred per the user.
- Modifying any backend runtime code under `src/backend/**`.
- Round-tripping sanitised output through production model classes.
- Supporting non-JSON inputs.
- A `--verbose` mode, streaming mode, or any other v1.1 features listed in `SPEC.md`.
- Hash-based or HMAC-based scrambling (only seeded PRNG-based scrambling in v1).

### Assumptions

1. The planner handoff for the sanitiser is complete; this plan does not re-derive product decisions. Any conflict between this plan and `SPEC.md` is resolved in favour of `SPEC.md`.
2. The `scripts/testDataSanitiser/` directory has no external callers in the repository (verified at spec-planning time via grep). The directory can be deleted safely.
3. `fast-glob` is acceptable as a new devDependency. The implementer should confirm with the user if this is in doubt before adding it.
4. The existing builder test infrastructure (Vitest, 85% coverage threshold) is sufficient. No new test framework is introduced.
5. The `--seed` flag is required for v1 (per `SPEC.md` agreed decision 8). It is not deferred.
6. The sanitiser does not need to integrate with any other tooling. It is a standalone CLI invoked on demand.

---

## Global constraints and quality gates

### Engineering constraints

- Keep API/entry points thin and delegate behaviour to services or controllers.
- Fail fast on invalid inputs and persistence failures.
- Avoid defensive guards that hide wiring issues.
- Keep changes minimal, localised, and consistent with repository conventions.
- Use British English in comments and documentation.
- Follow the builder-area TypeScript conventions: `module: NodeNext`, explicit imports/exports, typed interfaces, no implicit `any`.
- Use Zod for CLI options validation, per the builder AGENTS contract (`scripts/builder/AGENTS.md` §8).
- Default values must be set in module constructors only (`scripts/builder/AGENTS.md` §9).

### TDD workflow (mandatory per section)

For each section below:

1. **Red**: write failing tests for the section's acceptance criteria.
2. **Green**: implement the smallest change needed to pass.
3. **Refactor**: tidy implementation with all tests still green.
4. Run section-level verification commands.

### Delegation mandatory-read gate (mandatory for sub-agent execution)

When a section is delegated to sub-agents, the plan must define and enforce mandatory documentation reads.

For each delegated phase (`Testing Specialist`, `Implementation`, `Code Reviewer`, `Docs`):

1. List required documentation file paths under that phase before delegation.
2. Require the sub-agent handoff to include `Files read` with explicit file paths.
3. Verify every mandatory file is listed before accepting the handoff.
4. If any mandatory file is missing, return the work to the same sub-agent and block progression to the next phase.

The mandatory-read list per phase is documented inside each section.

### Shared-helper planning gate (mandatory when helper changes are expected)

When a section is likely to introduce helper reuse, helper extension, or new shared helpers:

1. Record helper decisions in that section before implementation.
2. Include: decision (`reuse` | `extend` | `new` | `keep local`), owning path, and call-site rationale.
3. Add planned helper entries to the relevant canonical docs with status `Not implemented`.
4. During the documentation pass, reconcile planned entries against actual implementation and update status/details accordingly.

The shared-helper planning table is documented in each section that introduces new helpers. The canonical doc target for sanitiser-area helpers is `docs/developer/builder/test-data-sanitiser.md` (a new doc, mirroring `regression-checker-how-to.md`). All shared-helper entries in this plan reference this doc target. If a section's helper is broadly useful outside the sanitiser, it is also cross-referenced in `docs/developer/builder/builder-script.md` as a one-line pointer.

### Validation commands hierarchy

- Builder lint: `npm run lint:builder`
- Builder type-check: `npm run builder:compile`
- Builder tests: `npm run test:builder`
- Builder coverage: `npm run test:builder:coverage`
- Backend tests: `npm test -- <target>` (only if any backend test fixture is touched; not expected)
- Frontend tests: not relevant (no frontend changes)

---

## Section 1 — Sanitiser configuration and dependencies (Zod schema + injected deps)

### Objective

Define the CLI options schema and the injected-dependencies contract that the rest of the sanitiser builds on. Both are pure types/schemas with no runtime behaviour.

### Constraints

- Use Zod (per builder AGENTS contract §8).
- The options schema must reject empty input arrays, empty output strings, and other invalid inputs at parse time.
- The injected-dependencies contract must list every function the orchestration layer needs to call, so the CLI entrypoint can wire them and tests can mock them.

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- `AGENTS.md` (root)
- `scripts/builder/AGENTS.md`
- `SPEC.md` (sections: "Agreed product decisions" 1–8, "Domain and contract recommendations" → "Recommended data shapes" → "CLI configuration" and "CLI dependencies")
- `docs/developer/SPEC_TEMPLATE.md`
- `docs/developer/ACTION_PLAN_TEMPLATE.md`

Implementation mandatory docs:

- `AGENTS.md` (root)
- `scripts/builder/AGENTS.md`
- `SPEC.md` (same scope as above)
- `scripts/builder/src/regression-checker/config/validate-regression-config.zod.ts` (precedent for Zod config pattern in builder area)
- `scripts/builder/src/regression-checker/cli/index.ts` (precedent for injected-deps orchestration)

Code Reviewer mandatory docs:

- `AGENTS.md` (root)
- `scripts/builder/AGENTS.md`
- `SPEC.md` (same scope)
- `docs/developer/builder/builder-script.md` (if a shared-helper entry has been added)

### Shared helper plan (when helper changes are expected)

No new shared helpers in this section. The Zod schema and deps type are local to the sanitiser module.

### Acceptance criteria

- A Zod schema `SanitiserCliOptionsSchema` validates the four flags (`inputs`, `output`, `report`, `seed`).
- The inferred `SanitiserCliOptions` type matches the schema.
- A `SanitiserCliDeps` type is exported from `scripts/builder/src/test-data-sanitiser/lib/sanitiser-cli-deps.ts` with all functions listed in `SPEC.md` "CLI dependencies".
- The schema rejects `inputs: []` (empty array) with a clear error.
- The schema rejects `output: ''` (empty string) with a clear error.
- The schema accepts optional `report` and `seed`.

### Required test cases (Red first)

Schema tests (`sanitiser-config.spec.ts`):

1. `SanitiserCliOptionsSchema` accepts a minimal valid options object: `{ inputs: ['a.json'], output: 'out' }`.
2. `SanitiserCliOptionsSchema` accepts the full options object: `{ inputs: ['a.json', 'b.json'], output: 'out', report: 'rep.json', seed: 'abc123' }`.
3. `SanitiserCliOptionsSchema` rejects `inputs: []` (empty array) with a clear Zod error.
4. `SanitiserCliOptionsSchema` rejects `output: ''` (empty string) with a clear Zod error.
5. `SanitiserCliOptionsSchema` rejects `inputs: ['']` (empty string in array) with a clear Zod error.
6. `SanitiserCliOptionsSchema` rejects `seed: ''` (empty string seed) with a clear Zod error.
7. The inferred TypeScript type `SanitiserCliOptions` has the expected shape (compile-time assertion via test file).

Deps type tests (compile-time only, no runtime test):

- Compile-time assertion that `SanitiserCliDeps` has all 9 expected function members. (Done via a typed `satisfies SanitiserCliDeps` fixture in a test file.)

### Section checks

- `npm run lint:builder` passes.
- `npm run builder:compile` passes.
- `npm run test:builder -- sanitiser-config` passes.
- Coverage of `sanitiser-config.zod.ts` and `sanitiser-cli-deps.ts` is at 100% (small, well-typed files).

### Optional `@remarks` JSDoc follow-through

- None expected for this section. The types are self-documenting.

### Implementation notes / deviations / follow-up

- **Implementation notes:** TBD after implementation.
- **Deviations from plan:** TBD.
- **Follow-up implications for later sections:** Section 2 onwards can import these types and assume they are stable.

---

## Section 2 — Seeded PRNG and shape-preserving scrambler

### Objective

Implement the deterministic, shape-preserving scrambler that the walker uses to replace identifier values. The scrambler must preserve character class (lowercase/uppercase/digit) and special characters (e.g. `@`, `.`, `-`, `_`) while producing different output for different input values, deterministically given a seed.

### Constraints

- The scrambler is a pure function: same input + same seed → same output.
- The scrambler must preserve the exact character length of the input.
- The scrambler must preserve the casing, digit, and special-character pattern of the input (e.g. `arnoldh12@hwbcymru.net` → `pqskjba45@lxodhtru.net`).
- The seeded PRNG must be fast and side-effect-free (no global state).
- The PRNG is seeded once per run; its output feeds the scrambler.

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- `AGENTS.md` (root)
- `scripts/builder/AGENTS.md`
- `SPEC.md` (sections: "Agreed product decisions" 6–8, "Domain and contract recommendations" → "Naming recommendations" → "Avoid")
- `scripts/testDataSanitiser/sanitiser.ts` (lines 39–57 for the existing `preserveShapeScramble` behaviour to replicate; though the new implementation is rewritten, the existing test fixtures are useful for confirming shape-preservation behaviour)

Implementation mandatory docs:

- `AGENTS.md` (root)
- `scripts/builder/AGENTS.md`
- `SPEC.md` (same scope)
- `scripts/builder/src/regression-checker/lib/seeded-rng.ts` if it exists, otherwise a generic seeded PRNG (e.g. mulberry32) is acceptable

Code Reviewer mandatory docs:

- `AGENTS.md` (root)
- `scripts/builder/AGENTS.md`
- `SPEC.md` (same scope)

### Shared helper plan (when helper changes are expected)

1. Helper: `createSeededRng(seed: string): () => number`
   - Decision: `new`
   - Owning path: `scripts/builder/src/test-data-sanitiser/lib/seeded-rng.ts`
   - Call-site rationale: The PRNG is the foundation of the scrambler. It must be a pure factory function so the seed is captured in closure rather than stored in module-level state.
   - Relevant canonical doc target: `docs/developer/builder/test-data-sanitiser.md` (new doc; add planned-only entry under a "Shared helpers" section).
   - Planned doc status: `Not implemented` (to be updated to `Implemented` in Section 9).

2. Helper: `shapePreservingScramble(input: string, rng: () => number): string`
   - Decision: `new`
   - Owning path: `scripts/builder/src/test-data-sanitiser/core/scrambler.ts`
   - Call-site rationale: Used by the walker (Pass 1) to generate replacement values for emails, Google IDs, and composite UID tokens. The rng is injected so the scrambler is testable.
   - Relevant canonical doc target: `docs/developer/builder/test-data-sanitiser.md`.
   - Planned doc status: `Not implemented`.

### Acceptance criteria

- `createSeededRng('abc')` returns a function that produces a deterministic, non-zero sequence of numbers.
- `createSeededRng('abc')` and `createSeededRng('xyz')` produce different sequences.
- `shapePreservingScramble('abc', rng)` returns a 3-character lowercase string.
- `shapePreservingScramble('ABC', rng)` returns a 3-character uppercase string.
- `shapePreservingScramble('123', rng)` returns a 3-digit string.
- `shapePreservingScramble('arnoldh12@hwbcymru.net', rng)` returns a string of the same length with the same `@` and `.` positions and same casing/digit distribution.
- `shapePreservingScramble('user+tag@sub.domain.com', rng)` preserves the `+` character (in addition to `@` and `.`).
- `shapePreservingScramble('abc-def_ghi', rng)` preserves `-` and `_` characters.
- `shapePreservingScramble(input, rng)` is deterministic for a given `(input, rng)` pair.

### Required test cases (Red first)

Seeded RNG tests (`seeded-rng.spec.ts`):

1. Same seed produces same sequence.
2. Different seeds produce different sequences.
3. Sequence contains numbers in `[0, 1)`.
4. Long sequence (1000 calls) does not have obvious periodicity.

Scrambler tests (`scrambler.spec.ts`):

1. Length preservation: output length equals input length.
2. Lowercase letter preservation: `shapePreservingScramble('abc', rng)` returns a string in `[a-z]{3}`.
3. Uppercase letter preservation: `shapePreservingScramble('ABC', rng)` returns a string in `[A-Z]{3}`.
4. Digit preservation: `shapePreservingScramble('123', rng)` returns a string in `[0-9]{3}`.
5. Special-character preservation: `shapePreservingScramble('a@b.c', rng)` returns a string with `@` at position 1 and `.` at position 3.
6. Email shape preservation: `shapePreservingScramble('arnoldh12@hwbcymru.net', rng)` returns a string of length 22 with `@` at position 9 and `.` at position 13 and matching case/digit positions.
7. Special-character preservation: `shapePreservingScramble('abc-def_ghi', rng)` returns a string of length 11 with `-` at position 3 and `_` at position 7, and the letters at positions 0, 1, 2, 4, 5, 6, 8, 9, 10 are lowercase.
8. Plus-alias preservation: `shapePreservingScramble('user+tag@sub.domain.com', rng)` returns a string of the same length with `+` at position 4, `@` at position 8, and `.` at positions 12 and 17 preserved. The `+` is a common email-local-part character and must round-trip through the scrambler.
9. Determinism: same `(input, seed)` produces same output across calls.
10. Different seeds produce different output for the same input.

### Section checks

- `npm run lint:builder` passes.
- `npm run builder:compile` passes.
- `npm run test:builder -- seeded-rng scrambler` passes.
- Coverage of `seeded-rng.ts` and `scrambler.ts` is at 100%.

### Optional `@remarks` JSDoc follow-through

- `createSeededRng`: brief JSDoc note explaining the choice of PRNG and why a seeded PRNG is preferred over `Math.random` for GDPR-respecting mappings.
- `shapePreservingScramble`: JSDoc note explaining that this is NOT cryptographically secure, only suitable for test-data anonymisation.

### Implementation notes / deviations / follow-up

- TBD.

---

## Section 3 — Regex patterns and idempotency-pattern helpers

### Objective

Centralise all regex patterns used by the walker and the placeholder-recognition helpers. These are pure constants and matcher functions, no I/O.

### Constraints

- All patterns are defined in one place (`regex-patterns.ts`).
- The patterns must match the formats specified in `SPEC.md` agreed decision 11.
- The placeholder-recognition patterns (idempotency) must match the placeholder shapes defined in `SPEC.md` agreed decision 12.

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- `AGENTS.md` (root)
- `scripts/builder/AGENTS.md`
- `SPEC.md` (sections: "Agreed product decisions" 11, 12; "Domain and contract recommendations" → "Naming recommendations")
- `scripts/testDataSanitiser/sanitiser.ts` (lines 20–27 for the existing regex patterns; lines 63–81 for the existing `extractGoogleDriveIds`; lines 127–129 for the existing idempotency check)

Implementation mandatory docs:

- `AGENTS.md` (root)
- `scripts/builder/AGENTS.md`
- `SPEC.md` (same scope)
- `scripts/testDataSanitiser/sanitiser.ts` (same lines)

Code Reviewer mandatory docs:

- `AGENTS.md` (root)
- `scripts/builder/AGENTS.md`
- `SPEC.md` (same scope)

### Shared helper plan (when helper changes are expected)

1. Helper: `extractGoogleDriveIds(text: string): string[]`
   - Decision: `new` (replaces the existing function in `scripts/testDataSanitiser/sanitiser.ts`)
   - Owning path: `scripts/builder/src/test-data-sanitiser/core/regex-patterns.ts`
   - Call-site rationale: Used by the walker to extract Drive IDs from URLs in any string value.
   - Relevant canonical doc target: `docs/developer/builder/test-data-sanitiser.md`.
   - Planned doc status: `Not implemented`.

2. Helper: `isNumberedPlaceholder(value: string): boolean`
   - Decision: `new`
   - Owning path: `scripts/builder/src/test-data-sanitiser/lib/idempotency-patterns.ts`
   - Call-site rationale: Recognises cross-run placeholders so they are not re-scrambled.
   - Relevant canonical doc target: `docs/developer/builder/test-data-sanitiser.md`.
   - Planned doc status: `Not implemented`.

3. Helper: `isSubmissionItemId(value: string): boolean`
   - Decision: `new`
   - Owning path: `scripts/builder/src/test-data-sanitiser/lib/idempotency-patterns.ts`
   - Call-site rationale: Recognises `ssi_*` IDs as already-sanitised (or as targets for sanitisation in Pass 1).
   - Relevant canonical doc target: `docs/developer/builder/test-data-sanitiser.md`.
   - Planned doc status: `Not implemented`.

### Acceptance criteria

- `EMAIL_REGEX` matches `arnoldh12@hwbcymru.net` and does not match `not-an-email`.
- `NUMERIC_ID_REGEX` matches 15/17/21/25-digit numbers and does not match a 14-digit or 26-digit number. The regex is word-bounded (`\b\d{15,25}\b`) to avoid false matches inside longer numeric runs.
- `GOOGLE_RESOURCE_ID_REGEX` matches 25/40/100-character `[A-Za-z0-9_-]` strings and does not match a 24-character or 101-character string. The regex is word-bounded (`\b[A-Za-z0-9_-]{25,100}\b`).
- `extractGoogleDriveIds('https://docs.google.com/document/d/abc123...xyz/edit')` returns the ID.
- `extractGoogleDriveIds('https://drive.google.com/drive/u/0/folders/abc123...xyz')` returns the ID.
- `extractGoogleDriveIds('https://drive.google.com/file/d/abc123...xyz/view')` returns the ID.
- `extractGoogleDriveIds('https://drive.google.com/open?id=abc123...xyz')` returns the ID.
- `extractGoogleDriveIds('https://drive.google.com/uc?id=abc123...xyz')` returns the ID.
- `isNumberedPlaceholder('studentName1')` returns `true`.
- `isNumberedPlaceholder('userIdentifier3_First')` returns `true`.
- `isNumberedPlaceholder('userIdentifier3_Last2')` returns `true`.
- `isNumberedPlaceholder('notAPlaceholder')` returns `false`.
- `isSubmissionItemId('ssi_abc12345678')` returns `true`.
- `isSubmissionItemId('abc')` returns `false`.

### Required test cases (Red first)

Regex tests (`regex-patterns.spec.ts`):

1. Email regex: matches 5 positive examples (standard, dots in local, hyphens in domain, subdomains, plus aliases) and 3 negative examples.
2. Numeric ID regex: matches 15/17/21/25-digit positive examples and rejects 14/26-digit negative examples.
3. Google resource ID regex: matches 25/40/100-character positive examples and rejects 24/101-character negative examples.
4. Google Drive URL extraction: positive cases for each of the 5 URL formats specified in `SPEC.md` agreed decision 11; negative case for a non-URL string.

Idempotency-pattern tests (`idempotency-patterns.spec.ts`):

1. Numbered placeholder matcher: positive cases for all 5 numbered-placeholder categories (studentName, teacherName, userIdentifier, classCourseIdentifier, documentIdentifier) with and without `_First`/`_Last`/`_Last2`/`_Last3` suffixes; negative cases for arbitrary strings. The pattern matches `_(First|Last(?:2|3)?)?` exactly.
2. Submission item ID matcher: positive cases for `ssi_` + 16 alphanumeric chars (canonical) and 17+ chars (forward-compat); negative cases for `ssi_` + 8 chars and arbitrary strings.

### Section checks

- `npm run lint:builder` passes.
- `npm run builder:compile` passes.
- `npm run test:builder -- regex-patterns idempotency-patterns` passes.
- Coverage of `regex-patterns.ts` and `idempotency-patterns.ts` is at 100%.

### Optional `@remarks` JSDoc follow-through

- `EMAIL_REGEX`: brief JSDoc note that this is intentionally permissive to catch any email-like pattern.
- `extractGoogleDriveIds`: JSDoc note listing which URL formats are supported and that the function is additive (new formats can be added by extending the patterns).

### Implementation notes / deviations / follow-up

- TBD.

---

## Section 4 — Target fields and translation map

### Objective

Implement the explicit field allowlist (key-match layer) and the translation map (the within-run idempotency guard). The translation map also handles sub-token registration for names.

### Constraints

- The target fields are defined as a constant set per PII category, with no mutation at runtime.
- The translation map is a stateful object (Map) that the walker reads and the rewriter consumes.
- Sub-token registration applies only to name categories (per `SPEC.md` naming recommendations).
- The map is created fresh per run; no module-level global state.

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- `AGENTS.md` (root)
- `scripts/builder/AGENTS.md`
- `SPEC.md` (sections: "Agreed product decisions" 9, 10, 12; "Domain and contract recommendations" → "Naming recommendations", "Translation map entry shape", "Run counters")
- `scripts/testDataSanitiser/sanitiser.ts` (lines 88–103 for the existing `registerNameWithSubTokens` function)

Implementation mandatory docs:

- `AGENTS.md` (root)
- `scripts/builder/AGENTS.md`
- `SPEC.md` (same scope)
- `scripts/testDataSanitiser/sanitiser.ts` (same lines)

Code Reviewer mandatory docs:

- `AGENTS.md` (root)
- `scripts/builder/AGENTS.md`
- `SPEC.md` (same scope)

### Shared helper plan (when helper changes are expected)

1. Helper: `createTranslationMap(rng: () => number): TranslationMap`
   - Decision: `new`
   - Owning path: `scripts/builder/src/test-data-sanitiser/core/translation-map.ts`
   - Call-site rationale: The factory captures the rng in closure so the walker can call `register` and the rewriter can call `lookup` without re-passing the rng. Supports test isolation.
   - Relevant canonical doc target: `docs/developer/builder/test-data-sanitiser.md`.
   - Planned doc status: `Not implemented`.

2. Helper: `TARGET_FIELDS: TargetFieldsConfig`
   - Decision: `new`
   - Owning path: `scripts/builder/src/test-data-sanitiser/core/target-fields.ts`
   - Call-site rationale: A constant object mapping each PII category to its key allowlist. The walker imports this and consults it in Pass 1.
   - Relevant canonical doc target: `docs/developer/builder/test-data-sanitiser.md`.
   - Planned doc status: `Not implemented`.

### Acceptance criteria

- `TARGET_FIELDS` lists all 8 PII categories with their respective key names.
- A `TranslationMap` instance supports `register(original, replacement)`, `lookup(original)`, `has(original)`, and `size()`.
- Registering the same original twice is a no-op (idempotency within a run).
- Sub-token registration splits a full name on whitespace and registers each token (length > 2) with `_First`/`_Last`/`_Last2` suffixes.
- Single-token names (no whitespace) are not sub-token-registered.

### Required test cases (Red first)

Target fields tests (`target-fields.spec.ts`):

1. `TARGET_FIELDS.studentNames` contains `'name'` and `'studentName'`.
2. `TARGET_FIELDS.teacherNames` contains `'teacherName'`.
3. `TARGET_FIELDS.emails` contains `'email'`.
4. `TARGET_FIELDS.userIdentifiers` contains `'id'`, `'userId'`, `'studentId'`.
5. `TARGET_FIELDS.classCourseIdentifiers` contains `'classId'`, `'courseId'`.
6. `TARGET_FIELDS.submissionItemIdentifiers` contains `'id'`.
7. `TARGET_FIELDS.documentIdentifiers` contains `'documentId'`, `'referenceDocumentId'`, `'templateDocumentId'`.
8. `TARGET_FIELDS.compositeUidFields` contains `'uid'` and `'_uid'`.

Translation map tests (`translation-map.spec.ts`):

1. Empty map: `size()` returns 0; `has('x')` returns false; `lookup('x')` returns undefined.
2. Register and lookup: `register('a', 'b')` then `lookup('a')` returns `'b'`.
3. Idempotent register: `register('a', 'b')` then `register('a', 'c')`; `lookup('a')` still returns `'b'`.
4. Sub-token registration for a two-part student name: `registerNameWithSubTokens('Ada Lovelace', 'studentName1', map)` registers `'Ada Lovelace'`, `'Ada'` (as `studentName1_First`), and `'Lovelace'` (as `studentName1_Last`).
5. Sub-token registration for a two-part teacher name: `registerNameWithSubTokens('Ms Smith', 'teacherName1', map)` registers `'Ms Smith'`, `'Ms'` (as `teacherName1_First`), and `'Smith'` (as `teacherName1_Last`).
6. Sub-token registration for a three-part name: `registerNameWithSubTokens('Ada Marie Lovelace', 'studentName1', map)` registers the full name plus three sub-tokens (`_First`, `_Last`, `_Last2`).
   6a. Sub-token registration for a four-part name: `registerNameWithSubTokens('Ada Marie Grace Lovelace', 'studentName1', map)` registers the full name plus four sub-tokens (`_First`, `_Last`, `_Last2`, `_Last3`). This is the upper bound of sub-token production; five-or-more-part names are not produced by the sanitiser (the walker treats any sub-token at index ≥ 4 as not-registerable and registers only the first four).
7. Sub-token registration for a single-token name: `registerNameWithSubTokens('Madonna', 'studentName1', map)` registers only the full name.
8. Sub-token registration for a name with a short token: `registerNameWithSubTokens('John A. Smith', 'studentName1', map)` skips the `'A.'` token (length ≤ 2).
9. Sub-token registration for a name with a duplicate token: `registerNameWithSubTokens('John Smith John', 'studentName1', map)` does not re-register an already-registered token (the second `'John'`).
10. Sub-token registration is **never** called for non-name categories. The translation map provides a `registerWithCategory(value, placeholder, category)` API for identifier categories (`userIdentifier`, `classCourseIdentifier`, `submissionItemIdentifier`, `documentIdentifier`, `compositeUid`, `email`) that does not split values into sub-tokens. A unit test asserts that the API is a direct value-to-placeholder mapping without any whitespace tokenisation.
11. The translation map entry shape includes a `PiiCategory` tag so the report can derive per-file and run-total counts. `map.set(value, { placeholder, category })` (or equivalent typed shape). The lookup API returns the placeholder string (backwards-compatible).

### Section checks

- `npm run lint:builder` passes.
- `npm run builder:compile` passes.
- `npm run test:builder -- target-fields translation-map` passes.
- Coverage of `target-fields.ts` and `translation-map.ts` is at 100%.

### Optional `@remarks` JSDoc follow-through

- `createTranslationMap`: JSDoc note explaining the within-run idempotency contract.
- `registerNameWithSubTokens`: JSDoc note explaining why sub-tokens are registered (catching casual name usage in free-text fields) and why short tokens are skipped (avoiding false positives like middle initials).

### Implementation notes / deviations / follow-up

- TBD.

---

## Section 5 — UID parser

### Objective

Implement the UID format detection that distinguishes submission-format UIDs from reference/template-format UIDs.

### Constraints

- Detection must work for UIDs of varying segment counts (3 to 7+).
- The algorithm must scan for the `role` segment rather than relying on fixed index (per `SPEC.md` agreed decision 19).
- The function must classify a UID as one of: `reference`, `template`, `submission-format`, or `unknown`.
- For `submission-format` UIDs, the function must return the index of the studentId segment (always 1, but returned for future-proofing).
- For non-submission UIDs, no segment index is returned (the UID is left untouched).

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- `AGENTS.md` (root)
- `scripts/builder/AGENTS.md`
- `SPEC.md` (section: "Agreed product decisions" 19)
- `src/backend/Models/StudentSubmission.js` (line 269 for the submission UID format)
- `src/backend/Models/Artifacts/0_BaseTaskArtifact.js` (lines 52–54 for the reference/template UID format)
- `src/backend/Models/TaskDefinition.js` (line 56 for the taskId format)

Implementation mandatory docs:

- `AGENTS.md` (root)
- `scripts/builder/AGENTS.md`
- `SPEC.md` (same scope)
- Same backend model files

Code Reviewer mandatory docs:

- `AGENTS.md` (root)
- `scripts/builder/AGENTS.md`
- `SPEC.md` (same scope)

### Shared helper plan (when helper changes are expected)

1. Helper: `parseSubmissionUid(uid: string): { studentIdSegment: string; prefix: string; suffix: string } | null`
   - Decision: `new`
   - Owning path: `scripts/builder/src/test-data-sanitiser/core/uid-parser.ts`
   - Call-site rationale: Returns the segments of a submission-format UID so the walker can scramble only the studentId segment. Returns null for non-submission UIDs.
   - Relevant canonical doc target: `docs/developer/builder/test-data-sanitiser.md`.
   - Planned doc status: `Not implemented`.

2. Helper: `detectRoleSegment(uid: string): 'reference' | 'template' | 'submission' | null`
   - Decision: `new`
   - Owning path: `scripts/builder/src/test-data-sanitiser/core/uid-parser.ts`
   - Call-site rationale: Returns the role segment value if found, or null. Used internally by `parseSubmissionUid` and exposed for diagnostics.
   - Relevant canonical doc target: `docs/developer/builder/test-data-sanitiser.md`.
   - Planned doc status: `Not implemented`.

### Acceptance criteria

The parser uses a **scan-based role detection** algorithm combined with **structural validation** (4 segments, segment 2 matches the student-ID pattern). The acceptance criteria:

- `parseSubmissionUid('t_abc123-12345678901234567-p1-0')` returns `{ studentIdSegment: '12345678901234567', prefix: 't_abc123-', suffix: '-p1-0' }` (canonical 4-segment submission with 17-digit studentId).
- `parseSubmissionUid('t_abc123-S001-p1-0')` returns `null` (segment 2 is `'S001'`, not a student-ID pattern).
- `parseSubmissionUid('t_abc123-0-reference-p-1-0')` returns `null` (reference UID, not submission — role segment found).
- `parseSubmissionUid('t_abc123-0-template-p-1-0')` returns `null` (template UID, not submission — role segment found).
- `parseSubmissionUid('t_abc123-S001-p-1-0')` returns `null` (5 segments, no role match — not a canonical submission).
- `parseSubmissionUid('a-b-c')` returns `null` (3 segments, not a canonical submission).
- `parseSubmissionUid('a-b-c-d')` returns `null` (4 segments, segment 2 is `'b'`, not a student-ID pattern).
- `parseSubmissionUid('a-12345678901234567-c-d')` returns `{ studentIdSegment: '12345678901234567', prefix: 'a-', suffix: '-c-d' }` (4 segments, segment 2 matches student-ID pattern).
- `parseSubmissionUid('a-b-c-d-e-f')` returns `null` (6 segments, not a canonical submission).
- `parseSubmissionUid('t_abc-def-0-reference-p-1-0')` returns `null` (role found at non-standard index, treated as reference).
- `parseSubmissionUid('reference')` returns `null` (single segment equal to role — degenerate, not a submission).
- `detectRoleSegment('t_abc123-0-reference-p-1-0')` returns `'reference'`.
- `detectRoleSegment('t_abc123-0-template-p-1-0')` returns `'template'`.
- `detectRoleSegment('t_abc123-12345678901234567-p-1-0')` returns `null` (no role segment).

### Required test cases (Red first)

UID parser tests (`uid-parser.spec.ts`):

1. `parseSubmissionUid` positive case: 4-segment canonical submission with student-ID-pattern segment 2 returns the parsed result.
2. `parseSubmissionUid` negative case: 4-segment with non-student-ID segment 2 returns `null`.
3. `parseSubmissionUid` negative case: reference UID returns `null`.
4. `parseSubmissionUid` negative case: template UID returns `null`.
5. `parseSubmissionUid` negative case: 5-segment with no role returns `null`.
6. `parseSubmissionUid` negative case: 3-segment returns `null`.
7. `parseSubmissionUid` negative case: 6-segment with no role returns `null`.
8. `parseSubmissionUid` negative case: single-segment equal to role returns `null`.
9. `parseSubmissionUid` defensive scan: a UID where the `role` segment appears at a non-standard index (e.g., `'t_abc-extra-reference-p-1-0'`) returns `null` (the role segment is found, so the UID is not a submission).
10. `parseSubmissionUid` with `taskId` containing hyphens: `'t_abc-def-0-reference-p-1-0'` is correctly classified as reference because the role segment is found (verifies the scan is hyphen-safe).
11. `detectRoleSegment` positive cases (3 cases: reference at standard index, reference at non-standard index, template).
12. `detectRoleSegment` negative cases (3 cases: no role, empty string, single-segment).
13. The scrambler integration: when applied to the `studentIdSegment` of a submission UID, the resulting UID has the prefix and suffix intact and only the segment scrambled. The round-tripped UID is re-parseable as a submission UID (the role scan still doesn't find a role segment, since the scrambled segment is still digits and not `^(reference|template|submission)$`).

### Section checks

- `npm run lint:builder` passes.
- `npm run builder:compile` passes.
- `npm run test:builder -- uid-parser` passes.
- Coverage of `uid-parser.ts` is at 100%.

### Optional `@remarks` JSDoc follow-through

- `parseSubmissionUid`: JSDoc note explaining the scan-based algorithm and the canonical taskId format assumption.

### Implementation notes / deviations / follow-up

- TBD.

---

## Section 6 — JSON-aware walker (Pass 1: discover)

### Objective

Implement the cycle-safe JSON walker that, given a parsed JSON value, populates the translation map with all discovered PII values.

### Constraints

- The walker is cycle-safe (uses `WeakSet` to track visited objects).
- The walker is read-only (does not mutate the input).
- The walker consults the explicit field allowlist (`TARGET_FIELDS`) first, then applies the regex fallbacks on string values.
- The walker applies sub-token registration for name fields.
- The walker uses the UID parser to handle composite UID fields differently.
- The walker handles all JSON value types: object, array, string, number, boolean, null.
- The walker increments the `RunCounters` as it processes.

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- `AGENTS.md` (root)
- `scripts/builder/AGENTS.md`
- `SPEC.md` (sections: "Agreed product decisions" 9–19, "Domain and contract recommendations" → "Naming recommendations", "Run counters")
- `scripts/testDataSanitiser/sanitiser.ts` (lines 110–194 for the existing `discoverPII`; the new walker is rewritten but the test cases are useful)

Implementation mandatory docs:

- `AGENTS.md` (root)
- `scripts/builder/AGENTS.md`
- `SPEC.md` (same scope)
- `scripts/testDataSanitiser/sanitiser.ts` (same lines)

Code Reviewer mandatory docs:

- `AGENTS.md` (root)
- `scripts/builder/AGENTS.md`
- `SPEC.md` (same scope)

### Shared helper plan (when helper changes are expected)

1. Helper: `discoverPII(data: unknown, translationMap: TranslationMap, counters: RunCounters): void`
   - Decision: `new`
   - Owning path: `scripts/builder/src/test-data-sanitiser/core/pii-walker.ts`
   - Call-site rationale: The discover pass. Mutates the translationMap and counters in place.
   - Relevant canonical doc target: `docs/developer/builder/test-data-sanitiser.md`.
   - Planned doc status: `Not implemented`.

### Acceptance criteria

- The walker handles top-level objects, arrays, primitives, and null.
- The walker handles deeply nested objects and arrays (test depth ≥ 5).
- The walker is cycle-safe: a self-referential input does not cause stack overflow.
- The walker increments `studentName` counter for each `name`/`studentName` field encountered.
- The walker increments `teacherName` counter for each `teacherName` field.
- The walker increments `userIdentifier` counter for each `id`/`userId`/`studentId` field.
- The walker increments `classCourseIdentifier` counter for each `classId`/`courseId` field.
- The walker increments `submissionItemIdentifier` counter for each `ssi_*` value matched by the shape regex (`^ssi_[A-Za-z0-9]{16,}$`). The walker does **not** inspect parent context: a bare `id` key is interpreted as `userIdentifier`, not `submissionItemIdentifier`. This is the implementation of the simplified rule from the spec.
- The walker increments `documentIdentifier` counter for each `documentId`/`referenceDocumentId`/`templateDocumentId` field, AND for each Google resource ID matched by the regex fallback (extracted from a URL or matched as a loose ID run).
- The walker **does not** increment a `compositeUid` counter directly. Instead, it registers a translation-map entry tagged with `PiiCategory.compositeUid` for the embedded studentId segment of a submission-format UID. Per-file and run-total `compositeUid` counts are derived from the translation map via the `deriveShapePreservingCounts` helper (see `SPEC.md` Seeded-RNG contract / Per-file count derivation). The walker reports the category tag on each translation-map entry it creates.
- The walker registers emails found in `email` fields AND in any string value matching the email regex (fallback). Email entries are tagged with `PiiCategory.email`; per-file counts are derived from the translation map.
- The walker registers numeric IDs (15–25 digits, word-bounded) found in any string value matching the numeric ID regex.
- The walker registers Google resource IDs (loose 25–100 char runs) found in any string value matching the Google ID regex; these are tagged with `PiiCategory.documentIdentifier`.
- The walker extracts and registers Google Drive IDs from URLs in any string value; these are tagged with `PiiCategory.documentIdentifier`.
- The walker does not re-register values already in the translation map (within-run idempotency).
- The walker does not register values matching the placeholder patterns (cross-run idempotency, best-effort).

### Required test cases (Red first)

Walker tests (`pii-walker.spec.ts`):

1. Empty object: walker completes with zero counts and empty map.
2. Empty array: walker completes with zero counts and empty map.
3. Primitives at root (string, number, boolean, null): walker completes with zero counts and empty map. `null` does not match any PII rule and produces no translation-map entry.
4. Single student name in `students[0].name`: walker registers the name with `studentName1` and increments `studentName` by 1.
5. Single teacher name in `classOwner.teacherName`: walker registers the name with `teacherName1` and increments `teacherName` by 1.
6. Email in `email` field: walker registers the email tagged with `PiiCategory.email`; the per-file `email` count is derived from the translation map (e.g. via `deriveShapePreservingCounts`).
7. Email in `taskNotes` string (fallback): same as case 6 but triggered by the regex fallback.
8. Student `id` in `students[0].id`: walker registers and increments `userIdentifier` count.
9. Classroom `classId` at root: walker registers and increments `classCourseIdentifier` count.
10. Submission item `id` (`ssi_*`) in `submissions[0].items[taskId].id`: walker registers and increments `submissionItemIdentifier` count (matched by shape regex, not parent context).
11. Document ID in `submissions[0].documentId`: walker registers and increments `documentIdentifier` count.
12. Reference document ID in `assignmentDefinition.referenceDocumentId`: walker registers and increments `documentIdentifier` count.
13. Composite UID in `artifact.uid` (submission format, e.g. `t_abc123456789-12345678901234567-p1-0`): walker registers the studentId segment tagged with `PiiCategory.compositeUid`; the per-file `compositeUid` count is derived from the translation map (one entry per scrambled submission-format UID).
14. Composite UID in `artifact.uid` (reference format, e.g. `t_abc123456789-0-reference-p1-0`): walker does NOT register or increment (the role segment is found and the UID is left untouched).
15. Numeric ID (21 digits, word-bounded) in a string fallback: walker registers and increments `userIdentifier` count.
16. Google resource ID (loose 25–100 char run) in a string fallback: walker registers and increments `documentIdentifier` count.
17. Google Drive URL in a string: walker extracts and registers the ID with `documentIdentifier` tag.
18. Cyclic object input: `const obj = {}; obj.self = obj;` — walker completes without stack overflow.
19. Cyclic array input: `const arr = []; arr.push(arr);` — walker completes without stack overflow.
20. Deeply nested input (depth 10): walker handles correctly.
21. Within-run idempotency: the same email appearing in two places is registered only once.
22. Cross-run placeholder recognition: input containing `studentName1` is NOT re-registered.
23. Top-level array input: walker processes each element and registers PII from all elements.
24. Explicit `uid` key with non-submission format (e.g. 3 segments, no role match): walker does NOT register or increment (fails the 4-segment + student-ID-pattern gate).
25. UID with 4 segments where segment 2 is not a student-ID pattern: walker does NOT register or increment.
26. UID with 5+ segments and no role match: walker does NOT register or increment.
27. UID with 4 segments, no role match, segment 2 matches student-ID pattern: walker registers the segment 2 (studentId) as `compositeUid` category and only that segment is scrambled.
28. Sub-token registration does NOT apply to UID studentId segments: the segment is registered as a direct `compositeUid` category entry (not split into name sub-tokens).
29. Translation map is global across files: the same email appearing in two separate file inputs (processed sequentially) maps to the same sanitised value and increments the `email` derived count in both files.
30. Explicit `_uid` key in object: walker handles identically to `uid` (registers submission-format studentId, leaves others untouched).

### Section checks

- `npm run lint:builder` passes.
- `npm run builder:compile` passes.
- `npm run test:builder -- pii-walker` passes.
- Coverage of `pii-walker.ts` is at ≥ 90% (cycle safety is hard to cover to 100%).

### Optional `@remarks` JSDoc follow-through

- `discoverPII`: JSDoc note explaining the two-layer approach (explicit key match + regex fallback) and the cycle-safety mechanism.

### Implementation notes / deviations / follow-up

- TBD.

---

## Section 7 — Tree rewriter (Pass 2: apply)

### Objective

Implement the tree rewriter that, given a parsed JSON clone and a populated translation map, returns a sanitised tree with all translation-map values substituted.

### Constraints

- The rewriter is called on a deep clone of the parsed JSON (Pass 1 does not mutate the input).
- The rewriter replaces string values found in the translation map; values not in the map pass through unchanged.
- The rewriter uses the UID parser to re-assemble UIDs after scrambling the studentId segment.
- The rewriter handles all JSON value types: object, array, string, number, boolean, null.
- The rewriter **populates a per-file `fileOccurrences: Set<string>`** as it applies each substitution. The set is a sibling output (not returned from the rewriter; the orchestrator creates and supplies it). After the rewriter completes, the set is passed to `deriveShapePreservingCounts` (Section 8) to derive per-file `email` and `compositeUid` counts.

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- `AGENTS.md` (root)
- `scripts/builder/AGENTS.md`
- `SPEC.md` (sections: "Agreed product decisions" 13, 15, 19; "Domain and contract recommendations" → "Per-file count derivation"; "Data loading and orchestration" → "Per-file processing")
- `scripts/testDataSanitiser/sanitiser.ts` (lines 200–219 for the existing `applySanitization`; the new rewriter is JSON-aware and rewritten)

Implementation mandatory docs:

- `AGENTS.md` (root)
- `scripts/builder/AGENTS.md`
- `SPEC.md` (same scope)
- `scripts/testDataSanitiser/sanitiser.ts` (same lines)

Code Reviewer mandatory docs:

- `AGENTS.md` (root)
- `scripts/builder/AGENTS.md`
- `SPEC.md` (same scope)

### Shared helper plan (when helper changes are expected)

1. Helper: `applySanitisation(data: unknown, translationMap: TranslationMap, fileOccurrences: Set<string>): unknown`
   - Decision: `new`
   - Owning path: `scripts/builder/src/test-data-sanitiser/core/sanitise-tree.ts`
   - Call-site rationale: The apply pass. Returns a new tree with substitutions applied. Mutates the input clone in place (the input is already a deep clone, so this is safe). As it applies each substitution, the rewriter adds the matched translation-map key to `fileOccurrences` so the report writer can derive per-file `email` and `compositeUid` counts.
   - Relevant canonical doc target: `docs/developer/builder/test-data-sanitiser.md`.
   - Planned doc status: `Not implemented`.

### Acceptance criteria

- The rewriter handles top-level objects, arrays, primitives, and null.
- The rewriter handles deeply nested objects and arrays.
- The rewriter replaces every value found in the translation map with its corresponding replacement.
- The rewriter leaves values not in the translation map unchanged.
- The rewriter correctly re-assembles submission-format UIDs after scrambling the studentId segment.
- The rewriter leaves reference/template-format UIDs unchanged.
- The rewriter does not corrupt the JSON structure (keys are preserved, array order is preserved).
- The rewriter populates the supplied `fileOccurrences` set with the keys of every translation-map entry it substitutes. A unit test asserts that the set contains exactly the keys that were substituted and no others.

### Required test cases (Red first)

Rewriter tests (`sanitise-tree.spec.ts`):

1. Empty translation map: rewriter returns the input clone unchanged; `fileOccurrences` is empty.
2. Single replacement: input `{ name: 'Ada' }` with map `{'Ada' → 'studentName1'}` produces `{ name: 'studentName1' }`; `fileOccurrences` is `Set(['Ada'])`.
3. Multiple replacements: input `{ name: 'Ada', email: 'ada@school.com' }` with appropriate map produces sanitised output; `fileOccurrences` contains both keys.
4. Nested replacement: input `{ class: { teacher: { name: 'Ms Smith' } } }` with map produces sanitised nested output; `fileOccurrences` contains the matched key.
5. Array replacement: input `[{ name: 'Ada' }, { name: 'Bob' }]` with map produces sanitised array; `fileOccurrences` contains both names.
6. UID re-assembly: input `{ uid: 't_abc-12345678901234567-p-1-0' }` with map `{'12345678901234567' → 'userIdentifier1'}` produces `{ uid: 't_abc-userIdentifier1-p-1-0' }` (the studentId segment is a user identifier, not a name). `fileOccurrences` contains the studentId key, not the full UID (the walker registered the segment, not the UID).
7. Non-mutation of input: rewriter does not mutate the input clone (deep equality check).
8. fileOccurrences is populated only for keys that were actually substituted: passing a translation map with 3 entries but only 2 of them are referenced in the input — the `fileOccurrences` set contains only the 2 referenced keys.

### Section checks

- `npm run lint:builder` passes.
- `npm run builder:compile` passes.
- `npm run test:builder -- sanitise-tree` passes.
- Coverage of `sanitise-tree.ts` is at ≥ 90%.

### Optional `@remarks` JSDoc follow-through

- `applySanitisation`: JSDoc note explaining the within-run consistency guarantee (same input → same output via the map) and the assumption that the input is a deep clone (caller's responsibility).

### Implementation notes / deviations / follow-up

- TBD.

---

## Section 8 — Sanitisation report writer

### Objective

Implement the report shape and writer that produces the `sanitisation-report.json` file with per-file and per-category counts.

### Constraints

- The report shape matches `SPEC.md` "Sanitisation report shape".
- The report is written once at the end of the run as a single aggregated JSON file.
- The report includes the run seed, totals, and per-file status.
- Per-file counts include all 8 PII categories (even if zero). The `email` and `compositeUid` counts per file are derived from the translation map (see `deriveShapePreservingCounts` helper below).
- The `generatedAt` field uses `new Date().toISOString()` and matches the strict ISO 8601 UTC format `/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/` (with milliseconds and 'Z' suffix).
- The `runSeed` field is the 8-hex-char effective PRNG seed (per the Seeded-RNG contract in `SPEC.md`), not the user-supplied `--seed` value.

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- `AGENTS.md` (root)
- `scripts/builder/AGENTS.md`
- `SPEC.md` (sections: "Domain and contract recommendations" → "Sanitisation report shape", "Run counters", "Per-file count derivation", "Seeded-RNG contract")

Implementation mandatory docs:

- `AGENTS.md` (root)
- `scripts/builder/AGENTS.md`
- `SPEC.md` (same scope)

Code Reviewer mandatory docs:

- `AGENTS.md` (root)
- `scripts/builder/AGENTS.md`
- `SPEC.md` (same scope)

### Shared helper plan (when helper changes are expected)

1. Helper: `createSanitisationReport(input: ReportInput): SanitisationReport`
   - Decision: `new`
   - Owning path: `scripts/builder/src/test-data-sanitiser/core/sanitisation-report.ts`
   - Call-site rationale: Builds the report object. Pure function; no I/O.
   - Relevant canonical doc target: `docs/developer/builder/test-data-sanitiser.md`.
   - Planned doc status: `Not implemented`.

2. Helper: `writeReport(report: SanitisationReport, path: string, writeTextFile): Promise<void>`
   - Decision: `new`
   - Owning path: `scripts/builder/src/test-data-sanitiser/core/sanitisation-report.ts`
   - Call-site rationale: Writes the report to disk. `writeTextFile` is an injected dependency.
   - Relevant canonical doc target: `docs/developer/builder/test-data-sanitiser.md`.
   - Planned doc status: `Not implemented`.

3. Helper: `deriveShapePreservingCounts(translationMap, fileOccurrences): { email: number; compositeUid: number }`
   - Decision: `new`
   - Owning path: `scripts/builder/src/test-data-sanitiser/core/sanitisation-report.ts`
   - Call-site rationale: Derives per-file `email` and `compositeUid` counts from the translation map. Pure function. The `fileOccurrences` argument is a `Set<mapKey>` of translation-map entries that were used by the current file (populated during Pass 2 by the rewriter as it applies substitutions).
   - Relevant canonical doc target: `docs/developer/builder/test-data-sanitiser.md`.
   - Planned doc status: `Not implemented`.

### Acceptance criteria

- `createSanitisationReport` produces a report matching the shape in `SPEC.md`.
- The report includes `generatedAt` (ISO timestamp), `runSeed` (8-hex-char effective PRNG seed), `totalsByCategory`, and `files` array.
- The `totalsByCategory` is the sum of per-file counts across all 8 categories.
- Each file entry has `input`, `output`, `status`, `counts` (all 8 categories), and optional `error`.
- Per-file `email` and `compositeUid` counts are derived from the translation map via `deriveShapePreservingCounts`; the derivation is unit-tested with a translation map containing 1 `email` and 2 `compositeUid` entries and a file that uses 1 of each.
- `writeReport` writes the report as 2-space-indented JSON to the specified path.

### Required test cases (Red first)

Report tests (`sanitisation-report.spec.ts`):

1. Empty input (zero files): report has empty `files` array and zero `totalsByCategory`.
2. Single successful file: report has one file entry with `status: 'ok'` and appropriate counts.
3. Multiple files: report totals equal the sum of per-file counts.
4. File with error: report file entry has `status: 'error'` and an `error` message; counts are zero.
5. ISO timestamp: `generatedAt` matches the strict ISO 8601 UTC format `/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/` (with milliseconds and 'Z' suffix).
6. Run seed: `runSeed` is an 8-character lowercase hex string and matches the effective PRNG seed derived from the input (verified by computing SHA-256 of the input seed string and taking the first 4 bytes).
7. `deriveShapePreservingCounts` with 1 `email` + 2 `compositeUid` translation-map entries and a file that used 1 `email` + 1 `compositeUid` returns `{ email: 1, compositeUid: 1 }`.
8. `deriveShapePreservingCounts` with 0 `email` entries returns `{ email: 0, compositeUid: 0 }` (does not throw).

### Section checks

- `npm run lint:builder` passes.
- `npm run builder:compile` passes.
- `npm run test:builder -- sanitisation-report` passes.
- Coverage of `sanitisation-report.ts` is at 100%.

### Optional `@remarks` JSDoc follow-through

- None expected.

### Implementation notes / deviations / follow-up

- TBD.

---

## Section 9 — Filesystem and glob helpers

### Objective

Implement the injected filesystem and glob helpers so the orchestration function can be tested with mocks.

### Constraints

- The helpers wrap Node's `fs` and `fast-glob` (or equivalent).
- Each helper is a pure function that can be replaced by a mock in tests.
- The helpers handle the lifecycle: ensure directory exists, read JSON, write text, list JSON files, expand globs.

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- `AGENTS.md` (root)
- `scripts/builder/AGENTS.md`
- `SPEC.md` (section: "Domain and contract recommendations" → "CLI dependencies")
- `scripts/builder/src/regression-checker/lib/fs.ts` (precedent for filesystem helpers in builder area)
- `scripts/builder/src/regression-checker/lib/process.ts` (precedent for process helpers)

Implementation mandatory docs:

- `AGENTS.md` (root)
- `scripts/builder/AGENTS.md`
- `SPEC.md` (same scope)
- Same precedent files

Code Reviewer mandatory docs:

- `AGENTS.md` (root)
- `scripts/builder/AGENTS.md`
- `SPEC.md` (same scope)

### Shared helper plan (when helper changes are expected)

1. Helper: `createFsHelpers()` factory returning `{ readJsonFile, writeTextFile, ensureDirectory, listJsonFiles }`
   - Decision: `new`
   - Owning path: `scripts/builder/src/test-data-sanitiser/lib/fs-helpers.ts`
   - Call-site rationale: Production implementations of the four filesystem deps. The factory returns the concrete implementations; tests provide mocks.
   - Relevant canonical doc target: `docs/developer/builder/test-data-sanitiser.md`.
   - Planned doc status: `Not implemented`.

2. Helper: `createGlobHelpers()` factory returning `{ expandGlobs }`
   - Decision: `new`
   - Owning path: `scripts/builder/src/test-data-sanitiser/lib/glob-helpers.ts`
   - Call-site rationale: Wraps `fast-glob`.
   - Relevant canonical doc target: `docs/developer/builder/test-data-sanitiser.md`.
   - Planned doc status: `Not implemented`.

3. Helper: `createDefaultDeps()` factory returning all 9 deps
   - Decision: `new`
   - Owning path: `scripts/builder/src/test-data-sanitiser/lib/sanitiser-cli-deps.ts`
   - Call-site rationale: Convenience factory used by the CLI entrypoint to wire default implementations.
   - Relevant canonical doc target: `docs/developer/builder/test-data-sanitiser.md`.
   - Planned doc status: `Not implemented`.

### Acceptance criteria

- `createFsHelpers()` returns an object with all 4 expected methods.
- `readJsonFile` reads and parses a JSON file from disk.
- `writeTextFile` writes a string to a file at the given path.
- `ensureDirectory` creates a directory recursively if it does not exist.
- `listJsonFiles` lists all `.json` files in a directory recursively, sorted alphabetically (for deterministic processing order).
- `createGlobHelpers()` returns an object with `expandGlobs` that resolves glob patterns to file paths.
- `createDefaultDeps()` returns an object matching the `SanitiserCliDeps` shape.

### Required test cases (Red first)

Filesystem tests (`fs-helpers.spec.ts`):

1. `readJsonFile` reads a valid JSON file and returns the parsed value.
2. `readJsonFile` throws on invalid JSON.
3. `readJsonFile` throws on missing file.
4. `writeTextFile` writes a string to a file; subsequent `readJsonFile` returns the parsed value.
5. `ensureDirectory` creates a nested directory that does not exist.
6. `ensureDirectory` is a no-op if the directory already exists.
7. `listJsonFiles` returns all `.json` files in a directory recursively, sorted alphabetically (verified by test with a fixture directory containing files in a non-alphabetical on-disk order).

Glob tests (`glob-helpers.spec.ts`):

1. `expandGlobs(['a.json'])` returns `['<cwd>/a.json']` (or the absolute path equivalent; the helper returns absolute paths).
2. `expandGlobs(['*.json'])` returns all matching `.json` files in the current directory, absolute paths.
3. `expandGlobs(['non-existent/*.json'])` returns an empty array (no error).

Deps factory test (compile-time assertion only):

- `createDefaultDeps()` returns an object that `satisfies SanitiserCliDeps`.

### Section checks

- `npm run lint:builder` passes.
- `npm run builder:compile` passes.
- `npm run test:builder -- fs-helpers glob-helpers` passes.
- Coverage of `fs-helpers.ts` and `glob-helpers.ts` is at ≥ 85% (some filesystem edge cases are hard to cover in unit tests).

### Optional `@remarks` JSDoc follow-through

- `createFsHelpers`: JSDoc note explaining the factory pattern and how to inject mocks in tests.

### Implementation notes / deviations / follow-up

- TBD.

---

## Section 10 — CLI orchestration function

### Objective

Implement the pure orchestration function `runSanitiserCli(options, deps)` that ties all the modules together.

### Constraints

- The function is pure: it takes options and deps, returns a result, and performs no I/O except through the injected deps.
- The function handles all the orchestration steps: glob expansion, file reading, parsing, Pass 1, deep clone, Pass 2, file writing, report generation, report writing.
- The function returns a result object containing the report and the exit code.
- The function handles per-file errors gracefully (records them in the report, continues with the next file).
- The function respects the within-run determinism guarantee (uses the seed or generates a fresh one).

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- `AGENTS.md` (root)
- `scripts/builder/AGENTS.md`
- `SPEC.md` (sections: "Data loading and orchestration", "Main user-facing surface specification", "Workflow specification")
- `scripts/builder/src/regression-checker/cli/index.ts` (precedent for orchestration function with injected deps)

Implementation mandatory docs:

- `AGENTS.md` (root)
- `scripts/builder/AGENTS.md`
- `SPEC.md` (same scope)
- Same precedent file

Code Reviewer mandatory docs:

- `AGENTS.md` (root)
- `scripts/builder/AGENTS.md`
- `SPEC.md` (same scope)

### Shared helper plan (when helper changes are expected)

1. Helper: `runSanitiserCli(options, deps): Promise<RunSanitiserCliResult>`
   - Decision: `new`
   - Owning path: `scripts/builder/src/test-data-sanitiser/cli/run-sanitiser-cli.ts`
   - Call-site rationale: The pure orchestration function. Testable in isolation.
   - Relevant canonical doc target: `docs/developer/builder/test-data-sanitiser.md`.
   - Planned doc status: `Not implemented`.

### Acceptance criteria

- `runSanitiserCli` with a valid options object and mock deps completes without error.
- The function returns a result with the report and exit code `0` on full success.
- The function returns exit code `2` when at least one file errored.
- The function returns exit code `1` on a **fatal pre-processing error** (invalid CLI args, output directory cannot be created, report path unwritable, random-seed generator throws, dependency wiring throws before any file is processed). Fatal errors are strictly pre-processing; any failure during file processing (read, parse, deep-clone, walk, rewrite, write) is a per-file error and contributes to exit code `2`.
- The function produces a sanitised output file for each input file.
- The function produces a sanitisation report. The report is written for any run that processed at least one file; it is not written for fatal pre-processing errors.
- The function is deterministic given the same `--seed` value (per the Seeded-RNG contract).
- The function produces different output for the same input when no `--seed` is supplied (across two runs).
- The function handles top-level arrays (the report records per-file counts, not per-element counts).
- The function collects the input file list by de-duplicating and **alphabetically sorting by absolute path** all direct paths and glob-expanded paths. The resulting list is the file-processing order and is deterministic regardless of how `--input` arguments were ordered by the operator.

### Required test cases (Red first)

Orchestration tests (`run-sanitiser-cli.spec.ts`):

1. Single file, no PII: completes with exit code `0`, zero counts in the report.
2. Single file with PII: completes with exit code `0`, non-zero counts in the report.
3. Multiple files: all sanitised, totals equal sum of per-file counts.
4. File with parse error: recorded in report as `status: 'error'`, CLI exits with code `2`.
5. File with write error: recorded in report as `status: 'error'`, CLI exits with code `2`.
6. Deep clone throws (e.g., input contains a function or non-cloneable symbol): orchestration records per-file error, continues with next file, exits with code `2`.
7. Invalid options: orchestration returns exit code `1`; `writeReport` is NOT called.
8. Unwritable output directory (`ensureDirectory` throws): orchestration returns exit code `1`; `writeReport` is NOT called; no report file is generated.
9. Same `--seed`, same input: two runs produce identical output (including identical `runSeed` value).
10. No `--seed`, same input: two runs produce different output and different `runSeed` values.
11. Top-level array input: CLI produces sanitised output and a per-file report entry.
12. Default report path: when `report` is not specified, the report is written to `<output>/sanitisation-report.json`.
13. Empty seed (passed via options after Zod validation rejects it, so this is a Zod-level test): `--seed ''` is rejected by the Zod schema with `min(1)`.
14. Input file list ordering: the orchestration function takes the union of direct paths and expanded globs, de-duplicates them, and sorts alphabetically by absolute path. The resulting processing order is independent of argument order.
15. Unwritable custom `--report` path: orchestration returns exit code `1`; `writeReport` is NOT called; no report file is generated at the custom path or the default path. This is a distinct failure mode from the unwritable-output-directory case (test 8) because `--report` can point outside the output directory.

### Section checks

- `npm run lint:builder` passes.
- `npm run builder:compile` passes.
- `npm run test:builder -- run-sanitiser-cli` passes.
- Coverage of `run-sanitiser-cli.ts` is at ≥ 85%.

### Optional `@remarks` JSDoc follow-through

- `runSanitiserCli`: JSDoc note explaining the orchestration flow, the exit-code contract, and the determinism guarantee.

### Implementation notes / deviations / follow-up

- TBD.

---

## Section 11 — CLI entrypoint (argv parsing + dependency wiring)

### Objective

Implement the CLI entrypoint that parses `process.argv`, calls the Zod schema for validation, wires default dependencies, and invokes `runSanitiserCli`.

### Constraints

- The entrypoint does not contain orchestration logic — it only parses argv and wires deps.
- The entrypoint is a thin wrapper suitable for direct invocation via `node scripts/builder/dist/test-data-sanitiser/cli/index.js`.
- The entrypoint exits with the code returned by `runSanitiserCli`.
- The entrypoint logs to stdout/stderr via the injected log/logError deps.

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- `AGENTS.md` (root)
- `scripts/builder/AGENTS.md`
- `SPEC.md` (section: "Main user-facing surface specification" → "Recommended CLI primitives" and "Flags")
- `scripts/builder/src/regression-checker/cli/index.ts` (precedent for CLI entrypoint structure)

Implementation mandatory docs:

- `AGENTS.md` (root)
- `scripts/builder/AGENTS.md`
- `SPEC.md` (same scope)
- Same precedent file

Code Reviewer mandatory docs:

- `AGENTS.md` (root)
- `scripts/builder/AGENTS.md`
- `SPEC.md` (same scope)

### Shared helper plan (when helper changes are expected)

1. Helper: `parseSanitiserCliArgs(argv: string[]): SanitiserCliOptions`
   - Decision: `new`
   - Owning path: `scripts/builder/src/test-data-sanitiser/cli/parse-cli-args.ts`
   - Call-site rationale: Pure argv parser. Separated from the entrypoint for testability.
   - Relevant canonical doc target: `docs/developer/builder/test-data-sanitiser.md`.
   - Planned doc status: `Not implemented`.

### Acceptance criteria

- `parseSanitiserCliArgs(['--input', 'a.json', '--output', 'out'])` returns the corresponding options.
- `parseSanitiserCliArgs(['--input', 'a.json', '--input', 'b.json', '--output', 'out', '--seed', 'abc'])` returns the options with multiple inputs and a seed.
- `parseSanitiserCliArgs(['--output', 'out'])` throws (no inputs).
- `parseSanitiserCliArgs(['--input', 'a.json'])` throws (no output).
- The CLI entrypoint `cli/index.ts` calls `parseSanitiserCliArgs(process.argv.slice(2))`, wires default deps, and invokes `runSanitiserCli`.
- The entrypoint exits with the code returned by `runSanitiserCli`.

### Required test cases (Red first)

Argv parser tests (`parse-cli-args.spec.ts`):

1. Minimal valid invocation: returns the options object.
2. Multiple `--input` flags: returns an array.
3. All flags: returns the full options object including `--report custom.json`.
4. Missing `--input`: throws a clear error.
5. Missing `--output`: throws a clear error.
6. Unknown flag: throws a clear error.
7. `--report custom.json` returns options with `report: 'custom.json'`.

CLI entrypoint tests (`cli-entrypoint.spec.ts`):

1. The entrypoint calls `parseSanitiserCliArgs` with the correct argv slice.
2. The entrypoint calls `runSanitiserCli` with the parsed options and default deps.
3. The entrypoint calls `process.exit(result.exitCode)` with the returned exit code.

### Section checks

- `npm run lint:builder` passes.
- `npm run builder:compile` passes.
- `npm run test:builder -- parse-cli-args cli-entrypoint` passes.
- Coverage of `parse-cli-args.ts` and `cli/index.ts` is at 100% (entrypoint is thin).

### Optional `@remarks` JSDoc follow-through

- `parseSanitiserCliArgs`: JSDoc note explaining the flag contract.

### Implementation notes / deviations / follow-up

- TBD.

---

## Section 12 — Removal of the old standalone script + npm script + dependency

### Objective

Delete the old `scripts/testDataSanitiser/` directory, add the `fast-glob` devDependency, and add the `sanitise:test-data` npm script.

### Constraints

- The deletion is unconditional: no callers exist (verified at spec-planning time).
- The new npm script follows the regression-checker pattern: compile first, then run.
- The new devDependency is added at the root `package.json` `devDependencies` block.

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- `AGENTS.md` (root)
- `scripts/builder/AGENTS.md`
- `package.json` (current state)
- `docs/developer/builder/builder-script.md` (precedent for npm script)

Implementation mandatory docs:

- `AGENTS.md` (root)
- `scripts/builder/AGENTS.md`
- `package.json` (current state)

Code Reviewer mandatory docs:

- `AGENTS.md` (root)
- `scripts/builder/AGENTS.md`
- `package.json` (current state)

### Shared helper plan (when helper changes are expected)

No new shared helpers. This section is configuration and cleanup only.

### Acceptance criteria

- The directory `scripts/testDataSanitiser/` no longer exists.
- The file `scripts/testDataSanitiser/sanitiser.ts` is deleted.
- `package.json` includes `"sanitise:test-data": "npm run builder:compile && node scripts/builder/dist/test-data-sanitiser/cli/index.js"` in the `scripts` block.
- `package.json` includes `"fast-glob": "^3.3.0"` in the `devDependencies` block (version range to be confirmed at implementation time; ^3.3.0 is the current stable line).
- `npm install` succeeds after the changes.

### Required test cases (Red first)

No new tests in this section. The existing test suite must continue to pass.

### Section checks

- `npm run lint:builder` passes.
- `npm run builder:compile` passes.
- `npm run test:builder` passes (full suite).
- `grep -r "scripts/testDataSanitiser" --include="*.ts" --include="*.js" --include="*.json" --include="*.md" . 2>/dev/null | grep -v node_modules | grep -v package-lock.json` returns no results (sanity check that no source files still reference the old path).

### Optional `@remarks` JSDoc follow-through

- None.

### Implementation notes / deviations / follow-up

- TBD.

---

## Section 13 — Integration test on a real-shape fixture

### Objective

Add an end-to-end integration test that exercises the full pipeline on a fixture file mirroring the `ABClass` partial hydration shape.

### Constraints

- The fixture is a hand-written JSON file with all 8 PII categories represented.
- The integration test invokes the full `runSanitiserCli` with mock filesystem deps, in-memory.
- The test asserts the sanitised output has the expected substitutions and the report has the expected counts.

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- `AGENTS.md` (root)
- `scripts/builder/AGENTS.md`
- `SPEC.md` (sections: "Data-shape context" for the fixture shape)
- `docs/developer/DATA_SHAPES.md` (for the canonical fixture shape)
- All previous sections of this plan

Implementation mandatory docs:

- `AGENTS.md` (root)
- `scripts/builder/AGENTS.md`
- `SPEC.md` (same scope)

Code Reviewer mandatory docs:

- `AGENTS.md` (root)
- `scripts/builder/AGENTS.md`
- `SPEC.md` (same scope)

### Shared helper plan (when helper changes are expected)

No new shared helpers. The integration test reuses everything built in Sections 1–11.

### Acceptance criteria

- The fixture JSON file exists at `scripts/builder/src/test-data-sanitiser/__fixtures__/abclass-partial.json`.
- The integration test in `scripts/builder/src/test-data-sanitiser/integration/abclass-roundtrip.spec.ts` (or similar) exercises the full pipeline.
- The test asserts that the sanitised output has:
  - Student names replaced with `studentName1`/`studentName2`/...
  - Teacher names replaced with `teacherName1`
  - Emails replaced with shape-preserving scrambles
  - Student IDs replaced with `userIdentifier1`/...
  - Classroom IDs replaced with `classCourseIdentifier1`
  - Submission item IDs replaced with `submissionItemIdentifier1`/...
  - Document IDs replaced with `documentIdentifier1`/...
  - Composite UIDs have only the studentId segment scrambled
- The test asserts the report has the expected per-file and per-category counts.

### Required test cases (Red first)

Integration test (`abclass-roundtrip.spec.ts`):

1. End-to-end run on the fixture produces a sanitised output and a report.
2. The sanitised output has the expected substitutions.
3. The report has the expected per-file and per-category counts.
4. With a fixed `--seed`, the same input produces the same output.

### Section checks

- `npm run lint:builder` passes.
- `npm run builder:compile` passes.
- `npm run test:builder` passes (full suite, including the new integration test).
- Coverage of the sanitiser module remains at ≥ 85%.

### Optional `@remarks` JSDoc follow-through

- The fixture file: a comment in the test file noting that the fixture is synthetic and contains no real PII.

### Implementation notes / deviations / follow-up

- TBD.

---

## Section 14 — Documentation update

### Objective

Update developer documentation to cover the new CLI.

### Constraints

- A new `docs/developer/builder/test-data-sanitiser.md` doc **must be created** (mirroring `regression-checker-how-to.md`). This is the canonical doc for all sanitiser-area shared-helper entries; it is not optional.
- The `docs/developer/builder/builder-script.md` doc gets a brief pointer to the new doc (one or two lines referencing the CLI).
- A `scripts/builder/src/test-data-sanitiser/README.md` is added.
- The shared-helper entries planned in earlier sections are reconciled (status updated from `Not implemented` to `Implemented` or kept `Not implemented` as appropriate) in `docs/developer/builder/test-data-sanitiser.md`.

### Delegation mandatory reads (when sub-agents are used)

Docs agent mandatory docs:

- `AGENTS.md` (root)
- `scripts/builder/AGENTS.md`
- `docs/developer/builder/builder-script.md` (current state)
- `docs/developer/builder/regression-checker-how-to.md` (precedent for builder-area CLI doc)
- `SPEC.md` (entire document)
- `ACTION_PLAN.md` (this document, for shared-helper reconciliation)

### Shared helper plan (when helper changes are expected)

No new shared helpers. This section reconciles existing planned-only entries.

### Acceptance criteria

- `docs/developer/builder/test-data-sanitiser.md` exists and covers the CLI, flags, examples, and limitations.
- `scripts/builder/src/test-data-sanitiser/README.md` exists and covers usage, flags, examples, and limitations.
- The shared-helper entries planned in Sections 2, 3, 4, 5, 6, 7, 8, 9, 10, 11 are reconciled in the chosen canonical doc.

### Required test cases (Red first)

No new tests. Existing tests must continue to pass.

### Section checks

- `npm run lint:builder` passes.
- `npm run test:builder` passes (full suite).
- Documentation review: the README and developer docs accurately reflect the implemented behaviour.

### Optional `@remarks` JSDoc follow-through

- TBD based on implementation.

### Implementation notes / deviations / follow-up

- TBD.

---

## Regression and contract hardening

### Objective

Ensure the full sanitiser module meets the project's quality gates and that no regressions are introduced.

### Constraints

- The full builder test suite must pass.
- The 85% coverage threshold (lines, functions, statements, branches) must be met.
- The builder lint must pass with no new warnings.
- The builder type-check must pass.
- The new npm script must work end-to-end against a real JSON file (smoke test).

### Acceptance criteria

- `npm run lint:builder` passes.
- `npm run builder:compile` passes.
- `npm run test:builder` passes.
- `npm run test:builder:coverage` reports ≥ 85% on the sanitiser module.
- A smoke test of `npm run sanitise:test-data -- --input <fixture> --output <dir>` produces the expected output and exits with code `0`.

### Required test cases/checks

1. Run the full builder test suite.
2. Run the builder coverage check.
3. Run the builder lint check.
4. Run the builder type-check.
5. Run the npm script against a real JSON file as a smoke test.
6. Verify the `runSanitiserCli` mandatory-read evidence is complete for every delegated regression handoff.

### Section checks

- All commands listed above exit with code `0`.

### Implementation notes / deviations / follow-up

- TBD.

---

## Documentation and rollout notes

### Objective

Finalise documentation and confirm the feature is ready for use.

### Constraints

- All planned-only shared-helper entries are reconciled.
- The README and developer docs accurately reflect the implemented behaviour.
- The `package.json` script is documented in `builder-script.md`.

### Acceptance criteria

- The shared-helper entries in the chosen canonical doc are up to date.
- The developer docs are accurate and complete.
- The `runSanitiserCli` is referenced from the docs.

### Required checks

1. Verify the chosen canonical doc for shared helpers is up to date.
2. Verify the developer docs mention the persistence/transport strategy (none for v1; CLI is local-only).
3. Verify the developer docs list the flags and the report file.
4. Verify the implementation notes/deviations fields are filled in.
5. Verify the `Files read` evidence is complete for delegated docs/review handoffs.

### Optional `@remarks` JSDoc review

- TBD based on implementation.

### Implementation notes / deviations / follow-up

- TBD.

---

## Suggested implementation order

1. **Section 1** — Sanitiser configuration and dependencies (foundational types; no behaviour)
2. **Section 2** — Seeded PRNG and shape-preserving scrambler (foundational primitives)
3. **Section 3** — Regex patterns and idempotency-pattern helpers (foundational primitives)
4. **Section 4** — Target fields and translation map (Pass 1 building blocks)
5. **Section 5** — UID parser (Pass 1 building block for composite UIDs)
6. **Section 6** — JSON-aware walker (Pass 1: discover) — depends on Sections 2, 3, 4, 5
7. **Section 7** — Tree rewriter (Pass 2: apply) — depends on Sections 4, 5
8. **Section 8** — Sanitisation report writer (independent)
9. **Section 9** — Filesystem and glob helpers (injected deps; independent)
10. **Section 10** — CLI orchestration function — depends on Sections 6, 7, 8, 9
11. **Section 11** — CLI entrypoint — depends on Section 10
12. **Section 12** — Removal of the old script + npm script + dependency (independent of build steps)
13. **Section 13** — Integration test — depends on Sections 1–11
14. **Section 14** — Documentation update — depends on all previous sections

Sections 12 can be parallelised with Sections 1–11. Section 14 must follow all implementation. The integration test (Section 13) must follow Sections 1–11 but can be developed alongside Section 12.
