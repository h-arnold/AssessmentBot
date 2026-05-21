# ADR-001: Adopt yearGroupKey-only with Controller-Resolution Pattern

## Status

✅ **Accepted** - Implemented in SPEC.md v1.9.0 and ACTION_PLAN.md

## Context

The assignment definition creation path contained significant technical debt:

1. **Duplication**: Two creation methods (`ensureDefinition` and `upsertDefinition`) with overlapping responsibilities
2. **Ambiguity**: Both `yearGroup` (numeric) and `yearGroupKey` (string) were used interchangeably in active code
3. **Misplaced Responsibilities**: Value defaulting occurred in multiple layers (API, controller, model) violating separation of concerns
4. **Hidden Failures**: Deprecated parameters were silently accepted, masking migration gaps

### Selected Approach

1. **Single Canonical Reference**: `yearGroupKey` (string) is the ONLY year-group reference in active code
2. **Controller-Resolution Pattern**: Controllers accept `yearGroupKey: string | null` and resolve to non-null before model calls
3. **Model Boundary Contract**: Model constructor and `fromJSON()` receive non-null `yearGroupKey` (string) only
4. **Fail-Fast Validation**: Model throws `TypeError` when deprecated `yearGroup` is present, surfacing missed migration entries
5. **Single Creation Method**: `upsertDefinition` is the sole creation/update entry point; `ensureDefinition` removed
6. **Model-Owned Defaults**: All value defaulting (e.g., `assignmentWeighting` → 1) moved to model constructor
7. **Validation Ownership**: Clear separation per §0.2:
   - Transport validation → API layer
   - Domain validation → Controller
   - Data defaults/integrity → Model

### Key Changes

| Component                     | Before                                          | After                                           |
| ----------------------------- | ----------------------------------------------- | ----------------------------------------------- |
| Year Group Field              | `yearGroup` (number) OR `yearGroupKey` (string) | `yearGroupKey` (string) ONLY                    |
| Creation Method               | `ensureDefinition` OR `upsertDefinition`        | `upsertDefinition` ONLY                         |
| `yearGroupLabel`              | Model-resolved or undefined                     | Controller-resolved, model accepts as parameter |
| `assignmentWeighting` Default | Applied in API layer or controller              | Applied in model constructor (defaults to 1)    |
| Validation                    | Mixed across layers                             | Clear ownership boundaries                      |
| Deprecated Field Handling     | Silently ignored                                | Throws TypeError at model boundary              |

## Consequences

### Positive

1. **Eliminates Ambiguity**: Single source of truth for year-group references
2. **Enforces Standards**: Clear validation ownership prevents future violations
3. **Fail-Fast**: Migration gaps surface immediately as errors, not silent data corruption
4. **Simplified Architecture**: Single creation path reduces maintenance burden
5. **Model Integrity**: Model owns its data defaults and integrity checks
6. **Testability**: Clear contracts make testing more straightforward

### Negative

1. **Breaking Change**: Existing stored definitions with `yearGroup` fields become inaccessible
   - **Mitigation**: No legacy data to preserve; existing definitions must be re-created through new flow
2. **No Backwards Compatibility**: Legacy code using `yearGroup` will break
   - **Mitigation**: Explicit per SPEC.md; deprecated code in `src/AdminSheet` and legacy `globals.js` intentionally excluded
3. **Definition Key Format Change**: Old keys (e.g., `Math_Algebra_10`) won't match new keys (e.g., `Math_Algebra_year-group-10`)
   - **Mitigation**: Acceptable as part of architectural cleanup

### Neutral

1. **Migration Required**: All active code paths must be updated to use `yearGroupKey`
2. **Test Updates**: Tests for removed functionality must be deleted; tests for changed functionality must be updated

## Alternatives Considered

### Option A: Dual-Field Support with Runtime Conversion

- **Pros**: Backwards compatible, gradual migration possible
- **Cons**: Perpetuates ambiguity, adds complexity, violates fail-fast principle, requires ongoing dual-path maintenance
- **Rejected**: Does not address root causes of the technical debt

### Option C: Flatten to Model Getters/Setters

- **Pros**: Pure OOP approach
- **Cons**: Over-engineering, requires extensive refactoring beyond scope, not aligned with existing codebase patterns
- **Rejected**: Out of scope for this refactoring effort

## Rationale

This approach was selected because it:

1. **Addresses Root Causes**: Directly eliminates the ambiguity between `yearGroup` and `yearGroupKey`
2. **Enforces Standards**: Implements the validation ownership rules from `src/backend/AGENTS.md` §0.2
3. **Fail-Fast Principle**: Makes deprecated usage immediately visible, preventing hidden bugs
4. **Architectural Consistency**: Aligns with existing patterns (controller-resolution for reference data)
5. **Maintainability**: Reduces code paths and simplifies the mental model for developers
6. **Test Coverage**: Easier to test with clear, single-responsibility components

## Implementation References

- **SPEC.md v1.9.0**: Full specification of architectural decision
- **ACTION_PLAN.md**: Complete delivery plan with TDD-first approach
- **CODE_REVIEW.md**: Comprehensive review documenting 100% compliance
- **Commit Range**: Multiple commits implementing Sections 0-5

## Related Documents

- `src/backend/AGENTS.md` §0.2 - Validation ownership rules
- `docs/developer/backend/api-layer.md` - Shared helper status
- `docs/developer/backend/backend-testing.md` - Testing standards

## Decision Date

2025-05-19 (SPEC.md v1.9.0)

## Supersedes

None - This is the first ADR in the decisions series.

---

_Generated by Mistral Vibe_
_Co-Authored-By: Mistral Vibe <vibe@mistral.ai>_
