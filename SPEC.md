# Builder Reliability and Review Follow-through Specification

## Status

- Draft v1.0
- Replaces the stale apiHandler planning artefact with a maintenance specification for the agreed actionable items in `CODE_REVIEW_EVAL.md`

## Purpose

This document defines the intended behaviour for the agreed review-fix maintenance work across the active builder pipeline and a small set of bounded repository hygiene follow-through items.

The feature will be used to:

- restore a truthful, deterministic builder contract for JsonDbApp inputs
- harden builder reliability across path handling, filesystem error reporting, and network-dependent tooling
- complete the agreed low-risk follow-through items without widening scope beyond `CODE_REVIEW_EVAL.md`

This feature is **not** intended to:

- redesign the broader builder pipeline beyond the agreed review comments
- introduce frontend layout or workflow changes
- refactor deprecated `src/AdminSheet` code beyond minimal documentation-quality cleanup

## Agreed product decisions

1. The committed `scripts/builder/vendor/jsondbapp` snapshot is the canonical runtime builder input for both JsonDbApp inlining and JsonDb manifest merge.
2. This maintenance pass must replace the current placeholder vendored JsonDbApp files with the actual upstream JsonDbApp `v0.1.1` builder subset committed in-repo.
3. The committed builder subset is limited to the real upstream `appsscript.json` plus the real upstream contents for every file explicitly enumerated in the updated `jsonDbApp.sourceFiles` allowlist in `builder.config.json`; unrelated upstream files do not need to be vendored for this pass, and no implicit transitive-closure or runtime-discovery rule applies.
4. `builder.config.json` remains the runtime source of truth for JsonDbApp inclusion. In this maintenance pass, `jsonDbApp.sourceFiles` must be synchronised to the real committed `v0.1.1` subset and must enumerate the exact committed vendored subset before implementation is complete because the current placeholder-era list does not match upstream.
5. Stage 6 (`resolve-jsondb-source`) is retained only as a local validation-and-normalisation step over the committed vendored snapshot. It is the canonical blocking owner for rejecting missing configured files and placeholder vendored content before downstream inlining, and it must not auto-discover replacements from disk.
6. Stage 6 must stop downloading archives, extracting releases, shelling out to `curl` or `tar`, or repointing `BuilderPaths` to a workdir copy; resolved JsonDbApp paths stay pointed at the configured vendored snapshot.
7. Builder config validation in the active `scripts/builder` surface must be brought back into line with the builder AGENTS Zod-first policy in code, not by weakening the policy document. This change includes adding `zod` as a direct dependency owned in `package.json` and `package-lock.json`, with dependency installation and lockfile validation treated as part of the builder config-validation change. The Zod schema becomes the single source of truth for config validation, lives in an adjacent schema module, and `BuilderConfig`-related TypeScript types are inferred from it.
8. `jsonDbApp.sourceFiles` and `jsonDbApp.publicExports` must both be non-empty and unique after normalisation. `jsonDbApp.sourceFiles` entries may be normalised from Windows-style separators to forward-slash relative paths during config loading, but duplicates, invalid relative paths, or out-of-root paths must fail validation.
9. Stage 7 inlining order remains the current deterministic lexicographic relative-path order rather than config-array order.
10. The real upstream `v0.1.1` public exports relevant to AssessmentBot remain `loadDatabase` and `createAndInitialiseDatabase`; `jsonDbApp.publicExports` continues to expose only that confirmed API.
11. Inspection of the real upstream `v0.1.1` manifest shows extra top-level fields (`timeZone`, `exceptionLogging`, `runtimeVersion`), but AssessmentBot’s backend manifest already owns those values. Stage 8 merge semantics therefore remain unchanged for this maintenance pass: only OAuth scopes and enabled advanced services are merged from JsonDbApp into the final output.
12. Builder relative-path reporting must normalise single Windows path separators (`\`) to forward slashes everywhere relative file lists are emitted or validated.
13. The shared recursive file walker in `scripts/builder/src/lib/fs.ts` becomes the canonical implementation. Step-local duplication should be removed where the shared helper already fits the contract.
14. Per-file backend copy failures must be wrapped in `BuildStageError` with `backend-copy` stage context and the relevant source or destination path details.
15. All remaining in-scope network calls must use explicit finite timeouts and fail with actionable context. For this maintenance pass that applies to the Sonar PR duplication helper script; the builder no longer performs a JsonDbApp release download at runtime.
16. Smaller follow-through items stay deliberately bounded to: removing the unused import in `eslint.config.js`; fixing the broken docs anchor in `docs/setup/configOptions.md`; replacing placeholder or empty JSDoc in the listed deprecated AdminSheet files with concise meaningful documentation or removing empty blocks; renaming the mismatched `requestStore` test title to match its assertion intent; and making `.husky/pre-commit` block commits when `npm run lint:fix` fails.

## Existing system constraints

### Backend or API constraints already in place

- The builder entrypoint `scripts/builder/src/build-gas-bundle.ts` runs a fixed stage sequence that later steps already consume through `BuilderPaths`.
- `runJsonDbInlineNamespace(...)` expects `jsonDbAppPinnedSnapshotDir`, `jsonDbAppSourceFiles`, and `jsonDbAppPublicExports` to be fully resolved before the inlining stage runs.
- `jsondb-inline-namespace.ts` currently rejects placeholder snapshot content, but this maintenance pass moves the canonical blocking ownership for that rejection upstream to Stage 6 so downstream inlining may assume validated real source.
- `runMergeManifest(...)` already treats the backend manifest as the owner of top-level manifest fields and merges JsonDbApp scopes/services into that base.
- Root backend linting and Vitest flows already exist for `tests/**/*.js`, including `tests/api/requestStore.test.js`.

### Current data-shape constraints

- `BuilderConfig` currently defines `frontendDir`, `backendDir`, `buildDir`, and `jsonDbApp.{ pinnedSnapshotDir, sourceFiles, publicExports }`.
- `jsonDbApp.publicExports` remains a configured allowlist for the namespace wrapper surface.
- `jsonDbApp.sourceFiles` remains an authoritative configured allowlist of relative JavaScript paths beneath the vendored snapshot root; for this maintenance pass that allowlist must enumerate the exact committed vendored subset, the builder may normalise these entries to forward-slash form, but it must not replace them from a downloaded release scan, directory walk, or implicit transitive-closure rule.
- Final builder output still depends on deterministic relative paths such as `appsscript.json`, `JsonDbApp.inlined.js`, and `UI/ReactApp.html`.

### Frontend or consumer architecture constraints

- No frontend route, layout, or visible workflow changes are part of this maintenance work.
- Existing repository commands in `package.json` are the validation surface for this work; the plan must not rely on invented helper commands.
- No TypeScript or ESLint shared-config behaviour change is required for this scope; the `eslint.config.js` item is limited to removing an unused import rather than changing lint policy semantics.

## Domain and contract recommendations

### Why this approach is preferable

- It makes the builder contract truthful again by aligning runtime behaviour to the committed vendored-snapshot configuration instead of silently overriding it.
- It improves portability and determinism by removing runtime dependence on external archive tools and a network download in the active builder path.
- It resolves the placeholder-snapshot blocker directly enough that the builder can remain functional after the contract change.
- It keeps the deprecated-surface follow-through deliberately small so the maintenance pass does not expand into broader refactors.

### Recommended data shapes

#### Builder JsonDbApp contract

```ts
{
  jsonDbApp: {
    pinnedSnapshotDir: 'scripts/builder/vendor/jsondbapp',
    sourceFiles: ['src/...real-upstream-files...'],
    publicExports: ['loadDatabase', 'createAndInitialiseDatabase']
  }
}
```

Contract rules:

- `pinnedSnapshotDir` identifies the vendored snapshot root inside the repository.
- `sourceFiles` is a non-empty, unique configured inclusion allowlist of relative `.js` files beneath that root.
- `publicExports` is a non-empty, unique configured namespace export allowlist.
- Config loading normalises `sourceFiles` path separators to forward slashes before uniqueness checks and downstream use.

#### Builder resolved-path expectations

```ts
{
  jsonDbAppPinnedSnapshotDir: '/absolute/path/to/scripts/builder/vendor/jsondbapp',
  jsonDbAppManifestPath: '/absolute/path/to/scripts/builder/vendor/jsondbapp/appsscript.json',
  jsonDbAppSourceFiles: ['src/...real-upstream-files...']
}
```

Rules:

- The resolved paths point at the committed vendor snapshot, not `build/work`.
- Stage 6 may validate and normalise these values.
- Stage 6 must not repoint them to a downloaded release tree.

### Naming recommendation

Prefer:

- `vendored snapshot`
- `configured source-file allowlist`
- `builder stage context`
- `blocking lint gate`

Avoid:

- `runtime release snapshot`
- `downloaded source of truth`
- `best-effort lint gate`

### Validation recommendation

#### Builder

- Define the builder config schema first in an adjacent Zod schema module and infer `BuilderConfig` from it.
- Update `package.json` and `package-lock.json` to own the direct `zod` dependency required by that schema, and treat dependency installation plus lockfile validation as part of this builder contract-alignment change.
- Parse builder config through that schema so required fields, nested JsonDbApp fields, uniqueness rules, and string-array contracts fail with consistent `preflight-clean` stage context.
- Validate that `jsonDbApp.pinnedSnapshotDir` resolves inside the repository, contains `appsscript.json`, and contains every configured source file.
- Fail fast in Stage 6 on malformed config, invalid relative paths, missing vendored files, placeholder snapshot content, or filesystem copy failures; do not silently continue.

#### Repository hygiene follow-through

- Network helper scripts that remain in scope must pass an explicit timeout to their HTTP client API and surface timeout failure context.
- Pre-commit gating changes and Sonar helper timeout changes must each have an explicit validation note in the action plan even if that validation is manual rather than automated.
- Wording-only or docs-only fixes do not require contrived automated tests when no existing harness exists, but they must stay local to the agreed files.

## Feature architecture

### Placement

- Canonical ownership for the main behaviour changes remains inside `scripts/builder`.
- The bounded follow-through items are limited to the explicitly listed root docs, test, hook, deprecated AdminSheet files, the in-scope Sonar helper script, and the builder documentation that currently misstates the JsonDbApp contract.
- No parallel builder entrypoint, alternate JsonDbApp source mechanism, or frontend layout document is introduced.

### Proposed high-level tree

```text
build-gas-bundle.ts
 resolveBuilderPaths / loadBuilderConfig
 runResolveJsonDbSource
 runJsonDbInlineNamespace
 runMergeManifest
 runBackendCopy
 runMaterialiseOutput
 runValidateOutput
```

### Out of scope for this surface

- New tooling or automation for refreshing the vendored JsonDbApp snapshot from upstream releases after this maintenance pass.
- Broader deprecated AdminSheet behaviour refactors or lint enablement.
- Any not-agreed or de-prioritised comments listed in `CODE_REVIEW_EVAL.md`.

## Data loading and orchestration

### Required datasets or dependencies

- `scripts/builder/builder.config.json`
- root `package.json` and `package-lock.json` for the direct `zod` dependency introduced by builder config validation alignment
- local repository filesystem contents under `scripts/builder/vendor/jsondbapp`
- existing builder output directories under `build/`
- SonarCloud API responses for the PR duplication helper script

### Prefetch or initialisation policy

#### Startup

- Builder startup resolves config and repository-relative paths locally.
- Builder startup must not perform a JsonDbApp network fetch or archive extraction.

#### Feature entry

- `runResolveJsonDbSource(...)` validates the vendored snapshot and configured source-file allowlist, rejects placeholder vendored content as the canonical Stage 6 blocking check, and leaves downstream JsonDbApp inlining to assume already-validated real source.
- Repository hygiene items run only when the touched file or command is invoked; no extra startup work is introduced.

#### Manual refresh

- No manual refresh workflow is added.

### Query or transport additions

- None.

## Workflow specification

## Resolve builder config and JsonDbApp snapshot

### Eligible inputs or preconditions

- `builder.config.json` exists and is valid JSON.
- Configured source directories and the vendored JsonDbApp snapshot resolve inside the repository.

### Inputs, fields, or confirmation copy

- `frontendDir`
- `backendDir`
- `buildDir`
- `jsonDbApp.pinnedSnapshotDir`
- `jsonDbApp.sourceFiles`
- `jsonDbApp.publicExports`

### Behaviour

- Parse config through the builder-owned Zod schema and reject malformed or missing fields with `preflight-clean` stage context.
- Own the direct `zod` dependency in `package.json` and `package-lock.json` as part of this config-validation change, with dependency installation and lockfile validation completed before builder verification.
- Resolve the configured JsonDbApp snapshot to an absolute in-repo path, verify `appsscript.json` exists, verify every configured source file exists beneath the snapshot root, reject placeholder snapshot content as the canonical Stage 6 blocking failure before Stage 7, and leave resolved BuilderPaths pointed at the configured vendored snapshot.
- Produce deterministic relative file metadata for downstream steps without downloading or extracting any release archive.
- Surface invalid configuration or missing snapshot files as blocking builder failures.

## Materialise and validate final builder output

### Eligible inputs or preconditions

- The build pipeline has already populated `build/gas`.

### Behaviour

- Use consistent forward-slash normalisation for relative output file lists on Windows and non-Windows platforms.
- Reuse the shared recursive file walker rather than keeping duplicate step-local traversal logic where the shared helper satisfies the need.
- Keep required-file and forbidden-leakage checks unchanged in meaning while making the file enumeration implementation portable.

## Copy backend runtime files

### Eligible inputs or preconditions

- `paths.backendDir` exists and `paths.buildGasDir` is writable.

### Behaviour

- Continue copying only runtime-relevant backend JavaScript files.
- Wrap per-file destination-directory creation and copy failures in `BuildStageError` with `backend-copy` stage context and path detail so diagnostics identify the failing file.

## Apply bounded repository hygiene follow-through

### Behaviour

- Add explicit timeouts to the in-scope Sonar helper network request and keep timeout failures diagnosable.
- Keep the `requestStore` test descriptive text aligned with what the assertion actually proves.
- Make the pre-commit hook fail the commit when `npm run lint:fix` fails.
- Limit deprecated AdminSheet changes to documentation-quality cleanup only.
- Update builder-facing documentation so Stage 6, config examples, and public-export examples no longer imply the stale contract.

## Error, loading, and empty-state rules

### Blocking failure

- Invalid builder config, missing vendored snapshot files, placeholder vendored snapshot content rejected by Stage 6 before Stage 7, invalid relative source-file entries, or per-file backend copy failures are blocking builder errors.
- Network timeout or HTTP fetch failure in the Sonar helper script must fail with actionable context rather than hanging indefinitely.

### Partial-load or partial-success failure

- None. This maintenance pass should fail fast rather than degrading builder output quality.

## Backend changes required to support agreed behaviour

1. Builder config contract alignment
   - Replace manual config validation with a Zod-backed schema module and inferred config types while preserving `BuildStageError` stage context.
   - Add the direct `zod` dependency in `package.json` and `package-lock.json`, and treat dependency installation plus lockfile validation as required follow-through for the schema adoption.
   - Replace the placeholder vendored JsonDbApp snapshot with the real pinned `v0.1.1` subset and synchronise `jsonDbApp.sourceFiles` so it enumerates that exact committed subset.
   - Stop runtime reassignment to a downloaded release snapshot, keep Stage 6 as local validation only, and make Stage 6 the canonical blocking owner for placeholder-content rejection before Stage 7.
2. Builder reliability hardening
   - Correct Windows path-separator normalisation in the listed builder steps.
   - Reuse the shared recursive file walker and fix its path-join portability issue.
   - Wrap backend copy loop filesystem failures with stage context.
3. Bounded repository follow-through
   - Add explicit timeout handling to the in-scope Sonar helper request.
   - Fix the listed lint/docs/JSDoc/test-title/pre-commit items without expanding to unrelated cleanup.
   - Update builder documentation where the JsonDbApp contract is currently stale.

## Planning handoff notes

- Sequence contract-alignment work before downstream builder-step hardening so tests can target the settled JsonDbApp source-of-truth.
- No frontend layout spec is required because this scope does not materially change any frontend layout, route, or workflow.
- Keep docs and deprecated-surface cleanup in later sections after builder reliability changes land.

## Testing expectations

- Add or update builder unit tests around config parsing, JsonDbApp snapshot resolution, Stage 6 ownership of placeholder rejection before Stage 7, non-repointed vendored-snapshot BuilderPaths, backend-copy failures, and output-path normalisation.
- Replace archive/download-centred `resolve-jsondb-source` coverage with vendored-snapshot fixture coverage that proves Stage 6 validates the exact local committed files named in `builder.config.json` and no longer depends on network fetches, external archive tooling, or runtime file discovery.
- Treat `package.json` and `package-lock.json` updates for direct `zod` adoption as part of the builder contract change, and run builder verification against the installed dependency tree reflected in the updated lockfile.
- Keep builder verification grounded in existing commands: `npm run builder:test`, `npm run builder:lint`, `npm run builder:compile`, and the final end-to-end builder command already present in `package.json`.
- Keep root validation focused on `npm run lint` and `npm test -- tests/api/requestStore.test.js` for the touched non-builder test surface.
- Record explicit manual validation steps for the Sonar helper timeout behaviour and the `.husky/pre-commit` blocking behaviour if no existing automated harness is introduced.
- For docs-only or wording-only items with no existing automated harness, record that red-first automated tests are intentionally skipped.

## Documentation and rollout notes

- Update root `SPEC.md` and `ACTION_PLAN.md` to replace the stale apiHandler planning artefacts for this maintenance pass.
- Update `docs/developer/builder/builder-script.md` so its JsonDbApp configuration example, public-export example, and Stage 6 narrative all match the final committed-vendor contract.
- If code comments or configuration wording are changed, keep them aligned with the vendored-snapshot contract and British English usage.
- Retain discoverable provenance for the vendored JsonDbApp source as upstream tag `v0.1.1` in the active builder code or adjacent builder documentation without reintroducing runtime download behaviour.
- Manual future refresh automation for the vendored JsonDbApp snapshot is deliberately deferred; this maintenance pass only restores truthful runtime behaviour.

## V1 scope recommendation

### Include in v1

- Builder contract realignment to the vendored JsonDbApp snapshot, including replacement of the current placeholder snapshot with the real pinned `v0.1.1` subset
- Builder reliability fixes for path normalisation, shared file walking, backend copy error wrapping, and in-scope network timeout handling
- The explicitly listed repo hygiene and builder-doc follow-through items only

### Defer from v1

- New tooling or automation for updating the vendored JsonDbApp snapshot
- Broader builder refactors unrelated to the agreed review comments
- Any additional cleanup in deprecated AdminSheet code beyond the listed JSDoc work
