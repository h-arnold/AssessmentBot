# Regression Checker Output Improvements Plan

## User Requirements

1. Header should report FAILING if there are regressions (not just failing checks)
2. Header field names should use Title Case (e.g., `Checks Failing` not `checksFailing`)
3. Add per-command summary showing pass/failure status per check ID (from regression.config.json) to help identify whether it's backend lint, test, compile, etc. that's the issue
4. Add list of failed tests/checks beneath header in human/LLM readable form
5. Write output to text file (currently not created in baseline mode)

## Current Output Analysis

Current baseline output:
```
=== REGRESSION HEADER START ===
sessionId: feat/ReactFrontend
sessionStorageKey: session-ZmVhdC9SZWFjdEZyb250ZW5k
sessionIdSource: git-branch
mode: baseline
baselineCreatedThisRun: true
baselineTimestamp: N/A
currentTimestamp: 2026-05-13T13:07:14.827Z
overallStatus: FAILING
totalChecks: 8
checksPassing: 5
checksFailing: 3
regressionsCount: 0
newFailuresCount: 0
fixesCount: 0
toolSummary: eslint=3, playwright=1, tsc=1, vitest=3
=== REGRESSION HEADER END ===
```

Config check IDs:
- backend-lint-check (eslint)
- frontend-lint-check (eslint)
- builder-lint-check (eslint)
- backend-test-coverage-check (vitest)
- frontend-test-coverage-check (vitest)
- frontend-e2e-check (playwright)
- builder-test-coverage-check (vitest)
- builder-compile-check (tsc)

## Desired Mock Output

### Baseline Mode:
```
=== REGRESSION HEADER START ===
Session ID: feat/ReactFrontend
Session Storage Key: session-ZmVhdC9SZWFjdEZyb250ZW5k
Session ID Source: git-branch
Mode: baseline
Baseline Created This Run: true
Baseline Timestamp: N/A
Current Timestamp: 2026-05-13T13:07:14.827Z
Overall Status: FAILING
Total Checks: 8
Checks Passing: 4
Checks Failing: 4
Regressions Count: 0
New Failures Count: 0
Fixes Count: 0
Tool Summary: eslint=3, playwright=1, tsc=1, vitest=3
=== REGRESSION HEADER END ===

--- PER-COMMAND SUMMARY ---
backend-lint-check: passing
frontend-lint-check: passing
builder-lint-check: failing
backend-test-coverage-check: passing
frontend-test-coverage-check: failing
frontend-e2e-check: failing
builder-test-coverage-check: passing
builder-compile-check: failing

--- FAILED CHECKS ---
1. builder-lint-check (eslint)
   Status: failing
   Exit Code: 1
   Errors: 2, Warnings: 0

2. frontend-test-coverage-check (vitest)
   Status: failing
   Exit Code: 1
   Tests: 10 total, 7 passed, 3 failed
   Failed Tests:
   - src/frontend/components/Button.spec.ts | Button | should handle click events
   - src/frontend/components/Button.spec.ts | Button | should be disabled when loading

3. frontend-e2e-check (playwright)
   Status: failing
   Exit Code: 1
   Tests: 5 total, 3 passed, 2 failed
   Failed Tests:
   - src/frontend/e2e/login.spec.ts | Login Page | should redirect after login
   - src/frontend/e2e/dashboard.spec.ts | Dashboard | should load user data

4. builder-compile-check (tsc)
   Status: failing
   Exit Code: 1
   Diagnostics: 2
```

### Compare Mode (with regressions):
```
=== REGRESSION HEADER START ===
Session ID: feat/ReactFrontend
Session Storage Key: session-ZmVhdC9SZWFjdEZyb250ZW5k
Session ID Source: git-branch
Mode: compare
Baseline Created This Run: false
Baseline Timestamp: 2026-05-12T10:00:00.000Z
Current Timestamp: 2026-05-13T13:07:14.827Z
Overall Status: FAILING
Total Checks: 8
Checks Passing: 4
Checks Failing: 4
Regressions Count: 3
New Failures Count: 2
Fixes Count: 1
Tool Summary: eslint=3, playwright=1, tsc=1, vitest=3
=== REGRESSION HEADER END ===

--- PER-COMMAND SUMMARY ---
backend-lint-check: passing
frontend-lint-check: passing
builder-lint-check: failing (1 regression)
backend-test-coverage-check: passing
frontend-test-coverage-check: failing (1 regression, 1 new failure)
frontend-e2e-check: failing (1 regression)
builder-test-coverage-check: passing (1 fix)
builder-compile-check: failing

--- FAILED CHECKS ---
1. builder-lint-check (eslint)
   Status: failing
   Exit Code: 1
   Regressions: 1
   - @typescript-eslint/no-explicit-any|scripts/builder/src/index.ts|10|5|Unexpected any type

2. frontend-test-coverage-check (vitest)
   Status: failing
   Exit Code: 1
   Regressions: 1, New Failures: 1
   - src/frontend/components/Button.spec.ts | Button | should handle click events (REGRESSION)
   - src/frontend/components/Input.spec.ts | Input | should focus on mount (NEW FAILURE)

3. frontend-e2e-check (playwright)
   Status: failing
   Exit Code: 1
   Regressions: 1
   - src/frontend/e2e/login.spec.ts | Login Page | should redirect after login (REGRESSION)

4. builder-compile-check (tsc)
   Status: failing
   Exit Code: 1
   Diagnostics: 2
```

## Implementation Plan

### File to Modify: `cli/index.ts`

#### Changes to `renderBaselineReport`:
1. Convert field names from camelCase to Title Case
2. Add per-command summary section showing pass/fail status per check ID
3. Add failed checks list section with numbered entries, showing check ID, tool, status, exit code, and summary counts (errors/warnings for eslint, test counts for vitest/playwright, diagnostic count for tsc)

#### Changes to `renderComparisonReport`:
1. Convert field names from camelCase to Title Case  
2. Add per-command summary section showing pass/fail status per check ID with regression/new failure/fix counts
3. Enhance failed checks list to include regression/newFailure/fix information from comparison with fingerprint details

#### Changes to `buildBaselineModeResult`:
1. Write output to text file (currently only compare mode writes files via `persistComparisonReports`)

#### Helper functions to add:
1. `formatFieldName(camelCase: string): string` - Converts camelCase to Title Case
2. `renderPerCommandSummary(checks: ScheduledCheckResult[] | ComparisonCheckResult[]): string` - Lists each check ID with its status and counts
3. `renderFailedChecksList(options: { checks: ...; derivedSummaries?: Map<string, DerivedSummary> }): string` - Formats failed checks with numbering and details
4. For compare mode: Include regression/new failure/fix counts in per-command summary

## Implementation Details

The main file to modify is `/workspaces/AssessmentBot/scripts/builder/src/regression-checker/cli/index.ts`

Changes needed:
- Update header field formatting in both report functions
- Add per-command (per-check-ID) summary rendering
- Add failed checks list rendering  
- Add file writing for baseline mode
- Pass derived summaries to baseline report for rich failure details
