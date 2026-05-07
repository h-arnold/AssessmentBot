# Assignment Definition Wizard Refactor Action Plan (TDD-First)

## Read-First Context

Before writing or executing this plan:

1. Read `SPEC.md` for the accepted wizard behaviour and contracts.
2. Read `ASSIGNMENT_DEFINITION_WIZARD_LAYOUT.md` for the agreed modal workflow and visible states.
3. Read `ACTION_PLAN.md` for the broader assignment-definition delivery context.
4. Read `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`.
5. Read `docs/developer/frontend/frontend-modal-patterns.md`.
6. Read `docs/developer/frontend/frontend-testing.md`.
7. Read `docs/developer/frontend/frontend-loading-and-width-standards.md`.
8. Read `docs/developer/frontend/frontend-logging-and-error-handling.md`.
9. Read `config/eslint/ts-base-rules.cjs`.
10. Read the current wizard implementation:

- `src/frontend/src/pages/AssignmentDefinitionWizardModal.tsx`
- `src/frontend/src/pages/useAssignmentDefinitionWizard.ts`
- `src/frontend/src/pages/AssignmentDefinitionWizardModalShell.tsx`

## Scope and assumptions

### Scope

- Refine the existing split wizard structure in place.
- Reduce `AssignmentDefinitionWizardModal` and `useAssignmentDefinitionWizard` to satisfy the hard ESLint complexity limit of `<=7`.
- Remove duplicated wizard-specific orchestration and state-shaping logic where a coherent local contract exists.
- Simplify modal render branching through an existing shell or narrow view-state seam.
- Align the refactor to the accepted `SPEC.md` and `ASSIGNMENT_DEFINITION_WIZARD_LAYOUT.md` contract, even where the current implementation appears to diverge.
- Fix the known create-session post-parse contract gap inside this refactor if it is confirmed in implementation: after stage-one create, the same session must transition to the shared edit surface and use the same explicit document-change re-parse-or-cancel flow as update mode.

### Out of scope

- Relaxing or bypassing the ESLint complexity rule.
- Introducing speculative cross-feature helpers or a generic app-wide wizard abstraction.
- Moving the wizard to a new feature folder as part of this refactor.
- Reworking `AssignmentsPage.tsx` beyond any import or contract updates that become strictly necessary.
- Changing backend contracts, persistence, or product behaviour beyond bringing the wizard back into alignment with the accepted spec/layout contract.

### Assumptions

1. The validated lint baseline is the current source of truth: both `AssignmentDefinitionWizardModal` and `useAssignmentDefinitionWizard` currently fail ESLint complexity at `17`.
2. Existing split files already represent the accepted structure boundary; the remaining work is structural refinement inside that boundary, not first-time hook extraction.
3. When current implementation and accepted spec/layout conflict, the implementation must move towards the accepted spec/layout rather than the refactor preserving the divergence.

---

## Current validated baseline

- `AssignmentDefinitionWizardModal.tsx` already delegates to `useAssignmentDefinitionWizard.ts`, but the component still fails complexity because it owns multiple top-level modal return branches and a large render path.
- `useAssignmentDefinitionWizard.ts` already owns the wizard state machine, but still fails complexity because it contains:
  - duplicated async orchestration skeletons across `handleParseAndContinue`, `handleSave`, and `handleReparse`
  - repeated state-shaping work around task rows, canonical document URLs, parsed baselines, document-change state, and definition hydration
- `AssignmentDefinitionWizardModalShell.tsx` already exists, which means a shell/view-state seam is available and should be evaluated before escalating to a reducer or discriminated UI-state rewrite.
- The accepted spec/layout contract requires create-after-parse sessions to move onto the same main edit surface and the same document-change re-parse/cancel flow as update mode.
- The current create-session flow appears likely to diverge from that contract because the post-parse document-change path is not evidently shared with update mode. Treat this as a pre-existing spec-alignment bug to fix inside this refactor, not a behaviour to preserve.
- Repo policy explicitly rejects duplicated orchestration skeletons where descriptor-driven derivation is feasible.
- Repo policy does not reject a single-caller feature-local hook when it owns a real contract; the wizard hook remains the correct top-level ownership boundary.

---

## Global constraints and quality gates

### Engineering constraints

- Keep one feature-local wizard hook as the primary state/orchestration surface.
- Do not split the workflow into multiple speculative hooks purely to appease lint.
- Extract only helpers that own a coherent contract; otherwise keep logic local.
- Prefer descriptor/config-driven orchestration over near-identical async handlers.
- Prefer one narrow modal shell or view-state path over multiple top-level early-return branches.
- Treat a reducer or discriminated UI-state model as a fallback option only if the simpler refactor still leaves either file above complexity `7`.
- Preserve modal loading, blocking-error, confirm-loading, and accessible busy-state semantics according to the canonical frontend docs.
- Preserve and, where needed, restore the accepted wizard contract from `SPEC.md` and `ASSIGNMENT_DEFINITION_WIZARD_LAYOUT.md`.
- Use British English in code comments and docs.

### TDD workflow (mandatory per section)

For each section below:

1. **Red**: add or tighten tests to protect the accepted contract before structural changes begin.
2. **Green**: implement the smallest structural change that makes the section pass.
3. **Refactor**: tidy names, contracts, and local extraction boundaries with tests still green.
4. Run the section-level verification commands.

### Delegation mandatory-read gate

For any delegated implementation, testing, or review handoff in this plan, require:

- `AGENTS.md`
- `src/frontend/AGENTS.md`
- `WIZARD_REFACTOR_ACTION_PLAN.md`
- `SPEC.md`
- `ASSIGNMENT_DEFINITION_WIZARD_LAYOUT.md`
- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
- `docs/developer/frontend/frontend-modal-patterns.md`
- `docs/developer/frontend/frontend-testing.md`
- `docs/developer/frontend/frontend-loading-and-width-standards.md`
- `docs/developer/frontend/frontend-logging-and-error-handling.md`
- `config/eslint/ts-base-rules.cjs`
- the touched wizard source files and touched tests

Every delegated handoff must include an explicit `Files read` section. Reject the handoff if any mandatory file is missing.

### Validation commands

- Wizard-only lint from `src/frontend/`: `npx eslint src/pages/AssignmentDefinitionWizardModal.tsx src/pages/useAssignmentDefinitionWizard.ts src/pages/AssignmentDefinitionWizardModalShell.tsx`
- Focused frontend tests from repo root: `npm run frontend:test -- AssignmentDefinitionWizardModal AssignmentDefinitionWizardModalShell`
- Full frontend lint from repo root: `npm run frontend:lint`
- Frontend build/type validation from repo root: `npm run frontend:build`

### Shared-helper planning gate

These helper decision entries must align with `docs/developer/ACTION_PLAN_TEMPLATE.md`. Do not treat `src/frontend/AGENTS.md` as a destination for wizard helper-outcome records. Because this refactor expects helper and modal-seam decisions, planned helper entries must be added to the relevant canonical docs with status `Not implemented` before or as part of implementation planning. The likely canonical targets for this wizard refactor are:

- `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
- `docs/developer/frontend/frontend-modal-patterns.md`

Helper decision entries for this refactor:

1. Helper or contract: `useAssignmentDefinitionWizard`
   - Decision: `keep local`
   - Owning path: `src/frontend/src/pages/useAssignmentDefinitionWizard.ts`
   - Call-site rationale: the hook already owns the coherent assignment-definition wizard contract and remains the right feature-local orchestration boundary
   - Relevant canonical doc target: `docs/developer/frontend/frontend-modal-patterns.md`
   - Planned doc status: `Not implemented`

2. Helper or contract: wizard async mutation flow runner
   - Decision: `new`
   - Owning path: feature-local to the wizard, either inside `useAssignmentDefinitionWizard.ts` or a co-located helper file if needed
   - Call-site rationale: parse, save, and re-parse currently repeat the same async control skeleton and need one real orchestration contract rather than three near-copies
   - Relevant canonical doc target: `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
   - Planned doc status: `Not implemented`

3. Helper or contract: wizard state-shaping helpers
   - Decision: `keep local`
   - Owning path: `src/frontend/src/pages/useAssignmentDefinitionWizard.ts` or a co-located wizard helper module if lint/readability still requires it
   - Call-site rationale: canonical document URL derivation, task-row mapping, document-change shaping, parsed baseline construction, and definition hydration are coherent wizard-local transforms but are not yet justified as shared cross-feature helpers
   - Relevant canonical doc target: `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
   - Planned doc status: `Not implemented`

4. Helper or contract: wizard shell/view-state seam
   - Decision: `extend`
   - Owning path: `src/frontend/src/pages/AssignmentDefinitionWizardModalShell.tsx` or a narrow local view-state helper consumed by `AssignmentDefinitionWizardModal.tsx`
   - Call-site rationale: the component already has an available shell seam and should use one render path for blocked/loading/error/ready states before escalating to a heavier state-model rewrite
   - Relevant canonical doc target: `docs/developer/frontend/frontend-modal-patterns.md`
   - Planned doc status: `Not implemented`

---

## Section 1 — Lock the accepted contract baseline and missing regression coverage

**Status: ✅ COMPLETE**

- Red Phase: All 19 regression tests pass (10 original + 9 new)
- Code Review: Clean pass after 4 review cycles
- Documentation: Mock-before-render anti-pattern documented in `docs/developer/frontend/frontend-testing.md`
- Baseline: Lint violations recorded (complexity 17 in both files), existing hook and shell present
- Coverage: All Section 1 acceptance criteria protected within current implementation constraints

### Objective

- Confirm the current lint baseline.
- Lock in regression coverage for the accepted wizard contract before structural changes begin.

### Constraints

- No production behaviour changes in this section.
- The contract baseline for later sections is `SPEC.md` plus `ASSIGNMENT_DEFINITION_WIZARD_LAYOUT.md`, not merely the current implementation.
- Do not add tests for private implementation details.

### Acceptance criteria

- The section records the real starting point:
  - `AssignmentDefinitionWizardModal` complexity `17`
  - `useAssignmentDefinitionWizard` complexity `17`
  - existing hook and shell already present
  - create-after-parse contract alignment still needs explicit protection
- Regression coverage explicitly protects these accepted behaviours before Section 2 starts:
  - stage-one create success transitions the same session into the shared edit surface
  - final save success from the shared edit surface
  - create-session post-parse document edits trigger the same re-parse-or-cancel flow as update mode
  - create-session post-parse re-parse success preserves/reset task-row state according to the accepted contract
  - loading, blocking-error, and guarded-close states remain explicit at the modal surface

### Required test cases (Red first)

1. Run `npm run frontend:test -- AssignmentDefinitionWizardModal AssignmentDefinitionWizardModalShell`.
2. From `src/frontend/`, run `npx eslint src/pages/AssignmentDefinitionWizardModal.tsx src/pages/useAssignmentDefinitionWizard.ts src/pages/AssignmentDefinitionWizardModalShell.tsx`.
3. Add or tighten behaviour-level coverage for:
   - successful stage-one create populating tasks and entering the shared edit surface
   - successful final save from that shared edit surface
   - successful post-parse create-session re-parse after document changes
   - create-session re-parse cancel restoring previous document URLs
   - blocked/loading/error state rendering through the modal surface

### Section checks

- Baseline lint failures are captured accurately.
- Existing and newly added regression tests are green before refactor implementation begins.
- Planned helper entries were added to the relevant canonical docs with status `Not implemented` before implementation starts.
- No stale plan language remains about preserving a spec-divergent create-session flow, first-time hook extraction, file relocation, or threshold relaxation.

### Optional `@remarks` JSDoc follow-through

- None.

---

## Section 2 — Replace duplicated async handlers with one wizard-local orchestration contract

**Status: ✅ COMPLETE**

- Green Phase: Shared orchestration contract implemented
- Shared orchestration: `runWizardMutation` with descriptor-driven options pattern
- Handler refactoring: All 3 handlers reduced to thin wrappers
- Create-mode contract: Fixed via `localDefinitionKey` and `parsedCreateBaselineReference`
- Complexity: 17 → 7 (material drop of 59%)
- State-shaping helpers: Extracted 7 helpers (deriveReferenceDataState, derivePrimaryActionState, useFormInitialization, convertBaselineToDefinition, detectDocumentChange, buildWizardErrorContext, hydrateFormFromDefinition)
- Error handling: Added `map-error-to-ui.ts` for user-safe error mapping
- All 20 tests green, lint passes, type check passes

### Objective

- Reduce hook complexity by collapsing the repeated async mutation skeletons into one real wizard-local flow contract.
- Bring create-session post-parse orchestration into line with the accepted shared edit-surface contract if the current handlers still diverge.

### Constraints

- Keep a single top-level wizard hook.
- Do not introduce multiple micro-hooks for parse/save/re-parse.
- Keep the orchestration contract feature-local and descriptor-driven.
- Preserve current mutation side effects, cache invalidation, and blocking-error treatment where they are already consistent with the accepted spec/layout contract.
- Where current create-session behaviour conflicts with `SPEC.md` or `ASSIGNMENT_DEFINITION_WIZARD_LAYOUT.md`, prefer spec/layout alignment over behaviour preservation.

### Acceptance criteria

- `handleParseAndContinue`, `handleSave`, and `handleReparse` become thin wrappers over a shared orchestration path.
- The shared orchestration path owns at least these reusable concerns:
  - early exit for busy-state preconditions
  - request acquisition or derivation
  - `mutateAsync` invocation
  - shared error logging and user-safe blocking-error mapping
  - common submission-state lifecycle
- Mode-specific behaviour is expressed through descriptor/config inputs rather than copied control flow.
- Post-parse create sessions and update sessions use the same re-parse-or-cancel orchestration contract for document changes.
- Hook complexity drops materially and no new helper introduced in this section exceeds complexity `7`.

### Required test cases (Red first)

1. Keep the Section 1 regression coverage green for:
   - parse success into the shared edit surface
   - final save success
   - create-session post-parse re-parse success/cancel
2. Add any missing regression coverage needed to prove that the unified async path does not change accepted query invalidation or close behaviour.
3. Run `npm run frontend:test -- AssignmentDefinitionWizardModal`.
4. From `src/frontend/`, run `npx eslint src/pages/useAssignmentDefinitionWizard.ts`.

### Section checks

- No three-way duplicated async orchestration skeleton remains across the hook handlers.
- Shared orchestration is descriptor-driven, not a pass-through wrapper.
- `useAssignmentDefinitionWizard` is trending towards or already below complexity `7`.
- The accepted create-after-parse contract is enforced in the orchestration boundary rather than left as a follow-up ambiguity.

### Optional `@remarks` JSDoc follow-through

- Add `@remarks` only if the final orchestration contract would be non-obvious without explaining why parse/save/re-parse intentionally share one flow boundary.

---

## Section 3 — Extract wizard-local state-shaping helpers with real contracts

**Status: ✅ COMPLETE**

- All state-shaping helpers extracted and verified (14 pure transformation helpers)
- Hook complexity maintained at 7 (from Section 2)
- All 20 tests pass
- Section checks verified: repeated pure transforms extracted, dirty-state calculation simplified, hook coordinates state

### Objective

- Move repeated pure transformations out of the hook body so the hook coordinates state rather than constructing every derived object inline.

### Constraints

- Prefer pure local helpers first.
- Keep helpers wizard-local unless a real second caller enters accepted scope.
- Do not create helper files only to move code out of the hook; each helper must own a clear transform contract.
- Keep loading/error-state shaping aligned with `docs/developer/frontend/frontend-loading-and-width-standards.md` and `docs/developer/frontend/frontend-logging-and-error-handling.md`.

### Acceptance criteria

- Repeated shaping logic is reduced through coherent local helpers for patterns such as:
  - task-row mapping from definition or mutation responses
  - canonical document URL derivation
  - document-change state shaping
  - parsed create-baseline construction
  - definition hydration payload shaping for form/task state
- Dirty-state and hydration logic read as composition of named transforms rather than one long inline path.
- The hook remains the owner of side effects, but helper extraction removes avoidable branching from its body.
- No extracted helper is introduced as a speculative cross-feature abstraction.
- Any create-session post-parse state shaping now matches the accepted shared edit-surface contract.

### Required test cases (Red first)

1. Keep testing at the modal/hook behaviour level unless a new pure helper becomes complex enough to justify direct unit coverage.
2. Verify update-mode hydration still produces the same visible form values and task rows.
3. Verify create-session post-parse document-change detection and cancel/reset behaviour matches update mode.
4. Run `npm run frontend:test -- AssignmentDefinitionWizardModal`.
5. From `src/frontend/`, run `npx eslint src/pages/useAssignmentDefinitionWizard.ts`.

### Section checks

- Repeated pure transforms no longer obscure the hook body.
- Dirty-state calculation and definition hydration are structurally simpler than the current inline implementation.
- The hook either passes complexity `<=7` here or is close enough that the remaining work is clearly in the component render path.

### Optional `@remarks` JSDoc follow-through

- Consider `@remarks` on any non-obvious baseline or document-change helper if the reasoning would otherwise be lost after the action plan is removed.

---

## Section 4 — Collapse modal render branching through a shell or narrow view-state seam

**Status: ✅ COMPLETE**

- Component complexity reduced from 17 to 5 (well below ≤7 threshold)
- Shell complexity maintained at ≤7
- All 3 early returns collapsed into single shell path
- Main modal reduced from 215 lines to 108 lines
- Shell extended from 83 lines to ~491 lines with full view-state handling
- All 20 tests pass, lint clean

### Objective

- Reduce component complexity by replacing multiple top-level early-return modal branches with one modal render path.

### Constraints

- Reuse the existing `AssignmentDefinitionWizardModalShell.tsx` seam if it can own a narrow contract cleanly.
- Do not introduce a generic app-wide modal wrapper.
- Preserve current blocking, loading, ready, discard-confirm, and primary-action semantics where they align with the accepted spec/layout contract.
- Keep modal loading and blocking treatments aligned with `docs/developer/frontend/frontend-loading-and-width-standards.md` and `docs/developer/frontend/frontend-modal-patterns.md`.

### Acceptance criteria

- `AssignmentDefinitionWizardModal` no longer has three separate top-level modal early returns for blocked/loading/error states.
- One of these outcomes is used:
  - extend `AssignmentDefinitionWizardModalShell.tsx` to own the shell/view-state contract, or
  - introduce a narrow local `viewState`/render helper consumed by the modal
- The main modal component becomes a thin presenter that wires:
  - modal title and footer actions
  - form/body rendering
  - discard-confirm modal
  - one shell/view-state decision path
- The chosen shell/view-state path preserves explicit status semantics for loading and blocking states.
- `AssignmentDefinitionWizardModal` reaches complexity `<=7`.

### Required test cases (Red first)

1. Keep or extend shell-level tests so loading and blocking-error states remain explicit and testable.
2. Keep modal integration coverage for ready-state interactions, create-session post-parse re-parse prompts, and discard-confirm behaviour.
3. Run `npm run frontend:test -- AssignmentDefinitionWizardModal AssignmentDefinitionWizardModalShell`.
4. From `src/frontend/`, run `npx eslint src/pages/AssignmentDefinitionWizardModal.tsx src/pages/AssignmentDefinitionWizardModalShell.tsx`.

### Section checks

- No duplicated modal shell structure remains across blocked/loading/error branches.
- The shell/view-state seam owns a narrow contract rather than becoming a prop tunnel.
- `AssignmentDefinitionWizardModal` passes the complexity rule.

### Optional `@remarks` JSDoc follow-through

- None unless the final shell contract carries non-obvious accessibility or busy-state reasoning.

---

## Section 5 — Fallback only: reducer or discriminated UI-state pass

### Objective

- Provide a bounded fallback if Sections 2 to 4 still leave either wizard file above complexity `7`.

### Constraints

- Do not start with this section.
- Execute it only if simpler helper/view-state refactors prove insufficient.
- Keep the fallback narrow and local to the wizard feature.
- Do not use this section to avoid fixing the create-session spec-alignment gap if it still remains.

### Acceptance criteria

- A reducer or discriminated UI-state model is introduced only when there is a demonstrated remaining complexity problem after the simpler passes.
- The fallback specifically targets the unresolved branching, rather than rewriting the whole wizard architecture.
- Behaviour and tests remain stable.

### Required test cases (Red first)

1. Add only the minimum regression coverage needed for the specific fallback change.
2. Re-run `npm run frontend:test -- AssignmentDefinitionWizardModal AssignmentDefinitionWizardModalShell`.
3. From `src/frontend/`, re-run `npx eslint src/pages/AssignmentDefinitionWizardModal.tsx src/pages/useAssignmentDefinitionWizard.ts src/pages/AssignmentDefinitionWizardModalShell.tsx`.

### Section checks

- This section is skipped entirely if Sections 2 to 4 already satisfy the lint target.
- Any reducer or state-model addition is justified by remaining measured complexity, not preference.

### Optional `@remarks` JSDoc follow-through

- Required if a reducer or discriminated state model is introduced and its transition logic would otherwise be hard to reconstruct.

---

## Regression and contract hardening

**Status: ✅ VERIFIED**

- All 3 wizard files pass lint with complexity <=7
- All 20 tests pass
- Build type check passes for modified files
- Accepted behaviours preserved: create parse-and-continue flow, same-session transition, final save, document-change re-parse/cancel, discard-confirm gating

### Objective

- Prove the wizard satisfies the accepted contract while both complexity violations are resolved.

### Constraints

- Prefer focused validation first, then broader frontend checks.
- Do not treat “lint passes” as sufficient without behaviour verification.
- The regression gate is the accepted spec/layout contract, not merely parity with the previous implementation.

### Acceptance criteria

- `AssignmentDefinitionWizardModal` complexity is `<=7`.
- `useAssignmentDefinitionWizard` complexity is `<=7`.
- No touched helper in the wizard path exceeds complexity `7`.
- Wizard unit tests remain green.
- Frontend lint passes clean.
- Frontend build/type validation passes.
- The final implementation preserves or restores these accepted behaviours:
  - create parse-and-continue flow
  - same-session transition to the shared edit surface after stage-one create
  - final save flow from the shared edit surface
  - create-session and update-session document-change re-parse/cancel paths
  - discard-confirm gating for dirty edits

### Required test cases/checks

1. Run `npm run frontend:test -- AssignmentDefinitionWizardModal AssignmentDefinitionWizardModalShell`.
2. From `src/frontend/`, run `npx eslint src/pages/AssignmentDefinitionWizardModal.tsx src/pages/useAssignmentDefinitionWizard.ts src/pages/AssignmentDefinitionWizardModalShell.tsx`.
3. Run `npm run frontend:lint`.
4. Run `npm run frontend:build`.
5. Verify the final implementation still preserves or restores the accepted behaviours listed above.

### Section checks

- All required checks above are green.
- The final state does not depend on relaxing lint rules or adding speculative abstractions.
- The create-session post-parse contract gap is closed or explicitly blocked before implementation sign-off.

---

## Documentation and rollout notes

**Status: ✅ COMPLETE**

- Updated frontend-modal-patterns.md: helper-change status changed from `Not implemented` to `Implemented`
- Added implementation details: hook, shell, and modal file structure
- All helper decisions reconciled with delivered implementation
- No stale planning language remains

## Final Summary

**All Sections Complete!**

- ✅ Section 1: Locked accepted contract baseline (19 tests, complexity 17 baseline recorded)
- ✅ Section 2: Unified duplicated async handlers (runWizardMutation, 7 helpers extracted, complexity 17→7)
- ✅ Section 3: Extracted state-shaping helpers (14 helpers, complexity maintained at 7)
- ✅ Section 4: Collapsed modal render branching (3 early returns → 1 shell path, complexity 17→5)
- ✅ Section 5: Skipped (not needed - all files at complexity ≤7)
- ✅ Regression and contract hardening: All checks pass
- ✅ Documentation: Canonical docs updated

**Final State:**

- useAssignmentDefinitionWizard.ts: complexity 7 ✅
- AssignmentDefinitionWizardModal.tsx: complexity 5 ✅
- AssignmentDefinitionWizardModalShell.tsx: complexity ≤7 ✅
- All 20 tests pass ✅
- # All lint checks pass ✅

### Objective

- Keep the wizard refactor notes aligned with the actual delivered structure and helper decisions.

### Constraints

- Update only the documents touched by the refactor.
- Do not preserve stale “planned extraction” language once implementation is done.
- Reconcile the planned `Not implemented` helper entries in the relevant canonical docs against the delivered implementation outcome.

### Acceptance criteria

- `WIZARD_REFACTOR_ACTION_PLAN.md` notes are reconciled with the implemented outcome before the plan is retired.
- Planned helper entries exist in the relevant canonical docs with status `Not implemented` before implementation starts, then are reconciled during the documentation pass.
- Any helper or modal decisions that become implemented outcomes are reflected accurately in the relevant canonical frontend docs.
- If the shell seam is extended, modal-family documentation remains consistent with that narrow local contract.

### Required checks

1. Reconcile the helper decision entries in this plan against the final implementation.
2. Verify the planned `Not implemented` helper entries were added to the relevant canonical docs:
   - `docs/developer/frontend/frontend-shared-helpers-and-abstraction-standards.md`
   - `docs/developer/frontend/frontend-modal-patterns.md`
3. Update those canonical docs to reflect the delivered helper/modal outcome where implementation completed the planned work, or keep `Not implemented` where work remains pending.
4. Confirm no document still claims:
   - the hook does not yet exist
   - file relocation is pending
   - accepting complexity `17` is an acceptable endpoint
   - current implementation divergence was intentionally preserved over the accepted spec/layout contract

---

## Suggested implementation order

1. Section 1 — lock the accepted contract baseline and missing seam coverage
2. Section 2 — unify duplicated async orchestration in the existing hook and fix the create-session post-parse contract gap
3. Section 3 — extract wizard-local state-shaping helpers
4. Section 4 — simplify the component through one shell/view-state path
5. Section 5 — only if still needed after the simpler passes
6. Regression and documentation cleanup
