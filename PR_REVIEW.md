# Pre-PR Review - fix/301-stale-assignment-definitions

- **Base branch:** main
- **Generated:** 2026-09-19T14:59:37+00:00
- **Regression gate:** PASS (0 new failures; the checker reported 46 existing frontend `max-lines` warnings, which were excluded from the review gate at the user's direction)
- **Changed files:** 73 (11840 insertions, 2491 deletions)

## Verdict

**Fail** - multiple focuses identified unresolved Critical defects in recovery correctness, API shape handling, error classification, security-sensitive logging, and modal cancellation behaviour.

## Focus areas

### Repo rule compliance

#### Critical

- **Production hook parameters are silently defaulted.** `src/frontend/src/features/classes/AssessTaskModal/useAssessTaskFlow.ts:53-54` declares the hook parameters optional and silently substitutes `open = false` and `classId = ''`, although `AssessTaskModal.tsx:82` already passes both required values. This violates the fail-fast/no-default rules and masks invalid callers.
- **A production return property exists only to satisfy a test.** `src/frontend/src/features/classes/AssessTaskModal/useAssessTaskFlow.ts:495` returns `transitionToStaleRecovery`, but the production component does not consume it; the only external consumer is `src/frontend/src/features/classes/AssessTaskModal/AssessTaskModal.staleRecovery.spec.tsx:187`. Remove the dead public hook surface and test the behaviour through the public assessment-start path.
- **Mutation error logs include the complete request and nested stack.** `src/frontend/src/features/assignmentWizard/assignmentWizardMutation.ts:62-70` sends the complete request payload and `error.stack` to `logFrontendError`, bypassing the production stack policy and potentially exposing document identifiers, metadata, and weighting data. Use an allow-listed diagnostic subset and the logger's dedicated stack field, or omit the stack.

#### Improvement

- **Planning and layout documents still describe removed or completed work as pending.** `SPEC.md:5,120-129` and `STALE_RECOVERY_LAYOUT.md:180-181` contradict the implemented architecture and current modal-pattern documentation at `docs/developer/frontend/frontend-modal-patterns.md:147-151`. Reconcile status, handoff, and assumptions with the delivered design.
- **Changed frontend tests copy a canonical fixture instead of consuming it.** The same `definition-0-slides` literal is copied into `assignmentWizardFormState.spec.ts:17-42`, `AssignmentDefinitionWizardReviewContent.spec.tsx:16-41`, and `AssignmentDefinitionWizardModalShell.spec.tsx:105-130`, despite the canonical fixture and raw-import pattern already existing. Load the committed fixture and retain only deliberately local invalid/boundary data.

#### Nitpick

- **Completed tests retain red-phase claims.** `tests/y_controllers/AssignmentDefinitionTaskEquivalence.test.js:3-5`, `tests/controllers/assignmentDefinitionController.upsert.recovery.test.js:27-30`, `tests/synthetic-analysis/syntheticEditableDefinitionsView.test.ts:21-24,76-78`, and recovery specs still describe absent implementation. Replace the historical prose with behaviour-oriented descriptions.
- **American spelling appears in changed frontend documentation.** `src/frontend/src/features/assignmentWizard/assignmentWizardFormState.ts:48-53` uses `canceling`; use `cancelling`.
- **A changed test statement is needlessly compressed onto one line.** `src/frontend/src/features/assignmentWizard/AssignmentDefinitionWizardModalShell.spec.tsx:33` combines the test callback opening and declaration on one line.

#### Incidental (triage)

- Tracked worktree changes exist in `.opencode/agents/code-reviewer.md` and `opencode.jsonc`, plus generated `src/frontend/.opencode/` artefacts. These are outside `main...HEAD` and must not be included accidentally.

### KISS & DRY

#### Critical

- **Do not default the required assessment-flow context.** `src/frontend/src/features/classes/AssessTaskModal/useAssessTaskFlow.ts:53-54` silently substitutes `open = false` and `classId = ''`; keep `AssessTaskFlowParameters` required and pass explicit test parameters.

#### Improvement

- **Use the committed canonical definition fixture instead of copying it.** The same literal is duplicated at `assignmentWizardFormState.spec.ts:17-42`, `AssignmentDefinitionWizardReviewContent.spec.tsx:16-41`, and `AssignmentDefinitionWizardModalShell.spec.tsx:105-130`, creating multiple sources of truth.
- **Extract the repeated wizard discard-confirmation component.** The same modal structure is repeated at `AssignmentDefinitionWizardModal.tsx:154-165`, `AssessTaskCreateReview.tsx:157-176`, and `AssessTaskRecoverySurface.tsx:109-128`, including accessibility wiring. Extract a narrow feature-local component.

#### Nitpick

- **Remove stale red-phase comments from completed tests.** `AssessTaskModal.recovery.spec.tsx:4-9` and `AssessTaskModal.staleRecovery.spec.tsx:164-180` describe implementation that now exists.
- **Hoist the duplicated parse-failure copy into one local constant.** `AssignmentDefinitionRecoveryRules.js:100-105` and `:119-124` construct the same message separately.

### De-Sloppification

#### Critical

- **`transitionToStaleRecovery` is returned from `useAssessTaskFlow` with no production caller.** `src/frontend/src/features/classes/AssessTaskModal/useAssessTaskFlow.ts:495` is consumed externally only by `AssessTaskModal.staleRecovery.spec.tsx:187`, violating the rule against production code added purely for tests. Remove the returned property and drive the routing test through the real stale-rejection path.

#### Improvement

- **Duplicated parse/reconcile block in `_resolveTaskState`.** `src/backend/y_controllers/AssignmentDefinition/AssignmentDefinitionUpsertOrchestrator.js:276-298` and `:300-330` clone the parse/reconcile tail. Extract a private parse-and-reconcile helper and let each branch supply only its timestamps.
- **`validateRecoveryFieldShapes_` runs twice per wizard-shaped upsert.** `src/backend/z_Api/assignmentDefinition/assignmentDefinitionUpsertValidation.js:59` and `:129` validate the same fields. Remove the duplicate call or move direct-test assertions to the transport entry.
- **Generic fallback message is triplicated.** `AssessTaskRecoverySurface.tsx:24`, `useAssessTaskRecoveryFlow.ts:38`, and `map-error-to-ui.ts:158` contain the same fallback copy. Reuse one canonical source.
- **Modal-open state-reset skeleton is duplicated.** `useAssessTaskFlow.ts:253-269` and `:270-287` repeat the same ten state setters. Hoist a local reset helper.
- **Nested discard-confirmation dialog is duplicated.** `AssessTaskCreateReview.tsx:22,59-61,157-177` and `AssessTaskRecoverySurface.tsx:30,84-86,109-128` duplicate modal props and accessibility wiring. Extract a feature-local component.
- **JSDoc blocks document parameters that do not exist.** `AssessTaskRecoverySurface.tsx:165-172` and `:192-200` document `onTopicAddNew` and `onYearGroupAddNew` for functions that accept only `recovery`. Rewrite the blocks to match the signatures.
- **Primary-action label default is resolved in two places with different logic.** `AssignmentDefinitionWizardModalShell.tsx:109-110` derives from `mode`, while `AssignmentDefinitionWizardReviewContent.tsx:113-114` derives from `hasParsedTasks`. Keep one source of truth.
- **`assignmentWeighting` default coercion is repeated across three modules.** `assessTaskRecoveryData.ts:36-39`, `assignmentWizardFormState.ts:109-112,259-262`, and `useAssignmentDefinitionWizard.ts:337,365` repeat the same rule. Reuse one helper for the active callers.
- **`hasParsedTasks !== undefined` is a speculative alert gate.** `AssignmentDefinitionWizardReviewContent.tsx:81-82` has an unreachable omitted-prop branch because all production callers pass a boolean. Make the intended alert contract explicit.
- **One-caller micro-extractions only rename code.** `AssessTaskModal.tsx:27-32` and `assignmentWizardOrchestrator.ts:12-22` each extract trivial logic used once. Inline them while retaining the explanatory comments.

#### Nitpick

- **Two full-definition predicates are expressed differently.** `scripts/synthetic-test-data/toTransportViews.js:100-106` and `:211-215` answer the same conceptual question with different checks. Reuse `isFullDefinition` or document the intentional difference.
- **`deriveReferenceDataState` returns an unused field.** `assignmentWizardFormState.ts:478-491` returns `hasTrustworthyReferenceData`, but its only caller does not use it.

#### Incidental (triage)

- `useAssignmentDefinitionWizard.ts:433-435` contains a pre-existing catch-and-rethrow no-op.
- `useAssignmentDefinitionWizard.ts:439-445` contains pre-existing placeholder no-op callbacks that are part of the current API surface.

### Performance (Big-O)

No material algorithmic performance defect was identified in the changed production algorithms. The changed weighting reconciliation is linear in task count, artefact comparison is linear in compared content, and synthetic transport projections use keyed lookup maps and linear projections.

### Logging rules compliance

#### Critical

- **The shared mutation error logger emits the complete request payload.** `assignmentWizardMutation.ts:62-70` passes `context.requestPayload` into every error log; the shared runner is used by recovery at `useAssessTaskRecoveryFlow.ts:184-191,328-335`. Replace it with a small allow-listed diagnostic object.
- **The shared mutation error logger bypasses production stack suppression.** `assignmentWizardMutation.ts:68-70` places `error.stack` inside `metadata.stack`, while `frontendLogger.ts:162-168` suppresses only top-level `payload.stack`. Pass stack information through the dedicated field or omit it.
- **Recovery action handlers discard rejected promises.** `AssessTaskRecoverySurface.tsx:179-182,226-229,260-270` invokes `void recovery.startUpdate()` and `void recovery.save()` while `useAssessTaskRecoveryFlow.ts:183-226,323-347` leaves local/reparse/form-validation failures without a handling boundary. Handle and map these failures before intentionally settling the promise.

#### Improvement

- **An impossible recovery invariant is converted to generic UI copy without a diagnostic.** `useAssessTaskRecoveryFlow.ts:294-298` treats missing `capturedStartContext` as unexpected but only settles generic copy. Log a structured developer diagnostic before displaying the safe message.

#### Incidental (triage)

- Existing assessment flows render raw exception messages at `useAssessTaskFlow.ts:283-284,420-427` and `useAssessTaskLinkFlow.ts:158-167`; these existed on `main` but remain policy violations.
- `assignmentDefinitionService.ts:42-54,77-89` uses direct Zod parsing instead of the shared diagnostic helper; this predates the branch but is consumed by recovery.
- `apiService.ts:30-39` and `apiTransportError.ts:1-9,25-32` discard the documented stale `error.details` block emitted by `z_apiHandler.js:430-439,469-476`.

### Frontend layout / design / accessibility

#### Critical

- **The owning modal bypasses dirty-discard handling for in-modal create.** `AssessTaskModal.tsx:112-119,391-397` routes close button, Escape, and mask dismissal directly to `onClose`, bypassing the dirty guard in `useAssignmentDefinitionWizard.ts:401-414`. Add owning-modal coverage and route dismissal through the active create wizard's close semantics.

#### Improvement

- **Assignment-selection loading status does not expose busy semantics.** `AssignmentSelectSkeleton.tsx:19-24` renders an `<output>` without `aria-busy="true"`, despite the loading standard requiring it.
- **The new recovery skeleton is not reduced-motion safe.** `RecoveryReviewSkeleton.tsx:20-22` enables active animation without a scoped `prefers-reduced-motion` treatment.
- **New TSX spacing bypasses canonical spacing constants.** `AssignmentDefinitionWizardReviewContent.tsx:155,159,229,386` and `AssessTaskRecoverySurface.tsx:256-258` use raw spacing literals; action rows at `:177,206,224` use implicit `Space` sizing. Use the shared spacing constants.

#### Nitpick

- Recovery helper JSDoc at `AssessTaskRecoverySurface.tsx:165-172,192-199` documents parameters that do not exist.
- Completed recovery specs retain red-phase descriptions at `AssessTaskModal.recovery.spec.tsx:4-9` and `AssessTaskModal.inModalCreate.spec.tsx:11-14`.
- The E2E title at `classes-page-assess-task.spec.ts:491` says “outer Cancel” although the test clicks the review-content Cancel at `:514`.

#### Incidental (triage)

- Review tooling observed existing frontend `max-lines` warnings and incomplete full-suite runs; these are gate/verification concerns rather than layout findings.

### Frontend data shape / schema consistency

#### Critical

- **Full-definition read nullability is inconsistent across the API boundary.** The contract and backend allow `null` at `assignment-definition.md:154-172` and `assignmentDefinitionTransport.js:209-215`, but `assignmentDefinition.zod.ts:58-80` and `assignmentDefinitionService.ts:37-54` require a non-null definition, while `useAssessTaskRecoveryFlow.ts:149-169,216-226` expects `null`. Align the schema, service type, and loaded gating.
- **Link-flow stale recovery does not return to selection state.** `useAssessTaskLinkFlow.ts:124-139` enters recovery without resetting `noMatchResolution`; `useAssessTaskFlow.ts:152-163` does not clear it, and cancel at `useAssessTaskRecoveryFlow.ts:243-252` therefore leaves the modal in the link picker (`AssessTaskModal.tsx:269-302,347-370`). Clear the link state or introduce an explicit post-recovery state and add a regression test.
- **Full automated verification is not clean.** The reviewer reported existing lint warnings and incomplete frontend coverage/E2E runs. Establish a completed reproducible run before sign-off, with genuine failures resolved or confirmed as pre-existing flakes.

#### Improvement

- **Nullable approval timestamps silently disable stale protection.** `assessTaskRecoveryData.ts:41-58` omits `expectedDefinitionUpdatedAt` when `updatedAt` is null, reverting to ordinary upsert semantics despite the baseline contract at `assignment-definition.md:250-253,307-312`. Require a non-null baseline or fail closed and test the chosen policy.

#### Nitpick

- Recovery test comments at `AssessTaskModal.recovery.spec.tsx:1-18` still describe an unimplemented red phase.
- `useAssessTaskLinkFlow.ts:175-177` spells “encounters” as `encounteres`.

#### Incidental (triage)

- The canonical assignment-definition document has pre-existing contradictions around nullable `yearGroupLabel` and partial task weighting at `assignment-definition.md:35-51,69-87,385-412` versus the frontend schemas.
- `assignmentWizardMutation.ts:57-71` logs the complete mutation payload, and `assignmentDefinitionService.ts:44-54,79-89` logs complete response/request data; both predate the recovery additions but violate current logging policy.

### Backend data shape / schema consistency

#### Critical

- **Mixed raw-JSON and model-instance artefacts are never equivalent.** `AssignmentDefinitionTaskEquivalence.js:142-153,216-224` compares own keys without serialising instances, while persistence returns raw JSON (`AssignmentDefinitionPersistence.js:241-247`) and parsing returns model instances (`AssignmentDefinitionTaskParser.js:74-75,93-94`). Persisted `type` and runtime `_rows` differences make unchanged artefact-bearing tasks appear changed and can reset stored weightings. Compare canonical serialised fields and add a mixed-representation regression test.
- **Recovery precondition failures are mapped to `INTERNAL_ERROR`.** `AssignmentDefinitionRecoveryRules.js:23-32` throws plain `Error` objects, while `z_apiHandler.js:451-466` maps unknown errors to `INTERNAL_ERROR`; documented request violations should return `INVALID_REQUEST`. Throw/map `ApiValidationError` and assert the API envelope.

#### Improvement

- **`expectedDefinitionUpdatedAt: null` violates the documented request shape.** `assignmentDefinitionUpsertValidation.js:35-45` permits null and `AssignmentDefinitionRecoveryRules.js:48-54` treats it as omitted, while the docs and frontend schema require an optional ISO string. Reject explicit null or revise all boundaries together.
- **Changed comparator tests do not cover the production shape boundary.** `AssignmentDefinitionTaskEquivalence.test.js:27-29` uses only plain JSON, while production compares raw persistence data with rehydrated model instances. Add an artefact-bearing integration case.

#### Incidental (triage)

- Strict partial-row validation is defined at `assignmentDefinitionPartialRowValidation.js:226-237` but not wired into `assignmentDefinitionTransport.js:120-128`, contrary to `assignment-definition.md:504-505`.
- The year-group label contract contradicts its frontend type: docs at `assignment-definition.md:41,75` say nullable while validators and schemas require a non-null string.

#### Nitpick

- Changed tests retain obsolete red-phase comments at `AssignmentDefinitionTaskEquivalence.test.js:3-6`, `assignmentDefinitionController.upsert.recovery.test.js:27-30`, and `syntheticEditableDefinitionsView.test.ts:21-24`.

### Security & secrets

#### Critical

- **The assignment wizard logs the complete request payload on production error paths.** `assignmentWizardMutation.ts:62-70` passes the complete `UpsertAssignmentDefinitionRequest`, including document identifiers, assignment metadata, task weightings, and the concurrency baseline, to production-enabled error logging. Remove it or replace it with an allow-listed diagnostic subset and add a regression assertion.

#### Improvement

- **Document IDs are not checked for transport-safe characters before Drive access.** `assignmentDefinitionUpsertValidation.js:94-100` checks only strings, while URL extraction at `assignmentDefinitionTransport.js:60-76` can produce `..`; the existing safe-identifier helper at `assignmentDefinitionValidation.js:79-109` should be applied to raw and extracted IDs.

#### Incidental (triage)

- The changed transport remains behind the existing `apiHandler` allowlist and authentication gate; no new credentials, `eval`, `innerHTML`, or CDN runtime asset was found.
- The existing logger does not redact `apiKey`, which is documented as a development-only exposure, but the new full-payload logging increases the importance of payload minimisation.

### Test-coverage gaps

#### Improvement

- **Backend weighting reconciliation lacks changed/removed/zero integration coverage.** `AssignmentDefinitionRecoveryRules.js:132-160` and `AssignmentDefinitionUpsertOrchestrator.js:283-295,317-327` implement equivalent/non-equivalent/new/removed/zero semantics, but tests cover only limited matching/new cases. Add controller-level matrices for forced and timestamp-triggered paths.
- **Recovery generation guards are not tested against cancelled in-flight work.** `useAssessTaskRecoveryFlow.ts:157-169,179-209,216-250` relies on generation checks, but current tests cancel only after prompt or settled parse-failure states. Add deferred load/reparse tests that cancel first and resolve/reject later.
- **Obsolete assessment-start rejection paths are untested.** `useAssessTaskFlow.ts:342-360` and extracted link/create flows intentionally ignore obsolete failures, but tests cover only successful obsolete completion. Add rejection variants for close/reopen and selection-change races.
- **New backend recovery diagnostics have no logger-output assertions.** `AssignmentDefinitionRecoveryRules.js:48-65,84-125` adds warning/error logs, but recovery tests assert codes and write suppression only. Add logger-seam assertions for safe context and original parser errors.

### Error-handling robustness

#### Critical

- **Parser failures are classified as parse failures regardless of their cause.** `AssignmentDefinitionRecoveryRules.js:87-107` wraps every parser exception as `DEFINITION_PARSE_FAILED`, including external authorisation or service failures from `AssignmentDefinitionTaskParser.js:31-39,51-95`. Preserve original rate-limit, authorisation, and persistence classifications.
- **Cancelling stale recovery while the definition load is pending still starts a reparse.** `useAssessTaskRecoveryFlow.ts:157-163,216-226` checks generation only on the load error path; cancellation at `:235-240` can be followed by a late successful load that invokes the mutation. Check generation before reparsing.
- **Cancelling the review during approval can still start the assessment.** `useAssessTaskRecoveryFlow.ts:294-315,323-347` resumes assessment after save without a generation/cancellation check, while `:249-265` allows cancellation during the pending operation. Check generation around save and resume or disable dismissal until settled.

#### Improvement

- **The backend accepts any string as `expectedDefinitionUpdatedAt`.** `assignmentDefinitionUpsertValidation.js:35-45` checks only `typeof value === 'string'`, despite the ISO contract and existing strict validator. Apply strict timestamp validation.
- **Assessment and link flows still render raw exception messages.** `useAssessTaskFlow.ts:283-285,420-427` and `useAssessTaskLinkFlow.ts:155-167` expose raw messages instead of using `mapErrorToUserMessage`.
- **Recovery form validation can produce an unhandled rejection.** `useAssessTaskRecoveryFlow.ts:323-327` awaits intentionally rejecting `validateFields()`, while `AssessTaskRecoverySurface.tsx:267-270` invokes `recovery.save()` with `void` and no rejection handler. Handle expected validation rejection deliberately.

### Data-shape docs consistency

#### Critical

- **Reparse equivalence fails at the persisted JSON/model-instance boundary.** `AssignmentDefinitionTaskEquivalence.js:133-153,176-224` does not serialise model instances, while persistence returns raw JSON and parsing returns model instances. The mismatch can silently reset weightings, contrary to `assignment-definition.md:292-299`.
- **Invalid forced-reparse requests return `INTERNAL_ERROR`, not `INVALID_REQUEST`.** `AssignmentDefinitionRecoveryRules.js:23-32` throws plain errors for documented request-contract violations, and `z_apiHandler.js:451-466` maps them to `INTERNAL_ERROR`.
- **Parser exceptions are over-classified as permanent parse failures.** `AssignmentDefinitionRecoveryRules.js:87-107` catches external service failures and maps them to `DEFINITION_PARSE_FAILED`, contrary to `transport-envelope.md:84-99` and `assignment-definition.md:331-340`.
- **Invalid tasks are not guaranteed to block persistence as documented.** `AssignmentDefinitionTaskParser.js:57-67` skips invalid tasks, while `AssignmentDefinitionRecoveryRules.js:110-126` rejects only an empty result; mixed valid/invalid input can persist a partial definition despite the all-or-nothing contract at `assignment-definition.md:331-340`.
- **Link-flow alternate metadata can violate the canonical trimmed-string contract.** `assessTaskLinkPayload.ts:11-18,29-39` appends raw title/topic values, while `assignment-definition.md:248-249` requires trimmed non-empty strings and `assignmentDefinition.zod.ts:136-137` validates that contract.

#### Improvement

- **Backend freshness validation is weaker than the documented and frontend shape.** `assignmentDefinitionUpsertValidation.js:35-45` accepts arbitrary strings and null for `expectedDefinitionUpdatedAt`, while the docs and frontend schema require strict ISO strings.
- **The frontend drops the documented `error.details` block.** `apiService.ts:30-39` and `apiTransportError.ts:1-9,25-32` omit details that the backend emits at `z_apiHandler.js:430-439,469-476` and the contract documents.
- **The canonical contract is internally inconsistent for year-group labels.** `assignment-definition.md:41,75` says nullable while schemas and validators require non-null strings.
- **Recovery weighting default is duplicated outside the owning model.** `assessTaskRecoveryData.ts:36-39` substitutes `DEFAULT_WEIGHTING_VALUE` although model/domain defaulting is owned by `AssignmentDefinition.js:88-100`.
- **Task-equivalence rules are not fully captured in the canonical data-shape document.** `AssignmentDefinitionTaskEquivalence.js:4-20` defines material comparison semantics, while `assignment-definition.md:289-300,314-323` documents only high-level weighting results.

#### Incidental (triage)

- The documented create-key algorithm at `assignment-definition.md:271-273` disagrees with the UUID supplied by `AssignmentDefinitionUpsertOrchestrator.js:137,391-400`.
- Partial-row validation is documented as active but not wired into transport at `assignmentDefinitionTransport.js:120-128`.
- Completed tests retain obsolete RED-phase claims at `AssignmentDefinitionTaskEquivalence.test.js:3-5`, `assignmentDefinitionController.upsert.recovery.test.js:27-30`, and `syntheticEditableDefinitionsView.test.ts:21-24`.

## Decisions

### Repo rule compliance

- **[Critical] `src/frontend/src/features/classes/AssessTaskModal/useAssessTaskFlow.ts:53-54`** - Decision: Fix now. Approach: remove the silent `open` and `classId` defaults, keep the hook contract required, and update tests to pass explicit valid parameters. Rationale: invalid callers must fail fast rather than run with an empty class identity.
- **[Critical] `src/frontend/src/features/classes/AssessTaskModal/useAssessTaskFlow.ts:495`** - Decision: Fix now. Approach: remove the test-only `transitionToStaleRecovery` return property and exercise the public stale-rejection path. Rationale: production code must not exist solely to support a test.
- **[Critical] `src/frontend/src/features/assignmentWizard/assignmentWizardMutation.ts:62-70`** - Decision: Fix now. Approach: remove the full request payload from metadata, use an allow-listed diagnostic subset, and pass the stack through the logger's dedicated stack field so production suppression applies. Rationale: production logs must not expose complete assignment requests or bypass stack policy.
- **[Improvement] `SPEC.md:5,120-129` and `STALE_RECOVERY_LAYOUT.md:180-181`** - Decision: Wontfix. Rationale: the user confirmed these planning/layout documents will be deleted on merge, so reconciling temporary documents is unnecessary.
- **[Improvement] `src/frontend/src/features/assignmentWizard/assignmentWizardFormState.spec.ts:17-42`** - Decision: Fix now. Approach: load the committed canonical fixture through the established raw-import/shared-helper pattern. Rationale: copied fixtures create avoidable drift points.
- **[Nitpick] `tests/y_controllers/AssignmentDefinitionTaskEquivalence.test.js:3-5`** - Decision: Fix now. Approach: replace RED-phase prose with current behaviour descriptions. Rationale: completed tests should describe the implementation they exercise.
- **[Nitpick] `src/frontend/src/features/assignmentWizard/assignmentWizardFormState.ts:48-53`** - Decision: Fix now. Approach: change `canceling` to British-English `cancelling`. Rationale: repository language rules require British English.
- **[Nitpick] `src/frontend/src/features/assignmentWizard/AssignmentDefinitionWizardModalShell.spec.tsx:33`** - Decision: Fix now. Approach: restore the normal line break. Rationale: improve readability and formatter consistency.
- **[Incidental] Worktree-only changes in `.opencode/agents/code-reviewer.md`, `opencode.jsonc`, and `src/frontend/.opencode/`** - Decision: Exclude from PR. Rationale: the user changed their decision and asked that these incidental files not be committed; they remain untouched.

### KISS & DRY

- **[Critical] `src/frontend/src/features/classes/AssessTaskModal/useAssessTaskFlow.ts:53-54`** - Decision: Fix now. Approach: remove fallback defaults and retain the required hook contract. Rationale: this duplicates the repo-rule finding and confirms the same fail-fast remediation.
- **[Improvement] `src/frontend/src/features/assignmentWizard/assignmentWizardFormState.spec.ts:17-42`** - Decision: Fix now. Approach: reuse the canonical fixture and shared task-row projection. Rationale: reduce multiple sources of test truth.
- **[Improvement] `src/frontend/src/features/assignmentWizard/AssignmentDefinitionWizardModal.tsx:154-165`** - Decision: Fix now. Approach: extract a narrow feature-local discard-confirmation component shared by create, recovery, and wizard surfaces. Rationale: three live copies can drift in copy and accessibility behaviour.
- **[Nitpick] `src/frontend/src/features/classes/AssessTaskModal/AssessTaskModal.recovery.spec.tsx:4-9`** - Decision: Fix now. Approach: replace stale red-phase comments with behaviour-oriented descriptions. Rationale: the implementation is now present.
- **[Nitpick] `src/backend/y_controllers/AssignmentDefinition/AssignmentDefinitionRecoveryRules.js:100-105`** - Decision: Fix now. Approach: hoist the repeated parse-failure message into one module-local constant. Rationale: keep identical user copy synchronised.

### De-Sloppification

- **[Critical] `src/frontend/src/features/classes/AssessTaskModal/useAssessTaskFlow.ts:495`** - Decision: Fix now. Approach: remove the test-only return property and update the test to drive the real stale-rejection path. Rationale: avoid dead public API surface.
- **[Improvement] `src/backend/y_controllers/AssignmentDefinition/AssignmentDefinitionUpsertOrchestrator.js:276-298,300-330`** - Decision: Fix now. Approach: extract a private parse-and-reconcile helper while keeping branch-specific timestamps outside it. Rationale: prevent future semantic changes being applied to only one cloned branch.
- **[Improvement] `src/backend/z_Api/assignmentDefinition/assignmentDefinitionUpsertValidation.js:59,129`** - Decision: Fix now. Approach: validate recovery field shapes once at the transport entry and adjust direct-test coverage as needed. Rationale: remove duplicate validation and drift risk.
- **[Improvement] `src/frontend/src/features/classes/AssessTaskModal/AssessTaskRecoverySurface.tsx:24`** - Decision: Fix now. Approach: reuse one canonical generic error-copy source. Rationale: prevent fallback-copy drift.
- **[Improvement] `src/frontend/src/features/classes/AssessTaskModal/useAssessTaskFlow.ts:253-269,270-287`** - Decision: Fix now. Approach: use one local reset helper for both fetch branches. Rationale: keep the flow state reset complete and synchronised.
- **[Improvement] `src/frontend/src/features/classes/AssessTaskModal/AssessTaskCreateReview.tsx:22,59-61,157-177`** - Decision: Fix now. Approach: share the feature-local discard-confirmation modal and accessibility wiring with recovery. Rationale: reduce live duplication.
- **[Improvement] `src/frontend/src/features/classes/AssessTaskModal/AssessTaskRecoverySurface.tsx:165-172,192-200`** - Decision: Fix now. Approach: rewrite JSDoc to match the actual parameters and return values. Rationale: remove misleading copied documentation.
- **[Improvement] `src/frontend/src/features/assignmentWizard/AssignmentDefinitionWizardModalShell.tsx:109-110`** - Decision: Fix now. Approach: keep primary-action label derivation in one canonical location. Rationale: prevent mode and parsed-state defaults diverging.
- **[Improvement] `src/frontend/src/features/classes/AssessTaskModal/assessTaskRecoveryData.ts:36-39`** - Decision: Fix now. Approach: centralise weighting coercion for active callers while preserving the intended UI/domain boundary. Rationale: remove repeated defaulting logic.
- **[Improvement] `src/frontend/src/features/assignmentWizard/AssignmentDefinitionWizardReviewContent.tsx:81-82`** - Decision: Fix now. Approach: replace the optional-prop sentinel with an explicit alert-visibility contract. Rationale: remove speculative unreachable semantics.
- **[Improvement] `src/frontend/src/features/classes/AssessTaskModal/AssessTaskModal.tsx:27-32`** - Decision: Fix now. Approach: inline the one-caller helper while retaining its explanatory comment. Rationale: remove indirection that provides no reuse.
- **[Nitpick] `scripts/synthetic-test-data/toTransportViews.js:100-106,211-215`** - Decision: Fix now. Approach: reuse `isFullDefinition` or document the deliberate predicate difference. Rationale: avoid two meanings for the same conceptual check.
- **[Nitpick] `src/frontend/src/features/assignmentWizard/assignmentWizardFormState.ts:478-491`** - Decision: Fix now. Approach: drop the unused `hasTrustworthyReferenceData` return field. Rationale: remove unused API surface.
- **[Incidental] `src/frontend/src/features/assignmentWizard/useAssignmentDefinitionWizard.ts:433-435`** - Decision: Fix now. Approach: remove the pre-existing no-op catch and let the promise reject naturally. Rationale: the catch adds no handling.
- **[Incidental] `src/frontend/src/features/assignmentWizard/useAssignmentDefinitionWizard.ts:439-445`** - Decision: Fix now. Approach: give the callbacks modal responsibility or remove the do-nothing seam. Rationale: eliminate a misleading no-op API boundary.

### Performance (Big-O)

- No remediation decision is required. The focus found no material Big-O defect in changed production algorithms; the user accepted the performance assessment as clean.

### Logging rules compliance

- **[Critical] `src/frontend/src/features/assignmentWizard/assignmentWizardMutation.ts:62-70`** - Decision: Fix now. Approach: replace full request metadata with a small allow-listed diagnostic object. Rationale: confirms the security/logging payload decision.
- **[Critical] `src/frontend/src/features/assignmentWizard/assignmentWizardMutation.ts:68-70`** - Decision: Fix now. Approach: use the logger's dedicated stack field so production suppression applies. Rationale: nested metadata currently bypasses the logger policy.
- **[Critical] `src/frontend/src/features/classes/AssessTaskModal/AssessTaskRecoverySurface.tsx:179-182,226-229,260-270`** - Decision: Fix now. Approach: handle and map failures inside public recovery actions before intentionally settling promises. Rationale: prevent unhandled rejections and stuck recovery UI.
- **[Improvement] `src/frontend/src/features/classes/AssessTaskModal/useAssessTaskRecoveryFlow.ts:294-298`** - Decision: Fix now. Approach: log a safe structured diagnostic before showing generic copy. Rationale: preserve developer visibility for an internal invariant failure.
- **[Incidental] `src/frontend/src/features/classes/AssessTaskModal/useAssessTaskFlow.ts:283-284,420-427`** - Decision: Fix now. Approach: route existing raw exception paths through `mapErrorToUserMessage`. Rationale: existing behaviour still violates the user-facing error policy.
- **[Incidental] `src/frontend/src/services/assignmentDefinition/assignmentDefinitionService.ts:42-54,77-89`** - Decision: Fix now. Approach: use `parseApiResponse` with bounded diagnostics for service validation. Rationale: standardise service-boundary logging.
- **[Incidental] `src/frontend/src/services/apiService.ts:30-39`** - Decision: Fix now. Approach: preserve and type the documented `error.details` block through `ApiTransportError`. Rationale: consumers should receive the documented structured diagnostics.

### Frontend layout / design / accessibility

- **[Critical] `src/frontend/src/features/classes/AssessTaskModal/AssessTaskModal.tsx:112-119,391-397`** - Decision: Fix now. Approach: route owning-modal dismissal through the active wizard close semantics and add browser coverage for close, Escape, and mask interactions. Rationale: dirty edits must not be lost without confirmation.
- **[Improvement] `src/frontend/src/features/classes/AssessTaskModal/AssignmentSelectSkeleton.tsx:19-24`** - Decision: Fix now. Approach: add `aria-busy="true"` while retaining the implicit status output. Rationale: expose loading state accessibly.
- **[Improvement] `src/frontend/src/features/classes/AssessTaskModal/RecoveryReviewSkeleton.tsx:20-22`** - Decision: Fix later. Approach: record a motion/accessibility follow-up for a scoped reduced-motion rule or non-animated variant. Rationale: existing skeletons also use Ant Design `active` directly, so the issue is deferred rather than treated as an immediate branch blocker.
- **[Improvement] `src/frontend/src/features/assignmentWizard/AssignmentDefinitionWizardReviewContent.tsx:155,159,229,386`** - Decision: Fix now. Approach: replace raw spacing and implicit `Space` sizing with canonical constants. Rationale: align the new surfaces with the 8px spacing policy.
- **[Nitpick] `src/frontend/src/features/classes/AssessTaskModal/AssessTaskRecoverySurface.tsx:165-172,192-199`** - Decision: Fix now. Approach: correct the helper JSDoc signatures. Rationale: remove inaccurate generated documentation.
- **[Nitpick] `src/frontend/src/features/classes/AssessTaskModal/AssessTaskModal.recovery.spec.tsx:4-9`** - Decision: Fix now. Approach: update the spec description to current behaviour. Rationale: remove stale RED-phase wording.
- **[Nitpick] `src/frontend/e2e-tests/classes-page-assess-task.spec.ts:491,514`** - Decision: Fix now. Approach: make the E2E title match the actual review-content interaction, or add the missing owning-modal interaction. Rationale: test names must reflect coverage.
- **[Incidental] Frontend verification warnings and incomplete full-suite reruns** - Decision: Exclude as baseline. Rationale: the user accepted the regression results and zero new failures; these observations are not treated as layout findings.

### Frontend data shape / schema consistency

- **[Critical] `src/frontend/src/services/assignmentDefinition/assignmentDefinition.zod.ts:58-80`** - Decision: Wontfix. Rationale: the user confirmed that backend nullability is intentional for definitions that are not yet created, while the frontend contract should require fields once a definition exists.
- **[Critical] `src/frontend/src/features/classes/AssessTaskModal/useAssessTaskLinkFlow.ts:124-139`** - Decision: Fix now. Approach: clear link-resolution state on recovery end or introduce an explicit post-recovery state and add a regression test. Rationale: cancelling recovery must return to the correct selection state.
- **[Critical] Frontend full-suite verification** - Decision: Accept current evidence. Rationale: the user accepted the completed regression evidence and zero new failures, excluding baseline warnings and incomplete auxiliary reruns.
- **[Improvement] `src/frontend/src/features/classes/AssessTaskModal/assessTaskRecoveryData.ts:41-58`** - Decision: Wontfix. Rationale: the user confirmed that a null `updatedAt` denotes a definition that has not been created, and the recovery path is only entered for existing definitions; the omission path must not be used to alter the established contract.
- **[Nitpick] `src/frontend/src/features/classes/AssessTaskModal/AssessTaskModal.recovery.spec.tsx:1-18`** - Decision: Fix now. Approach: update comments to describe implemented recovery behaviour.
- **[Nitpick] `src/frontend/src/features/classes/AssessTaskModal/useAssessTaskLinkFlow.ts:175-177`** - Decision: Fix now. Approach: correct `encounteres` to `encounters`.
- **[Incidental] `docs/developer/data-shapes/assignment-definition.md:35-51,69-87,385-412`** - Decision: Fix now. Approach: reconcile nullable `yearGroupLabel` and partial task-weighting documentation with the actual schemas and runtime invariants.
- **[Incidental] `src/frontend/src/features/assignmentWizard/assignmentWizardMutation.ts:57-71`** - Decision: Fix now. Approach: apply payload minimisation and shared response-validation logging policy. Rationale: recovery now consumes the shared path, so the existing policy gap is relevant.

### Backend data shape / schema consistency

- **[Critical] `src/backend/y_controllers/AssignmentDefinition/AssignmentDefinitionTaskEquivalence.js:142-153,216-224`** - Decision: Fix now. Approach: compare canonical serialised artefact fields, exclude runtime-only state, and add a mixed raw-JSON/model-instance regression test. Rationale: unchanged persisted artefacts must retain stored weightings.
- **[Critical] `src/backend/y_controllers/AssignmentDefinition/AssignmentDefinitionRecoveryRules.js:23-32`** - Decision: Fix now. Approach: throw/map `ApiValidationError` and assert `INVALID_REQUEST` at the API envelope. Rationale: malformed request combinations must not be reported as internal failures.
- **[Improvement] `src/backend/z_Api/assignmentDefinition/assignmentDefinitionUpsertValidation.js:35-45`** - Decision: Wontfix. Rationale: the user confirmed explicit null is intentionally allowed by the backend for create requests where no existing version baseline exists; the frontend requires a non-null baseline after creation.
- **[Improvement] `tests/y_controllers/AssignmentDefinitionTaskEquivalence.test.js:27-29`** - Decision: Fix now. Approach: add a test using persisted plain artefact JSON and a rehydrated model artefact. Rationale: plain-object tests do not exercise the production representation boundary.
- **[Incidental] `src/backend/z_Api/assignmentDefinitionTransport.js:120-128`** - Decision: Fix now. Approach: wire `validatePartialRow_()` into the transport boundary. Rationale: the documented strict partial-row contract should be enforced.
- **[Incidental] `docs/developer/data-shapes/assignment-definition.md:41,75`** - Decision: Fix now. Approach: align documentation with the runtime-supported non-null `yearGroupLabel` contract. Rationale: the canonical shape must not contradict schemas and validators.
- **[Nitpick] `tests/y_controllers/AssignmentDefinitionTaskEquivalence.test.js:3-6`** - Decision: Fix now. Approach: replace obsolete RED-phase comments with current contract descriptions.

### Security & secrets

- **[Critical] `src/frontend/src/features/assignmentWizard/assignmentWizardMutation.ts:62-70`** - Decision: Fix now. Approach: retain only safe fields such as action type, mode, definition key, request ID, and error code, with stack passed through the dedicated field. Rationale: production logs must not contain full requests.
- **[Improvement] `src/backend/z_Api/assignmentDefinition/assignmentDefinitionUpsertValidation.js:94-100`** - Decision: Fix now. Approach: reuse the existing safe-identifier helper once at the API boundary for raw and URL-extracted document IDs, with boundary tests. Rationale: this avoids duplicate domain validation while rejecting unsafe input before Drive access.

### Test-coverage gaps

- **[Improvement] `src/backend/y_controllers/AssignmentDefinition/AssignmentDefinitionUpsertOrchestrator.js:283-295,317-327`** - Decision: Fix now. Approach: add forced and timestamp-triggered integration cases for equivalent/non-zero, equivalent/zero, changed, new, and removed tasks. Rationale: unit comparator coverage alone does not pin reconciliation behaviour.
- **[Improvement] `src/frontend/src/features/classes/AssessTaskModal/useAssessTaskRecoveryFlow.ts:157-169,179-209,216-250`** - Decision: Fix now. Approach: add deferred load/reparse cancellation tests that resolve or reject after cancellation. Rationale: generation guards need direct race coverage.
- **[Improvement] `src/frontend/src/features/classes/AssessTaskModal/useAssessTaskFlow.ts:342-360`** - Decision: Fix now. Approach: add obsolete rejection variants for close/reopen and selection-change races across matched/link/create paths. Rationale: rejected obsolete operations must not mutate the current session.
- **[Improvement] `src/backend/y_controllers/AssignmentDefinition/AssignmentDefinitionRecoveryRules.js:48-65,84-125`** - Decision: Fix now. Approach: assert logger output at the seam, including safe context and original parser errors. Rationale: new diagnostic behaviour requires regression coverage.

### Error-handling robustness

- **[Critical] `src/backend/y_controllers/AssignmentDefinition/AssignmentDefinitionRecoveryRules.js:87-107`** - Decision: Fix now. Approach: map only recognised content failures to `DEFINITION_PARSE_FAILED` and preserve authorisation, rate-limit, and persistence classifications. Rationale: users need the correct recovery guidance.
- **[Critical] `src/frontend/src/features/classes/AssessTaskModal/useAssessTaskRecoveryFlow.ts:157-163,216-226`** - Decision: Wontfix. Rationale: the user confirmed Wontfix; the rationale supplied was that “the harm caused outweighs the hassle of implementing a fix”. This decision is retained verbatim despite the wording being counterintuitive and should be revisited before merge if the intended meaning was that the bug harm outweighs implementation cost.
- **[Critical] `src/frontend/src/features/classes/AssessTaskModal/useAssessTaskRecoveryFlow.ts:294-315,323-347`** - Decision: Fix now. Approach: check the recovery generation around save and resume, or disable dismissal until the operation settles. Rationale: cancellation must not start an assessment after approval completes.
- **[Improvement] `src/backend/z_Api/assignmentDefinition/assignmentDefinitionUpsertValidation.js:35-45`** - Decision: Fix now. Approach: apply strict ISO-with-timezone validation to provided non-null baselines while preserving intentional create-time omission/null semantics. Rationale: malformed update baselines should not reach domain logic.
- **[Improvement] `src/frontend/src/features/classes/AssessTaskModal/useAssessTaskFlow.ts:283-285,420-427`** - Decision: Fix now. Approach: use `mapErrorToUserMessage` for raw-message paths. Rationale: technical exception text must not reach production UI.
- **[Improvement] `src/frontend/src/features/classes/AssessTaskModal/useAssessTaskRecoveryFlow.ts:323-327`** - Decision: Fix now. Approach: handle expected form-validation rejection deliberately while allowing unexpected errors to surface through the normal boundary. Rationale: avoid unhandled rejected promises.

### Data-shape docs consistency

- **[Critical] `src/backend/y_controllers/AssignmentDefinition/AssignmentDefinitionTaskEquivalence.js:133-153,176-224`** - Decision: Fix now. Approach: canonicalise serialised fields, exclude runtime-only state, and add regression coverage. Rationale: aligns implementation with the weighting-preservation contract.
- **[Critical] `src/backend/y_controllers/AssignmentDefinition/AssignmentDefinitionRecoveryRules.js:23-32`** - Decision: Fix now. Approach: use `ApiValidationError` and add API envelope assertions. Rationale: documented invalid requests must return `INVALID_REQUEST`.
- **[Critical] `src/backend/y_controllers/AssignmentDefinition/AssignmentDefinitionRecoveryRules.js:87-107`** - Decision: Fix now. Approach: preserve non-content error classifications and map only recognised content errors to parse failure. Rationale: keep transport semantics correct.
- **[Critical] `src/backend/DocumentParsers` path via `AssignmentDefinitionTaskParser.js:57-67`** - Decision: Fix now. Approach: propagate invalid-task presence to the recovery boundary and block persistence, with regression coverage. Rationale: enforce the documented all-or-nothing parse contract.
- **[Critical] `src/frontend/src/features/classes/AssessTaskModal/assessTaskLinkPayload.ts:11-18,29-39`** - Decision: Fix now. Approach: trim/reject additions before constructing alternate metadata arrays and add whitespace/blank tests. Rationale: payloads must satisfy the canonical trimmed non-empty shape.
- **[Improvement] `src/backend/z_Api/assignmentDefinition/assignmentDefinitionUpsertValidation.js:35-45`** - Decision: Fix now. Approach: apply strict ISO validation while preserving the agreed create/update nullability distinction. Rationale: align the boundary with the documented shape.
- **[Improvement] `src/frontend/src/services/apiService.ts:30-39`** - Decision: Fix now. Approach: preserve and type the structured error details block. Rationale: the documented transport contract should survive frontend parsing.
- **[Improvement] `docs/developer/data-shapes/assignment-definition.md:41,75`** - Decision: Fix now. Approach: document the runtime-supported non-null year-group label contract. Rationale: remove schema/document contradiction.
- **[Improvement] `src/frontend/src/features/classes/AssessTaskModal/assessTaskRecoveryData.ts:36-39`** - Decision: Fix now. Approach: make the frontend request/defaulting boundary explicit while preserving model ownership of domain defaults. Rationale: avoid an undocumented second defaulting rule.
- **[Improvement] `src/backend/y_controllers/AssignmentDefinition/AssignmentDefinitionTaskEquivalence.js:4-20`** - Decision: Fix now. Approach: add a concise canonical equivalence section or link covering compared fields and exclusions. Rationale: weighting preservation depends on these effective shape semantics.
- **[Incidental] `docs/developer/data-shapes/assignment-definition.md:271-273`** - Decision: Fix now. Approach: align the documented create-key algorithm with the UUID implementation, or change the implementation to the documented algorithm after choosing the intended contract. Rationale: persistence identity must have one source of truth.
- **[Incidental] `src/backend/z_Api/assignmentDefinitionTransport.js:120-128`** - Decision: Fix now. Approach: wire strict partial-row validation or update the contract only if the lighter check is intentionally retained. Rationale: documented transport guarantees should be real.
- **[Incidental] `tests/y_controllers/AssignmentDefinitionTaskEquivalence.test.js:3-5`** - Decision: Fix now. Approach: update obsolete RED-phase claims in completed tests. Rationale: future failures should describe current behaviour.
