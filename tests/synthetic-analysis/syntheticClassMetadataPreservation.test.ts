import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { generateAssignmentDefinitions } from '#synthetic-data/generateAssignmentDefinitions.js';
import { generateAssignments } from '#synthetic-data/generateAssignments.js';
import { generateReferenceData } from '#synthetic-data/generateReferenceData.js';
import { generateSyntheticAnalysisGraph } from '#synthetic-data/generateSyntheticAnalysisGraph.js';
import {
  getProfileDefinition,
  LARGE_FULL_PROFILE_NAME,
} from '#synthetic-data/profileDefinitions.js';
import { toTransportViews } from '#synthetic-data/toTransportViews.js';
import { generateClassMetadata } from '#synthetic-data/generateClassMetadata.js';

/** Removes only the class-level field introduced by the metadata feature. */
function withoutClassMetadata(graph: Record<string, any>) {
  const copy = structuredClone(graph);
  for (const classDocument of copy.persistence.classes) delete classDocument.metadata;
  for (const classPartial of copy.transport.classPartials) delete classPartial.metadata;
  for (const classView of Object.values(copy.transport.classesById) as Array<Record<string, any>>) {
    delete classView.metadata;
  }
  return copy;
}

/** Compose the established pre-metadata public stages without invoking the graph orchestrator. */
function generatePreMetadataGraph(profileName: string, seed?: number) {
  const baseProfile = getProfileDefinition(profileName);
  const profileDefinition = { ...baseProfile, seed: seed ?? baseProfile.seed };
  const referenceData = generateReferenceData(profileDefinition) as Record<string, any>;
  const assignmentDefinitions = generateAssignmentDefinitions({
    profileDefinition: profileDefinition as any,
    referenceData: referenceData as any,
  }) as Array<Record<string, any>>;
  const { classes, assignments } = generateAssignments({
    profileDefinition: profileDefinition as any,
    referenceData: referenceData as any,
    assignmentDefinitions: assignmentDefinitions as any,
  }) as { classes: Array<Record<string, any>>; assignments: Array<Record<string, any>> };
  const transport = toTransportViews({
    referenceData: referenceData as any,
    classes: classes as any,
    assignmentDefinitions: assignmentDefinitions as any,
    assignments: assignments as any,
  });

  const manifest = {
    schemaVersion: 1,
    profile: baseProfile.name,
    seed: profileDefinition.seed,
    generatedEntityCounts: {
      classes: classes.length,
      students: classes.reduce((total, classDocument) => total + classDocument.students.length, 0),
      assignments: assignments.length,
      assignmentDefinitions: assignmentDefinitions.length,
      cohorts: referenceData.cohorts.length,
      yearGroups: referenceData.yearGroups.length,
      assignmentTopics: referenceData.assignmentTopics.length,
    },
  };
  if (baseProfile.name === 'large-representative') {
    const fullProfile = getProfileDefinition(LARGE_FULL_PROFILE_NAME);
    Object.assign(manifest, {
      canonicalFullProfile: {
        classCount: fullProfile.classCount,
        studentsPerClass: fullProfile.studentsPerClass,
        assignmentsPerClass: fullProfile.assignmentsPerClass,
        yearGroupCount: fullProfile.yearGroupCount,
      },
    });
  }

  return {
    manifest,
    referenceData,
    persistence: { classes, assignmentDefinitions, assignments },
    transport,
  };
}

describe('class metadata preservation', () => {
  it.each(['small', 'medium', 'large-representative'])(
    'preserves the complete pre-metadata graph for profile %s, except class metadata',
    (profileName) => {
      const generated = generateSyntheticAnalysisGraph(profileName);
      const trusted = generatePreMetadataGraph(profileName);

      for (const classDocument of trusted.persistence.classes) {
        expect(Object.hasOwn(classDocument, 'metadata')).toBe(false);
      }
      for (const classPartial of trusted.transport.classPartials) {
        expect(Object.hasOwn(classPartial, 'metadata')).toBe(false);
      }
      for (const classView of Object.values(trusted.transport.classesById)) {
        expect(Object.hasOwn(classView, 'metadata')).toBe(false);
      }
      expect(withoutClassMetadata(generated)).toStrictEqual(trusted);
    }
  );

  it('keeps every non-metadata graph field responsive to the established seed override', () => {
    const seed = 17032;
    const generated = generateSyntheticAnalysisGraph('small', { seed });
    expect(withoutClassMetadata(generated)).toStrictEqual(generatePreMetadataGraph('small', seed));
  });

  it('does not consume the seeded Faker stream or clock in the metadata stage', () => {
    expect(generateClassMetadata).toEqual(expect.any(Function));
    // The module boundary is the relevant capability: the stage receives generated records and
    // must not initialise an independent Faker stream or derive timestamps from the wall clock.
    const source = readFileSync('scripts/synthetic-test-data/generateClassMetadata.js', 'utf8');
    expect(source).not.toMatch(/createSeededFaker|\bfaker\b|Date\.now|new Date\s*\(/iu);
  });
});
