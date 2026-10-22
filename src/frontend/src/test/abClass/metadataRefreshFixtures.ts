import smallClasses from '@synthetic/small/classesById.json?raw';
import mediumClasses from '@synthetic/medium/classesById.json?raw';
import largeClasses from '@synthetic/large-representative/classesById.json?raw';
import smallDefinitions from '@synthetic/small/assignmentDefinitionPartials.json?raw';
import mediumDefinitions from '@synthetic/medium/assignmentDefinitionPartials.json?raw';
import largeDefinitions from '@synthetic/large-representative/assignmentDefinitionPartials.json?raw';
import {
  ClassFullSchema,
  type ClassFull,
} from '@/services/googleClassrooms/classDetail/classDetailService.zod';
import { AssignmentDefinitionPartialsResponseSchema } from '@/services/assignmentDefinition/assignmentDefinitionPartials.zod';
import { DataAnalysisService } from '@/services/dataAnalysis/dataAnalysisService';
import type { AverageScores, RecentAssignment } from '@/services/abClass/abClassMetadata.zod';
import type { MetricResult, PerClassResult } from '@/services/dataAnalysis/dataAnalysis.zod';
import { deepFreeze } from '../shared/canonicalFixturePrimitives';
import type { MetadataProfile } from './abClassMetadataFixtures';

const views = deepFreeze({
  small: {
    classes: JSON.parse(smallClasses) as Record<string, unknown>,
    definitions: JSON.parse(smallDefinitions) as unknown,
  },
  medium: {
    classes: JSON.parse(mediumClasses) as Record<string, unknown>,
    definitions: JSON.parse(mediumDefinitions) as unknown,
  },
  'large-representative': {
    classes: JSON.parse(largeClasses) as Record<string, unknown>,
    definitions: JSON.parse(largeDefinitions) as unknown,
  },
});

const OMIT_FINAL_ASSIGNMENT = -1;

export const SUMMARY_TIME = '2026-10-20T06:30:00.123Z';
export const NEW_SOURCE_TIME = '2026-10-19T12:00:00.456Z';
export const PROFILES: readonly MetadataProfile[] = ['small', 'medium', 'large-representative'];

/** Loads an untouched committed class, including canonical analyser trust failures.
 * @param {MetadataProfile} profile - Explicit compact profile.
 * @param {string} classId - Explicit canonical class identity.
 * @returns {ClassFull} Detached validated transport record.
 */
export function canonicalRefreshClass(profile: MetadataProfile, classId: string): ClassFull {
  return ClassFullSchema.parse(views[profile].classes[classId]);
}

/** Selects a historical-source boundary clone; each call returns detached data.
 * Every committed class's final assignment has a null studentName, rejected by
 * isolated analysis. Successful writer probes model the preceding source version
 * by omitting that assignment, never repairing its names or its assessment evidence.
 * Medium/large retain supplied two/three-entry history as independent snapshots;
 * those supplied scores are never calculation oracles.
 * @param {MetadataProfile} profile - Explicit compact profile.
 * @returns {object} Complete class, live definitions and a successful analysis.
 */
export function createMetadataRefreshFixture(profile: MetadataProfile) {
  const classIds = { small: 'class-2', medium: 'class-0', 'large-representative': 'class-1' };
  const classFull = canonicalRefreshClass(profile, classIds[profile]);
  classFull.assignments = classFull.assignments.slice(0, OMIT_FINAL_ASSIGNMENT);
  const assignmentDefinitionPartials = AssignmentDefinitionPartialsResponseSchema.parse(
    views[profile].definitions
  );
  const averagingResult = new DataAnalysisService().analyse({
    classes: [classFull],
    assignmentDefinitionPartials,
    filter: { classIds: [classFull.classId] },
  })[0];
  return { classFull, assignmentDefinitionPartials, averagingResult };
}

/** Independent explicit projection, never the production projection under test.
 * @param {PerClassResult} metrics - Actual analysis evidence.
 * @returns {AverageScores} Expected wire scores.
 */
export function expectedScores(metrics: PerClassResult): AverageScores {
  return {
    completeness: score(metrics.completeness),
    accuracy: score(metrics.accuracy),
    spag: score(metrics.spag),
    overall: score(metrics.overall),
  };
}

/** Maps a metric without invoking the production projection.
 * @param {MetricResult} metric - Validated analysis metric.
 * @returns {AverageScores['overall']} Literal expected score or marker.
 */
function score(metric: MetricResult): AverageScores['overall'] {
  return metric.state === 'excluded' ? 'excluded' : metric.value;
}

/** Calculates independently of supplied metadata, with standard weights and full scope.
 * @param {ReturnType<typeof createMetadataRefreshFixture>} fixture - Canonical source context.
 * @param {ClassFull} classFull - Explicit full or instance-isolated scope.
 * @returns {AverageScores} Expected calculated snapshot.
 */
export function calculateExpectedScores(
  fixture: ReturnType<typeof createMetadataRefreshFixture>,
  classFull: ClassFull
) {
  return expectedScores(
    new DataAnalysisService().analyse({
      classes: [classFull],
      assignmentDefinitionPartials: fixture.assignmentDefinitionPartials,
      filter: { classIds: [classFull.classId] },
    })[0].perClass
  );
}

/** Builds a boundary recent entry using a real assignment identity, not a definition identity.
 * @param {ClassFull} cls - Source class.
 * @param {number} index - Assignment index.
 * @returns {RecentAssignment} Detached mixed-marker boundary snapshot, not calculated scores.
 */
export function recentEntry(cls: ClassFull, index: number): RecentAssignment {
  const assignment = cls.assignments[index];
  if (assignment.updatedAt === null) throw new Error('Canonical source timestamp is required');
  return {
    assignmentId: assignment.assignmentId,
    assignmentDefinitionKey: assignment.assignmentDefinitionKey,
    updatedAt: assignment.updatedAt,
    averages: { completeness: 1.23456789, accuracy: 'N', spag: 'E', overall: 'excluded' },
  };
}

/** Obtains a target without importing the production target selector.
 * @param {ClassFull} cls - Complete class.
 * @returns {ClassFull['assignments'][number]} Newest canonical assignment.
 */
export function newestAssignment(cls: ClassFull) {
  return cls.assignments.toSorted((a, b) => {
    return (
      String(b.updatedAt).localeCompare(String(a.updatedAt)) ||
      a.assignmentId.localeCompare(b.assignmentId)
    );
  })[0];
}
