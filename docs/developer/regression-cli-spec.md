# Regression Reporting CLI Specification

## Status

- Draft v1.0
- Created to define a deterministic, non-LLM regression reporting workflow for lint, test, and compile/build checks.

## Purpose

This document defines the intended behaviour for a config-driven CLI that captures tool-native structured outputs, stores baseline runs by session, and compares follow-up runs to detect regressions.

For current operational usage and maintenance guidance, see [Builder Regression Checker How-To](./builder/regression-checker-how-to.md).

The feature will be used to:

- run configured checks for supported tools without changing human-oriented npm scripts
- store a baseline report for a given session identifier
- run follow-up comparisons for the same session identifier
- produce a fixed-structure summary header suitable for LLM-first reading before full details
- support hook-friendly non-zero exit codes when regressions are detected

This feature is **not** intended to:

- normalise all tool outputs into one universal canonical schema
- execute arbitrary shell commands outside supported tool families
- replace existing human-readable developer workflows

## Agreed product decisions

1. The CLI accepts an optional positional argument: `sessionId`.
2. If `sessionId` is omitted, the CLI uses the current Git branch name as `sessionId`.
3. If no baseline exists for `sessionId`, the CLI creates one.
4. If baseline exists for `sessionId`, the CLI creates a comparison report against that baseline.
5. The CLI is config-driven and reads checks from a small configuration file.
6. Supported tool families in v1 are strictly: `eslint`, `vitest`, `playwright`, `tsc`.
7. Unsupported tool families or unsupported reporter modes fail validation before execution.
8. The CLI stores raw tool-native outputs and compares baseline vs current using tool-specific diff logic.
9. The report starts with a fixed-structure summary header block for deterministic first-pass parsing.
10. `tsc` checks use direct `run.kind=tsc` mode only in v1 for stricter safety. _(Amended: the sole `npm-script` exception is the allowlisted aggregate `typecheck:all`; see the v1 amendment note below.)_
11. Parallel execution defaults to `maxWorkers = min(4, logicalCpuCount)`.
12. Playwright checks always run in a dedicated single-worker lane.
13. The default storage root for config and report artefacts is `.ts-regression-checker`.
14. Compare runs exit with a non-zero code when regressions are detected, so the CLI can be used in pre-commit and other hooks.
15. `run.kind=npm-script` in v1 supports only single-tool, non-mutating scripts that map to exactly one supported tool family. _(Amended: the allowlisted `typecheck:all` aggregate is exempt from the single-tool and non-chained rules; the mutating and declared-script rules still apply.)_
16. Baseline and compare runs must validate baseline compatibility (config/check/tool metadata) before diffing.
17. Baselines are auto-created when missing, and baseline-mode reports must be explicitly flagged as baseline creation output.

> **v1 amendment — `tsc` aggregate allowlist.** The shipped checker accepts one `npm-script` form
> for `tsc`: `{ "kind": "npm-script", "script": "typecheck:all" }`. Every other `tool=tsc` +
> `run.kind=npm-script` entry is rejected, the mutating-flag and declared-script guards still
> apply, and `typecheck:all` is the only script exempt from the single-tool and non-chained rules.
> Because the aggregate bypasses declared-tool-family resolution, the checker treats its output as
> `tsc` text; pass/fail is still driven by the process exit code. See
> [Regression Checker How-To](./builder/regression-checker-how-to.md) for the operational contract
> and the trade-off.

## Existing system constraints

### Backend or API constraints already in place

- No backend/API integration is required for v1.
- All artefacts are file-based in the local workspace.

### Current data-shape constraints

- ESLint and Vitest can emit JSON directly.
- Playwright can emit JSON via reporter mode.
- `tsc` does not provide stable native JSON diagnostics; v1 must use stable text mode and parse diagnostics.

### Frontend or consumer architecture constraints

- Existing npm scripts are kept human-friendly and unchanged.
- The regression CLI must layer on top of existing scripts/tools instead of replacing them.

## Domain and contract recommendations

### Why this approach is preferable

- deterministic execution and parsing without model interpretation
- safety via strict allowlist and validation
- low adoption cost because existing scripts remain intact
- extensibility by adding more supported tool adapters later

### Configuration recommendation

The checker reads `.ts-regression-checker/regression.config.json`, containing `reportDirectory`, `parallel` settings, and a `checks` array. Each check declares a unique `id`, a `tool` (`eslint`, `vitest`, `playwright`, or `tsc`), a repo-relative `cwd`, and a `run` block using `npm-script` or `tsc` under the documented validation rules. For the canonical example, field reference, and full validation-rule list, see [Regression Checker How-To § Configuration reference](./builder/regression-checker-how-to.md#configuration-reference).

### Tool execution contract

The runner enforces each tool's native structured or parseable output: it appends or overrides the JSON reporter for `eslint`, `vitest` and `playwright` and writes the JSON artefact; for `tsc` it forces plain diagnostics (`--pretty false`). The allowlisted `npm-script` aggregate is invoked as-is with no injected compiler arguments or JSON reporter, and pass/fail comes from its exit code. A check whose script cannot be validated against the declared tool family fails before execution, except the allowlisted `typecheck:all` aggregate. See [Regression Checker How-To § Raw artefact formats](./builder/regression-checker-how-to.md#raw-artefact-formats) and [§ Safety and validation rules](./builder/regression-checker-how-to.md#safety-and-validation-rules).

### Session storage recommendation

Baseline and run artefacts live under `<reportDirectory>/<sessionStorageKey>/`, defaulting to `.ts-regression-checker/reports`. A baseline directory holds `manifest.json` and per-check `raw.*` plus `derived.json`; each timestamped run directory holds the same, with `comparison.json` and `comparison.txt` in comparison runs. `sessionId` is the logical identifier, `sessionStorageKey` is its filesystem-safe encoding, and manifests persist both. See [Report and artefact layout](./builder/regression-checker-how-to.md#report-and-artefact-layout) and [Manifest and compatibility checks](./builder/regression-checker-how-to.md#manifest-and-compatibility-checks).

## Feature architecture

### Placement

- CLI source: `scripts/builder/src/regression-checker/` so it remains in an active tooling area and inherits builder quality gates
- Config schema/docs: `docs/developer/`
- Quality gates: follow builder-style lint, TypeScript compile, and test gates for this tooling area
- No change required to existing package scripts for human use.

### Proposed high-level tree

```text
scripts/builder/src/regression-checker/
├── cli.ts
├── config/
│   └── validate.ts
├── runners/
│   ├── eslint.ts
│   ├── vitest.ts
│   ├── playwright.ts
│   └── tsc.ts
├── compare/
│   ├── eslint.ts
│   ├── vitest.ts
│   ├── playwright.ts
│   └── tsc.ts
└── report/
    ├── header.ts
    └── writer.ts

scripts/builder/src/regression-checker/tests/
```

### Out of scope for this surface

- auto-fixing lint/test failures
- modifying production source code based on report output
- CI orchestration beyond local command execution and report generation

## Data loading and orchestration

### Required dependencies

- Node runtime and project toolchain already used by the repository
- read access to target `package.json` files for script validation
- write access to configured report directory

### Execution policy

The runner parses arguments, loads and validates the config, resolves the session and derives its filesystem-safe storage key, selects baseline mode when no baseline exists and compare mode otherwise, executes checks in bounded parallel with a dedicated single-worker Playwright lane, and validates baseline compatibility before diffing. It writes the baseline or comparison artefacts and prints and persists a fixed-structure summary header followed by the detailed body, with report ordering fixed to config order regardless of completion order; per-check derived summaries are generated for diffing (see [Derived summaries (per tool)](#derived-summaries-per-tool)). Step-by-step flows and practical limits are in [Running flows](./builder/regression-checker-how-to.md#running-flows) and [Determinism guarantees and practical limits](./builder/regression-checker-how-to.md#determinism-guarantees-and-practical-limits).

### CLI and exit-code contract

Entry points are the npm wrapper `npm run regression-checker -- [sessionId]` and the runtime contract `regression-checker [sessionId]`. An omitted `sessionId` falls back to the current Git branch, and an unresolvable branch fails fast. Baseline mode exits `0` and states that the run created the baseline without comparison diffing; compare mode exits `1` on regressions and `0` otherwise; invalid config, unsupported tool/mode or runtime failures exit non-zero (the how-to lists the concrete codes). See [Session ID behaviour](./builder/regression-checker-how-to.md#session-id-behaviour) and [Exit codes](./builder/regression-checker-how-to.md#exit-codes).

## Core behavioural model

### Derived summaries (per tool)

`eslint`:

- counts: errors, warnings
- finding fingerprints: `ruleId|filePath|line|column|message`

`vitest` / `playwright`:

- counts: total, passed, failed, skipped
- failure fingerprints: `file|suite|testName`

`tsc`:

- counts: diagnostics total
- diagnostic fingerprints: `code|filePath|line|column|message`

### Comparison categories

- `regressions`: baseline pass/finding-absent -> current fail/finding-present
- `new-failures`: current failures/fingerprints absent from baseline set
- `fixes`: baseline failures/fingerprints present -> current absent

Regression semantics for v1:

- ESLint: new warning findings and new error findings both count as regressions
- Vitest/Playwright: a test that was not skipped in baseline but is skipped in current counts as a regression
- Runtime/execution errors: any check execution/runtime error counts as a regression

## Report specification

### Fixed-structure header contract

The top of `comparison.txt` (and baseline summary text) must always use deterministic markers and field ordering.

Header line count is intentionally not specified in v1 and will be finalised after implementation behaviour is observed.

Header requirements:

1. Start marker: `=== REGRESSION HEADER START ===`
2. End marker: `=== REGRESSION HEADER END ===`
3. Deterministic key-value lines (stable ordering)
4. Optional padding lines are allowed, but not required in v1

Minimum header fields:

- `sessionId`
- `sessionStorageKey`
- `sessionIdSource` (`arg` or `git-branch`)
- `mode` (`baseline` or `compare`)
- `baselineCreatedThisRun` (`true` for baseline mode, `false` for compare mode)
- `baselineTimestamp` (or `N/A`)
- `currentTimestamp`
- `overallStatus` (`GREEN` or `FAILING`)
- `totalChecks`
- `checksPassing`
- `checksFailing`
- `regressionsCount`
- `newFailuresCount`
- `fixesCount`
- per-tool summary lines

### Detailed body contract

After the header end marker, the report includes execution metadata, per-check status and counts, explicit regression/new-failure/fix listings, and file references to raw artefacts. The per-check section fields are also listed in [Reading `comparison.txt`](./builder/regression-checker-how-to.md#reading-comparisontxt).

## Error handling and safety

1. Fail fast on invalid config or unsupported tool.
2. Fail fast if script resolution does not match declared tool family (the allowlisted `typecheck:all` aggregate is exempt).
3. Do not execute arbitrary shell strings from config.
4. Record execution errors as reportable check failures with clear error codes.
5. Fail fast when `sessionId` is omitted and current Git branch name cannot be resolved.
6. Fail fast when `reportDirectory` or `cwd` escapes the repository root.
7. Fail comparison with a clear `baseline-incompatible` status when baseline metadata does not match current metadata.

## Acceptance criteria

1. Running `regression-checker <sessionId>` with no prior baseline creates baseline artefacts.
2. Running the same command again creates a comparison report.
3. Unsupported tool types are rejected before any check runs.
4. Invalid script-to-tool mappings are rejected before execution (the allowlisted `typecheck:all` aggregate is exempt from declared-tool-family resolution).
5. Header includes required summary fields in deterministic order and uses the defined start/end markers.
6. Report highlights regressions, new failures, and fixes.
7. Raw tool-native outputs are persisted for each check.
8. Checks run in bounded parallel mode while report ordering remains deterministic.
9. Running `regression-checker` without `sessionId` uses the current Git branch as `sessionId`.
10. Default config/report storage is under `.ts-regression-checker`.
11. Compare runs exit with non-zero when regressions are detected.
12. `npm-script` checks that are mutating or multi-tool are rejected in config validation (multi-tool rejection does not apply to the allowlisted `typecheck:all` aggregate; mutating rejection does).
13. Compare mode aborts with `baseline-incompatible` when baseline metadata is incompatible with the current run inputs.

## Open decisions

1. None.

## Implementation readiness notes

- The contract is ready for MVP implementation.
- The next document should be an `ACTION_PLAN.md` section or dedicated action plan for:
  - schema + validator
  - runners and adapters
  - baseline store
  - comparison engine
  - fixed-structure header writer
  - tests for safety and diff behaviour
  - `.gitignore` update to ignore `.ts-regression-checker/reports` while allowing `.ts-regression-checker/regression.config.json` to be tracked
