# Schema Validation Alignment Report

**Date**: 2026-05-18  
**Issue**: Frontend/Backend validation inconsistency causing `createdAt must be null or an ISO datetime string` and Zod type errors  
**Branch**: fix/VariousAssignmentCreationErrors  
**Status**: Awaiting Implementation Phase

---

## 📋 Executive Summary

The frontend has **inconsistent validation schemas** that cause validation errors when communicating with the backend. Testing infrastructure is **complete and verified** (65 tests passing). Production code changes are **pending implementation**.

---

## ✅ COMPLETED WORK

### 1. Problem Analysis

**Identified two critical inconsistencies** between frontend schema files:

| Issue                               | `assignmentDefinition.zod.ts`             | `assignmentDefinitionPartials.zod.ts` | Backend       |
| ----------------------------------- | ----------------------------------------- | ------------------------------------- | ------------- |
| **Timestamp validation**            | Loose: `!Number.isNaN(Date.parse(value))` | Strict: regex pattern                 | Strict regex  |
| **assignmentWeighting nullability** | Non-nullable `z.number()`                 | Nullable `z.number().nullable()`      | Allows `null` |

**Backend contract** requires timestamps matching:

```
/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d{3})(Z|([+-])(\d{2}):(\d{2}))$/u
```

**Example valid**: `2026-05-18T13:50:35.105Z`  
**Example invalid**: `2026-05-18T13:50:35Z` (missing milliseconds)

**Impact**: Data passing frontend validation can fail backend validation, causing:

- `createdAt must be null or an ISO datetime string` (backend error)
- ZodError with path `["assignmentWeighting"]`, code `"invalid_type"` (frontend error)

---

### 2. Testing Specialist — Initial Pass

**Task**: Verify test coverage for backend contract consistency.

**Agent**: Testing Specialist

**Deliverables**:

- `src/frontend/src/services/assignmentDefinition.zod.spec.ts`: 109 → 245 lines (+136)
- `src/frontend/src/services/assignmentDefinitionPartials.zod.spec.ts`: 252 → 402 lines (+150)

**Key test additions**:

- Backend contract consistency tests for timestamps
  - Valid strict patterns (accepted by both schemas)
  - Loose patterns accepted by Date.parse but NOT by backend strict pattern
- Backend contract consistency tests for assignmentWeighting
  - Null acceptance documented as inconsistency
- Edge case coverage for timezone offsets, date formats, nullability

**Result**: ✅ All tests pass. Inconsistencies explicitly documented in test suite.

---

### 3. Code Reviewer — Test Review

**Task**: Review test changes and schema validation.

**Agent**: Code Reviewer

**Verdict**: **Pass with Minor Improvements**

**Confirmation**:

- ✅ Tests correctly identify backend contract requirements
- ✅ Tests properly document current inconsistencies
- ✅ All test assertions are accurate
- ✅ Test cases cover edge cases

**Findings** (3 improvements, 0 critical):

1. Missing test: `tasks` field strict null requirement in partials schema
2. Missing edge cases: Maximum timezone offsets (±23:59, ±24:00)
3. Missing test: assignmentWeighting range validation in AssignmentDefinitionSchema

---

### 4. Testing Specialist — Follow-up Pass

**Task**: Add missing test cases identified by Code Reviewer.

**Agent**: Testing Specialist

**Deliverables**:

- `assignmentDefinitionPartials.zod.spec.ts`: Added 3 new test blocks
  - `tasks` field strict null requirement (3 tests: null, array, undefined)
  - Timezone offset edge cases (4 tests: ±23:59 valid, ±24:00 invalid)
- `assignmentDefinition.zod.spec.ts`: Added 1 new test block
  - assignmentWeighting range validation for AssignmentDefinitionSchema (2 tests: < 0, > 10)

**Test Results**:

| File                                     | Tests  | Pass   | Fail  | Warnings |
| ---------------------------------------- | ------ | ------ | ----- | -------- |
| assignmentDefinitionPartials.zod.spec.ts | 44     | 44     | 0     | 0        |
| assignmentDefinition.zod.spec.ts         | 21     | 21     | 0     | 0        |
| **Total**                                | **65** | **65** | **0** | **0**    |

**Lint**: ✅ Zero errors, zero warnings on both files.

---

---

## ⏳ REMAINING WORK

---

### 5. Implementation — Schema Alignment (PENDING)

**Task**: Update `src/frontend/src/services/assignmentDefinition.zod.ts` to align with backend contract.

**Agent**: Implementation (awaiting delegation)

**Required changes**:

1. **Import and use strict timestamp schema**:
   - Replace `NullableIsoTimestampSchema` (loose) with strict validation matching backend pattern
   - Options:
     - Reuse `IsoDateTimeWithTimezoneSchema` from `assignmentDefinitionPartials.zod.ts`
     - Recreate the strict pattern inline in `assignmentDefinition.zod.ts`

2. **Make assignmentWeighting nullable**:
   - Change `assignmentWeighting: WeightingSchema` → `assignmentWeighting: WeightingSchema.nullable()`
   - Update in both:
     - `AssignmentDefinitionSchema` (response schema)
     - `UpsertAssignmentDefinitionRequestSchema` (request schema)

3. **Ensure consistency**:
   - Both schemas should accept the same data formats as backend
   - Nullability should match backend model (`null` allowed)
   - Timestamp format should match backend regex pattern

**Files to modify**:

- `src/frontend/src/services/assignmentDefinition.zod.ts` (primary)

**Dependencies**: None (can reuse validation functions from partials or inline the strict pattern)

**Expected changes**:

```typescript
// Before
const NullableIsoTimestampSchema = TrimmedNonEmptyStringSchema.refine((value) => {
  return !Number.isNaN(Date.parse(value));
}).nullable();

assignmentWeighting: WeightingSchema,

// After
// Use strict pattern matching backend: YYYY-MM-DDTHH:mm:ss.SSSZ or YYYY-MM-DDTHH:mm:ss.SSS±HH:MM
const IsoDateTimeWithTimezoneSchema = z.string().refine(isIsoDateTimeWithTimezone, {
  message: 'Expected an ISO datetime string with timezone info.',
});
const NullableIsoDateTimeWithTimezoneSchema = IsoDateTimeWithTimezoneSchema.nullable();

assignmentWeighting: WeightingSchema.nullable(),
```

---

### 6. Code Reviewer — Final Review (PENDING)

**Task**: Review implementation changes for:

- Schema consistency with backend contract
- Type safety and Zod schema correctness
- No regressions in existing functionality

**Agent**: Code Reviewer (awaiting delegation)

**Deliverables**:

- Findings report
- Pass/fail verdict
- Confirmation that all 65+ tests still pass

---

### 7. Verification (PENDING)

**Task**: Run full test suite to confirm no regressions.

**Commands to run**:

```bash
cd /workspaces/AssessmentBot/src/frontend
npm test
npm run lint:frontend
```

**Acceptance criteria**:

- ✅ All existing tests continue to pass
- ✅ New schema validation tests pass
- ✅ No lint errors
- ✅ No type errors

---

### 8. Commit and Push (PENDING)

**Task**: Commit changes with descriptive message, push to branch.

**Expected commit message**:

```
fix: align frontend schema validation with backend contract

- Use strict ISO datetime validation matching backend regex pattern
- Make assignmentWeighting nullable to match backend model
- Ensure schema consistency between assignmentDefinition and partials

Generated by Mistral Vibe.
Co-Authored-By: Mistral Vibe <vibe@mistral.ai>
```

---

---

## 📊 Progress Tracking

| Phase              | Agent              | Status         | Files Changed     | Tests     | Outcome                      |
| ------------------ | ------------------ | -------------- | ----------------- | --------- | ---------------------------- |
| Problem Analysis   | Orchestrator       | ✅ Complete    | -                 | -         | Inconsistencies identified   |
| Test Coverage      | Testing Specialist | ✅ Complete    | 2 spec files      | +34 tests | All pass                     |
| Test Review        | Code Reviewer      | ✅ Complete    | -                 | -         | Pass with minor improvements |
| Test Follow-up     | Testing Specialist | ✅ Complete    | 2 spec files      | +9 tests  | All pass                     |
| **Implementation** | **Implementation** | **⏳ Pending** | **1 schema file** | **-**     | **-**                        |
| Final Review       | Code Reviewer      | ⏳ Pending     | -                 | -         | -                            |
| Verification       | Orchestrator       | ⏳ Pending     | -                 | -         | -                            |
| Commit/Push        | Orchestrator       | ⏳ Pending     | -                 | -         | -                            |

---

## 🎯 Next Steps

**Ready for**: Delegation to **Implementation** agent to update `assignmentDefinition.zod.ts`

**Blocked by**: None

**Estimated remaining effort**: ~1-2 hours (schema update + review + verification)

---

## 📚 Related Files

### Source Files (to be modified)

- `src/frontend/src/services/assignmentDefinition.zod.ts`

### Test Files (already updated)

- `src/frontend/src/services/assignmentDefinition.zod.spec.ts`
- `src/frontend/src/services/assignmentDefinitionPartials.zod.spec.ts`

### Backend Reference

- `src/backend/z_Api/assignmentDefinitionPartials.js` (ISO_DATE_TIME_PATTERN at line 22)
- `src/backend/Models/AssignmentDefinition.js` (assignmentWeighting handling at lines 25-67)

---

## 🔍 Original Error Details

See user's initial report for full error stack traces. Key errors:

1. **Zod validation error** (frontend):

   ```
   path: ["assignmentWeighting"]
   expected: "number"
   code: "invalid_type"
   message: "Invalid input"
   ```

2. **Backend validation error**:
   ```
   createdAt must be null or an ISO datetime string.
   ```

---

**Document generated**: 2026-05-18  
**Status**: Work in progress - Implementation phase pending
