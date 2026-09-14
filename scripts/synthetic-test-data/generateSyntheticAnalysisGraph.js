import { LARGE_FULL_PROFILE_NAME, getProfileDefinition } from './profileDefinitions.js';
import { generateReferenceData } from './generateReferenceData.js';
import { generateAssignmentDefinitions } from './generateAssignmentDefinitions.js';
import { generateAssignments } from './generateAssignments.js';
import { toTransportViews } from './toTransportViews.js';

const SCHEMA_VERSION = 1;
const REPRESENTATIVE_PROFILE_NAME = 'large-representative';

/**
 * Builds the canonical-large parameters recorded on the representative manifest.
 *
 * @returns {{classCount: number, studentsPerClass: number, assignmentsPerClass: number, yearGroupCount: number}} Canonical full-profile parameters.
 */
function toCanonicalFullProfile() {
  const fullProfile = getProfileDefinition(LARGE_FULL_PROFILE_NAME);
  return {
    classCount: fullProfile.classCount,
    studentsPerClass: fullProfile.studentsPerClass,
    assignmentsPerClass: fullProfile.assignmentsPerClass,
    yearGroupCount: fullProfile.yearGroupCount,
  };
}

/**
 * Resolves the optional seed override, rejecting values that cannot identify a
 * corpus exactly.
 *
 * @param {{seed?: number}} options Optional generation overrides.
 * @param {number} profileSeed The profile's fixed default seed.
 * @returns {number} The resolved finite integer seed.
 * @throws {Error} When a supplied seed is not a finite integer.
 */
function resolveSeed(options, profileSeed) {
  const { seed } = options;
  if (seed === undefined) {
    return profileSeed;
  }
  if (!Number.isInteger(seed)) {
    throw new Error(
      `Invalid synthetic analysis seed ${String(seed)}; the seed must be a finite integer.`
    );
  }
  return seed;
}

/**
 * Composes the deterministic synthetic analysis graph for a named profile.
 *
 * @param {string} profileName Supported profile name.
 * @param {{seed?: number}} [options] Optional generation overrides.
 * @returns {{manifest: object, referenceData: object, persistence: object, transport: object}} The logical corpus model.
 */
export function generateSyntheticAnalysisGraph(profileName, options = {}) {
  const baseProfile = getProfileDefinition(profileName);
  const seed = resolveSeed(options, baseProfile.seed);
  const profileDefinition = { ...baseProfile, seed };

  const referenceData = generateReferenceData(profileDefinition);
  const assignmentDefinitions = generateAssignmentDefinitions({ profileDefinition, referenceData });
  const { classes, assignments } = generateAssignments({
    profileDefinition,
    referenceData,
    assignmentDefinitions,
  });
  const transport = toTransportViews({
    referenceData,
    classes,
    assignmentDefinitions,
    assignments,
  });

  const manifest = {
    schemaVersion: SCHEMA_VERSION,
    profile: baseProfile.name,
    seed,
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

  if (baseProfile.name === REPRESENTATIVE_PROFILE_NAME) {
    manifest.canonicalFullProfile = toCanonicalFullProfile();
  }

  return {
    manifest,
    referenceData,
    persistence: { classes, assignmentDefinitions, assignments },
    transport,
  };
}
