# Regression Reporting CLI Specification

## Status

- Draft v1.0
- Created to define a deterministic, non-LLM regression reporting workflow for lint, test, and compile/build checks.

## Purpose

This document defines the intended behaviour for a config-driven CLI that captures tool-native structured outputs, stores baseline runs by session, and compares follow-up runs to detect regressions.

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
10. `tsc` checks use direct `run.kind=tsc` mode only in v1 for stricter safety.
11. Parallel execution defaults to `maxWorkers = min(4, logicalCpuCount)`.
12. Playwright checks always run in a dedicated single-worker lane.
13. The default storage root for config and report artefacts is `.ts-regression-checker`.
14. Compare runs exit with a non-zero code when regressions are detected, so the CLI can be used in pre-commit and other hooks.
15. `run.kind=npm-script` in v1 supports only single-tool, non-mutating scripts that map to exactly one supported tool family.
16. Baseline and compare runs must validate baseline compatibility (config/check/tool metadata) before diffing.
17. Baselines are auto-created when missing, and baseline-mode reports must be explicitly flagged as baseline creation output.

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

Preferred config file path:

- `.ts-regression-checker/regression.config.json`

Recommended top-level shape:

```json
{
  "reportDirectory": ".ts-regression-checker/reports",
  "parallel": {
    "enabled": true,
    "maxWorkers": 2
  },
  "checks": [
    {
      "id": "backend-lint-check",
      "tool": "eslint",
      "cwd": ".",
      "run": {
        "kind": "npm-script",
        "script": "lint:backend:check"
      }
    },
    {
      "id": "builder-compile",
      "tool": "tsc",
      "cwd": ".",
      "run": {
        "kind": "tsc",
        "project": "scripts/builder/tsconfig.json"
      }
    },
    {
      "id": "backend-tests",
      "tool": "vitest",
      "cwd": ".",
      "run": {
        "kind": "npm-script",
        "script": "test:backend"
      }
    }
  ]
}
```

`run.kind` values:

- `npm-script`
- `tsc`

Validation rules:

- each `checks[].id` must be unique
- each `checks[].tool` must be one of `eslint|vitest|playwright|tsc`
- `reportDirectory` must resolve to a repo-relative path under the repository root (absolute paths are invalid in v1)
- each `checks[].cwd` must resolve to a repo-relative path under the repository root (path traversal outside repo is invalid)
- `run.kind=npm-script` requires script existence in the relevant `package.json`
- `run.kind=npm-script` requires the script to be non-mutating (no `--fix`, `--write`, or equivalent mutating flags)
- `run.kind=npm-script` requires the script command to resolve to exactly one supported tool family in v1 (no chained multi-tool scripts)
- `run.kind=tsc` requires `tool=tsc` and a valid `project` path
- for `tool=tsc`, `run.kind=npm-script` is invalid in v1
- script command must resolve to the declared tool executable family
- if `parallel.enabled=true`, `parallel.maxWorkers` must be an integer greater than or equal to `1`
- when `parallel.maxWorkers` is omitted, default to `min(4, logicalCpuCount)`

### Tool execution contract

For each check, the runner enforces tool-native structured or parseable output mode:

- `eslint`: append/override formatter to JSON and write JSON file
- `vitest`: append/override reporter to JSON and write JSON file
- `playwright`: append/override reporter to JSON and capture JSON output file
- `tsc`: enforce stable plain diagnostics mode (`--pretty false`) and capture text output for parser

If the configured script cannot be validated to the declared tool family, fail before execution.

### Session storage recommendation

Base directory:

- `<reportDirectory>/<sessionStorageKey>/`

Default report directory:

- `.ts-regression-checker/reports`

Baseline:

- `<reportDirectory>/<sessionStorageKey>/baseline/`
  - `manifest.json`
  - `checks/<check-id>/raw.*`
  - `checks/<check-id>/derived.json`

Follow-up runs:

- `<reportDirectory>/<sessionStorageKey>/runs/<timestamp>/`
  - `manifest.json`
  - `checks/<check-id>/raw.*`
  - `checks/<check-id>/derived.json`

Comparison output:

- `<reportDirectory>/<sessionStorageKey>/runs/<timestamp>/comparison.json`
- `<reportDirectory>/<sessionStorageKey>/runs/<timestamp>/comparison.txt`

Session identity and storage safety:

- `sessionId` is the logical identifier shown in reports and manifests
- `sessionStorageKey` is a filesystem-safe encoding derived from `sessionId` and used for directory names
- manifests must persist both `sessionId` and `sessionStorageKey`

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

1. Parse CLI args and load config.
   - resolve `sessionId` from positional arg when supplied; otherwise resolve it from current Git branch name
   - derive `sessionStorageKey` from `sessionId` for filesystem-safe storage
2. Validate config schema and tool allowlist constraints.
3. Validate each configured check can resolve to its declared tool family.
4. Determine mode:
   - baseline mode when no baseline exists for `sessionStorageKey`
   - compare mode when baseline exists
5. Execute checks in bounded parallel mode and capture raw outputs.
6. Route Playwright checks through a dedicated single-worker lane.
7. Preserve deterministic report ordering by rendering summaries in config order regardless of completion order.
8. Generate per-check derived summaries for diffing.
9. Validate baseline compatibility before comparison diffing (config fingerprint, check IDs, tool families, and execution metadata).
10. Write baseline or comparison artefacts.
11. Print and persist a fixed-structure summary header followed by detailed body.

### CLI and exit-code contract

- entry script: `npm run regression-checker -- [sessionId]`
- runtime contract: `regression-checker [sessionId]`
- when `sessionId` is omitted, use current Git branch name
- if branch name cannot be resolved (for example detached HEAD), fail fast with a clear error
- baseline mode exits `0` on successful baseline creation
- baseline mode output must explicitly include that this run created the baseline and did not perform comparison diffing
- compare mode exits `1` when one or more regressions are detected
- compare mode exits `0` when no regressions are detected
- invalid config, unsupported tool/mode, or runtime execution errors exit non-zero (implementation-specific error codes are allowed)

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

After header end marker:

- execution metadata
- per-check status and counts
- explicit regression/new-failure/fix listings
- file references to raw artefacts

## Error handling and safety

1. Fail fast on invalid config or unsupported tool.
2. Fail fast if script resolution does not match declared tool family.
3. Do not execute arbitrary shell strings from config.
4. Record execution errors as reportable check failures with clear error codes.
5. Fail fast when `sessionId` is omitted and current Git branch name cannot be resolved.
6. Fail fast when `reportDirectory` or `cwd` escapes the repository root.
7. Fail comparison with a clear `baseline-incompatible` status when baseline metadata does not match current metadata.

## Acceptance criteria

1. Running `regression-checker <sessionId>` with no prior baseline creates baseline artefacts.
2. Running the same command again creates a comparison report.
3. Unsupported tool types are rejected before any check runs.
4. Invalid script-to-tool mappings are rejected before execution.
5. Header includes required summary fields in deterministic order and uses the defined start/end markers.
6. Report highlights regressions, new failures, and fixes.
7. Raw tool-native outputs are persisted for each check.
8. Checks run in bounded parallel mode while report ordering remains deterministic.
9. Running `regression-checker` without `sessionId` uses the current Git branch as `sessionId`.
10. Default config/report storage is under `.ts-regression-checker`.
11. Compare runs exit with non-zero when regressions are detected.
12. `npm-script` checks that are mutating or multi-tool are rejected in config validation.
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
