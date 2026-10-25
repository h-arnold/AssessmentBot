# Regression Checker How-To

This guide explains how to configure, run, and troubleshoot the TypeScript regression checker used by the builder toolchain.

## Purpose and when to use it

Use the regression checker when you need deterministic comparisons between two runs of lint/test/compile checks.

Typical use cases:

- Verify that a branch has not introduced new lint, test, or TypeScript diagnostics.
- Gate local pre-push checks with a stable baseline/compare workflow.
- Produce machine-readable artefacts (`comparison.json`) and readable summaries (`comparison.txt`) for review.

The checker does not replace normal developer workflows. It layers on top of existing npm scripts and tool CLIs.

## Prerequisites and assumptions

Run from repository root.

Required:

- Dependencies installed (`npm install`).
- Builder TypeScript compiled (`npm run builder:compile`) if you run the Node entrypoint directly.
- Config file present at `.ts-regression-checker/regression.config.json`.
- All configured `cwd`, `reportDirectory`, and `run.project` paths must resolve inside repository root.

Common command entrypoints:

```bash
# Wrapper command from root package.json (compiles builder first)
npm run regression-checker -- [sessionId]

# Direct entrypoint (useful if builder is already compiled)
node scripts/builder/dist/regression-checker/run-regression-checker.js [sessionId]
```

## Configuration reference

Canonical config path:

- `.ts-regression-checker/regression.config.json`

Current repository example:

```json
{
  "reportDirectory": ".ts-regression-checker/reports",
  "parallel": {
    "enabled": false
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
      "id": "typescript-compile-check",
      "tool": "tsc",
      "cwd": ".",
      "run": {
        "kind": "npm-script",
        "script": "typecheck:all"
      }
    }
  ]
}
```

### Top-level fields

- `reportDirectory`:
  - Report root, relative to repository root.
  - Must stay inside repository root.
- `parallel.enabled`:
  - `true` enables bounded parallel scheduling.
  - `false` forces serial execution.
- `parallel.maxWorkers`:
  - Integer `>= 1`.
  - If omitted, defaults to `min(4, logicalCpuCount)`.
- `checks`:
  - Non-empty array.
  - `checks[].id` must be unique.

### Check fields

- `checks[].id`: Stable identifier used in report sections and artefact paths.
- `checks[].tool`: One of `eslint`, `vitest`, `playwright`, `tsc`.
- `checks[].cwd`: Working directory for that check, relative to repository root.
- `checks[].timeoutMs` (optional): Integer timeout in milliseconds for command execution.
- `checks[].reporterMode` (optional):
  - Allowed only for tools with supported modes.
  - Supported values in current implementation: `json` for `eslint`, `vitest`, `playwright`.
  - `tsc` has no supported reporter mode. This covers both `tsc` run kinds, including the npm-script aggregate, which writes a plain-text artefact.
- `checks[].run`:
  - For `eslint`, `vitest`, `playwright`: `{ "kind": "npm-script", "script": "..." }`
  - For `tsc`: `{ "kind": "tsc", "project": "..." }`, or the single allowlisted aggregate `{ "kind": "npm-script", "script": "typecheck:all" }`

### Safety and validation rules

The checker fails config validation before execution when any rule is violated:

- Absolute paths or path traversal outside repo root.
- Unsupported tool family.
- Unsupported reporter mode for tool family.
- `tool=tsc` with `run.kind=npm-script` unless the script is the single allowlisted aggregate `typecheck:all`; every other `tsc` npm script is rejected.
- `run.kind=tsc` used with any non-`tsc` tool.
- Missing npm script declaration in relevant `package.json`. This still applies to the allowlisted aggregate: renaming `typecheck:all` fails validation loudly.
- Mutating scripts in any check, including the allowlisted aggregate (for example `--fix`, `--write`, `--update`, `--update-snapshots`, `-u`).
- Chained scripts (`&&`, `||`, `;`, pipe), except the allowlisted `typecheck:all` aggregate, which is `&&`-chained by design.
- Script recursion.
- npm script that resolves to zero or multiple supported tool families.
- npm script resolved tool family mismatching `checks[].tool`.

#### Allowlisted `tsc` aggregate trade-off

`typecheck:all` is the only `tsc` npm script accepted. The validator still requires `tool: "tsc"`,
still requires the script to be declared, and still rejects mutating commands, but for this one
script it skips the declared-tool-family resolution that every other npm-script check must satisfy
and tolerates the `&&` chain. As a result the checker treats the aggregate's output as `tsc` text
without inspecting which commands the script chains. Pass/fail stays correct because it is driven by
the process exit code, but a re-pointed `typecheck:all` that ran a non-`tsc` tool would yield an
empty diagnostic set. The trade-off is deliberate: one aggregate gate covers every TypeScript
project. Keep the allowlist keyed to the exact script name and keep `typecheck:all` chaining only
TypeScript compilers.

## Running flows

### Session ID behaviour

`sessionId` can be supplied as a positional argument:

```bash
npm run regression-checker -- feature/regression-checker
```

If omitted, the checker uses the current Git branch name.

If branch resolution fails (for example detached HEAD), the run fails with an explicit session resolution error.

### Baseline flow (first run for a session)

If no baseline exists for `sessionId`, the checker:

1. Creates session baseline storage.
2. Runs all configured checks.
3. Writes baseline manifest and raw artefacts.
4. Prints a baseline report with:
   - `mode: baseline`
   - `baselineCreatedThisRun: true`
   - `baselineTimestamp: N/A`
   - `This run created the baseline and did not perform comparison diffing.`

Exit code is `0` when baseline creation completes successfully.

### Compare flow (subsequent run for same session)

If a baseline exists, the checker:

1. Creates a timestamped run directory under `runs`.
2. Runs all configured checks.
3. Validates baseline compatibility.
4. Compares baseline vs current summaries.
5. Writes `comparison.json` and `comparison.txt`.

### Exit codes

CLI exit codes from `run-regression-checker`:

- `0`: no regressions (`GREEN`) or baseline created successfully.
- `1`: regressions detected (`FAILING`).
- `2`: invalid regression config.
- `3`: unexpected failure, including baseline incompatibility and other runtime failures.

Note: `npm run regression-checker` runs `npm run builder:compile` first; if compile fails, the wrapper command exits before running the checker CLI.

## Report and artefact layout

Reports are written under:

- `.ts-regression-checker/reports`

Session folder uses a filesystem-safe key derived from session ID (`session-<base64url>`).

Layout:

```text
.ts-regression-checker/reports/
  session-<key>/
    baseline/
      manifest.json
      checks/<checkId>/raw.json|raw.txt
      checks/<checkId>/derived.json
    runs/<timestamp>/
      manifest.json
      checks/<checkId>/raw.json|raw.txt
      checks/<checkId>/derived.json
      comparison.json
      comparison.txt
```

Each `manifest.json` records both the logical `sessionId` and the derived filesystem-safe
`sessionStorageKey`.

### Manifest and compatibility checks

Before comparison diffing, compatibility is validated against baseline manifest:

- Config fingerprint.
- Check IDs and order.
- Tool families by check ID.
- Execution metadata (for example script name or tsc project).

Per-check `executionMetadata` records `{ project }` for `run.kind=tsc`, `{ script }` for the `tsc`
npm-script aggregate (no `reporterMode`), and `{ reporterMode, script }` for the other npm-script
tools.

If incompatible, overall status becomes `BASELINE-INCOMPATIBLE` and the process exits non-zero.

### Reading `comparison.txt`

Header is deterministic and bracketed:

- `=== REGRESSION HEADER START ===`
- `=== REGRESSION HEADER END ===`

Key fields include:

- Session identity and source.
- Mode and timestamps.
- Overall status.
- Aggregate totals (`regressionsCount`, `newFailuresCount`, `fixesCount`).
- `toolSummary`.

After the header, each check has a section:

- `checkId`
- `status`
- `tool`
- `regressions`
- `newFailures`
- `fixes`

### Raw artefact formats

- `eslint`: JSON reporter output.
- `vitest`: JSON reporter output.
- `playwright`: JSON reporter output persisted from stdout.
- `tsc`: text diagnostics. For `run.kind=tsc`, the runner passes `--pretty false` to the compiler.
  For the allowlisted `run.kind=npm-script` aggregate, the runner invokes `npm run typecheck:all`
  as-is — it injects no compiler arguments and no JSON reporter — and captures the script's plain
  text output. Pass/fail still comes from the process exit code, and the captured text is parsed
  for diagnostics.

## Typical workflows

### Local development workflow

1. Choose a stable session ID (often branch name).
2. Run once to create baseline.
3. Make changes.
4. Run again with same session ID to compare.
5. Review `comparison.txt` first, then inspect `comparison.json` for automation.

Example:

```bash
npm run regression-checker -- feature/my-change
# ... edit code ...
npm run regression-checker -- feature/my-change
```

### CI workflow pattern

1. Restore or persist `.ts-regression-checker/reports` between jobs/stages if you need compare mode across runs.
2. Run checker with an explicit session ID (for example branch or PR ID).
3. Fail pipeline on non-zero exit.
4. Publish `comparison.txt` and `comparison.json` as artefacts for diagnostics.

### Introducing a new check safely

1. Add a new non-mutating npm script (or `tsc` project entry).
2. Add check config with unique `id`, correct `tool`, and safe `cwd`.
3. Run checker with a new session ID to create baseline.
4. Run again to validate compare behaviour.
5. Keep check IDs stable to avoid baseline compatibility churn.

## Troubleshooting

### `Regression config is invalid`

Likely causes:

- Unsafe path values.
- Duplicate check IDs.
- Unsupported tool or reporter mode.
- `tool=tsc` with `run.kind=npm-script` naming anything other than the allowlisted `typecheck:all`.
- Script is chained or mutating (only `typecheck:all` is exempt from the chain rule).
- Script does not map to exactly one supported tool family.

Action:

- Validate each check against rules in this guide.
- Confirm scripts exist in the correct `package.json` for `cwd`/`npm --prefix` resolution.

### Baseline incompatibility (`BASELINE-INCOMPATIBLE`)

Likely causes:

- Check set changed.
- Tool family changed for an existing check ID.
- Script/project metadata changed.
- Config fingerprint changed from baseline.

Action:

- Create a fresh baseline for the session.
- Use a new session ID when intentionally changing check contracts.

### Detached HEAD / missing branch name

If no `sessionId` is passed, Git branch lookup is required.

Action:

- Supply an explicit `sessionId` argument in detached or ephemeral environments.

### Compare mode not triggering

If each run is creating baseline output, you are likely changing session ID each time.

Action:

- Re-run with exactly the same `sessionId`.
- Verify report directory persistence between runs.

### Insufficient runtime detail while checks execute

By default, child command output is not mirrored live.

Action:

```bash
REGRESSION_CHECKER_STREAM_OUTPUT=true npm run regression-checker -- feature/my-change
```

## Determinism guarantees and practical limits

Deterministic behaviour provided by implementation:

- Check result ordering follows config order.
- Tool summaries and fingerprints are sorted deterministically.
- Header fields are emitted in stable order.
- Session storage keys and run-directory naming are stable for identical inputs.

Important limits:

- The checker only supports `eslint`, `vitest`, `playwright`, and `tsc`.
- Comparison quality depends on tool-native output fidelity.
- Baseline and compare must use compatible check contracts.
- Playwright checks are always run in a dedicated single-worker lane, even when parallelism is enabled.
