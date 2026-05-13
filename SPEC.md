# Regression-Checker Builder CLI Specification

## Status

- Draft v1.0
- Root planning artefact aligned to `docs/developer/regression-cli-spec.md`

## Purpose

This document defines the intended behaviour for the regression-checker builder CLI.

The feature will be used to:

- run supported regression checks without changing human-oriented npm scripts
- create and persist a baseline for a session identifier
- compare later runs against that baseline and detect regressions deterministically
- emit a fixed-structure summary header plus detailed artefacts for hook and LLM-first consumption

This feature is **not** intended to:

- execute arbitrary shell commands outside the supported tool families
- replace existing human-readable developer workflows
- add frontend surfaces or backend/API integration

## Agreed product decisions

1. The CLI contract is `regression-checker [sessionId]`.
2. When `sessionId` is omitted, the CLI must use the current Git branch name; detached HEAD or other lookup failure is a hard error.
3. If no baseline exists for the resolved session, the run creates one and exits `0`.
4. If a baseline exists, the run performs a comparison against that baseline.
5. The CLI is config-driven and reads checks from `.ts-regression-checker/regression.config.json`.
6. Supported v1 tool families are strictly `eslint`, `vitest`, `playwright`, and `tsc`.
7. Unsupported tool families, unsupported reporter modes, mutating scripts, multi-tool scripts, and invalid script-to-tool mappings must fail validation before execution.
8. `run.kind` values are restricted to `npm-script` and `tsc`.
9. `tool=tsc` is valid only with `run.kind=tsc`; `run.kind=npm-script` is invalid for `tsc` in v1.
10. `run.kind=npm-script` supports only single-tool, non-mutating scripts that resolve to exactly one supported tool family.
11. Raw tool-native outputs must be stored per check, and comparison must use tool-specific derived summaries rather than one universal schema.
12. Parallel execution defaults to `min(4, logicalCpuCount)` when `parallel.maxWorkers` is omitted.
13. Playwright checks must always execute in a dedicated single-worker lane.
14. Report ordering must stay deterministic in config order regardless of execution order.
15. The default storage root for config and report artefacts is `.ts-regression-checker`.
16. Compare runs must exit non-zero when regressions are detected so the CLI is hook-friendly.
17. Baseline compatibility validation must pass before diffing: config fingerprint, check IDs, tool families, and execution metadata must match.
18. Baseline-mode output must explicitly state that the baseline was created in this run and that no comparison diffing occurred.

## Existing system constraints

### Backend or API constraints already in place

- No backend or API integration is required for v1.
- All inputs and outputs are local file-system artefacts.

### Current data-shape constraints

- ESLint and Vitest can emit JSON directly.
- Playwright can emit JSON through reporter mode.
- `tsc` does not provide a stable native JSON diagnostic format, so v1 must capture stable text output with `--pretty false` and parse diagnostics.

### Frontend or consumer architecture constraints

- Existing npm scripts stay human-friendly and unchanged.
- The CLI must layer on top of existing tooling rather than replace developer-facing scripts.
- This is builder-only work; no frontend layout spec is required.

## Domain and contract recommendations

### Why this approach is preferable

- deterministic execution and parsing without model interpretation
- strict allowlist validation and repo-root path safety
- low adoption cost because existing scripts remain intact
- clean extension path for future tool adapters

### Recommended data shapes

#### Regression config

```ts
{
  reportDirectory: string;
  parallel?: {
    enabled: boolean;
    maxWorkers?: number;
  };
  checks: Array<{
    id: string;
    tool: 'eslint' | 'vitest' | 'playwright' | 'tsc';
    cwd: string;
    reporterMode?: string;
    run:
      | { kind: 'npm-script'; script: string }
      | { kind: 'tsc'; project: string };
  }>;
}
```

#### Stored run manifest

```ts
{
  sessionId: string;
  sessionStorageKey: string;
  sessionIdSource: 'arg' | 'git-branch';
  mode: 'baseline' | 'compare';
  createdAt: string;
  baselineCreatedThisRun: boolean;
  configFingerprint: string;
  checks: Array<{
    id: string;
    tool: 'eslint' | 'vitest' | 'playwright' | 'tsc';
    cwd: string;
    executionMetadata: Record<string, string | number | boolean | null>;
  }>;
}
```

### Validation recommendation

#### Builder CLI inputs

- `reportDirectory`, each `checks[].cwd`, and each `run.project` path must be repo-relative and must not escape the repository root.
- `checks[].id` values must be unique.
- `run.kind=npm-script` must resolve to an existing script in the relevant `package.json` and to exactly one supported tool family.
- Mutating flags such as `--fix`, `--write`, `-u`, `--update`, and `--update-snapshots` must be rejected.
- Unsupported reporter modes must fail validation before any tool process starts.

## Feature architecture

### Placement

- CLI implementation lives under `scripts/builder/src/regression-checker/`.
- Builder quality gates apply: builder lint, builder TypeScript compile, builder Vitest suites, and production build validation where relevant.
- No frontend or backend runtime entry point is added.

### Proposed high-level tree

```text
scripts/builder/src/regression-checker/
 cli/
 config/
 runners/
 compare/
 report/
 storage/
```

### Out of scope for this surface

- auto-fixing lint or test failures
- modifying production source code based on regression output
- CI orchestration beyond local command execution and report generation
- arbitrary tool execution beyond the v1 allowlist

## Data loading and orchestration

### Required datasets or dependencies

- repository root and Git branch resolution
- target `package.json` script maps for validation
- local file-system write access under `.ts-regression-checker`
- supported tool executables already present in the project toolchain

### Prefetch or initialisation policy

#### Startup

- Parse the positional `sessionId` argument.
- Resolve Git branch name only when `sessionId` is omitted.
- Load and validate config before any check execution.
- Resolve the baseline-or-compare mode before scheduling checks.

#### Manual refresh

- Not applicable; this is a one-shot CLI workflow.

### Query or transport additions

- None.

## Core behavioural model

### Suggested shape

```ts
{
  header: {
    sessionId: string;
    sessionStorageKey: string;
    sessionIdSource: 'arg' | 'git-branch';
    mode: 'baseline' | 'compare';
    baselineCreatedThisRun: boolean;
    baselineTimestamp: string | 'N/A';
    currentTimestamp: string;
    overallStatus: 'GREEN' | 'FAILING';
    totalChecks: number;
    checksPassing: number;
    checksFailing: number;
    regressionsCount: number;
    newFailuresCount: number;
    fixesCount: number;
  }
  checks: Array<{
    id: string;
    tool: 'eslint' | 'vitest' | 'playwright' | 'tsc';
    status: 'passing' | 'failing' | 'execution-error' | 'baseline-incompatible';
    rawArtefactPath: string;
    derivedSummaryPath: string;
  }>;
}
```

### Derivation or merge rules

#### Derived summaries by tool

- `eslint`: counts for errors and warnings; finding fingerprint `ruleId|filePath|line|column|message`.
- `vitest` and `playwright`: counts for total, passed, failed, skipped; failure fingerprint `file|suite|testName`.
- `tsc`: diagnostic count plus fingerprint `code|filePath|line|column|message`.

#### Comparison categories

- `regressions`: baseline pass or absence becomes current fail or presence.
- `new-failures`: current failure or fingerprint absent from the baseline set.
- `fixes`: baseline failure or fingerprint absent in the current set.
- Runtime or execution errors always count as regressions.
- For Vitest and Playwright, a test skipped in current but not skipped in baseline counts as a regression.
- For ESLint, both new warnings and new errors count as regressions.

### Sort order or priority rules

1. Render checks in config order.
2. Render header keys in fixed order.
3. Keep deterministic tie-breaks inside tool-specific lists by stable fingerprint order.

## Workflow specification

## Baseline creation

### Eligible inputs or preconditions

- Resolved `sessionId` and valid config.
- No existing baseline for the resolved `sessionStorageKey`.

### Behaviour

- Execute all configured checks under the validated scheduling rules.
- Persist baseline artefacts under `<reportDirectory>/<sessionStorageKey>/baseline/`.
- Persist `manifest.json`, per-check raw output, and per-check derived summary.
- Emit summary text that explicitly states baseline creation and the absence of comparison diffing.
- Exit `0` when baseline creation succeeds.

## Comparison run

### Eligible inputs or preconditions

- Resolved `sessionId`, valid config, and an existing baseline for the same `sessionStorageKey`.
- Baseline compatibility validation must pass before diffing.

### Behaviour

- Execute all configured checks under the validated scheduling rules.
- Persist current-run artefacts under `<reportDirectory>/<sessionStorageKey>/runs/<timestamp>/`.
- Write `comparison.json` and `comparison.txt` for the run.
- Exit `1` when one or more regressions are detected; otherwise exit `0`.
- Abort comparison with a clear baseline-incompatible result when baseline metadata is incompatible.

## Error, loading, and empty-state rules

### Blocking failure

- Invalid config, unsupported tool family, unsupported reporter mode, repo-escaping paths, invalid script mappings, detached HEAD branch resolution failure, and baseline incompatibility are blocking failures.
- These failures must stop the run with a clear non-zero exit and actionable message.

### Empty states

#### No configured checks

- Reject config as invalid rather than running an empty session.

## Accessibility and usability notes

- The text report must begin with deterministic header markers so tools can parse the summary before the detailed body.
- Human-readable scripts remain unchanged; the regression checker is an additional builder CLI.

## Backend changes required to support agreed behaviour

1. None.

## Planning handoff notes

- Sequence work so CLI/config validation lands before runners, storage, comparison, and report integration.
- Use builder-first validation commands in the action plan and delegated implementation work.
- Keep any `.gitignore` change limited to ignoring generated reports while allowing the tracked config file.

## Testing expectations

- Builder Vitest coverage for session resolution, config validation, runner adapters, storage, comparison, report header rendering, and exit codes.
- Regression coverage for path safety, mutating-script rejection, baseline incompatibility, deterministic ordering, and runtime-error handling.
- Final builder validation must include builder lint, builder compile, relevant builder tests, and builder coverage where new modules land.

## Documentation and rollout notes

- Keep `docs/developer/regression-cli-spec.md` as the source specification.
- Update builder-facing docs if implementation changes command usage, storage conventions, or validation expectations.
- Add a `.gitignore` rule for `.ts-regression-checker/reports` without ignoring `.ts-regression-checker/regression.config.json`.

## V1 scope recommendation

### Include in v1

- CLI argument handling and session resolution
- strict config validation and script-to-tool allowlist enforcement
- bounded parallel runners with a dedicated Playwright lane
- baseline storage, comparison, fixed-structure report output, and exit-code handling

### Defer from v1

- support for additional tool families
- universal normalisation schema across all tools
- CI orchestration beyond local execution and generated artefacts
