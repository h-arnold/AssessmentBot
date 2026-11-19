# Regression Reporting CLI Specification

## Status

The how-to owns the current operational contract; see [Regression Checker How-To](./builder/regression-checker-how-to.md).

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
6. Supported tool families are strictly: `eslint`, `vitest`, `playwright`, `tsc`.
7. Unsupported tool families or unsupported reporter modes fail validation before execution.
8. The CLI stores raw tool-native outputs and compares baseline vs current using tool-specific diff logic.
9. The report starts with a fixed-structure summary header block for deterministic first-pass parsing.
10. `tsc` checks use direct `run.kind=tsc` mode.
11. Parallel execution defaults to `maxWorkers = min(4, logicalCpuCount)`.
12. Playwright checks always run in a dedicated single-worker lane.
13. The default storage root for config and report artefacts is `.ts-regression-checker`.
14. Compare runs exit with a non-zero code when regressions are detected, so the CLI can be used in pre-commit and other hooks.
15. `run.kind=npm-script` supports only single-tool, non-mutating scripts that map to exactly one supported tool family. The sole exception is the allowlisted aggregate `typecheck:all`, which is exempt from the single-tool and non-chained rules; the mutating-flag and declared-script guards still apply.
16. Baseline and compare runs must validate baseline compatibility (config/check/tool metadata) before diffing.
17. Baselines are auto-created when missing, and baseline-mode reports must be explicitly flagged as baseline creation output.

Because the aggregate bypasses declared-tool-family resolution, the checker treats its output as
`tsc` text; pass/fail is still driven by the process exit code. See the
[Regression Checker How-To](./builder/regression-checker-how-to.md) for the operational contract
and the trade-off.

## Existing system constraints

### Backend or API constraints already in place

- No backend/API integration is required.
- All artefacts are file-based in the local workspace.

### Current data-shape constraints

- ESLint and Vitest can emit JSON directly.
- Playwright can emit JSON via reporter mode.
- `tsc` does not provide stable native JSON diagnostics; the checker uses stable text mode and parses diagnostics.

### Frontend or consumer architecture constraints

- Existing npm scripts are kept human-friendly and unchanged.
- The regression CLI must layer on top of existing scripts/tools instead of replacing them.

## Domain and contract recommendations

### Why this approach is preferable

- deterministic execution and parsing without model interpretation
- safety via strict allowlist and validation
- low adoption cost because existing scripts remain intact
- extensibility by adding more supported tool adapters later

### Configuration and artefacts

The how-to owns the config fields, tool execution rules, and artefact layout. See [Configuration reference](./builder/regression-checker-how-to.md#configuration-reference), [Safety and validation rules](./builder/regression-checker-how-to.md#safety-and-validation-rules), [Raw artefact formats](./builder/regression-checker-how-to.md#raw-artefact-formats), and [Report and artefact layout](./builder/regression-checker-how-to.md#report-and-artefact-layout).

## Feature architecture

### Placement

- CLI source: [scripts/builder/src/regression-checker/](../../scripts/builder/src/regression-checker/) so it remains in an active tooling area and inherits builder quality gates
- Config schema/docs: `docs/developer/`
- Quality gates: follow builder-style lint, TypeScript compile, and test gates for this tooling area
- No change required to existing package scripts for human use.

### Out of scope for this surface

- auto-fixing lint/test failures
- modifying production source code based on report output
- CI orchestration beyond local command execution and report generation

## Data loading and orchestration

### Required dependencies

- Node runtime and project toolchain already used by the repository
- read access to target `package.json` files for script validation
- write access to configured report directory

### Execution and CLI behaviour

The how-to owns the execution flows, session resolution, and exit codes. See [Running flows](./builder/regression-checker-how-to.md#running-flows), [Session ID behaviour](./builder/regression-checker-how-to.md#session-id-behaviour), [Exit codes](./builder/regression-checker-how-to.md#exit-codes), and [Determinism guarantees and practical limits](./builder/regression-checker-how-to.md#determinism-guarantees-and-practical-limits).

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

Regression semantics:

- ESLint: new warning findings and new error findings both count as regressions
- Vitest/Playwright: a test that was not skipped in baseline but is skipped in current counts as a regression
- Runtime/execution errors: any check execution/runtime error counts as a regression

## Report and error-handling contract

The how-to owns the report format, header and body fields, failure handling, and acceptance behaviour. See [Reading `comparison.txt`](./builder/regression-checker-how-to.md#reading-comparisontxt), [Report and artefact layout](./builder/regression-checker-how-to.md#report-and-artefact-layout), [Safety and validation rules](./builder/regression-checker-how-to.md#safety-and-validation-rules), and [Exit codes](./builder/regression-checker-how-to.md#exit-codes).
