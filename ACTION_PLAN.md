# ACTION PLAN: Regression Checker Review Findings

## Scope

Address only the findings recorded in:

- `/home/developer/AssessmentBot/CODE_REVIEW.md`
- `/home/developer/AssessmentBot/SLOP_REVIEW.md`

Out of scope:

- New feature work
- Behavioural changes beyond the identified findings
- Broad refactors outside `scripts/builder/src/regression-checker/**`

## Delivery Strategy

- Prioritise High and Medium findings first.
- Bundle Low findings into a final clean-up phase.
- Keep changes minimal, localised, and backwards compatible.
- Validate each phase before progressing.

## LOC Baseline and Hard Reduction Gate (Mandatory)

Baseline captured on 2026-05-13 for `scripts/builder/src/regression-checker/**`:

- Production TypeScript (`*.ts` excluding `*.spec.ts`): **4,138 LOC**
- Full TypeScript tree (`*.ts` including specs): **8,680 LOC**

Hard success gate for this refactor:

- Final production LOC must be **strictly less than 4,138** (net reduction required).
- Refactor is not complete unless this LOC gate passes alongside functional quality gates.

Validation command for LOC gate:

- `find scripts/builder/src/regression-checker -type f -name '*.ts' ! -name '*.spec.ts' | sort | xargs wc -l`

## Delegation Protocol (Mandatory)

- Each delegated phase handoff must include `Files read` evidence covering:
  - `/home/developer/AssessmentBot/AGENTS.md`
  - `/home/developer/AssessmentBot/scripts/builder/AGENTS.md`
  - `/home/developer/AssessmentBot/CODE_REVIEW.md`
  - `/home/developer/AssessmentBot/SLOP_REVIEW.md`
  - Phase-specific source files listed below
- Enforce a hard evidence gate: if any mandatory file is missing from a delegate `Files read` section, return the work to the same sub-agent and block progression.
- Mandatory per-phase source files:
  - Phase 1: `scripts/builder/src/regression-checker/config/validate-regression-config.ts`
  - Phase 2: `scripts/builder/src/regression-checker/run-regression-checker.ts`, `scripts/builder/src/regression-checker/config/validate-regression-config.ts`, shared helper target under `scripts/builder/src/lib/**`
  - Phase 3: `scripts/builder/src/regression-checker/config/validate-regression-config.ts`
  - Phase 4: `scripts/builder/src/regression-checker/run-regression-checker.ts`, `scripts/builder/src/regression-checker/config/validate-regression-config.ts`

## Phase 1: Consolidate Duplicated Script Safety Validation (High/Medium)

### Objective

Remove duplicated mutating/chained npm-script validation logic in `validate-regression-config.ts` while preserving current behaviour and error wording.

### Target Files

- `scripts/builder/src/regression-checker/config/validate-regression-config.ts`

### Tasks

1. Extract a single helper for npm script safety checks (mutating command + chained command).
2. Replace duplicated checks in:
   - `validateNpmScriptCheck(...)`
   - `resolveToolFamiliesFromScript(...)`
3. Preserve existing error messages unless a review finding explicitly requires adjustment.
4. Add/adjust unit tests only as needed to verify no behavioural regression.

### Acceptance Criteria

- Only one canonical implementation of script safety checks remains in this module.
- Existing rejection behaviour for mutating and chained scripts remains unchanged.
- All existing related builder tests remain green.

### Validation Commands

- `npm run test:builder -- scripts/builder/src/regression-checker/config/validate-regression-config.spec.ts`
- `npm run test:builder -- scripts/builder/src/regression-checker/section1-cli-contract.spec.ts`
- `npm run lint:builder`

### Risk Notes

- Recursive script resolution may depend on current check ordering.
- Mitigation: retain call order and assert existing failing-case messages in tests.

---

## Phase 2: Unify Path Safety Logic Across Modules (High/Medium)

### Objective

Remove duplicated cross-platform absolute path and traversal safety logic between `run-regression-checker.ts` and `validate-regression-config.ts`.

### Target Files

- `scripts/builder/src/regression-checker/run-regression-checker.ts`
- `scripts/builder/src/regression-checker/config/validate-regression-config.ts`
- `scripts/builder/src/lib/fs.ts` (or a dedicated path-safety helper module if cleaner)

### Tasks

1. Introduce one shared canonical helper for cross-platform absolute path detection.
2. Introduce or reuse one shared canonical helper for relative path traversal normalisation/safety.
3. Replace parallel implementations in both regression-checker modules with shared helper calls.
4. Simplify `validateRepoRelativePath(...)` responsibilities so path normalisation/safety concerns are composed from shared helpers rather than re-implemented inline.
5. Keep external behaviour deterministic and error reporting actionable.

### Acceptance Criteria

- No duplicate absolute-path prefix logic remains across the two regression-checker modules.
- No duplicate traversal validation implementation remains across the two modules.
- `validateRepoRelativePath(...)` is reduced to clear orchestration/composition responsibilities rather than owning multiple low-level path-safety implementations.
- Path traversal protections proven by existing security-focused tests.

### Validation Commands

- `npm run test:builder -- scripts/builder/src/regression-checker/section1-cli-contract.spec.ts`
- `npm run test:builder -- scripts/builder/src/regression-checker/run-regression-checker.spec.ts`
- `npm run lint:builder`

### Risk Notes

- Small helper contract changes can alter edge-case handling (e.g., `..` normalisation).
- Mitigation: run security/path tests first and compare baseline error outputs.

---

## Phase 3: Resolve Medium Consistency Gap in Nested npm Script Handling (Medium)

### Objective

Address asymmetric handling of missing nested npm scripts (silent skip vs explicit direct-script failure) in `validate-regression-config.ts`.

### Target Files

- `scripts/builder/src/regression-checker/config/validate-regression-config.ts`

### Tasks

1. Confirm intended behaviour for unresolved nested scripts discovered by regex extraction.
2. Implement one of the following (minimal-impact first):
   - Add explicit explanatory inline comment documenting intentional skip behaviour; or
   - Switch to explicit fail-fast error if product decision requires strict enforcement.
3. Add/adjust tests to lock intended behaviour.

### Acceptance Criteria

- Behaviour is explicit and documented in code.
- Tests clearly assert the intended handling path for missing nested scripts.
- No ambiguity remains for future maintainers.

### Validation Commands

- `npm run test:builder -- scripts/builder/src/regression-checker/config/validate-regression-config.spec.ts`
- `npm run lint:builder`

### Risk Notes

- Changing from skip to fail-fast may break existing configs.
- Mitigation: default to comment-only clarification unless explicit decision is made to tighten behaviour.

---

## Phase 4: Low-Priority Clean-up and Type-Safety Tightening (Low, Bundled)

### Objective

Apply low-risk clean-ups from both reviews without changing runtime behaviour.

### Target Files

- `scripts/builder/src/regression-checker/run-regression-checker.ts`
- `scripts/builder/src/regression-checker/config/validate-regression-config.ts`

### Tasks

1. Replace unsafe error cast in ENOENT handling with a proper type guard.
2. Inline unnecessary trivial constants for quote trimming where they reduce clarity.
3. Review and inline/remove single-caller or minimal-value helpers only where clarity improves and tests stay unchanged.
4. Keep edits small and avoid opportunistic reformatting.

### Acceptance Criteria

- No unsafe cast remains for ENOENT branch handling.
- Low-priority clean-ups do not alter externally observable behaviour.
- Lint and tests remain green.

### Validation Commands

- `npm run test:builder -- scripts/builder/src/regression-checker/run-regression-checker.spec.ts`
- `npm run lint:builder`

### Risk Notes

- “Clean-up” edits can create accidental behavioural changes.
- Mitigation: keep each clean-up atomic and test immediately.

---

## Final Verification Gate

Run after all phases complete:

1. `npm run lint:builder`
2. `npm run test:builder`
3. `npm run regression-checker`

Success criteria:

- Lint passes.
- Builder tests pass.
- Regression checker verification passes in one of these valid modes:
  - Baseline mode: all checks pass (`Overall Status: GREEN`).
  - Compare mode: no regressions/new failures versus baseline (stable or improved outcome), with no new failures introduced by this plan's changes.
- LOC hard gate passes: production LOC in `scripts/builder/src/regression-checker/**` is strictly below baseline (4,138 LOC).

## Assumptions

1. Existing regression-checker behaviour should be preserved unless a finding explicitly requires behavioural change.
2. Shared helper extraction into `scripts/builder/src/lib/**` is acceptable under current builder conventions.

## Open Questions

1. For missing nested npm scripts discovered via regex extraction, do we want strict fail-fast enforcement or documented permissive skip behaviour?
2. Should path-safety helpers live in existing `scripts/builder/src/lib/fs.ts` or a dedicated `path-safety` module for clearer ownership?

## Files Read

- `/home/developer/AssessmentBot/ACTION_PLAN.md`
- `/home/developer/AssessmentBot/AGENTS.md`
- `/home/developer/AssessmentBot/scripts/builder/AGENTS.md`
- `/home/developer/AssessmentBot/src/frontend/AGENTS.md`
- `/home/developer/AssessmentBot/CODE_REVIEW.md`
- `/home/developer/AssessmentBot/SLOP_REVIEW.md`
