# Code Review — Section 1 Backend Implementation

**Verdict: PASS** — All automated checks pass (lint: 0 new errors; tests: 1877/1877 green). The implementation correctly delivers the SPEC-mandated change to `AssignmentDefinition.toPartialJSON()` with no scope creep and full adherence to backend conventions.

---

## Summary of Changes Reviewed

**Production file:** `src/backend/Models/AssignmentDefinition.js` (4 surgical edits)

1. **`toPartialJSON()` (lines 330–350)** — Emits `tasks: Array<{id, taskWeighting}>` (empty array when no tasks) instead of `tasks: null`. Includes `@remarks` documenting the contract change per SPEC §1.

2. **`_validate()` routing (lines 132–139)** — Treats `null` **and** empty arrays as partial-definition markers, preserving the constructor-side partial/full distinction.

3. **Constructor tasks assignment (lines 109–113)** — Normalises empty arrays to internal `null` so partial definitions always store `tasks: null`.

4. **`fromJSON()` normalisation (line 381)** — Converts wire-format array tasks back to `null` because lightweight summaries cannot rehydrate to `TaskDefinition` instances.

**Test files updated (7 files, 22 assertions + 7 new tests):** All changes are precise reflections of the new wire shape — no behavioural drift, no test-only production code.

---

## Checklist Assessment

### Universal Principles ✅

- [x] No `console.*` calls anywhere
- [x] No empty `catch` blocks
- [x] British English in comments (`Serialises`, `normalise`, `behaviour`)
- [x] No speculative features — only the explicit `toPartialJSON` extension
- [x] No default values introduced outside constructor
- [x] Files well under 500 lines (407 lines)

### Backend-Specific ✅

- [x] **GAS-compatible JavaScript** — plain script style, no `import`/`require` in production logic
- [x] **Node export guard** — `if (typeof module !== 'undefined' && module.exports) { module.exports = { AssignmentDefinition }; }` at EOF
- [x] **Validation** — `_validatePartial()` / `_validateFull()` use `ProgressTracker.getInstance().logAndThrowError` with `devContext`; no `Validate.requireParams` needed on private methods
- [x] **Singletons** — `ProgressTracker.getInstance()` used correctly
- [x] **No defensive feature-detection guards** on known internals
- [x] **Serialisation contract** — `toJSON()` / `toPartialJSON()` / `fromJSON()` all present and consistent
- [x] **No new scopes/services** — `appsscript.json` unchanged (correct)

### Implementation Correctness ✅

| Scenario                      | `toPartialJSON()` emits | Constructor stores     | `fromJSON()` restores      | Round-trip                    |
| ----------------------------- | ----------------------- | ---------------------- | -------------------------- | ----------------------------- |
| `tasks: null`                 | `[]`                    | `null`                 | `null`                     | ✅                            |
| `tasks: undefined`            | `[]`                    | `null`                 | `null`                     | ✅                            |
| `tasks: {}`                   | `[]`                    | `null`                 | `null`                     | ✅                            |
| `tasks: {t1: TaskDefinition}` | `[{id, taskWeighting}]` | `{t1: TaskDefinition}` | `null` (wire array → null) | ✅ partial→full loss expected |

The `!this.tasks || Object.keys(this.tasks).length === 0` guard correctly covers all three "no tasks" cases (`null`, `undefined`, `{}`).

### Test Quality ✅

- **New tests in `assignmentDefinition.test.js` (section 10)** exercise every edge case: populated tasks, `null`, `{}`, `undefined`, extraneous-field exclusion, specific weightings (5, default 1).
- **Updated assertions** in validation/serialisation/controller tests change `tasks: null` → `tasks: []` and verify array shape — exactly what the wire contract requires.
- **No implementation-detail tests** — all assertions target public output (`toPartialJSON()`, `fromJSON()` round-trips).
- **`abclassController.rehydrateAssignment.test.js`** was already passing because its fixtures used `toJSON()` (full shape) not `toPartialJSON()` — correct isolation.

---

## Findings

### Critical

None.

### Improvement

None — the implementation is minimal, correct, and fully tested.

### Nitpick

None — code style, naming, and comments are consistent with the existing codebase.

---

## Files Read for This Review

- `AGENTS.md` (root)
- `SPEC.md`
- `src/backend/AGENTS.md`
- `src/backend/Models/AssignmentDefinition.js`
- `tests/models/assignmentDefinition.test.js`
- `tests/assignment/assignmentDefinitionValidation.test.js`
- `tests/assignment/assignmentSerialisation.test.js`
- `tests/controllers/abclassController.readClass.test.js`
- `tests/controllers/assignmentDefinitionController.test.js`
- `tests/controllers/assignmentDefinitionController.upsert.test.js`
- `tests/controllers/abclassController.rehydrateAssignment.test.js`

---

## Conclusion

The Section 1 backend implementation is **complete and correct**. It satisfies the SPEC requirement to extend `AssignmentDefinition.toPartialJSON()` with lightweight task-weighting summaries, handles all null/undefined/empty/array edge cases, preserves the internal partial/full distinction, and normalises wire-format arrays back to `null` on deserialisation. All 1877 backend tests pass with zero regressions. Ready for merge.
