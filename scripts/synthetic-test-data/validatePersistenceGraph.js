import { fail } from './invariantGuards.js';
import { collectRosterIds } from './validationContext.js';
import {
  assertPersistenceProfileShape,
  assertYearGroupDistribution,
} from './validateProfileInvariants.js';

/**
 * Asserts every assignment topic yearGroupKey resolves in reference data.
 *
 * @param {object} referenceData Generated reference-data view.
 * @param {Set<string>} yearGroupKeys Resolvable Year Group keys.
 */
function assertTopicReferencesResolve(referenceData, yearGroupKeys) {
  for (const topic of referenceData.assignmentTopics) {
    for (const yearGroupKey of topic.yearGroupKeys) {
      if (!yearGroupKeys.has(yearGroupKey)) {
        fail(`Assignment topic "${topic.key}" references unknown yearGroupKey "${yearGroupKey}".`);
      }
    }
  }
}

/**
 * Computes the actual generated entity counts.
 *
 * @param {object} persistence Generated persistence graph.
 * @param {object} referenceData Generated reference-data view.
 * @returns {Map<string, number>} Actual counts keyed by entity name.
 */
function computeActualCounts(persistence, referenceData) {
  return new Map([
    ['classes', persistence.classes.length],
    [
      'students',
      persistence.classes.reduce(
        (total, classDocument) => total + classDocument.students.length,
        0
      ),
    ],
    ['assignments', persistence.assignments.length],
    ['assignmentDefinitions', persistence.assignmentDefinitions.length],
    ['cohorts', referenceData.cohorts.length],
    ['yearGroups', referenceData.yearGroups.length],
    ['assignmentTopics', referenceData.assignmentTopics.length],
  ]);
}

/**
 * Asserts the manifest counts and the profile class/year group counts match the graph.
 *
 * @param {object} manifest Generated manifest.
 * @param {Map<string, number>} actualCounts Actual generated entity counts.
 * @param {object} profile Resolved profile definition.
 */
function assertCountsMatch(manifest, actualCounts, profile) {
  for (const [entityName, declaredCount] of Object.entries(manifest.generatedEntityCounts)) {
    const actualCount = actualCounts.get(entityName);
    if (actualCount === undefined) {
      fail(`manifest generatedEntityCounts declares unknown entity "${entityName}".`);
    }
    if (actualCount !== declaredCount) {
      fail(
        `manifest generatedEntityCounts.${entityName} (${declaredCount}) does not match the actual ${entityName} count (${actualCount}).`
      );
    }
  }

  if (actualCounts.get('classes') !== profile.classCount) {
    fail(
      `Actual class count (${actualCounts.get('classes')}) violates the "${profile.name}" profile class count (${profile.classCount}).`
    );
  }
  if (actualCounts.get('yearGroups') !== profile.yearGroupCount) {
    fail(
      `Actual yearGroups count (${actualCounts.get('yearGroups')}) violates the "${profile.name}" profile yearGroupCount (${profile.yearGroupCount}).`
    );
  }
}

/**
 * Asserts every persistence class resolves its reference keys and has a unique roster.
 *
 * @param {Array<object>} classes Persistence class documents.
 * @param {object} context Validation context.
 */
function assertPersistenceClassesResolveReferences(classes, context) {
  const { yearGroupKeys, cohortKeys } = context;

  for (const classDocument of classes) {
    if (
      typeof classDocument.yearGroupKey !== 'string' ||
      !yearGroupKeys.has(classDocument.yearGroupKey)
    ) {
      fail(
        `Class "${classDocument.classId}" yearGroupKey "${String(classDocument.yearGroupKey)}" does not resolve in referenceData.yearGroups.`
      );
    }
    if (classDocument.cohortKey !== null && !cohortKeys.has(classDocument.cohortKey)) {
      fail(
        `Class "${classDocument.classId}" cohortKey "${classDocument.cohortKey}" does not resolve in referenceData.cohorts.`
      );
    }
    collectRosterIds(classDocument.classId, classDocument.students);
  }
}

/**
 * Asserts an assignment definition's topic and year-group keys resolve.
 *
 * @param {object} definition Persistence assignment definition.
 * @param {Set<string>} topicKeys Resolvable assignment-topic keys.
 * @param {Set<string>} yearGroupKeys Resolvable Year Group keys.
 */
function assertDefinitionReferenceKeys(definition, topicKeys, yearGroupKeys) {
  if (!topicKeys.has(definition.primaryTopicKey)) {
    fail(
      `Assignment definition "${definition.definitionKey}" primaryTopicKey "${definition.primaryTopicKey}" does not resolve in referenceData.assignmentTopics.`
    );
  }
  if (!yearGroupKeys.has(definition.yearGroupKey)) {
    fail(
      `Assignment definition "${definition.definitionKey}" yearGroupKey "${definition.yearGroupKey}" does not resolve in referenceData.yearGroups.`
    );
  }
}

/**
 * Asserts a full (keyed-task) assignment definition carries its full-model fields.
 *
 * @param {object} definition Persistence assignment definition.
 */
function assertFullDefinitionFields(definition) {
  if (Array.isArray(definition.tasks)) {
    return;
  }
  if (!definition.referenceDocumentId || !definition.templateDocumentId) {
    fail(
      `Full assignment definition "${definition.definitionKey}" must carry non-null reference and template document IDs.`
    );
  }
  if (typeof definition.assignmentWeighting !== 'number') {
    fail(
      `Full assignment definition "${definition.definitionKey}" must carry a numeric assignmentWeighting.`
    );
  }
}

/**
 * Asserts every assignment definition resolves its reference keys and full fields.
 *
 * @param {Array<object>} definitions Persistence assignment definitions.
 * @param {object} context Validation context.
 */
function assertDefinitionsResolveReferences(definitions, context) {
  const { topicKeys, yearGroupKeys } = context;

  for (const definition of definitions) {
    assertDefinitionReferenceKeys(definition, topicKeys, yearGroupKeys);
    assertFullDefinitionFields(definition);
  }
}

/**
 * Asserts every persistence submission item references a declared task ID.
 *
 * @param {object} assignment Owning persistence assignment.
 * @param {object} submission Persistence submission.
 * @param {Set<string>} taskIds Declared task IDs.
 */
function assertItemsReferenceDeclaredTasks(assignment, submission, taskIds) {
  for (const item of Object.values(submission.items)) {
    if (!taskIds.has(item.taskId)) {
      fail(
        `Assignment "${assignment.assignmentId}" submission item references task "${item.taskId}" not declared by definition "${assignment.assignmentDefinitionKey}".`
      );
    }
  }
}

/**
 * Asserts every persistence assignment belongs to a generated class and every
 * submission references a rostered student, its owning assignment, and a declared
 * task.
 *
 * @param {Array<object>} assignments Persistence assignment records.
 * @param {object} context Validation context.
 */
function assertPersistenceAssignmentsResolveReferences(assignments, context) {
  const { definitionTaskIdsByKey, rosterByClassId } = context;

  for (const assignment of assignments) {
    const taskIds = definitionTaskIdsByKey.get(assignment.assignmentDefinitionKey);
    if (taskIds === undefined) {
      fail(
        `Assignment "${assignment.assignmentId}" references unknown definition "${assignment.assignmentDefinitionKey}".`
      );
    }
    const rosterIds = rosterByClassId.get(assignment.courseId);
    if (rosterIds === undefined) {
      fail(
        `Assignment "${assignment.assignmentId}" courseId "${String(assignment.courseId)}" does not resolve to a generated class.`
      );
    }

    for (const submission of assignment.submissions) {
      if (submission.assignmentId !== assignment.assignmentId) {
        fail(
          `Assignment "${assignment.assignmentId}" submission for student "${submission.studentId}" names parent assignment "${String(submission.assignmentId)}" instead of its owning assignment.`
        );
      }
      if (!rosterIds.has(submission.studentId)) {
        fail(
          `Assignment "${assignment.assignmentId}" submission references student "${submission.studentId}" outside class "${assignment.courseId}".`
        );
      }
      assertItemsReferenceDeclaredTasks(assignment, submission, taskIds);
    }
  }
}

/**
 * Validates the persistence graph: reference integrity, manifest and profile
 * counts, roster uniqueness, and the Year Group distribution.
 *
 * @param {object} options Validation inputs.
 * @param {object} options.manifest Generated manifest.
 * @param {object} options.referenceData Generated reference-data view.
 * @param {object} options.persistence Generated persistence graph.
 * @param {object} options.context Validation context.
 */
export function validatePersistenceGraph({ manifest, referenceData, persistence, context }) {
  const actualCounts = computeActualCounts(persistence, referenceData);

  assertTopicReferencesResolve(referenceData, context.yearGroupKeys);
  assertCountsMatch(manifest, actualCounts, context.profile);
  assertPersistenceProfileShape({
    classes: persistence.classes,
    assignments: persistence.assignments,
    profile: context.profile,
  });
  assertPersistenceClassesResolveReferences(persistence.classes, context);
  assertYearGroupDistribution({
    classes: persistence.classes,
    yearGroups: referenceData.yearGroups,
  });
  assertDefinitionsResolveReferences(persistence.assignmentDefinitions, context);
  assertPersistenceAssignmentsResolveReferences(persistence.assignments, context);
}
