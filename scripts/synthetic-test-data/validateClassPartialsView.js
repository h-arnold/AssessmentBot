import { fail, isRecord } from './invariantGuards.js';
import { assertTransportView } from './validateTransportViews.js';

/**
 * Asserts a classPartials entry carries a resolvable, unique class identifier.
 *
 * @param {string} classId The class identifier under test.
 * @param {Set<string>} persistenceClassIds Persistence class identifiers.
 * @param {Set<string>} seenClassIds Class identifiers already observed.
 */
function assertClassPartialIdentifier(classId, persistenceClassIds, seenClassIds) {
  if (typeof classId !== 'string' || !persistenceClassIds.has(classId)) {
    fail(
      `transport.classPartials entry classId ${JSON.stringify(classId)} does not resolve in persistence.classes.`
    );
  }
  if (seenClassIds.has(classId)) {
    fail(`transport.classPartials contains duplicate classId "${classId}".`);
  }
  seenClassIds.add(classId);
}

/**
 * Asserts a classPartials entry's reference keys resolve.
 *
 * @param {object} classPartial The classPartials entry under test.
 * @param {string} classId The class identifier used in failure messages.
 * @param {Set<string>} yearGroupKeys Resolvable Year Group keys.
 * @param {Set<string>} cohortKeys Resolvable Cohort keys.
 */
function assertClassPartialReferences(classPartial, classId, yearGroupKeys, cohortKeys) {
  if (
    typeof classPartial.yearGroupKey !== 'string' ||
    !yearGroupKeys.has(classPartial.yearGroupKey)
  ) {
    fail(
      `transport.classPartials class "${classId}" yearGroupKey ${JSON.stringify(classPartial.yearGroupKey)} does not resolve in referenceData.yearGroups.`
    );
  }
  if (classPartial.cohortKey !== null && !cohortKeys.has(classPartial.cohortKey)) {
    fail(
      `transport.classPartials class "${classId}" cohortKey ${JSON.stringify(classPartial.cohortKey)} does not resolve in referenceData.cohorts.`
    );
  }
}

/**
 * Asserts one classPartials entry is an object with resolvable, unique references.
 *
 * @param {object} options Entry validation inputs.
 * @param {object} options.classPartial The classPartials entry under test.
 * @param {Set<string>} options.seenClassIds Class identifiers already observed.
 * @param {Set<string>} options.persistenceClassIds Persistence class identifiers.
 * @param {Set<string>} options.yearGroupKeys Resolvable Year Group keys.
 * @param {Set<string>} options.cohortKeys Resolvable Cohort keys.
 */
function assertClassPartialEntry({
  classPartial,
  seenClassIds,
  persistenceClassIds,
  yearGroupKeys,
  cohortKeys,
}) {
  if (!isRecord(classPartial)) {
    fail('transport.classPartials entries must be objects.');
  }

  const { classId } = classPartial;
  assertClassPartialIdentifier(classId, persistenceClassIds, seenClassIds);
  assertClassPartialReferences(classPartial, classId, yearGroupKeys, cohortKeys);
}

/**
 * Asserts every persistence class is represented exactly once in the
 * classPartials transport view with resolvable reference keys.
 *
 * @param {object} options Validation inputs.
 * @param {Array<object>} options.classPartials Transport class partials.
 * @param {Set<string>} options.persistenceClassIds Persistence class identifiers.
 * @param {Set<string>} options.yearGroupKeys Resolvable Year Group keys.
 * @param {Set<string>} options.cohortKeys Resolvable Cohort keys.
 */
export function assertClassPartialsView({
  classPartials,
  persistenceClassIds,
  yearGroupKeys,
  cohortKeys,
}) {
  assertTransportView(classPartials, 'classPartials', 'array');
  if (classPartials.length !== persistenceClassIds.size) {
    fail(
      `transport.classPartials holds ${classPartials.length} classes but persistence holds ${persistenceClassIds.size}.`
    );
  }

  const seenClassIds = new Set();
  for (const classPartial of classPartials) {
    assertClassPartialEntry({
      classPartial,
      seenClassIds,
      persistenceClassIds,
      yearGroupKeys,
      cohortKeys,
    });
  }
}
