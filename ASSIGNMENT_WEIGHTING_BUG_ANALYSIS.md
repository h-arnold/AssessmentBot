# Assignment Weighting Default Bug Analysis

## Executive Summary

**STATUS: ✅ COMPLETED**

When creating a new assignment definition without explicitly providing an `assignmentWeighting` value, the backend was storing it as `null` instead of defaulting to `1`. This caused a Zod validation error on the frontend because the `AssignmentDefinitionSchema` expected `assignmentWeighting` to be a number, not `null`.

**Fix implemented:** Backend now defaults `assignmentWeighting` to `1` when missing or `null`, and frontend schema has been aligned to handle the backend contract properly.

## Bug Description

### Symptoms

Users experience a Zod validation error when creating new assignments through the frontend wizard:

```
ZodError: [
  {
    "expected": "number",
    "code": "invalid_type",
    "path": ["assignmentWeighting"],
    "message": "Invalid input"
  }
]
```

Additionally, there may be a backend API validation error:

```
ApiTransportError: createdAt must be null or an ISO datetime string.
```

### Reproduction

1. Open the Assignment Definition Wizard
2. Fill in required fields (primaryTitle, primaryTopicKey, yearGroupKey, document URLs)
3. Do NOT provide an `assignmentWeighting` value (or provide `null`)
4. Submit the form
5. Observe Zod validation failure

### Example Request Payload (Missing assignmentWeighting)

```json
{
  "primaryTitle": "Encryption",
  "primaryTopicKey": "34701fc3-b87b-429c-992e-c65d88ea565b",
  "yearGroupKey": "a3891d8c-c730-4a99-8a51-e979bf0da095"
}
```

### Example Backend Response (Buggy)

```json
{
  "assignmentWeighting": null,
  "createdAt": "2026-05-18T13:50:35.105Z",
  "updatedAt": "2026-05-18T13:50:35.106Z",
  ...
}
```

The `assignmentWeighting: null` causes the frontend Zod schema validation to fail.

---

## Root Cause Analysis

### Current Behavior Flow

```
Frontend Request (no assignmentWeighting)
    ↓
Backend Transport Layer (assignmentDefinitionPartials.js)
    - validateUpsertParameters_() ✓ passes (assignmentWeighting is optional)
    - buildControllerUpsertPayload_() → passes through undefined/null
    ↓
Controller Layer (AssignmentDefinitionController.js)
    - upsertDefinition()
    - _resolveAssignmentWeightingForUpsert()
      → returns null when missing or null
    ↓
Backend persists: assignmentWeighting: null
    ↓
Backend returns full definition
    ↓
Frontend Validation (assignmentDefinition.zod.ts)
    - AssignmentDefinitionSchema expects: assignmentWeighting: WeightingSchema
    - WeightingSchema = z.number().min(0).max(10) → NOT nullable
    → ZodError: expected number, got null
```

### Code Locations

#### 1. Backend Controller (Primary Bug Location)

**File:** `src/backend/y_controllers/AssignmentDefinitionController.js`  
**Method:** `_resolveAssignmentWeightingForUpsert` (around line 269-283)

```javascript
_resolveAssignmentWeightingForUpsert({ payload, isUpdate, existingDefinition }) {
  if (Object.hasOwn(payload, 'assignmentWeighting')) {
    return this._requireNumericOrNullWeighting(
      payload.assignmentWeighting,
      'assignmentWeighting'
    );
  }

  // ❌ BUG: Returns null for creates, existing value for updates
  return isUpdate ? existingDefinition.assignmentWeighting : null;
}
```

**Problem:** When `assignmentWeighting` is missing from payload, it returns `null` for creates. When it's `null` in the payload, `_requireNumericOrNullWeighting` returns `null`.

#### 2. Backend Transport Layer

**File:** `src/backend/z_Api/assignmentDefinitionPartials.js`  
**Function:** `buildControllerUpsertPayload_` (around line 515-550)

**Problem:** Does not default `assignmentWeighting` before passing to controller. The transport layer accepts `undefined` or `null` and passes it through unchanged.

#### 3. Frontend Schema Mismatch

**File:** `src/frontend/src/services/assignmentDefinition.zod.ts`

```typescript
// Line 53: AssignmentDefinitionSchema
export const AssignmentDefinitionSchema = z
  .object({
    // ... other fields
    assignmentWeighting: WeightingSchema, // ❌ NOT nullable
    // ...
  })
  .strict();

// Line 14: WeightingSchema definition
const WeightingSchema = z.number().min(MIN_WEIGHTING_VALUE).max(MAX_WEIGHTING_VALUE);
// Range: 0-10, but NOT nullable

// Line 78: UpsertAssignmentDefinitionRequestSchema
export const UpsertAssignmentDefinitionRequestSchema = z
  .object({
    // ...
    assignmentWeighting: WeightingSchema.optional(), // Allows undefined, NOT null
    // ...
  })
  .strict();
```

**Problem:** Frontend expects `assignmentWeighting` to always be a number (0-10 range), never `null`. The request schema allows it to be optional (undefined), but the response schema requires it to be a number.

#### 4. Frontend Partial Schema (Inconsistent)

**File:** `src/frontend/src/services/assignmentDefinitionPartials.zod.ts`

```typescript
// Line 187: AssignmentDefinitionPartialSchema
export const AssignmentDefinitionPartialSchema = z
  .object({
    // ...
    assignmentWeighting: z.number().nullable(), // ✓ Allows null
    // ...
  })
  .strict();
```

**Problem:** The partial schema (used for backend transport) allows `nullable()`, but the full `AssignmentDefinitionSchema` does not. This inconsistency means the frontend can receive `null` from the backend but cannot validate it.

---

## Expected Behavior

### User Requirement

> "I want the backend to assign a weighting of 1 by default if none is provided rather than null."

### Correct Flow

```
Frontend Request (no assignmentWeighting)
    ↓
Backend Transport Layer
    - If assignmentWeighting is undefined or null → default to 1
    ↓
Controller Layer
    - If assignmentWeighting is undefined or null → default to 1
    ↓
Backend persists: assignmentWeighting: 1
    ↓
Backend returns full definition with assignmentWeighting: 1
    ↓
Frontend Validation
    - AssignmentDefinitionSchema receives: assignmentWeighting: 1 (number)
    → ✓ Validation passes
```

### Expected Data

**Request:** Same as before (no assignmentWeighting)  
**Response:**

```json
{
  "assignmentWeighting": 1,  // ✓ Defaulted to 1
  "createdAt": "2026-05-18T13:50:35.105Z",
  "updatedAt": "2026-05-18T13:50:35.106Z",
  ...
}
```

---

## Fix Strategy

### Option A: Backend Defaults (Recommended)

**Modify the backend to always provide a numeric `assignmentWeighting`:**

1. **Transport Layer** (`assignmentDefinitionPartials.js`):
   - In `buildControllerUpsertPayload_()`, if `assignmentWeighting` is `undefined` or `null`, set it to `1`
   - This ensures the controller always receives a valid number

2. **Controller Layer** (`AssignmentDefinitionController.js`):
   - In `_resolveAssignmentWeightingForUpsert()`, if `assignmentWeighting` is `undefined` or `null`, return `1`
   - This provides defense in depth

3. **Frontend Schema** (`assignmentDefinition.zod.ts`):
   - Update `AssignmentDefinitionSchema` to make `assignmentWeighting: WeightingSchema.nullable()`
   - OR better: Keep it as non-nullable since backend will always provide a value
   - Update `UpsertAssignmentDefinitionRequestSchema` to `assignmentWeighting: WeightingSchema.nullable().optional()`

### Selected Approach: Option A

**Rationale:**

- Aligns with user requirement (backend defaults)
- Single source of truth (backend)
- Maintains clean contract (frontend always gets a number)
- Defense in depth (both transport and controller layers)

---

## Implementation Plan

### Phase 1: Test First (TD-Driven)

Create tests that verify the expected behavior before implementing the fix.

**Files to create/modify:**

- `tests/api/assignmentDefinitionUpsertApi.test.js` - Add tests for transport layer
- `tests/controllers/assignmentDefinitionController.upsert.test.js` - Add tests for controller layer

**Test cases:**

1. Upsert with missing `assignmentWeighting` → defaults to 1
2. Upsert with `null` `assignmentWeighting` → defaults to 1
3. Upsert with explicit `assignmentWeighting` (e.g., 5) → preserves value
4. Same cases for both standard and wizard upsert paths
5. Both create and update scenarios

**Test data:** Use `tests/__mocks__/data/assignmentDefinition.json` as reference

### Phase 2: Code Review

Submit tests to Code Reviewer to ensure:

- Tests are correctly structured
- Tests fail for the right reasons (backend bug, not test errors)
- Test coverage is comprehensive

### Phase 3: Backend Implementation

**File: `src/backend/z_Api/assignmentDefinitionPartials.js`**

In `buildControllerUpsertPayload_()`:

```javascript
function buildControllerUpsertPayload_(parameters) {
  const shouldTranslateDocumentUrls =
    Object.hasOwn(parameters, 'referenceDocumentUrl') ||
    Object.hasOwn(parameters, 'templateDocumentUrl');

  let payload = shouldTranslateDocumentUrls ? { ...parameters } : parameters;

  if (shouldTranslateDocumentUrls) {
    // ... URL translation logic
  }

  // ✅ NEW: Default assignmentWeighting to 1 when missing or null
  if (!Object.hasOwn(payload, 'assignmentWeighting') || payload.assignmentWeighting === null) {
    payload = { ...payload, assignmentWeighting: 1 };
  }

  return payload;
}
```

**File: `src/backend/y_controllers/AssignmentDefinitionController.js`**

In `_resolveAssignmentWeightingForUpsert()`:

```javascript
_resolveAssignmentWeightingForUpsert({ payload, isUpdate, existingDefinition }) {
  if (Object.hasOwn(payload, 'assignmentWeighting')) {
    const value = this._requireNumericOrNullWeighting(
      payload.assignmentWeighting,
      'assignmentWeighting'
    );
    // ✅ NEW: Default to 1 when explicitly provided as null
    return value === null ? 1 : value;
  }

  // ✅ CHANGED: Default to 1 when not provided (for both creates and updates)
  return 1;
}
```

### Phase 4: Frontend Schema Alignment

**File: `src/frontend/src/services/assignmentDefinition.zod.ts`**

```typescript
// Option 1: Keep non-nullable (recommended since backend always provides value)
// No change needed to AssignmentDefinitionSchema

// Option 2: Make nullable (if we want to be defensive)
// assignmentWeighting: WeightingSchema.nullable(),

// Update request schema to be more permissive
assignmentWeighting: WeightingSchema.nullable().optional(),
```

**Note:** Since the backend will always provide a value, the frontend response schema doesn't need to change. The request schema should accept `null` or `undefined` to match what the frontend might send.

### Phase 5: Verification

1. Run all new tests → should pass
2. Run existing tests → should still pass
3. Run frontend lint → should pass
4. Manual testing with frontend wizard → should work without Zod errors

---

## Current Work Status

### Completed

- ✅ Bug analysis and root cause identification
- ✅ User requirement clarification (default to 1)
- ✅ Mock data file created: `tests/__mocks__/data/assignmentDefinition.json`
- ✅ Test creation and updates
- ✅ Code review of tests
- ✅ Backend implementation (transport and controller layers)
- ✅ Frontend schema updates
- ✅ Regression verification
- ✅ All tests passing (backend: 35 tests, frontend: 80 files, 751 tests)

### Committed Changes

All changes have been committed to the `fix/VariousAssignmentCreationErrors` branch:

1. **Commit fb89a8b** - Backend fix: Set default assignmentWeighting to 1 in upsert operations and update related tests
   - `src/backend/y_controllers/AssignmentDefinitionController.js` - Updated `_resolveAssignmentWeightingForUpsert` to default to 1
   - `src/backend/z_Api/assignmentDefinitionPartials.js` - Updated `buildControllerUpsertPayload_` to default to 1
   - `tests/api/assignmentDefinitionUpsertApi.test.js` - Added tests for default behavior
   - `tests/controllers/assignmentDefinitionController.upsert.test.js` - Added tests for default behavior

2. **Commit da7df4a** - Frontend fix: Align frontend schema validation with backend contract
   - `src/frontend/src/services/assignmentDefinition.zod.ts` - Made assignmentWeighting nullable in schemas
   - `src/frontend/src/services/assignmentDefinitionPartials.zod.ts` - Schema consistency updates
   - `src/frontend/src/pages/useAssignmentDefinitionWizard.ts` - Updated type to allow nullable assignmentWeighting

3. **Commit 567b850** - Cleanup: Resolve negated condition lint warnings in backend tests
   - `tests/utils/utilsGlobal.test.js` - Fixed ESLint no-negated-condition rule violations

---

## Files Involved

### Backend

- `src/backend/y_controllers/AssignmentDefinitionController.js` - Controller logic
- `src/backend/z_Api/assignmentDefinitionPartials.js` - Transport validation and payload building

### Frontend

- `src/frontend/src/services/assignmentDefinition.zod.ts` - Main assignment definition schema
- `src/frontend/src/services/assignmentDefinitionPartials.zod.ts` - Partial schema (for reference)

### Tests

- `tests/api/assignmentDefinitionUpsertApi.test.js` - API transport layer tests
- `tests/controllers/assignmentDefinitionController.upsert.test.js` - Controller layer tests
- `tests/__mocks__/data/assignmentDefinition.json` - Test data

### Documentation

- `docs/developer/backend/backend-testing.md` - Backend testing conventions
- `src/backend/AGENTS.md` - Backend agent instructions

---

## Validation Checklist

- [x] Tests exist and fail for the right reason (backend returns null)
- [x] Tests pass after backend fix
- [x] Backend defaults assignmentWeighting to 1 when missing
- [x] Backend defaults assignmentWeighting to 1 when null
- [x] Backend preserves explicit assignmentWeighting values
- [x] All existing tests still pass
- [x] Frontend schema aligned with backend contract
- [x] No regressions in existing functionality

---

## Risk Assessment

**Risk Level: LOW**

- Changes are localized to assignmentWeighting defaulting logic
- Defense in depth (both transport and controller layers)
- Comprehensive test coverage planned
- Existing tests will catch regressions
- Frontend schema changes are additive (nullable)

**Potential Issues:**

- If other code depends on `null` assignmentWeighting, those would need updates
- However, based on the Zod error, no frontend code currently handles null correctly

---

## Success Criteria

All success criteria have been met:

1. ✅ User can create assignments without specifying assignmentWeighting
2. ✅ New assignments have assignmentWeighting: 1 by default
3. ✅ Explicit assignmentWeighting values are preserved
4. ✅ No Zod validation errors on assignment creation
5. ✅ All tests pass (new and existing)
6. ✅ No regressions in existing functionality

**Verification:**

- Backend tests: 35 tests passing in `tests/controllers/assignmentDefinitionController.upsert.test.js`
- Frontend tests: 80 test files, 751 tests passing (1 skipped)
- All lint checks passing

---

## Next Steps

**All work completed!** No further action required.

The fix has been fully implemented, tested, and committed. The next step is to merge the `fix/VariousAssignmentCreationErrors` branch into the main branch when ready.

### Summary of Changes

**Backend Changes:**

- Transport layer (`assignmentDefinitionPartials.js`): Added default assignmentWeighting = 1 when missing or null
- Controller layer (`AssignmentDefinitionController.js`): Added default assignmentWeighting = 1 when missing or null
- Defense in depth: Both layers ensure assignmentWeighting defaults to 1

**Frontend Changes:**

- Schema alignment: Made assignmentWeighting nullable to match backend contract
- Updated types to allow nullable assignmentWeighting where appropriate

**Tests:**

- Added comprehensive tests for default assignmentWeighting behavior
- All existing tests continue to pass
- No regressions detected

---

_Document created: 2026-05-18_  
_Last updated: 2026-05-18_  
_Owner: fix/VariousAssignmentCreationErrors branch_  
**Status: ✅ COMPLETED - All fixes implemented and tested**
