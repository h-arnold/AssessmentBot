/**
 * Classes management workflow boundary helpers — unit tests.
 *
 * These tests validate the extracted workflow-boundary helper functions
 * that will be moved from ClassesManagementPanel.tsx into
 * classesManagementWorkflowBoundary.ts. They should fail (RED) until that
 * module exists.
 */

import { describe, expect, it } from 'vitest';
import {
  getClassesWorkflowBusyState,
  isClassesWorkflowMutationBoundaryActive,
  shouldSuppressClassesTableData,
} from './classesManagementWorkflowBoundary';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('isClassesWorkflowMutationBoundaryActive', () => {
  it('returns false when all submitting flags are false', () => {
    const result = isClassesWorkflowMutationBoundaryActive({
      createSubmitting: false,
      deleteSubmitting: false,
      setActiveSubmitting: false,
      setCohortSubmitting: false,
      setCourseLengthSubmitting: false,
      setInactiveSubmitting: false,
      setYearGroupSubmitting: false,
    });

    expect(result).toBe(false);
  });

  it('returns true when any submitting flag is true', () => {
    const result = isClassesWorkflowMutationBoundaryActive({
      createSubmitting: false,
      deleteSubmitting: true,
      setActiveSubmitting: false,
      setCohortSubmitting: false,
      setCourseLengthSubmitting: false,
      setInactiveSubmitting: false,
      setYearGroupSubmitting: false,
    });

    expect(result).toBe(true);
  });

  it('returns true when a different submitting flag is true', () => {
    const result = isClassesWorkflowMutationBoundaryActive({
      createSubmitting: false,
      deleteSubmitting: false,
      setActiveSubmitting: false,
      setCohortSubmitting: true,
      setCourseLengthSubmitting: false,
      setInactiveSubmitting: false,
      setYearGroupSubmitting: false,
    });

    expect(result).toBe(true);
  });
});

describe('shouldSuppressClassesTableData', () => {
  it('returns true when suppressStaleTableData is true', () => {
    const result = shouldSuppressClassesTableData(true, null);

    expect(result).toBe(true);
  });

  it('returns true when refreshRequiredMessage is non-null', () => {
    const result = shouldSuppressClassesTableData(false, 'Please refresh.');

    expect(result).toBe(true);
  });

  it('returns false when both inputs are falsy', () => {
    const result = shouldSuppressClassesTableData(false, null);

    expect(result).toBe(false);
  });

  it('returns true when both inputs are truthy', () => {
    const result = shouldSuppressClassesTableData(true, 'Please refresh.');

    expect(result).toBe(true);
  });
});

describe('getClassesWorkflowBusyState', () => {
  it("returns the string 'true' when isRefreshing is true", () => {
    const result = getClassesWorkflowBusyState(true);

    expect(result).toBe('true');
  });

  it('returns undefined when isRefreshing is false', () => {
    const result = getClassesWorkflowBusyState(false);

    expect(result).toBeUndefined();
  });
});
