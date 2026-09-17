import { describe, expect, it } from 'vitest';

import { generateSyntheticAnalysisGraph } from '../../scripts/synthetic-test-data/generateSyntheticAnalysisGraph.js';
import { loadSyntheticAnalysisProfile } from '../../scripts/synthetic-test-data/loadSyntheticAnalysisProfile.js';

const COMMITTED_PROFILE_NAMES = ['small', 'medium', 'large-representative'] as const;

/**
 * Leading honourific tokens stripped from generated person names. Faker emits
 * some of these with a trailing full stop (for example "Mrs."), which the
 * leading-token comparison below tolerates.
 */
const STRIPPED_HONOURIFICS: ReadonlyArray<string> = ['Mr', 'Mrs', 'Miss', 'Ms', 'Dr', 'Prof'];

/**
 * Structural observation of a class roster. Persistence classes and committed
 * class transport views share these name fields, so one collector serves both.
 */
type ObservedClassRoster = {
  students: Array<{ name: string }>;
  teachers: Array<{ teacherName: string }>;
};

/**
 * Generator-internal observation of the freshly generated graph. Only the
 * persistence roster needed by this spec is captured.
 */
type GeneratedSyntheticAnalysisGraph = {
  persistence: {
    classes: ObservedClassRoster[];
  };
};

/**
 * Extracts the leading token of a person name without a trailing full stop, so
 * Faker forms such as "Mrs." compare against the bare honourific set.
 *
 * @param personName The full person name to inspect.
 * @returns The leading token with one trailing full stop removed.
 */
function extractLeadingToken(personName: string): string {
  const [leadingToken] = personName.split(' ');
  return leadingToken.endsWith('.') ? leadingToken.slice(0, -1) : leadingToken;
}

/**
 * Reads every roster and teacher name from class rosters in class order.
 *
 * @param classes The class rosters to inspect.
 * @returns The roster and teacher names in class order.
 */
function collectPersonNames(classes: ReadonlyArray<ObservedClassRoster>): string[] {
  const personNames: string[] = [];
  for (const classDocument of classes) {
    for (const student of classDocument.students) {
      personNames.push(student.name);
    }
    for (const teacher of classDocument.teachers) {
      personNames.push(teacher.teacherName);
    }
  }
  return personNames;
}

/**
 * Collects the person names whose leading token is a stripped honourific.
 *
 * @param personNames The roster and teacher names to inspect.
 * @returns The offending names in inspection order.
 */
function collectHonourificNames(personNames: ReadonlyArray<string>): string[] {
  return personNames.filter((personName) =>
    STRIPPED_HONOURIFICS.includes(extractLeadingToken(personName))
  );
}

describe('honourific-free synthetic roster and teacher names', () => {
  it('generates roster and teacher names without a leading honourific for every committed profile seed', () => {
    for (const profileName of COMMITTED_PROFILE_NAMES) {
      const graph = generateSyntheticAnalysisGraph(profileName) as GeneratedSyntheticAnalysisGraph;
      const offendingNames = collectHonourificNames(collectPersonNames(graph.persistence.classes));

      expect(
        offendingNames,
        `${profileName} generated names must not begin with a stripped honourific`
      ).toEqual([]);
    }
  });

  it('commits roster and teacher names without a leading honourific for every committed profile', () => {
    for (const profileName of COMMITTED_PROFILE_NAMES) {
      const classesById = loadSyntheticAnalysisProfile(profileName, 'classesById') as Record<
        string,
        ObservedClassRoster
      >;
      const offendingNames = collectHonourificNames(collectPersonNames(Object.values(classesById)));

      expect(
        offendingNames,
        `${profileName} committed names must not begin with a stripped honourific`
      ).toEqual([]);
    }
  });
});
