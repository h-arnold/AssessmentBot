---
name: regression-checker
description: Use the config-driven regression checker CLI to establish a baseline, compare follow-up runs, and track repository health while progressing through `ACTION_PLAN.md`.
license: MIT
compatibility: opencode
---

# Regression Checker

Use this skill when you need a deterministic snapshot of the codebase while working through
`ACTION_PLAN.md`, especially for builder-led changes that need a stable health signal over time.

## What it does

- runs the repository regression checker from the root npm script
- creates or reuses a session baseline keyed by session ID
- compares the current tree against the saved baseline
- surfaces lint, test, compile, and build regressions with stable report artefacts

## Quick start

From the repository root:

```bash
npm run regression-checker -- <sessionId>
```

`sessionId` is optional. In normal use, omit it so the CLI uses the current Git branch name.
That keeps the report aligned with the branch and gives a clearer view of how the codebase is
changing there.

The wrapper first runs `npm run builder:compile` and then launches
`scripts/builder/dist/regression-checker/run-regression-checker.js`.

> **Timeout:** Always set a 20 minute (1200000 ms) timeout when invoking this command via the `shell` tool.
> Test suites can take several minutes and the default 120s timeout is not sufficient.

## How to use it with `ACTION_PLAN.md`

1. Choose one stable session ID for the whole plan, or omit it to let the CLI use the branch name.
   Keep that identity unchanged for every run so reports stay comparable.
2. Run the checker once before the first section to establish the baseline.
3. Do not run the checker between red, green or refactor phases. Use focused, section-scoped tests,
   lint and type checks for in-section verification instead; the checker is an expensive
   full-repository run that adds little signal mid-section.
4. Run the checker with the same session ID once at each full section completion, before the commit
   gate.
5. After the final cleanup pass, run one last comparison with the same session ID if that pass
   changed any files. If it changed nothing, record that and skip the run.
6. Treat that final comparison as a gate. Any regressions or unaccounted new failures mean the plan
   is not ready and its documentation commit must not proceed; fix the failures, re-review the
   corrected tree, and re-run the comparison until it is clean.
7. Record the status and report path in your progress notes before moving on.

## What to inspect

- `mode`: `baseline` or compare mode
- `sessionId` and `sessionStorageKey`
- `overallStatus`
- `regressionsCount`, `newFailuresCount`, `fixesCount`
- `toolSummary`
- whether the run created a baseline this time

## Report artefacts

The full report text that appears on stdout is also persisted to a file in the session
directory under the configured `reportDirectory` (default `.ts-regression-checker/reports`).

| Mode     | File path (relative to session dir) | Contains                                                                                                                     |
| -------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| baseline | `baseline/baseline.txt`             | Header metadata + per-check summary + failed checks with artefact-level details                                              |
| compare  | `runs/<timestamp>/comparison.txt`   | Header metadata + per-check summary + current failures per check + regressions, new failures, and fixes as delta annotations |

Report file tree:

```
.ts-regression-checker/reports/
└── session-<branch-name>/
    ├── baseline/
    │   ├── manifest.json
    │   ├── baseline.txt              ← full baseline report
    │   └── checks/
    │       ├── <check-id>/
    │       │   ├── raw.json          ← tool raw output (raw.txt for tsc)
    │       │   └── derived.json      ← structured summary for comparison
    │       └── ...
    └── runs/
        └── <timestamp>/
            ├── manifest.json
            ├── comparison.json       ← structured comparison data
            ├── comparison.txt        ← full comparison report
            └── checks/
                ├── <check-id>/
                │   ├── raw.json      ← tool raw output (raw.txt for tsc)
                │   └── derived.json  ← structured summary for comparison
                └── ...
```

Use `read` on `comparison.txt` or `baseline.txt` to inspect failure details without
re-running the checker.

## Validation and safety

- The config file is `.ts-regression-checker/regression.config.json`.
- Supported tool families are `eslint`, `vitest`, `playwright`, and `tsc`.
- Invalid config fails fast before execution.
- Compare runs exit non-zero when regressions are detected.

## Notes

- Treat the checker as the source of truth for whether the workspace is improving or regressing
  while the action plan advances.
- Keep the session ID stable so reports remain comparable across checkpoints.
