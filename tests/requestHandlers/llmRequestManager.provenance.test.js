import { describe, it, expect, vi } from 'vitest';
import {
  STALE_MIXED_MARKS,
  expectSourceRetained,
  runTransportCase,
} from '../helpers/llmRequestManagerHarness.js';

// Three distinct complete responses so final identity/attempt accounting is real
// (same sole-consumer local-stub pattern as the failures suite's exhaustion rows;
// suites do not import one another).
function exhaustedHttpResponses(status) {
  return ['A', 'B', 'C'].map((suffix) => ({
    getResponseCode: () => status,
    getContentText: vi.fn(() => `Service ${status} outcome ${suffix}.`),
  }));
}

/**
 * Runner seam for missing attempt provenance: it wraps the ACTUAL sender with a
 * call-through that deletes ONLY each actually received outcome's attempts field
 * at the BatchComplete boundary. The complete outcomes are snapshotted BEFORE the
 * deletion so the executed preflight can still prove the genuine attempt count
 * and the exact response/error identity the actual sender delivered; no outcome
 * is fabricated and no retry engine is mocked. The routed item's setError seam
 * is recorded so the contract can prove the fault precedes any terminal result.
 */
function wrapSenderDeletingProvenance(manager) {
  const actualSender = manager.sendRequestsInBatches.bind(manager);
  const actualOutcomes = [];
  const [routedEntry] = Object.values(manager.uidIndex);
  const setError = vi.spyOn(routedEntry.item, 'setError');
  const sender = vi
    .spyOn(manager, 'sendRequestsInBatches')
    .mockImplementation((requests, options) =>
      actualSender(requests, {
        ...options,
        onBatchComplete: (outcomes) => {
          outcomes.forEach((outcome) => {
            actualOutcomes.push({ ...outcome });
            delete outcome.attempts;
          });
          return options.onBatchComplete(outcomes);
        },
      })
    );
  return { sender, actualOutcomes, setError };
}

/**
 * Executed preflight shared by both rows: the genuine shared budget was spent
 * (one batched dispatch, two single-request retries, exact 5000/7500 waits) and
 * the actually received outcome carried full attempt provenance and its exact
 * identity BEFORE the boundary deleted it; the run-stop latch never latched.
 */
function expectGenuineExhaustionBeforeDeletion(collected, finalOutcome) {
  expect(collected.fetchAll).toHaveBeenCalledTimes(1);
  expect(collected.fetch).toHaveBeenCalledTimes(2);
  expect(collected.sleep.mock.calls.map((call) => call[0])).toEqual([5000, 7500]);
  expect(collected.spies.actualOutcomes).toHaveLength(1);
  const [actualOutcome] = collected.spies.actualOutcomes;
  expect(actualOutcome.uid).toBe(collected.requests[0].uid);
  expect(actualOutcome.response).toBe(finalOutcome.response);
  expect(actualOutcome.error).toBe(finalOutcome.error);
  expect(actualOutcome.attempts).toBe(3);
  expect(collected.manager.runStopped).toBe(false);
}

/**
 * Required missing-provenance contract (both rows): the public
 * processStudentResponses boundary throws a contextual internal fault BEFORE any
 * terminal result — never a manufactured LLM_RUN_STOPPED/LLM_UNAVAILABLE — with
 * the stale marks, source identity and cache state untouched.
 */
function expectProvenanceFaultContract(collected) {
  expect(collected.caught).toBeInstanceOf(Error);
  expect(collected.caught.message.toLowerCase()).toContain('attempt');
  expect(collected.caught.message).toContain(collected.requests[0].uid);
  expect(collected.caught.message.length).toBeGreaterThan(
    collected.requests[0].uid.length + 'attempt'.length
  );
  expect(collected.spies.setError).not.toHaveBeenCalled();
  expect(collected.item.getAssessment()).toEqual(STALE_MIXED_MARKS);
  expect(collected.scriptCache.put).not.toHaveBeenCalled();
  expectSourceRetained(collected);
}

describe('LLM routed outcome attempt provenance faults', () => {
  it('fails loudly at the public boundary when the routed HTTP-exhaustion outcome loses its attempt provenance', () => {
    const responses = exhaustedHttpResponses(500);
    const collected = runTransportCase(
      {
        fetchAll: vi.fn(() => [responses[0]]),
        fetch: vi
          .fn()
          .mockImplementationOnce(() => responses[1])
          .mockImplementationOnce(() => responses[2]),
        sleep: vi.fn(),
      },
      wrapSenderDeletingProvenance
    );
    expectGenuineExhaustionBeforeDeletion(collected, { response: responses[2], error: null });
    expectProvenanceFaultContract(collected);
  });

  it('fails loudly at the public boundary when the routed null-response network exhaustion loses its attempt provenance', () => {
    const finalError = new Error('NETWORK_PROVENANCE_FINAL sentinel fault');
    const collected = runTransportCase(
      {
        fetchAll: vi.fn(() => {
          throw new Error('NETWORK_PROVENANCE_INITIAL sentinel fault');
        }),
        fetch: vi
          .fn()
          .mockImplementationOnce(() => {
            throw new Error('NETWORK_PROVENANCE_SECOND sentinel fault');
          })
          .mockImplementationOnce(() => {
            throw finalError;
          }),
        sleep: vi.fn(),
      },
      wrapSenderDeletingProvenance
    );
    expectGenuineExhaustionBeforeDeletion(collected, { response: null, error: finalError });
    expectProvenanceFaultContract(collected);
    // The wiring fault is distinct from the original network error, whose exact
    // identity was bound to the actual outcome before deletion.
    expect(collected.caught).not.toBe(finalError);
    expect(collected.caught.message).not.toContain('NETWORK_PROVENANCE');
  });
});
