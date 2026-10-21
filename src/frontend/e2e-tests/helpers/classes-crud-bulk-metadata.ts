import type { Page } from '@playwright/test';
import type { ClassPartial } from '@/services/googleClassrooms/classPartials.zod';
import type { GoogleClassroom } from '@/services/googleClassrooms/googleClassrooms.zod';
import {
  CANONICAL_NULL_CLASS_METADATA,
  createCanonicalNotAttemptedClassMetadata,
  createCanonicalNumericClassMetadata,
} from './class-metadata-fixtures';

/** Shared Google Classroom rows used by the bulk-metadata eligibility journeys. */
export const bulkMetadataGoogleClassrooms: readonly GoogleClassroom[] = [
  { classId: 'gc-active', className: 'Alpha Active' },
  { classId: 'gc-inactive', className: 'Beta Inactive' },
  { classId: 'gc-not-created', className: 'Gamma Not Created' },
];

/** Eligible Classes rows for cohort and course-length bulk metadata journeys. */
export const bulkMetadataClassPartials: readonly ClassPartial[] = [
  {
    classId: 'gc-active',
    className: 'Alpha Active',
    cohortKey: 'cohort-2024',
    courseLength: 30,
    yearGroupKey: 'year-7',
    classOwner: null,
    teachers: [],
    active: true,
    metadata: createCanonicalNumericClassMetadata(),
  },
  {
    classId: 'gc-inactive',
    className: 'Beta Inactive',
    cohortKey: 'cohort-2024',
    courseLength: 20,
    yearGroupKey: 'year-8',
    classOwner: null,
    teachers: [],
    active: false,
    metadata: createCanonicalNotAttemptedClassMetadata(),
  },
  {
    classId: 'orphaned-legacy',
    className: 'Legacy Orphaned',
    cohortKey: 'cohort-2023',
    courseLength: 25,
    yearGroupKey: 'year-8',
    classOwner: null,
    teachers: [],
    active: false,
    // Legacy orphaned record: the backend has no stored snapshot, so the
    // canonical null emission is truthful rather than a fake default.
    metadata: CANONICAL_NULL_CLASS_METADATA,
  },
];

/** Eligible rows for year-group flow; inactive row deliberately starts in Year 7. */
export const bulkYearGroupEligibleClassPartials: readonly ClassPartial[] = [
  bulkMetadataClassPartials[0],
  { ...bulkMetadataClassPartials[1], yearGroupKey: 'year-7' },
  bulkMetadataClassPartials[2],
];

/**
 * Returns the table row for the supplied stable Classes row key.
 * @param {Page} page Playwright page containing the Classes table.
 * @param {string} rowKey Stable row identifier.
 * @returns {ReturnType<Page['locator']>} Locator for the matching table row.
 */
export function getClassesCrudRow(page: Page, rowKey: string) {
  return page.locator(`tbody tr[data-row-key="${rowKey}"]`);
}

/**
 * Selects the checkbox for a Classes table row.
 * @param {Page} page Playwright page containing the Classes table.
 * @param {string} rowKey Stable row identifier.
 * @returns {Promise<void>} Resolves when the row is selected.
 */
export async function selectClassesCrudRow(page: Page, rowKey: string): Promise<void> {
  await getClassesCrudRow(page, rowKey).getByRole('checkbox').check();
}

/**
 * Clears the checkbox selection for a Classes table row.
 * @param {Page} page Playwright page containing the Classes table.
 * @param {string} rowKey Stable row identifier.
 * @returns {Promise<void>} Resolves when the row is deselected.
 */
export async function clearClassesCrudRowSelection(page: Page, rowKey: string): Promise<void> {
  await getClassesCrudRow(page, rowKey).getByRole('checkbox').uncheck();
}
