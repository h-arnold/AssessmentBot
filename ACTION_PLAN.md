# Feature Delivery Plan (TDD-First)

## Read-First Context

Before writing or executing this plan:

1. Read the current `SPEC.md`.
2. Read `ASSIGNMENT_DEFINITION_WIZARD_LAYOUT.md`.
3. Treat those documents as the source of truth for product behaviour, contracts, and layout rules.
4. Use this action plan to sequence delivery and testing; do not restate or redefine material already settled in the spec or layout doc.

## Scope and assumptions

### Scope

- Deliver the assignment definition create/update modal wizard on the active Assignments page.
- Add the required backend API transport and frontend service/query contracts for `upsertAssignmentDefinition`, `getAssignmentDefinition`, and the supporting reference-data/list surfaces.
- Migrate the active frontend assignment-definition contracts to `yearGroupKey`-based reads and writes.

### Out of scope

- Assessment-launch wizard work.
- Weighted score-calculation algorithm design beyond persisting raw weights.
- Task-content editing beyond task weighting values.

### Assumptions

1. Stage-one create persists a legitimate assignment definition and must obey duplicate business-tuple validation before persistence.
2. `upsertAssignmentDefinition` is the single write transport for stage-one create, final save, and document-change re-parse.
3. Official Ant Design documentation verification could not be completed in this planning session because live external retrieval was unavailable; implementation must verify the selected component usage against `https://ant.design/llms.txt` and the linked official component docs before merge.
4. `assignmentTopics` joins startup warm-up in this phase because the same reference-data set is expected to support additional modal workflows.
5. No existing persisted assignment-definition data needs compatibility handling or migration in this feature; implementation may replace the old persistence contract directly.

---

## Section 0 — Shared modal width standard

### Objective

- Add the shared wide-data modal-width exception required by the wizard before user-facing modal implementation begins.

### Constraints

- Keep width ownership centralised in the canonical frontend width standards.
- Do not introduce feature-local modal width literals.

### Delegation mandatory reads (when sub-agents are used)

Implementation mandatory docs:

- `AGENTS.md`
- `src/frontend/AGENTS.md`
- `ASSIGNMENT_DEFINITION_WIZARD_LAYOUT.md`
- `docs/developer/frontend/frontend-loading-and-width-standards.md`

Code Reviewer mandatory docs:

- `AGENTS.md`
- `src/frontend/AGENTS.md`
- `ASSIGNMENT_DEFINITION_WIZARD_LAYOUT.md`
- `docs/developer/frontend/frontend-loading-and-width-standards.md`

### Acceptance criteria

- The canonical frontend width standards define one approved wide-data modal-width exception for this wizard family.
- Sections 3 and 4 consume that shared width contract rather than introducing a feature-local literal.

### Required test cases/checks

1. Verify the shared standard and any consumed token names are documented before modal implementation begins.

### Section checks

- Mandatory-read evidence gate passed for all delegated handoffs in this section.

### Implementation notes / deviations / follow-up

- **Implementation notes:** pending.
- **Deviations from plan:** pending.

---

## Global constraints and quality gates

### Engineering constraints

- Keep API entry points thin and delegate behaviour to the existing assignment-definition controller layer.
- Keep frontend transport behind `callApi(...)` and adjacent Zod validation.
- Fail fast on invalid URLs, invalid reference-data keys, duplicate tuples, and persistence failures.
- Keep the modal as a feature-local workflow surface; do not introduce a generic app-wide wizard abstraction for this feature.
- Use British English in comments and documentation.

### TDD workflow (mandatory per section)

For each section below:

1. **Red**: write failing tests for the section’s acceptance criteria.
2. **Green**: implement the smallest change needed to pass.
3. **Refactor**: tidy implementation with all tests still green.
4. Run section-level verification commands.

### Delegation mandatory-read gate (mandatory for sub-agent execution)

When a section is delegated to sub-agents, the plan must define and enforce mandatory documentation reads.

For each delegated phase (`Testing Specialist`, `Implementation`, `Code Reviewer`, `Docs`, or `De-Sloppification`):

1. list required documentation file paths under that phase before delegation
2. require the sub-agent handoff to include `Files read` with explicit file paths
3. verify every mandatory file is listed before accepting the handoff
4. if any mandatory file is missing, return the work to the same sub-agent and block progression to the next phase

### Shared-helper planning gate (mandatory when helper changes are expected)

Helper decision entries:

1. Helper: `AssignmentDefinitionWizardModal`
   - Decision: `keep local`
   - Owning module/path: `src/frontend/src/pages` or a feature-local assignments workflow module under `src/frontend/src/**`
   - Call-site rationale: the feature currently has one active caller family on the Assignments page, and the modal’s state machine is specific to assignment-definition parsing, re-parse gating, and task-weight editing
   - Relevant canonical doc target: `docs/developer/frontend/frontend-modal-patterns.md`
   - Planned doc status: `Not implemented`
2. Helper: `assignment-definition full-response mapper`
   - Decision: `keep local`
   - Owning module/path: frontend service or schema-adjacent mapping layer for assignment-definition full responses
   - Call-site rationale: one canonical editable entity shape should be normalised once at the transport boundary rather than re-mapped in page or modal code
   - Relevant canonical doc target: none in this phase; keep feature-local unless a second consumer appears
   - Planned doc status: `Not applicable`
3. Helper: `assignment-definition document URL translation`
   - Decision: `keep local`
   - Owning module/path: assignment-definition frontend service layer plus the matching backend transport boundary
   - Call-site rationale: pasted-URL parsing, canonical URL reconstruction, and ID handoff are specific to this workflow and should not leak into page or modal components
   - Relevant canonical doc target: none in this phase; keep feature-local unless broader reuse appears
   - Planned doc status: `Not applicable`

### Validation commands hierarchy

- Backend lint: `npm run lint`
- Frontend lint: `npm run frontend:lint`
- Backend tests: `npm test -- <target>`
- Frontend unit tests: `npm run frontend:test -- <target>`

---

## Section 1 — Backend transport contracts and persistence rules

### Objective

- Extend the backend write and read contracts so `upsertAssignmentDefinition` handles create-stage parse/persist, final save, and document-change re-parse, while `getAssignmentDefinition` handles edit-mode reads.

### Constraints

- Keep `apiHandler` as the only frontend transport entry point.
- Keep transport validation in `z_Api` helpers and domain validation in the controller layer.
- Preserve existing persistence behaviour where possible while enforcing the new duplicate-tuple and weighting rules.
- Freeze the active `getAssignmentDefinitionPartials` DTO in this section unless the matching frontend schema, startup query wiring, and Assignments page consumer changes land in the same implementation slice.

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- `AGENTS.md`
- `src/backend/AGENTS.md`
- `SPEC.md`
- `ASSIGNMENT_DEFINITION_WIZARD_LAYOUT.md`
- `docs/developer/backend/api-layer.md`
- `docs/developer/backend/backend-testing.md`

Implementation mandatory docs:

- `AGENTS.md`
- `src/backend/AGENTS.md`
- `SPEC.md`
- `docs/developer/backend/api-layer.md`

Code Reviewer mandatory docs:

- `AGENTS.md`
- `src/backend/AGENTS.md`
- `SPEC.md`

### Shared helper plan (when helper changes are expected)

1. Helper: `assignment-definition API handlers`
   - Decision: `extend`
   - Owning module/path: `src/backend/z_Api/assignmentDefinitionPartials.js` and `src/backend/z_Api/z_apiHandler.js`
   - Call-site rationale: the updated write behaviour belongs in the existing assignment-definition transport family
   - Relevant canonical doc target: backend API-layer docs if new patterns emerge
   - Planned doc status: `Not implemented`

### Acceptance criteria

- `upsertAssignmentDefinition` and `getAssignmentDefinition` exist behind `apiHandler` as the active wizard transports.
- `upsertAssignmentDefinition` accepts document URLs, validates supported Google document URLs, rejects same-document pairs, rejects mixed supported document types, derives `documentType` server-side, and persists only after those checks pass.
- `upsertAssignmentDefinition` accepts `yearGroupKey`, enforces the `0` to `10` weighting range, applies duplicate detection on tuple-changing saves, and returns the canonical full-definition response shape.
- Persisted full and partial assignment-definition records store authoritative `yearGroupKey` values, and read contracts resolve `yearGroupLabel` from that stored key.
- Stage-one create rejects duplicate tuples before persistence.
- `upsertAssignmentDefinition` and `getAssignmentDefinition` return the canonical full-definition response shape.

### Required test cases (Red first)

Backend controller/domain tests:

1. create-stage duplicate tuple rejection
2. weighting range validation for assignment and task weightings
3. valid year-group selection enforcement for save-compatible writes
4. stable definition-key handling across tuple edits
5. persistence round-trips store `yearGroupKey` authoritatively in full and partial records

Additional backend controller tests:

1. canonical full-definition response mapping for create, read, save, and re-parse
2. document-change re-parse preserves matching task weightings and defaults new tasks to `1`
3. final-save duplicate detection when title, topic, or year group changes
4. same-document pair rejection and mixed supported-type rejection

API layer tests:

1. new handler allowlisting and transport-shape validation
2. invalid URL and invalid identifier rejection at the transport boundary
3. full-definition read request-shape and identifier-safety validation

Frontend tests:

1. None in this section

### Section checks

- `npm test -- tests/api/...`
- `npm test -- tests/...assignment-definition...`
- Mandatory-read evidence gate passed for all delegated handoffs in this section.

### Optional `@remarks` JSDoc follow-through

- Add `@remarks` only if the response-shape mapping or single-write-transport behaviour would otherwise be non-obvious.

### Implementation notes / deviations / follow-up

- **Implementation notes:** pending.
- **Deviations from plan:** pending.
- **Follow-up implications for later sections:** frontend service schemas and modal state should consume the canonical full-definition response directly.

---

## Section 2 — Frontend service, schema, and query wiring

### Objective

- Add the frontend service wrappers, Zod contracts, and React Query entries needed for `upsertAssignmentDefinition`, `getAssignmentDefinition`, and the required reference-data dependencies.
- Defer the shared `assignmentDefinitionPartials` contract migration until the visible Assignments list-surface slice lands.

### Constraints

- All frontend-to-backend transport must remain behind `callApi(...)`.
- Query keys should be defined through shared query-key helpers rather than ad hoc arrays.
- Keep normalisation at the transport/schema boundary, not in page components.
- `assignmentTopics` joins startup warm-up in this phase, so the section must update the shared query and startup trust contract accordingly.
- This section must not change the live `assignmentDefinitionPartials` DTO or its existing Assignments page consumer yet.

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- `AGENTS.md`
- `src/frontend/AGENTS.md`
- `SPEC.md`
- `ASSIGNMENT_DEFINITION_WIZARD_LAYOUT.md`
- `docs/developer/frontend/frontend-react-query-and-prefetch.md`
- `docs/developer/frontend/frontend-testing.md`

Implementation mandatory docs:

- `AGENTS.md`
- `src/frontend/AGENTS.md`
- `SPEC.md`
- `docs/developer/frontend/frontend-react-query-and-prefetch.md`

Code Reviewer mandatory docs:

- `AGENTS.md`
- `src/frontend/AGENTS.md`
- `SPEC.md`

### Shared helper plan (when helper changes are expected)

1. Helper: `assignment-definition full-response mapper`
   - Decision: `keep local`
   - Owning module/path: schema-adjacent frontend service layer
   - Call-site rationale: one mapper keeps React Query caches and form state aligned
   - Relevant canonical doc target: none in this phase; keep feature-local unless a second consumer appears
   - Planned doc status: `Not applicable`

### Acceptance criteria

- Frontend service wrappers exist for `upsertAssignmentDefinition` and full-definition reads.
- A dedicated frontend transport wrapper and adjacent Zod schema exist for `assignmentTopics`.
- Shared query keys/options exist for assignment topics and full definitions by key.
- `assignmentTopics` participates in startup warm-up and shared trust handling in this phase.
- Mutation flows invalidate or refresh both the partial-definition list query and the selected full-definition query where the spec requires it.
- The live `assignmentDefinitionPartials` DTO and Assignments page consumer remain unchanged in this section.

### Required test cases (Red first)

Backend model tests:

1. None in this section

Backend controller tests:

1. None in this section

API layer tests:

1. None in this section

Frontend tests:

1. service/schema validation for `upsertAssignmentDefinition` and `getAssignmentDefinition`
2. service/schema validation for `assignmentTopics`
3. query-key and query-option coverage for full-definition and assignment-topic reads
4. startup warm-up wiring and trust handling for `assignmentTopics`
5. mutation cache invalidation or rebase coverage for stage-one create, final save, and re-parse through `upsertAssignmentDefinition`

### Section checks

- `npm run frontend:test -- src/frontend/src/services/...`
- `npm run frontend:test -- src/frontend/src/query/...`
- Mandatory-read evidence gate passed for all delegated handoffs in this section.

### Optional `@remarks` JSDoc follow-through

- Add `@remarks` only if the response-mapping boundary or startup trust integration would otherwise be surprising.

### Implementation notes / deviations / follow-up

- **Implementation notes:** pending.
- **Deviations from plan:** pending.
- **Follow-up implications for later sections:** the modal shell should treat the service contracts as canonical and avoid custom data reshaping; the shared partial-definition DTO migration is intentionally deferred to Section 3.

---

## Section 3 — Assignments page entry points and modal shell

### Objective

- Migrate the full-stack Assignments list surface to the `yearGroupKey`/`yearGroupLabel` contract and add the modal shell plumbing needed for the later workflow slice.

### Constraints

- Keep the Assignments page as the single owning surface.
- Keep create and update affordances unavailable to end users until Section 4 lands the first complete modal workflow.
- Keep the modal local to the assignments workflow; do not introduce a generic wizard abstraction.
- Treat the partial-definition DTO migration, the page-level year-group rendering/filtering updates, and the modal-launch affordances as one visible list-surface slice.
- Include the required backend partial-transport and controller updates in the same slice as the frontend list-surface consumer changes.

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- `AGENTS.md`
- `src/backend/AGENTS.md`
- `src/frontend/AGENTS.md`
- `SPEC.md`
- `ASSIGNMENT_DEFINITION_WIZARD_LAYOUT.md`
- `docs/developer/backend/api-layer.md`
- `docs/developer/backend/backend-testing.md`
- `docs/developer/frontend/frontend-modal-patterns.md`
- `docs/developer/frontend/frontend-loading-and-width-standards.md`
- `docs/developer/frontend/frontend-testing.md`

Implementation mandatory docs:

- `AGENTS.md`
- `src/backend/AGENTS.md`
- `src/frontend/AGENTS.md`
- `SPEC.md`
- `ASSIGNMENT_DEFINITION_WIZARD_LAYOUT.md`
- `docs/developer/backend/api-layer.md`
- `docs/developer/frontend/frontend-modal-patterns.md`
- `docs/developer/frontend/frontend-loading-and-width-standards.md`

Code Reviewer mandatory docs:

- `AGENTS.md`
- `src/backend/AGENTS.md`
- `src/frontend/AGENTS.md`
- `SPEC.md`
- `ASSIGNMENT_DEFINITION_WIZARD_LAYOUT.md`

### Shared helper plan (when helper changes are expected)

1. Helper: `AssignmentDefinitionWizardModal`
   - Decision: `keep local`
   - Owning module/path: Assignments page workflow surface
   - Call-site rationale: only one active caller family exists and the state machine is feature-specific
   - Relevant canonical doc target: `docs/developer/frontend/frontend-modal-patterns.md`
   - Planned doc status: `Not implemented`

### Acceptance criteria

- The backend partial-definition transport exposes `yearGroupKey` and `yearGroupLabel` as the active list-surface contract.
- The Assignments table renders `yearGroupLabel` from the active contract.
- Year-group filtering continues to work against the visible label contract after the migration.
- The modal shell component owns create/update title text, loading skeletons, blocking errors, and local mutation busy states when exercised directly in component tests.
- The page-level create and update affordances remain unavailable until Section 4 enables the first complete workflow.
- The existing delete row action remains present.

### Required test cases (Red first)

Backend controller/domain tests:

1. partial-definition list responses expose the active `yearGroupKey`/`yearGroupLabel` contract

API layer tests:

1. partial-definition transport request/response wiring remains valid after the contract migration

Frontend tests:

1. Assignments page renders year-group labels from the active contract correctly
2. year-group filtering continues to work against the visible label contract
3. modal shell component shows update-mode loading skeleton then hydrated form when exercised directly
4. modal shell component fails closed inside the owned surface on blocking-load errors

Playwright tests:

1. the migrated Assignments table remains usable while delete remains available

### Section checks

- `npm run frontend:test -- src/frontend/src/pages/...Assignments...`
- `npm test -- tests/...assignment-definition...`
- `npm run frontend:test:e2e -- <target>`
- Mandatory-read evidence gate passed for all delegated handoffs in this section.

### Optional `@remarks` JSDoc follow-through

- None.

### Implementation notes / deviations / follow-up

- **Implementation notes:** pending.
- **Deviations from plan:** pending.
- **Follow-up implications for later sections:** Section 4 enables the page-level create and update affordances on top of this migrated list surface and modal shell.

---

## Section 4 — Shared edit surface, re-parse gating, and task weighting workflow

### Objective

- Implement the create stage-one parse flow, the shared edit surface used by both modes, the explicit document-change re-parse gating, and task-weight editing.
- Enable the page-level create and update affordances as the first complete user-facing workflow slice.

### Constraints

- Unsaved document edits and unsaved metadata/weighting edits are mutually exclusive local states.
- Re-parse state must remain inside the modal and must not use nested confirmation modals.
- Task weighting remains unavailable until parsed tasks exist.

### Delegation mandatory reads (when sub-agents are used)

Testing Specialist mandatory docs:

- `AGENTS.md`
- `src/frontend/AGENTS.md`
- `SPEC.md`
- `ASSIGNMENT_DEFINITION_WIZARD_LAYOUT.md`
- `docs/developer/frontend/frontend-modal-patterns.md`
- `docs/developer/frontend/frontend-loading-and-width-standards.md`
- `docs/developer/frontend/frontend-testing.md`

Implementation mandatory docs:

- `AGENTS.md`
- `src/frontend/AGENTS.md`
- `SPEC.md`
- `ASSIGNMENT_DEFINITION_WIZARD_LAYOUT.md`
- `docs/developer/frontend/frontend-modal-patterns.md`
- `docs/developer/frontend/frontend-loading-and-width-standards.md`

Code Reviewer mandatory docs:

- `AGENTS.md`
- `src/frontend/AGENTS.md`
- `SPEC.md`
- `ASSIGNMENT_DEFINITION_WIZARD_LAYOUT.md`

### Shared helper plan (when helper changes are expected)

1. Helper: `task-weighting table input cell`
   - Decision: `keep local`
   - Owning module/path: assignment-definition wizard modal surface
   - Call-site rationale: the editing rules are specific to parsed task rows in this feature
   - Relevant canonical doc target: none in this phase; keep feature-local unless reuse emerges later
   - Planned doc status: `Not applicable`

### Acceptance criteria

- The page action area exposes a working create action, and each table row exposes a working update action.
- Create mode performs parse-and-persist before task editing is available.
- After stage-one create, the same modal session exposes document URLs, metadata, and task weightings through the shared edit surface.
- Updating document URLs disables other edits and exposes explicit `Re-parse` and `Cancel` actions.
- Cancel restores persisted URLs; re-parse refreshes tasks, preserves compatible weights, and defaults new tasks to `1`.
- If metadata or weighting edits are dirty, document URL fields remain unavailable until the user saves or closes the modal and confirms discard.
- Required topic/year-group reference data failures block the create modal surface locally.
- If post-mutation refresh leaves the Assignments list or open modal surface untrustworthy, the affected surface fails closed rather than continuing to show stale ready-state content.

### Required test cases (Red first)

Backend model tests:

1. None in this section

Backend controller tests:

1. None in this section

API layer tests:

1. None in this section

Frontend tests:

1. page-level create and update affordances become enabled only when the complete workflow is available
2. create mode hides or disables task editing before first parse
3. stage-one success hydrates the shared edit surface without a second fetch requirement
4. document change disables metadata and task weighting inputs until re-parse or cancel
5. cancel restores persisted URLs and re-enables other fields
6. re-parse refreshes task rows and preserves matching weightings
7. save remains blocked until a valid year-group selection is present
8. dirty metadata or weighting edits disable document URL fields until save or discard-by-close
9. create entry blocks locally when required reference data cannot be loaded
10. failed post-mutation refresh fails closed on the affected table or modal surface

Playwright tests:

1. create flow: parse and continue, then save
2. update flow: document change plus cancel restores URLs and fields
3. update flow: document change plus successful re-parse refreshes task rows
4. modal close with unsaved stage-two edits requires discard confirmation
5. save remains blocked until a valid year-group selection is present
6. create mode fails closed locally when required topic or year-group reference data cannot be trusted or loaded
7. failed post-mutation refresh fails closed on the affected surface instead of leaving stale ready-state content visible

### Section checks

- `npm run frontend:test -- src/frontend/src/...assignment-definition...`
- `npm run frontend:test:e2e -- <target>`
- Mandatory-read evidence gate passed for all delegated handoffs in this section.

### Optional `@remarks` JSDoc follow-through

- Add `@remarks` if the modal state machine or re-parse gating logic would otherwise be difficult to understand from code alone.

### Implementation notes / deviations / follow-up

- **Implementation notes:** pending.
- **Deviations from plan:** pending.
- **Follow-up implications for later sections:** refresh and regression work must verify both the table and modal caches update coherently.

---

## Regression and contract hardening

### Objective

- Verify that backend, frontend, and list-surface contracts remain coherent after the wizard lands.

### Constraints

- Prefer focused suites before broader validation.

### Acceptance criteria

- Touched backend transport tests pass.
- Touched frontend service and UI tests pass.
- Backend and frontend lint pass.
- Create, update, delete, and re-parse flows leave the Assignments table trustworthy.

### Required test cases/checks

1. Run touched backend API and controller suites.
2. Run touched frontend service, query, and modal/page suites.
3. Run `npm run lint`.
4. Run `npm run frontend:lint`.
5. Run `npm run frontend:test:e2e`.
6. Verify mandatory-read evidence (`Files read`) is complete for every delegated regression handoff.

### Section checks

- Run the commands listed above and ensure green results.

### Implementation notes / deviations / follow-up

- **Implementation notes:** pending.
- **Deviations from plan:** pending.

---

## Documentation and rollout notes

### Objective

- Keep the planning and developer docs aligned with the implemented feature and its compatibility rules.

### Constraints

- Only update documents relevant to assignment-definition contracts, frontend modal guidance, and reference-data compatibility.

### Acceptance criteria

- Docs accurately describe the consolidated `upsertAssignmentDefinition` write behaviour, canonical full-definition response shape, and `yearGroupKey`/`yearGroupLabel` contract.
- Any helper decisions that remained local or became shared are reconciled in canonical docs.

### Required checks

1. Verify docs mention stage-one create persistence, final-save persistence, and re-parse transport behaviour.
2. Verify docs mention `yearGroupKey`, `yearGroupLabel`, and startup-owned `assignmentTopics` loading.
3. Confirm notes/deviations fields are filled during implementation.
4. Verify mandatory-read evidence (`Files read`) is complete for delegated docs/review handoffs.
5. Reconcile planned shared-helper entries in canonical docs: keep `Not implemented` where still pending, and update implemented entries where delivered.

### Optional `@remarks` JSDoc review

- Confirm whether response-shape mapping, year-group compatibility, or re-parse state-machine choices should be preserved in `@remarks`.

### Implementation notes / deviations / follow-up

- pending.

---

## Suggested implementation order

1. Section 0 — Shared modal width standard
2. Section 1 — Backend transport contracts and persistence rules
3. Section 2 — Frontend service, schema, and query wiring
4. Section 3 — Assignments page entry points and modal shell
5. Section 4 — Shared edit surface, re-parse gating, and task weighting workflow
6. Regression and contract hardening
7. Documentation and rollout notes
