import { expect, vi } from 'vitest';
import { loadBackendModelInputs } from '#synthetic-data/toBackendModelInputs.js';
import { withTemporaryGlobals } from './globalMockManager.js';
import { httpResponse, loadManager, seedStaleMixedMarks } from './llmRequestManagerHarness.js';

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

/**
 * Run-stop healthy control fixture. Selects ONE canonical assignment from the
 * required profile holding `numericCount` numeric-healthy type-matched TEXT
 * pairs plus one genuine type-matched non-E template-signature pair (mixed
 * numeric/'N' marks) in the same real graph, then restores it through the real
 * `Assignment.fromJSON` inside the caller's `withTemporaryGlobals`. The four
 * real pairs keep their actual student/task/document/artifact associations and
 * unique UIDs; the assignment is narrowed to one real item per selected
 * submission, in discovery order. Selected source maps are validated through
 * the real Assessment owner first; only the ordered numeric items are cleared
 * to empty in-flight maps so they stay eligible for dispatch. The signature
 * item keeps its stored marks; the test alone converts it to genuine
 * template-copy evidence before generation. Nothing is manufactured.
 */
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
    const submission = assignment.submissions.find(
      (restoredSubmission) => restoredSubmission.studentId === planned.submission.studentId
    );
    const item = submission.getItem(planned.taskId);
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
    notAttempted: restored[restored.length - 1],
  };
}

/** One complete distinct numeric body for one received run-stop member. */
function runStopNumericBody(index) {
  return {
    completeness: { score: 0, reasoning: `Run-stop numeric outcome ${index} completeness.` },
    accuracy: { score: 2.5, reasoning: '' },
    spag: { score: 5, reasoning: `Run-stop numeric outcome ${index} spag.` },
  };
}

/**
 * Reserve status far outside every LLM accepted/stop/retryable window so an
 * unexpected native dispatch can never be misread as a business outcome; the
 * stop rows fail on the recorded seam list instead.
 */
const RUN_STOP_UNEXPECTED_PAYLOAD_GUARD = {
  getResponseCode: () => 600,
  getContentText: () => 'Run-stop unexpected native payload guard, never read.',
};

/**
 * Validates the caller's explicit run-stop scenario. `null` selects the healthy
 * control; a stop scenario requires the approved stop index for its batch
 * arrangement, an INITIAL or TRANSPORT_RETRY origin and one of the three
 * credential/endpoint stop statuses. `cancelledRetryable` configures the OTHER
 * same-batch member as a retryable HTTP 500 whose pending retries Base cancels
 * when the stop is classified: batch size 2 allows the stop at index 0 (forward)
 * or index 1 (reverse, INITIAL origin only), batch size 3 index 0 with a healthy
 * third numeric. `permanentSibling` swaps the sibling member for a permanent
 * HTTP 400 rejection. Exactly one sibling role is supported per scenario.
 */
function readRunStopScenario(scenario, numericCount, batchSize) {
  if (!scenario || typeof scenario !== 'object' || !Object.hasOwn(scenario, 'stop')) {
    throw new Error(
      'runRunStopControl requires an explicit scenario with an own stop key (null selects the healthy control).'
    );
  }
  if (scenario.stop === null) return null;
  if (numericCount !== 3) {
    throw new Error('Run-stop scenarios support the approved three numeric candidates only.');
  }
  ['cancelledRetryable', 'permanentSibling'].forEach((flag) => {
    if (scenario[flag] !== undefined && typeof scenario[flag] !== 'boolean') {
      throw new Error(`Run-stop scenario ${flag} must be a boolean when provided.`);
    }
  });
  const cancelledRetryable = scenario.cancelledRetryable === true;
  const permanentSibling = scenario.permanentSibling === true;
  const allowedBatchSizes = cancelledRetryable ? [2, 3] : [1, 2];
  const { requestIndex, origin, status } = scenario.stop;
  if (
    !allowedBatchSizes.includes(batchSize) ||
    (batchSize === 1 && requestIndex !== 1) ||
    (batchSize !== 1 &&
      requestIndex !== 0 &&
      !(cancelledRetryable && batchSize === 2 && (requestIndex === 0 || origin === 'INITIAL')))
  ) {
    throw new Error(
      'Run-stop scenarios support only the approved size-2/index-0 (same-batch), size-1/index-1 (earlier-batch) and size-2/index-1 INITIAL (reverse same-batch cancellation) stop arrangements.'
    );
  }
  if (origin !== 'INITIAL' && origin !== 'TRANSPORT_RETRY') {
    throw new Error(
      'Run-stop scenarios require an explicit stop origin of INITIAL or TRANSPORT_RETRY.'
    );
  }
  if (status !== 401 && status !== 403 && status !== 404) {
    throw new Error('Run-stop scenarios require an explicit stop status of 401, 403 or 404.');
  }
  return { ...scenario.stop, cancelledRetryable, permanentSibling };
}

/**
 * Shared run-stop runner. Builds the canonical fixture, converts the signature
 * item to genuine template-copy evidence, runs the real request generation,
 * then dispatches the explicit batch size through the real Base transport.
 * `scenario.stop === null` runs the healthy control exactly as approved; a
 * stop scenario seeds the target, sibling and unprocessed numeric items with
 * the shared mixed stale numeric/N marks after generation, answers the actually
 * received members with the configured native responses and captures the process
 * outcome explicitly. The batch-size getter, processor and engine spies are
 * call-through; no outcome is ever substituted.
 */
function runRunStopControl(profile, numericCount, batchSize, scenario) {
  if (!Number.isInteger(batchSize) || batchSize < 1) {
    throw new Error('runRunStopControl requires an explicit positive integer batchSize.');
  }
  const stop = readRunStopScenario(scenario, numericCount, batchSize);
  const stopIndex = stop ? stop.requestIndex : null;
  // The cancelled sibling is the stop's other same-batch member: index 1 for the
  // approved forward arrangement, index 0 for the reverse (stop at index 1).
  const cancelledIndex = stop && stop.cancelledRetryable ? 1 - stopIndex : null;
  const healthyIndex =
    stop && !stop.permanentSibling
      ? stop.cancelledRetryable
        ? batchSize === 3
          ? 2
          : null
        : batchSize === 2
          ? 1
          : 0
      : null;
  const unprocessedIndex = stop && !(stop.cancelledRetryable && batchSize === 3) ? 2 : null;
  const bodies = new Map();
  const nativeResponsesBySource = new Map();
  const unexpectedNativePayloads = [];
  let stopResponse = null;
  let initialServerResponse = null;
  let healthyNativeResponse = null;
  let cancelledResponse = null;
  let permanentResponse = null;
  let targetRequestUrl = null;
  const fetchAll = vi.fn((nativeRequests) =>
    nativeRequests.map((nativeRequest, memberIndex) => {
      if (!stop) {
        const body = bodies.get(JSON.parse(nativeRequest.payload).studentResponse);
        if (!body) {
          throw new Error('Run-stop healthy control received an unexpected native payload.');
        }
        return httpResponse(200, JSON.stringify(body));
      }
      const received = JSON.parse(nativeRequest.payload).studentResponse;
      const configured = nativeResponsesBySource.get(received);
      if (!configured) {
        // Unexpected native payloads are recorded on their own seam and
        // answered with the guard status instead of being thrown from inside
        // dispatch, where Base would swallow them as network failures and
        // mask the fault as a business outcome.
        unexpectedNativePayloads.push({ seam: 'fetchAll', memberIndex, sourceKey: received });
        return RUN_STOP_UNEXPECTED_PAYLOAD_GUARD;
      }
      return configured;
    })
  );
  const fetch = vi.fn((url) => {
    if (!stop || url !== targetRequestUrl) {
      unexpectedNativePayloads.push({ seam: 'fetch', url: String(url) });
      return RUN_STOP_UNEXPECTED_PAYLOAD_GUARD;
    }
    return stopResponse;
  });
  const sleep = vi.fn();
  const context = loadManager({ fetchAll, fetch, sleep });
  const collected = { batchSize, bodies, fetchAll, fetch, sleep };
  try {
    withTemporaryGlobals(context.globals, () => {
      delete require.cache[context.llmPath];
      const manager = new (require(context.llmPath))();
      const fixture = createRunStopAssignment(profile, numericCount);
      const { assignment, notAttempted } = fixture;
      // Genuine template-copy N evidence configured before generation: the
      // real task template content and usable hash, never manual N results.
      const template = notAttempted.task.getPrimaryTemplate();
      expect(template.content).toEqual(expect.any(String));
      expect(template.content.length).toBeGreaterThan(0);
      expect(template.contentHash).toEqual(expect.any(String));
      expect(template.contentHash.length).toBeGreaterThan(0);
      notAttempted.item.artifact.content = template.content;
      notAttempted.item.artifact.contentHash = template.contentHash;
      let numeric;
      if (stop) {
        numeric = fixture.numeric.map((pair, index) => ({
          ...pair,
          role:
            index === stopIndex
              ? 'target'
              : index === cancelledIndex
                ? 'cancelled'
                : index === unprocessedIndex
                  ? 'unprocessed'
                  : stop.permanentSibling
                    ? 'permanent'
                    : 'healthy',
        }));
      } else {
        numeric = fixture.numeric.map((pair, index) => {
          const expectedBody = runStopNumericBody(index);
          bodies.set(pair.item.artifact.content, expectedBody);
          return {
            ...pair,
            artifact: pair.item.artifact,
            artifactSnapshot: structuredClone(pair.item.artifact.toJSON()),
            documentId: pair.submission.documentId,
            expectedBody,
          };
        });
      }
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
      if (stop) {
        // Fixture payload fidelity is proven before any dispatch so a local
        // fixture fault fails as setup and can never be caught as a network
        // failure or misread as a business outcome.
        requests.forEach((request, index) => {
          expect(JSON.parse(request.payload).studentResponse).toBe(
            numeric[index].item.artifact.content
          );
        });
        // The approved mixed stale numeric/N seeding happens after request
        // generation through the existing shared helper; no prior E is seeded.
        seedStaleMixedMarks(numeric[stopIndex].item);
        if (unprocessedIndex !== null) {
          seedStaleMixedMarks(numeric[unprocessedIndex].item);
        }
        if (cancelledIndex !== null) {
          seedStaleMixedMarks(numeric[cancelledIndex].item);
        }
        if (stop.permanentSibling) {
          seedStaleMixedMarks(numeric[1 - stopIndex].item);
        }
        numeric.forEach((entry, index) => {
          entry.artifact = entry.item.artifact;
          entry.artifactSnapshot = structuredClone(entry.item.artifact.toJSON());
          entry.documentId = entry.submission.documentId;
          entry.request = requests[index];
        });
        // The signature snapshot is retained again after local mutations so
        // all four detached captures are post-mutation evidence.
        signature.artifactSnapshot = structuredClone(signature.item.artifact.toJSON());
        stopResponse = httpResponse(
          stop.status,
          'Rejection body kept unread by the transport and every caller.'
        );
        if (stop.origin === 'TRANSPORT_RETRY') {
          initialServerResponse = httpResponse(
            500,
            'Transient initial service failure body, never read.'
          );
        }
        numeric.forEach((entry) => {
          if (entry.role === 'target') {
            nativeResponsesBySource.set(
              entry.item.artifact.content,
              stop.origin === 'INITIAL' ? stopResponse : initialServerResponse
            );
          } else if (entry.role === 'healthy') {
            entry.expectedBody = runStopNumericBody(0);
            bodies.set(entry.item.artifact.content, entry.expectedBody);
            const healthyResponse = httpResponse(200, JSON.stringify(entry.expectedBody));
            nativeResponsesBySource.set(entry.item.artifact.content, healthyResponse);
            healthyNativeResponse = healthyResponse;
          } else if (entry.role === 'cancelled') {
            // The cancelled sibling's initial retryable response: Base's batch
            // consumption returns it untouched (attempts 1) once the stop is
            // classified, so its pending retries never dispatch.
            cancelledResponse = httpResponse(500, 'Cancelled retryable body, never read.');
            nativeResponsesBySource.set(entry.item.artifact.content, cancelledResponse);
          } else if (entry.role === 'permanent') {
            // The permanent sibling's per-request rejection: never read, never
            // retried, and never relabelled by the latched run stop.
            permanentResponse = httpResponse(400, 'Permanent rejection body, never read.');
            nativeResponsesBySource.set(entry.item.artifact.content, permanentResponse);
          }
        });
        targetRequestUrl = requests[stopIndex].url;
      }
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
      Object.assign(
        collected,
        stop
          ? {
              manager,
              requests,
              numeric,
              signature: { ...signature, mapSnapshot, entries },
              stop: { ...stop },
              caught,
              unexpectedNativePayloads,
              stopResponse,
              initialServerResponse,
              healthyNativeResponse,
              cancelled: stop.cancelledRetryable ? numeric[cancelledIndex] : null,
              cancelledResponse,
              permanent: stop.permanentSibling ? numeric[1 - stopIndex] : null,
              permanentResponse,
              scriptCache: context.scriptCache,
              spies,
            }
          : {
              manager,
              requests,
              numeric,
              signature: { ...signature, mapSnapshot, entries },
              scriptCache: context.scriptCache,
              spies,
            }
      );
    });
    return collected;
  } finally {
    vi.restoreAllMocks();
    context.restore();
  }
}

export { RUN_STOP_UNEXPECTED_PAYLOAD_GUARD, createRunStopAssignment, runRunStopControl };
