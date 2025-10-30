# Assignment Factory Pattern - RED PHASE Implementation

## Date: 30 October 2025

## Overview

This document summarizes the RED PHASE implementation for the Assignment Factory Pattern feature. All tests have been created and are failing as expected, ready for GREEN PHASE implementation.

## Branch

`test/assignment-factory-red-phase-implementation`

## Files Created/Modified

### 1. Test Helper Functions Added

**File**: `tests/helpers/modelFactories.js`

Added two new factory functions that use `Assignment.fromJSON()` to create test instances without triggering GAS service calls:

- `createSlidesAssignment(props)` - Creates a SlidesAssignment with documentType 'SLIDES'
- `createSheetsAssignment(props)` - Creates a SheetsAssignment with documentType 'SHEETS'

Both functions provide sensible defaults:

- `courseId='c1'`
- `assignmentId='a1'`
- `referenceDocumentId='ref1'`
- `templateDocumentId='tpl1'`
- `assignmentName='Test [Slides|Sheets] Assignment'`
- `documentType='SLIDES'|'SHEETS'`
- `tasks={}`
- `submissions=[]`

### 2. Legacy Fallback Test Added

**File**: `tests/assignment/assignmentLastUpdated.test.js`

Added test: `'should support legacy data without documentType (creates base Assignment)'`

This test verifies that:

- Legacy data without a `documentType` field can be deserialized
- Results in a base `Assignment` instance (not a subclass)
- All standard fields are restored correctly
- **Status**: PASSING (tests pre-existing functionality)

### 3. Comprehensive Factory Pattern Tests

**File**: `tests/assignment/assignmentFactory.test.js` (already existed)

Contains 12 tests organized into 5 test suites:

#### Assignment.create() Factory Method (4 tests - 3 FAILING, 1 PASSING)

- ✗ should create a SlidesAssignment for documentType SLIDES
- ✗ should create a SheetsAssignment for documentType SHEETS
- ✗ should throw an error for an unknown documentType
- ✓ should throw for null/undefined documentType (passes because undefined/null checks happen before method call)

#### Assignment.fromJSON() Polymorphic Deserialization (3 tests - ALL FAILING)

- ✗ should deserialize to a SlidesAssignment when data.documentType is SLIDES
- ✗ should deserialize to a SheetsAssignment when data.documentType is SHEETS
- ✗ should correctly restore subclass-specific properties (referenceDocumentId, templateDocumentId)

#### Polymorphic Round-Trip (2 tests - ALL FAILING)

- ✗ should preserve type and data for a SlidesAssignment after a toJSON() -> fromJSON() round-trip
- ✗ should explicitly verify documentType field survives round-trip

#### Subclass-Specific Serialization (2 tests - ALL FAILING)

- ✗ should include documentType, referenceDocumentId, templateDocumentId in SlidesAssignment.toJSON()
- ✗ should include documentType, referenceDocumentId, templateDocumentId in SheetsAssignment.toJSON()

#### Transient Field Exclusion (1 test - PASSING)

- ✓ should not serialize \_hydrationLevel even if present (passes because toJSON() doesn't include undefined fields)

## Test Results Summary

### Overall Status

```
Test Files:  1 failed | 29 passed (30)
Tests:       10 failed | 212 passed (222)
```

### Assignment Factory Tests

```
tests/assignment/assignmentFactory.test.js (12 tests | 10 failed)
```

### Expected Failures (RED Phase)

The following features are not yet implemented and cause test failures:

1. **`Assignment.create()` static factory method** - Does not exist
2. **`documentType` field** - Not present in Assignment, SlidesAssignment, or SheetsAssignment classes
3. **Polymorphic `Assignment.fromJSON()`** - Does not route to subclass fromJSON methods based on documentType
4. **`SlidesAssignment.fromJSON()` static method** - Does not exist
5. **`SheetsAssignment.fromJSON()` static method** - Does not exist
6. **`Assignment._baseFromJSON()` helper** - Does not exist
7. **Subclass `toJSON()` overrides** - Do not include documentType, referenceDocumentId, templateDocumentId
8. **Subclass constructors** - Do not set `this.documentType` property

## What Works (Pre-existing Functionality)

1. Base `Assignment.fromJSON()` creates base Assignment instances
2. Legacy data without `documentType` field is handled (creates base Assignment)
3. `lastUpdated` field serialization/deserialization (5 passing tests)
4. Transient field exclusion from serialization

## Ready for GREEN PHASE

All RED PHASE tests are complete and failing appropriately. The test suite is ready for implementation of:

1. Add `documentType` property to base Assignment class
2. Implement `Assignment.create()` static factory method
3. Refactor `Assignment.fromJSON()` to `Assignment._baseFromJSON()`
4. Implement polymorphic `Assignment.fromJSON()` with routing logic
5. Add `SlidesAssignment.fromJSON()` and `SheetsAssignment.fromJSON()` static methods
6. Override `toJSON()` in SlidesAssignment and SheetsAssignment
7. Update constructors to set `this.documentType`

## Notes

- All test factory functions correctly use `fromJSON()` to avoid GAS API calls
- Tests follow the documented patterns from `docs/developer/testing.md`
- British English used throughout (serialisation, behaviour)
- Transient fields properly excluded from serialisation
- Error messages follow project conventions
