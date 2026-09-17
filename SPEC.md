# Stale Assignment Definition Recovery — Specification

## Status

Draft v1.1 — explicit wizard decomposition and orchestration boundaries added — issue [#301](https://github.com/h-arnold/AssessmentBot/issues/301). Planning only; not implemented.

## Purpose

Recover from changed reference/template documents without creating a duplicate assignment definition, losing unrelated weightings, or starting an assessment before the user approves the refreshed definition.

## Agreed product decisions

1. A `DEFINITION_STALE` response during assessment displays a clear explanation that the definition's reference or template document has changed, with **Update** and **Cancel** actions. Cancel closes the assessment modal; it must not open the no-match/create choice.
2. Recovery is one modal at a time: the stale prompt, parse/review and retry states render inside the single owning assessment modal, and the wizard review surface replaces it rather than stacking a second modal.
3. Update targets the existing `definitionKey`, reparses its current documents and bypasses the initial create panel. Only successful parsing/persistence opens the usual second panel for metadata and weighting review.
4. Preserve assignment weighting. Preserve each unchanged task's stored weighting; new or changed tasks use the existing `TaskDefinition` constructor default of **1**. Removed tasks disappear. Preserve valid zero weightings.
5. Reparse persists immediately, consistent with the current wizard. Cancelling review does not roll back that refresh; it discards only subsequent unsaved edits and never starts an assessment. Explain this in the review surface.
6. Only explicit approval and successful save continue the original assessment flow, using the same definition, coursework and class identifiers.
7. Add an explicit **Reparse documents** action to the Assignments-page update wizard for unchanged URLs, as well as regression coverage for the existing timestamp-driven upsert behaviour. Neither opening an update modal nor a background refetch reparses documents automatically.
8. Report parsing failures in the owning modal. Do not show a successful review panel, persist a partial parse, or start assessment when parsing fails.
9. The genuine create-new-definition path is converted to the same in-modal rendering as recovery. The conversion is delivered as its own gated section after wizard decomposition and assessment decomposition, and before recovery UI, so recovery builds on a proven in-modal composition rather than introducing two presentation patterns for sibling flows. Create flow behaviour (choice → parse → review → auto-assessment) is unchanged; only the modal presentation changes.

## Existing system constraints

- `AssignmentController.startAssessmentRun` checks Drive timestamps before scheduling. Retain this check and the later trigger-execution freshness check.
- `AssessTaskModal.transitionToStaleRecovery` currently selects `creating`; its wizard is rendered with `mode="create"` and a null key. Existing tests incorrectly assert that behaviour.
- `AssignmentDefinitionUpsertOrchestrator._resolveTaskState` already reparses on changed document IDs or newer timestamps with the same IDs. Do not replace this with unconditional parsing for ordinary upserts.
- Upsert is the existing write boundary, with rollback handling across full definition and registry writes. Stable keys, `createdAt`, alternate titles/topics and document type must be preserved unless explicitly edited.
- Full stored tasks include artefacts; frontend responses expose only task ID, title and weighting. The backend owns task equivalence and weighting reconciliation. The frontend must not overwrite returned weightings by matching old task IDs.
- Use existing service wrappers, `callApi`, shared error mapping, query keys and wizard shell. No frontend import of backend runtime code.

## Domain and contract rules

### Task equivalence

Assumption made explicit: “unchanged” means the same task identity and equivalent parsed assessment content, not merely the same title or Drive modification timestamp.

For each task ID, compare title, notes, task metadata, and both ordered reference/template artefact collections. Artefact comparison includes type, role, source document/page identity, content and assessment-relevant metadata. Compare object keys independently of insertion order; preserve array order. Exclude weighting, derived content hashes, generated artefact UIDs and positional bookkeeping (`index`, `taskIndex`, `artifactIndex`) from equality. Task/page identity changes are changes, not a best-effort fuzzy match. Do not use hash equality alone. Any parser-generated volatile metadata must be identified before implementing the comparator rather than excluded wholesale.

The backend applies this rule to all reparses, including document-ID changes. Old payload weighting patches must not silently restore weightings for tasks that have changed during an ordinary save (see concurrent document changes below).

### Explicit reparse request

Extend `upsertAssignmentDefinition` with optional boolean `forceReparse`. `true` is accepted only with an existing `definitionKey`; it forces parsing regardless of timestamps. Omission or `false` retains existing upsert behaviour. Invalid types and a forced create are rejected. The flag is transport/control information, never persisted or returned as part of a definition.

Explicit reparse uses current persisted metadata/document identifiers (or the existing, explicitly confirmed URL-change workflow) and omits `taskWeightings`; preserve assignment weighting on omission. The response remains the existing editable definition shape, with reconciled weights authoritative.

### Failures

Introduce a stable non-retriable `DEFINITION_PARSE_FAILED` code for recognised document/task parsing failures, mapped to safe copy: “The assignment documents could not be parsed. Check the reference and template documents, then try again.” Keep raw diagnostic details in logs, not user copy. Preserve distinct authorisation, rate-limit and persistence errors rather than classifying every upsert failure as a parse failure.

A rejected/invalid task is a failed parse, not permission to save only the remaining tasks. A zero-task result also blocks refresh. Parsing failure leaves the previously stored definition and freshness timestamps unchanged. Persistence failures retain existing rollback behaviour.

### Concurrent document changes

Recheck document timestamps before committing approved weightings. If documents changed since the reviewed baseline, reject the save with `DEFINITION_STALE` before applying weighting patches or writing; return to Update/Cancel and require another reparse and approval. Use the existing response `updatedAt` as the review baseline and send it in the request field specified below; no new response field is needed. Never silently reparse and apply stale patches during approval.

An optional `expectedDefinitionUpdatedAt` (ISO timestamp) on approval saves identifies the definition returned by the latest load/reparse; compare it to the current stored definition before applying edits. A mismatch also returns `DEFINITION_STALE`, without writes. Responses already contain `updatedAt`; no new response fields are needed. Requests without this field retain ordinary upsert behaviour for existing non-wizard callers. Wizard save requests use it in create-after-parse, update and recovery flows. This is scoped stale-write protection, not a redesign of global concurrent persistence locking.

## Feature architecture and data loading

Assessment recovery belongs to `features/classes/AssessTaskModal`; document refresh and review belong to the existing `features/assignmentWizard` family. Async orchestration belongs in feature hooks, not pages or presentational components.

### Wizard decomposition (required)

The existing `useAssignmentDefinitionWizard.ts` (≈1,378 lines) and `AssessTaskModal.tsx` (≈955 lines) mix orchestration, state and rendering. Before adding recovery behaviour, split the materially touched logic into cohesive feature-local modules; keep presentational components (`AssignmentDefinitionWizardModal`, `...ModalShell`, sub-render helpers) reusable rather than redesigned:

1. **Form state module** — wizard form hydration from definitions/responses, dirty-state rules, document-change state and task-row state.
2. **Wizard orchestrator module** — a dedicated, readable orchestration file that owns the wizard process end-to-end: entry mode (create, update, explicit reparse, recovery), the parse → review → save sequence, mutation calls, error mapping, query invalidation and stage transitions. The modal component consumes this orchestrator; future developers should be able to follow the whole process in one place.
3. **Assessment orchestration module** — matching, linking, captured assessment context and stale-recovery transitions for `AssessTaskModal`, outside its rendering component.

Recovery then becomes an explicit orchestrator entry using an existing definition key — never a second wizard or a create-flow disguise. Unit tests must protect existing create/update/link behaviour through this refactor.

Capture the attempted `{definitionKey, assignmentId, courseId}` when starting assessment. Recovery uses this captured context, not rematching cached titles or relying on error details surviving the generic envelope schema. Support matched, newly created and linked-definition start attempts. Preserve any already committed link aliases when recovery is cancelled.

On Update, fetch the existing definition by key, then issue the explicit reparse mutation exactly once for that user action. If loading fails or returns no definition, show a blocking error; never fall back to create. Ignore obsolete async completions after close/reopen or context change. Do not start assessment from effects or background query refreshes.

After successful mutations invalidate existing definition-partials and definition-by-key queries. Use the mutation response as the review baseline; background refetches must not clobber dirty edits or trigger repeated parsing. Existing startup reference-data readiness rules remain unchanged.

## Behavioural model and workflows

### Assessment recovery

`attempting → stale prompt → loading/reparsing → review → saving approval → attempting → success`

- All recovery states render within the single owning modal; the wizard review surface must not open as a second stacked modal.
- Prompt Cancel closes the entire assessment flow.
- While parsing/saving, disable duplicate actions and conflicting edits; do not pretend a GAS request can be cancelled.
- Load/parse failure stays in a blocking owned region with Retry and Cancel. Retry is a deliberate user action, never an automatic parse loop.
- Review Cancel closes the flow with the existing discard confirmation only if there are unsaved edits. The persisted refresh remains.
- Approval save failure does not start assessment. A stale response returns to the prompt; other failures retain review edits and allow retry.
- A subsequent assessment-start stale response repeats the prompt, not an automatic loop. Other assessment-start errors use existing error treatment; a saved definition is not rolled back.
- A truly absent matching definition still uses the existing create/link flow.

### Assignments-page update

Keep the existing second-panel edit surface. Add a secondary Reparse documents action available when the loaded definition is trustworthy, no mutation is pending, and there are no unsaved metadata/weighting edits or pending URL changes. Explain the disabled action when edits must first be saved or discarded. The existing URL-change confirmation flow remains the route for changed URLs.

Explicit reparse refreshes the saved definition and presents the returned tasks/weights for review. Save closes normally; it never starts an assessment from this entry point. Ordinary same-ID timestamp-driven upserts remain supported for callers without a review baseline.

## Scope boundaries

No deployment, commit, PR creation, database migration, preview store, revision history, global concurrency redesign, automatic background reparse, reassessment of historical submissions, or broad modal redesign. No changes to historical embedded definitions. No generic deep-equality library extraction unless existing reuse justifies it.

A dedicated layout specification is required because prompt/reparse/review states, modal ownership, retry treatment and a manual action materially change the workflow.

## Acceptance criteria

- Both stale matched and stale linked flows update the original key without any create request, first-panel flash or duplicate definition.
- Cancel at prompt and review never schedules an assessment; review cancellation retains the persisted reparse.
- A timestamp-only edit with equivalent parsed tasks preserves all weights; content changes under the same task ID reset only affected task weights to 1.
- Added/removed tasks, zero weights, notes/metadata changes, generated UID differences and object-key order are covered by deterministic equivalence tests.
- Explicit same-URL reparse runs even with unchanged timestamps; ordinary fresh upserts do not parse.
- Invalid/empty parse, fetch failures, write failures and stale approval never produce false success or unintended assessment.
- User approval continues exactly once with captured identifiers. Close/reopen and delayed responses cannot act on a different assignment.
- Manual Assignments-page refresh and existing create/link/update flows have regression coverage.

## Planning handoff requirements

- Before finalising ACTION_PLAN.md, record `forceReparse`, `expectedDefinitionUpdatedAt` and parsing-error semantics in `docs/developer/data-shapes/assignment-definition.md`, and the new error code in `transport-envelope.md`, as **Not implemented**. Update backend error mapping and the frontend shared error-code/message registry during implementation, not via feature-local string matching.
- Drive freshness is checked by the backend against the stored definition's `referenceLastModified` and `templateLastModified`. The frontend sends no document timestamps. Separately compare the request's expected definition timestamp with stored `updatedAt` to detect changes to the definition itself.
- Extend the shared wizard entry contract with explicit recovery entry intent while retaining create/update semantics. Recovery requires an existing key and an approval-success callback; it must not masquerade as create. Document this planned extension, the new wizard orchestrator module and the assessment orchestration module in the canonical frontend shared-helper registry **before implementation starts**.
- Retire the frontend reparse merge in `buildTaskRowsFromResponse`: render server weightings directly. Explicit forced requests omit weighting patches, including the current empty array. Reject `forceReparse: true` combined with `taskWeightings` to avoid ambiguous patch precedence.
- Recovery uses the existing ID-shaped request from fetched definition data. URL-shaped requests remain supported for the existing document-change workflow.
- Use the canonical `small` profile definition/class partials for realistic frontend scenarios. Note: the generator's in-memory persistence view is never committed or loadable, so backend equivalence scenarios use local boundary fixtures (see ACTION_PLAN.md canonical-fixture policy). Boundary/invalid tests remain local. **The synthetic test generator is extended (decided, planned): `toTransportViews.js` gains a named full editable-definition transport view (`transport.editableDefinitions`, file `editableDefinitions.json`, writer/loader wiring, committed-profile regeneration), so MCP walkthroughs, E2E journeys, and unit tests consume the same canonical full-definition fixtures. Do not construct a competing realistic corpus. Only migrate existing tests touched by this issue.**

## Assumptions and open questions

User decisions on weighting preservation and immediate reparse persistence are confirmed. “Both” is interpreted as explicit manual reparse plus timestamp-driven regression coverage. One-modal-at-a-time recovery layout and the wizard/assessment decomposition (including the dedicated wizard orchestration file) are confirmed. Task equivalence, empty-result blocking and approval stale protection are explicit proposed safety rules subject to independent planning review. No unanswered user question currently blocks drafting; reviewer findings may require clarification.
