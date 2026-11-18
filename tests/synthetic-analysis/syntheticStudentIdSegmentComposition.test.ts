/**
 * Focused pin for the synthetic student-identifier segment composition.
 *
 * The generator composes each 21-digit student ID from a fixed leading digit,
 * a zero-padded class index and a zero-padded within-class student index. The
 * corpus conventions suite pins the digit-only length and uniqueness; this
 * suite pins the segment composition directly, against both the committed
 * compact views and freshly generated large-full rosters.
 *
 * @see docs/developer/testing/synthetic-test-data.md
 */

import { describe, expect, it } from 'vitest';

import { createSeededFaker } from '#synthetic-data/deterministicPrimitives.js';
import { generateClassRosters } from '#synthetic-data/generateClassRosters.js';
import { generateReferenceData } from '#synthetic-data/generateReferenceData.js';
import { loadSyntheticAnalysisProfile } from '#synthetic-data/loadSyntheticAnalysisProfile.js';
import {
  LARGE_FULL_PROFILE_NAME,
  PROFILE_NAMES,
  getProfileDefinition,
} from '#synthetic-data/profileDefinitions.js';

/** Leading digit of every generated student identifier. */
const STUDENT_ID_PREFIX = '1';

/** Zero-padded width of each index segment of a generated student identifier. */
const STUDENT_ID_SEGMENT_LENGTH = 10;

/** Committed compact profiles; large-full is never committed. */
const COMPACT_PROFILE_NAMES = PROFILE_NAMES.filter(
  (profileName) => profileName !== LARGE_FULL_PROFILE_NAME
);

/** Roster class shape observed from the generated and committed corpora. */
type ObservedClass = {
  classId: string;
  students: Array<{ id: string }>;
};

/** Reference-data shape consumed by the roster generator. */
type ObservedReferenceData = {
  cohorts: Array<{ key: string }>;
  yearGroups: Array<{ key: string }>;
};

/**
 * Compose the expected identifier from its prefix and two zero-padded segments.
 *
 * @param classIndex Zero-based class index.
 * @param studentIndex Zero-based student index within the class.
 * @returns The composed digit-only student identifier.
 */
function composeStudentId(classIndex: number, studentIndex: number): string {
  return `${STUDENT_ID_PREFIX}${String(classIndex).padStart(
    STUDENT_ID_SEGMENT_LENGTH,
    '0'
  )}${String(studentIndex).padStart(STUDENT_ID_SEGMENT_LENGTH, '0')}`;
}

/**
 * Generate only the large-full rosters, avoiding the full assignment graph.
 *
 * @returns The generated large-full persistence class documents.
 */
function generateLargeFullRosters(): ObservedClass[] {
  const profileDefinition = getProfileDefinition(LARGE_FULL_PROFILE_NAME);
  const faker = createSeededFaker(profileDefinition.seed);
  const referenceData = generateReferenceData(profileDefinition) as ObservedReferenceData;
  return generateClassRosters({ faker, profileDefinition, referenceData }) as ObservedClass[];
}

describe('synthetic student identifier segment composition', () => {
  for (const profileName of COMPACT_PROFILE_NAMES) {
    it(`${profileName}: committed rosters compose the prefix and zero-padded index segments`, () => {
      const classesById = loadSyntheticAnalysisProfile(profileName, 'classesById') as Record<
        string,
        ObservedClass
      >;
      for (const [classId, classFull] of Object.entries(classesById)) {
        const classIndex = Number(classId.replace('class-', ''));
        expect(Number.isInteger(classIndex)).toBe(true);
        for (const [studentIndex, student] of classFull.students.entries()) {
          expect(student.id).toBe(composeStudentId(classIndex, studentIndex));
        }
      }
    });
  }

  it('generates student IDs from the same prefix and zero-padded segments', () => {
    generateLargeFullRosters().forEach((classDocument, classIndex) => {
      classDocument.students.forEach((student, studentIndex) => {
        expect(student.id).toBe(composeStudentId(classIndex, studentIndex));
      });
    });
  });
});
