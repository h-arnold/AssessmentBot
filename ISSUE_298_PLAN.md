# Issue #298 — Re-run Assessment from an individual assignment

Issue: https://github.com/h-arnold/AssessmentBot/issues/298

## Agreed behaviour

- On the individual assignment heatmap reached from `ClassPage`, put a **Re-run Assessment** button with a distinct Lucide icon in the right-hand navigation actions, immediately **left of Refresh**. Keep **Back to Class overview** on the left.
- Clicking the button opens the existing `AssessTaskModal` for this class and assignment. Skip its assignment-selection stage and start the assessment automatically, without a second confirmation click.
- Reuse the `assignmentDefinitionKey` stored on the class's previously assessed assignment, even if its current Google Classroom title or topic has changed. This is the user's confirmed choice; do not re-match it by title/topic/year group.
- Retain the modal's existing loading, success, error and `DEFINITION_STALE` recovery behaviours. The success response means a background assessment has been queued, **not** that results are ready; the existing Refresh action reloads results after processing.
- If the assignment or linked definition is unavailable, surface a clear failure instead of starting with a different definition. Do not change the existing manual Start New Assessment flow.

## Implementation scope

1. Wire a Re-run Assessment action from `TaskHeatmapPage` through `ClassPageContent` to the `ClassPage` modal owner, passing the selected assignment ID and its linked definition key. Use the existing `PageNavCard` action layout and accessible button patterns.
2. Extend `AssessTaskModal` and `useAssessTaskFlow` with an optional, explicit re-run entry context. On opening, resolve the requested Classroom assignment and automatically initiate exactly one `startAssessmentRun({ definitionKey, assignmentId, courseId })` request. Preserve the existing manual selection/matching path for all other callers.
3. Ensure the new path works with captured context and stale-definition recovery; handle missing assignments, missing/invalid definition keys, fetch/API failures, retries, cancellation, closing/reopening and React StrictMode without duplicate runs or stale completions. Keep the re-run context visible instead of presenting the skipped selector.
4. Add focused Vitest and Playwright tests for action placement/wiring, automatic single start with the persisted key, unchanged manual entry, failure handling and stale recovery. Run frontend unit and E2E tests, check-only lint and frontend build; compare the final regression-checker run against the pre-change baseline.

## Boundaries

- No new backend API or persistence contract is expected: `startAssessmentRun` already accepts the three identifiers and completed runs replace the previous stored assignment for the same ID.
- No separate assignment-definition wizard or additional confirmation modal is needed. Reuse the existing assessment modal and recovery surfaces.
- Keep changes localised; consult frontend component and spacing conventions before changing UI. If a touched frontend source file exceeds 550 lines, follow the required responsibility-based decomposition rule.
- Existing unrelated release-note and package-file working-tree changes are out of scope and must not be altered.
