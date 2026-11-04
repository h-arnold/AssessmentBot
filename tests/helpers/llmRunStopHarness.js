import { expect, vi } from 'vitest';
import { loadBackendModelInputs } from '#synthetic-data/toBackendModelInputs.js';
import { withTemporaryGlobals } from './globalMockManager.js';
import { loadManager } from './llmRequestManagerHarness.js';
import {
  RUN_STOP_UNEXPECTED_PAYLOAD_GUARD,
  answerHealthyMember,
  answerRunStopMember,
  buildHealthyNumericEntries,
  prepareStopScenario,
  readHealthyIndex,
  readRunStopRole,
  readRunStopScenario,
  readUnprocessedIndex,
} from './llmRunStopScenarioSteps.js';

const RUN_STOP_CRITERIA = ['completeness', 'accuracy', 'spag'];

/** Whether one task/item row is a fully TEXT type-matched pair. */
function isRunStopTextPair(task, item) {
  const artifact = item.artifact;
  const reference = task?.artifacts?.reference?.[0];
  const template = task?.artifacts?.template?.[0];
  return artifact?.type === 'TEXT' && reference?.type === 'TEXT' && template?.type === 'TEXT';
}

/** Validates one canonical non-E assessment map through the real Assessment owner. */
function hasRunStopCanonicalMap(item) {
  const assessments = item.assessments;
  if (!assessments || Object.keys(assessments).length !== RUN_STOP_CRITERIA.length) return false;
  return RUN_STOP_CRITERIA.every((criterion) => {
    const entry = assessments[criterion];
    if (!entry || entry.score === 'E') return false;
    try {
      globalThis.Assessment.fromJSON(entry);
      return true;
    } catch {
      return false;
    }
  });
}

/** Template-signature candidate: canonical non-E map with at least one 'N' entry. */
function isRunStopTemplateSignature(item) {
  return (
    hasRunStopCanonicalMap(item) &&
    RUN_STOP_CRITERIA.some((criterion) => item.assessments[criterion].score === 'N')
  );
}

/** Numeric-healthy candidate: all numeric marks with usable TEXT source distinct from template. */
function isRunStopNumericCandidate(task, item) {
  const artifact = item.artifact;
  const template = task?.artifacts?.template?.[0];
  const reference = task?.artifacts?.reference?.[0];
  const usable =
    typeof artifact.content === 'string' &&
    artifact.content.length > 0 &&
    typeof artifact.contentHash === 'string' &&
    artifact.contentHash.length > 0 &&
    typeof template?.contentHash === 'string' &&
    template.contentHash.length > 0 &&
    typeof reference?.contentHash === 'string' &&
    reference.contentHash.length > 0;
  const distinct =
    artifact.contentHash !== template?.contentHash && artifact.content !== template?.content;
  return (
    isRunStopTextPair(task, item) &&
    hasRunStopCanonicalMap(item) &&
    RUN_STOP_CRITERIA.every((criterion) => typeof item.assessments[criterion].score === 'number') &&
    usable &&
    distinct
  );
}

/** Discovers one canonical assignment's run-stop rows in real traversal order. */
function collectRunStopRows(assignment, numericCount) {
  const rows = { numeric: [], signature: null };
  Object.values(assignment.submissions ?? {}).forEach((submission) => {
    Object.entries(submission.items ?? {}).forEach(([taskId, item]) => {
      const task = assignment.assignmentDefinition.tasks[taskId];
      if (!isRunStopTextPair(task, item)) return;
      const planned = { taskId, submission, item, task };
      if (isRunStopNumericCandidate(task, item) && rows.numeric.length < numericCount) {
        rows.numeric.push(planned);
      } else if (!rows.signature && isRunStopTemplateSignature(item)) {
        rows.signature = planned;
      }
    });
  });
  return rows;
}

/** Run-stop healthy control fixture. Selects ONE canonical assignment from the required
 * profile holding `numericCount` numeric-healthy type-matched TEXT pairs plus one genuine
 * type-matched non-E template-signature pair (mixed numeric/'N' marks) in the same real
 * graph, then restores it through the real `Assignment.fromJSON` inside the caller's
 * `withTemporaryGlobals`. The four real pairs keep their actual student/task/document/
 * artifact associations and unique UIDs; the assignment is narrowed to one real item per
 * selected submission, in discovery order. Selected source maps are validated through the
 * real Assessment owner first; only the ordered numeric items are cleared to empty
 * in-flight maps so they stay eligible for dispatch. The signature item keeps its stored
 * marks; the test alone converts it to genuine template-copy evidence before generation.
 * Nothing is manufactured. */
function createRunStopAssignment(profile, numericCount) {
  if (typeof profile !== 'string' || profile.length === 0) {
    throw new Error('createRunStopAssignment requires an explicit profile name.');
  }
  if (!Number.isInteger(numericCount) || numericCount < 1) {
    throw new Error('createRunStopAssignment requires an explicit integer numericCount.');
  }
  const source = Object.values(loadBackendModelInputs(profile).assignmentsByKey)
    .map((assignment) => {
      const rows = collectRunStopRows(assignment, numericCount);
      return rows.numeric.length === numericCount && rows.signature ? { assignment, rows } : null;
    })
    .find(Boolean);
  if (!source) {
    throw new Error(
      `${profile} canonical inputs contain no assignment with ${numericCount} numeric ` +
        'TEXT candidates and one template-signature candidate.'
    );
  }
  const assignment = globalThis.Assignment.fromJSON(structuredClone(source.assignment));
  const restored = [...source.rows.numeric, source.rows.signature].map((planned) => {
    if (!planned) {
      throw new Error('Run-stop control fixture could not restore a selected canonical pair.');
    }
    const submission = assignment.submissions.find(
      (restoredSubmission) => restoredSubmission.studentId === planned.submission.studentId
    );
    const item = submission?.getItem(planned.taskId);
    const task = assignment.assignmentDefinition.tasks[planned.taskId];
    if (!submission || !item || !task) {
      throw new Error('Run-stop control fixture could not restore a selected canonical pair.');
    }
    if (submission.items[planned.taskId] !== item || item.taskId !== planned.taskId) {
      throw new Error('Run-stop control fixture restored inconsistent pair associations.');
    }
    return { taskId: planned.taskId, submission, item, task };
  });
  const identities = new Set(
    restored.flatMap((pair) => [pair.submission.studentId, pair.item.artifact.getUid()])
  );
  if (identities.size !== restored.length * 2) {
    throw new Error('Run-stop control fixture selected duplicate students or artifact UIDs.');
  }
  const sources = new Set(
    source.rows.numeric.map(
      (planned) => `${planned.item.artifact.content}\u0000${planned.item.artifact.contentHash}`
    )
  );
  if (sources.size !== source.rows.numeric.length) {
    throw new Error(
      'Run-stop control fixture selected numeric candidates with duplicate source content.'
    );
  }
  assignment.submissions = restored.map((pair) => pair.submission);
  restored.forEach((pair) => {
    pair.submission.items = { [pair.taskId]: pair.item };
  });
  restored.slice(0, numericCount).forEach((pair) => {
    pair.item.assessments = {};
  });
  return {
    assignment,
    numeric: restored
      .slice(0, numericCount)
      .map(({ submission, item, task }) => ({ submission, item, task })),
    notAttempted: restored.at(-1),
  };
}

/** Builds the manager and fixture inside the caller's temporary globals, then configures
 * the genuine template-copy signature evidence before generation. */
function prepareRunStopFixture(context, profile, numericCount) {
  delete require.cache[context.llmPath];
  const manager = new (require(context.llmPath))();
  const fixture = createRunStopAssignment(profile, numericCount);
  const { notAttempted } = fixture;
  const template = notAttempted.task.getPrimaryTemplate();
  expect(template.content).toEqual(expect.any(String));
  expect(template.content.length).toBeGreaterThan(0);
  expect(template.contentHash).toEqual(expect.any(String));
  expect(template.contentHash.length).toBeGreaterThan(0);
  // Genuine template-copy N evidence configured before generation: the
  // real task template content and usable hash, never manual N results.
  notAttempted.item.artifact.content = template.content;
  notAttempted.item.artifact.contentHash = template.contentHash;
  return { manager, fixture };
}

/** Shared run-stop runner. Builds the canonical fixture, converts the signature item to
 * genuine template-copy evidence, runs the real request generation, then dispatches the
 * explicit batch size through the real Base transport. `scenario.stop === null` runs the
 * healthy control exactly as approved; a stop scenario seeds the target, sibling and
 * unprocessed numeric items with the shared mixed stale numeric/N marks after generation,
 * answers the actually received members with the configured native responses and captures
 * the process outcome explicitly. The batch-size getter, processor and engine spies are
 * call-through; no outcome is ever substituted. */
function runRunStopControl(profile, numericCount, batchSize, scenario) {
  if (!Number.isInteger(batchSize) || batchSize < 1) {
    throw new Error('runRunStopControl requires an explicit positive integer batchSize.');
  }
  const stop = readRunStopScenario(scenario, numericCount, batchSize);
  const stopIndex = stop ? stop.requestIndex : null;
  // The cancelled sibling is the stop's other same-batch member: index 1 for the
  // approved forward arrangement, index 0 for the reverse (stop at index 1).
  const cancelledIndex = stop?.cancelledRetryable ? 1 - stopIndex : null;
  const healthyIndex = readHealthyIndex(stop, batchSize);
  const unprocessedIndex = readUnprocessedIndex(stop, batchSize);
  const bodies = new Map();
  const nativeResponsesBySource = new Map();
  const unexpectedNativePayloads = [];
  const fetchAll = vi.fn((nativeRequests) =>
    nativeRequests.map((nativeRequest, memberIndex) =>
      stop
        ? answerRunStopMember(
            nativeRequest,
            memberIndex,
            nativeResponsesBySource,
            unexpectedNativePayloads
          )
        : answerHealthyMember(nativeRequest, bodies)
    )
  );
  const fetch = vi.fn((url) => {
    if (!stop || url !== prepared.targetRequestUrl) {
      unexpectedNativePayloads.push({ seam: 'fetch', url: String(url) });
      return RUN_STOP_UNEXPECTED_PAYLOAD_GUARD;
    }
    return prepared.stopResponse;
  });
  const sleep = vi.fn();
  const context = loadManager({ fetchAll, fetch, sleep });
  const collected = { batchSize, bodies, fetchAll, fetch, sleep };
  // The stop response and target URL are only known once the real requests are
  // generated inside the temporary globals, so the fetch seam reads them from
  // the prepared scenario at call time.
  let prepared = null;
  try {
    withTemporaryGlobals(context.globals, () => {
      const { manager, fixture } = prepareRunStopFixture(context, profile, numericCount);
      const { assignment, notAttempted } = fixture;
      const numeric = stop
        ? fixture.numeric.map((pair, index) => ({
            ...pair,
            role: readRunStopRole(index, stop, stopIndex, cancelledIndex, unprocessedIndex),
          }))
        : buildHealthyNumericEntries(fixture.numeric, bodies);
      const signature = {
        task: notAttempted.task,
        submission: notAttempted.submission,
        item: notAttempted.item,
        artifact: notAttempted.item.artifact,
        artifactSnapshot: structuredClone(notAttempted.item.artifact.toJSON()),
        documentId: notAttempted.submission.documentId,
      };
      const requests = manager.generateRequestObjects(assignment);
      expect(requests).toHaveLength(numericCount);
      expect(requests.map((request) => request.uid)).toEqual(
        numeric.map((entry) => entry.item.artifact.getUid())
      );
      // Exact N map and the three entry references are captured after
      // generation and before processing, so the later comparison proves
      // processing left them untouched.
      const mapSnapshot = structuredClone(notAttempted.item.getAssessment());
      const entries = RUN_STOP_CRITERIA.map((criterion) =>
        notAttempted.item.getAssessment(criterion)
      );
      prepared = stop
        ? prepareStopScenario({
            stop,
            numeric,
            requests,
            signature,
            stopIndex,
            cancelledIndex,
            unprocessedIndex,
            nativeResponsesBySource,
            bodies,
          })
        : null;
      const batchSizeSpy = vi
        .spyOn(manager.configManager, 'getBackendAssessorBatchSize')
        .mockImplementation(() => batchSize);
      const spies = { batchSize: batchSizeSpy };
      let caught = null;
      if (stop) {
        if (healthyIndex !== null) {
          spies.healthyAddAssessment = vi.spyOn(numeric[healthyIndex].item, 'addAssessment');
        }
        // Call-through seams record the real routed processing, the real
        // retry engine outcome and the real batch consumption outcomes
        // without ever substituting a canned result.
        spies.processor = vi.spyOn(manager, '_processSingleResponse');
        spies.engine = vi.spyOn(manager, '_runRetryEngine');
        spies.consume = vi.spyOn(manager, '_consumeBatch');
        try {
          manager.processStudentResponses(requests, assignment);
        } catch (error) {
          caught = error;
        }
      } else {
        manager.processStudentResponses(requests, assignment);
      }
      const stopExtras = prepared && {
        stop: { ...stop },
        caught,
        unexpectedNativePayloads,
        ...prepared,
        cancelled: stop.cancelledRetryable ? numeric[cancelledIndex] : null,
        permanent: stop.permanentSibling ? numeric[1 - stopIndex] : null,
      };
      Object.assign(
        collected,
        { manager, requests, numeric, signature: { ...signature, mapSnapshot, entries } },
        stopExtras,
        { scriptCache: context.scriptCache, spies }
      );
    });
    return collected;
  } finally {
    vi.restoreAllMocks();
    context.restore();
  }
}

export { RUN_STOP_UNEXPECTED_PAYLOAD_GUARD, createRunStopAssignment, runRunStopControl };
