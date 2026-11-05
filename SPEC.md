# Display Legacy Assignment Results

## Status

Reviewed and ready for implementation planning handoff. No production changes have been made.

## Purpose

Show valid saved assessment results, including older assignments without an assessment contract version. Mark those assignments “Reassessment required” without replacing their scores or content. Corrupted assessment data shows as individual `E` results; it must not prevent other submissions from displaying.

## Agreed product decisions

1. The field remains `assessmentContractVersion`. Read responses use `1 | 'legacy'`. Missing stored versions read as `'legacy'`. As an explicit compatibility assumption, stored `null` and any unsupported version also read as `'legacy'`; version `1` remains `1`.
2. Valid legacy scores, reasoning, source content and feedback display normally. Legacy numeric scores are included in heatmaps and averages using the existing weighting and `N`/`E` rules. There is no separate legacy calculation mode.
3. Legacy assignments have a visible “Reassessment required” tag **only in their task heatmap**, beside the existing Re-run Assessment action. Recent-assignment cards are unchanged (explicit user decision). After a successful rerun, refreshed responses carry `1` and the tag disappears. A failed rerun leaves existing results and the tag in place.
4. Invalid assessment items become all-three-criteria `CORRUPT_RECORD` `E`, using the existing error shape and reasoning. Valid items in the same submission and valid neighbouring submissions remain unchanged. An old version marker alone is never a reason to replace data with `E`.
5. **Corrupted or missing student IDs are explicitly out of scope**, as requested by the user. Do not add invented IDs, dropped-submission handling, unknown-student rows or warnings for that case. Use the same identity check as marker-1 records (`studentId` required); the removed projector's `userId`-only fallback goes with it. No identity recovery is planned.
6. Reading must not migrate data or write results back. Ordinary saves preserve the saved legacy submissions and the original marker presence/value. The read-only `'legacy'` marker and any read-time `E` replacements must not enter persistence. Completed-run validation, marker stamping and write order do not change.
7. Fix PR #346's empty-array regression: in the legacy restoration branch, preserve every present `submissions` value, including `null` or an object. Only an absent property uses the constructor's empty-array initial state. Full and partial persistence serialisers must not turn a present non-array value into `[]`.
8. Rewrite the related documentation and touched comments in plain English. Replace “task universe” with “task IDs” or “tasks”; remove certification, honesty and similar framing, repeated explanations and filler. Describe fields, validation and storage directly. Preserve useful technical details and security restrictions. This applies only to the listed related docs and code files touched by the feature, not untouched files such as the completed-write gate or `backend-testing.md`.

## Existing constraints

- Full records are read by `getAssignment`; class-embedded partial assignments by `getABClass`. The latter removes the embedded definition after preparing the response. Its stored task summaries are available before that removal.
- The existing legacy branch retains raw submission records; the current branch restores validated models. Keep that separation for persistence.
- `AssignmentCurrentRestoration` already owns backend item validation, missing-item replacement, task-list handling and submission timestamp preparation. Reuse those rules rather than introducing another validator.
- The frontend normalisers validate items before their final Zod parse. Their current marker-null requirement forces even valid legacy results into errors; remove that requirement.
- JsonDbApp can revive dates. Keep existing date-to-ISO conversion and the JSON-string API envelope. The version change does not change envelope fields or endpoint names.
- Ant Design provides the status tag. No new page, modal, selection or rerun workflow is needed.

## Data contracts

### Marker

| Boundary                                | Current                                                    | Target                                         |
| --------------------------------------- | ---------------------------------------------------------- | ---------------------------------------------- |
| Saved assignments and embedded partials | Stored marker may be `1`, missing, `null` or another value | Unchanged, including original presence/value   |
| Full and class read response            | `1` or `null`                                              | Required `1` or `'legacy'`                     |
| Full/partial frontend Zod schemas       | `z.union([z.literal(1), z.null()])`                        | `z.union([z.literal(1), z.literal('legacy')])` |
| Recent-assignment card view model       | No version field                                           | Unchanged; no tag on cards                     |

No field is added to saved class metadata. Root `null` still means “not found”; that is unrelated to a version field equal to `null`.

### Legacy read preparation

Both backend read paths prepare an independent read result while they still have the embedded task list. They do not alter the restored assignment or its saved raw submissions.

Validation mode mirrors current restoration, not response size: summary-array embedded tasks select partial validation; a keyed embedded task map selects full validation. Class responses still serialise partials in either case. A redacted submission stored under a full definition is therefore checked as full and contradictory null source data becomes E. Direct full reads resolve the full definition first and validate full submissions. The preparation helper's `form` selects output serialisation only, not a weaker validator.

For records with valid student/assignment identities and a valid embedded definition:

| Saved data                                                                                                            | Read result                                                                                                                                                        |
| --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Complete valid item                                                                                                   | Keep scores, reasoning, feedback, artefact type and content, with normal full/partial serialisation                                                                |
| Item with null/malformed assessments, missing criteria, invalid score, invalid artefact or contradictory source state | Existing `CORRUPT_RECORD` `E` for that task; keep healthy siblings                                                                                                 |
| Identifiable submission whose `items` is null, missing, an array or another non-record value                          | One `CORRUPT_RECORD` `E` item per task in its embedded definition; keep other submissions                                                                          |
| Missing known-task item, except the genuine no-submission case                                                        | Same missing-item `E` behaviour as current-format restoration, including non-empty null-parent submissions                                                         |
| Null parent document and a genuinely empty item map                                                                   | Existing no-submission representation; no manufactured attempt or score                                                                                            |
| Missing/invalid submission timestamps                                                                                 | Reuse existing deterministic timestamp preparation: valid saved values, otherwise assignment timestamps, with `createdAt` used when assignment `updatedAt` is null |
| Missing/null student name                                                                                             | Existing model's nullable-name representation                                                                                                                      |

Use the task list saved with that assignment, not a newer registry definition, except for the existing full-read resolution of an embedded partial definition. Class reads must prepare legacy submissions before replacing the embedded definition with `assignmentDefinitionKey`.

Existing assignment/student identity checks and unknown-task association errors are unchanged; this feature isolates assessment-data corruption, not identity corruption. Do not catch arbitrary constructor/programming errors and relabel them `E`. Explicit item validation failures and malformed item maps are the expected recoverable cases.

The existing `REASSESSMENT_REQUIRED` placeholder producer and its read-projection module are removed. The error catalogue entry may remain accepted for previously stored explicit errors; do not add unrelated catalogue deletion work. The assignment tag comes from `'legacy'`, not that error code.

### Empty-array regression and malformed roots

For a legacy assignment with a present non-array `submissions` field:

- Restoration and ordinary class persistence preserve that value, date-normalised as necessary, rather than replacing it with `[]`.
- The frontend rejects a non-array submissions root through its existing root validation. `getAssignment` then fails for that assignment; `getABClass` fails for that class. This is distinct from an individual corrupted item or item map, which must show `E` without blocking the read.
- Both backend read serialisers skip submission preparation for a present non-array root and emit the preserved value, date-normalised, with `'legacy'`. They do not throw first or replace it with `[]`.
- An absent property retains the constructor's empty-array state. Explicit `null` is not absence.
- Marker-1 root validation is unchanged. Rerunning may legitimately replace the saved assignment.

## Architecture and ownership

- `AssignmentRehydration` retains saved legacy state without coercion.
- `AssignmentSerialisation` owns persistence output and full read output. `ABClassResponseMapper` owns class read output.
- A small backend legacy-read preparation module reuses `AssignmentCurrentRestoration` and model serialisers on an independent result. It does not invent a second assessment validator or a snapshot store. The existing restoration facade exposes this operation to both read callers. Any extraction needed to share explicit validation stays under `Assignment/` and preserves marker-1 behaviour.
- Both frontend normalisers accept valid `'legacy'` items using the existing full/partial item validation, without requiring reassessment placeholders. The backend prepares malformed item maps and missing-task errors before the frontend loses access to the embedded task list. The browser's defensive `addMissingFullTasks()` fallback stays marker-1-only; backend legacy preparation owns coverage, including non-empty null-parent submissions. Only the genuine no-submission case is exempt.
- `TaskHeatmapPage` reads the selected assignment's marker from the loaded class response; no extra fetch or recent-card model field is needed for the tag.
- Data-analysis services continue to use the same scores and error rules. No marker-based filtering is added.

## User-facing surface

A non-dismissible warning-coloured Ant Design tag with text **Reassessment required** appears beside Re-run Assessment in the class task heatmap navigation card. If no rerun callback is supplied, the tag is still visible before Refresh. It does not replace scores, disable previews or block rerunning. Recent-assignment cards and other heatmap-builder surfaces are unchanged.

A separate root `LEGACY_ASSIGNMENT_READ_LAYOUT.md` is required because this adds visible assignment status. Complete and review it before the action plan. Existing loading, empty and error states remain unchanged.

## Scope boundaries and assumptions

In scope: the read marker, preservation fix, read-time assessment error isolation, tag, score inclusion tests, relevant fixture support, and the requested plain-language cleanup. This includes updating the contract-coupled legacy preview fixtures and browser journey; the separate classes/settings E2E harness rework is not part of this feature.

Out of scope: corrupted student IDs (explicit user decision); migration or recovery of data already lost; new identity repair; new UI workflows; changes to scoring, weights, completed-write validation or unrelated E2E harness work.

Assumptions: non-1 stored versions share legacy read behaviour; normal legacy item shapes are compatible with existing numeric/N schemas. This is verified with realistic fixtures, not inferred from artificial antique-payload tests. No authorised deferrals remain.

## Testing expectations

- Regression: legacy array, null, object and absent submissions through restoration, both persistence serialisers and ordinary class save. No read-time marker or `E` replacement leaks into storage.
- Both read paths: complete legacy results preserved; one corrupt item beside healthy items; malformed item map produces task-level `E`; timestamps, source previews, partial redaction, missing-task handling, no-submission handling, and no input mutation. No roster-based fake submissions are added.
- Module deletion updates `tests/setupGlobals.js` and `scripts/builder/src/steps/backend-copy.spec.ts`; assert the new preparation module sorts before the restoration facade. Include full-definition and partial-definition class records to pin validation mode.
- Rework/absorb the `tests/assignment/assignmentRehydration.legacy*.test.js` projector suites into preparation-module coverage. Retain persistence/read separation, identity rejection and no-input-mutation checks; replace blanket-placeholder expectations rather than deleting the useful coverage.
- Frontend: required `1 | 'legacy'` version; valid numeric/N and explicit E entries accepted; full/partial corruption isolation; marker-1 and root-rejection regressions preserved.
- Analysis: mixed current/legacy data contributes the same scores to heatmaps and weighted student/class/assignment averages; E follows existing rules, not zero coercion.
- UI: tag visible only for legacy; ordinary preview and rerun still work; successful rerun removes tag, failed rerun preserves it; narrow-screen placement.
- Playwright: update `src/frontend/e2e-tests/helpers/assessment-error-preview-fixtures.ts`, its `assessment-error-preview-journeys.ts` exports, and the legacy case in `assessment-error-previews.spec.ts`. Derive linked `'legacy'` full/class responses by cloning committed canonical JSON and changing only the selected assignment's marker in both views; retain real scores/content. Assert real legacy scores and previews, corrupt-task E, current siblings unaffected and the task-heatmap tag. The old expectation of blanket legacy E plus a reassessment preview alert is removed. Keep `TaskPreviewCard` support for previously stored explicit `REASSESSMENT_REQUIRED` errors. Add rerun success/failure and narrow-screen tag checks in a dedicated legacy spec rather than growing near-limit E2E files.
- Fixtures: select canonical `small` full/class views for healthy cross-layer tests and `medium` for mixed healthy/E. The current corpus generates only version 1. Node-side tests use a test-only legacy scenario derivation in `scripts/synthetic-test-data/` that clones linked canonical inputs and removes the stored marker or sets the read marker as appropriate. Frontend Vitest/Playwright instead clone canonical JSON through their existing typed fixture helpers and change only markers, retaining real scores/content. This explicit marker-only derivation is not a competing realistic dataset. Do not import script-owned JavaScript into frontend projects or change their `allowJs`, aliases or root directories. Invalid maps/nulls/boundaries stay local. Only migrate existing tests touched by this feature.

## Documentation and rollout

Planned target contracts are recorded under `docs/developer/data-shapes/` as **Not implemented**, separately from descriptions of current behaviour. Reconcile those entries as implementation lands. Shape docs: `assignment.md`, `assessment.md`, `abclass.md`, `student-submission.md`, `frontend-data-analysis-response.md` (score inclusion; no new card field), and `INDEX.md`.

Rewrite affected sections of `backend/rehydration.md`, `backend/api-layer.md`, `backend/AssessmentFlow.md` and the shape docs; tidy touched code comments. The API envelope is unchanged, so `transport-envelope.md` does not need a contract edit. Do not edit unrelated documentation or security terminology merely to remove a word.

Also update `frontend/navigation-consistency-status.md` for PageNavCard's optional wrapping prop and task-heatmap actions. Reconcile the planned wrapping entry in `frontend/frontend-shared-helpers-and-abstraction-standards.md`.

Update the legacy browser-journey inventories in `frontend/frontend-testing.md` (“Playwright owns the browser journeys”) and `frontend/frontend-playwright-e2e.md` (“Assessment-error preview journeys”) for the new legacy spec and retained-score fixtures. These are targeted behaviour/inventory updates, not a broader prose cleanup; `backend-testing.md` remains untouched.

Backend and frontend ship together because the read marker changes. No data migration, reset, deployment or production write is part of planning.
