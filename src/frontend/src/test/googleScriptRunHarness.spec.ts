import { describe, expect, it, vi } from 'vitest';
import { createGoogleScriptRunApiHandlerMock } from './googleScriptRunHarness';

/**
 * Focused contract coverage for the shared `google.script.run` harness factory:
 * live-Date rejection (unlike silent `JSON.stringify` coercion), ISO-string
 * passthrough, one-time success serialisation, raw failure delivery, and
 * per-call callback isolation.
 */
describe('googleScriptRunHarness', () => {
  describe('live Date rejection', () => {
    it('throws a TypeError when a nested live Date is present in the apiHandler request', () => {
      const invokeRequest = vi.fn();
      const runner = createGoogleScriptRunApiHandlerMock(invokeRequest);

      expect(() =>
        runner.apiHandler({
          method: 'upsertAssignmentDefinition',
          params: { nested: { updatedAt: new Date('2026-01-06T12:30:00.000Z') } },
        })
      ).toThrow(TypeError);
      expect(invokeRequest).not.toHaveBeenCalled();
    });

    it('throws a TypeError when a live Date is present anywhere in a success response before serialisation', () => {
      const successHandler = vi.fn();
      const runner = createGoogleScriptRunApiHandlerMock((_request, callbacks) => {
        callbacks.successHandler?.({
          ok: true,
          requestId: 'req-date-response',
          data: { rows: [{ updatedAt: new Date('2026-01-06T12:30:00.000Z') }] },
        });
      });

      expect(() => runner.withSuccessHandler(successHandler).apiHandler({ method: 'm' })).toThrow(
        TypeError
      );
      expect(successHandler).not.toHaveBeenCalled();
    });

    it('names the prohibited Date and the ISO-string fix in the TypeError message', () => {
      const runner = createGoogleScriptRunApiHandlerMock(() => {
        /* not reached */
      });

      expect(() => runner.apiHandler({ params: { updatedAt: new Date() } })).toThrow(
        /live Date.*ISO 8601 strings/s
      );
    });

    it('rejects a live Date at the top level of the request graph', () => {
      const runner = createGoogleScriptRunApiHandlerMock(() => {
        /* not reached */
      });

      expect(() => runner.apiHandler(new Date('2026-01-06T12:30:00.000Z'))).toThrow(TypeError);
    });
  });

  describe('ISO-string handling and serialisation fidelity', () => {
    it('accepts ISO-string timestamps in requests and success responses', () => {
      const invokeRequest = vi.fn();
      const isoInstant = '2026-01-06T12:30:00.000Z';
      const successEnvelope = {
        ok: true,
        requestId: 'req-iso-1',
        data: { updatedAt: isoInstant },
      };
      let delivered: string | undefined;

      const runner = createGoogleScriptRunApiHandlerMock((request, callbacks) => {
        invokeRequest(request);
        callbacks.successHandler?.(successEnvelope);
      });

      runner
        .withSuccessHandler((value) => {
          delivered = value as string;
        })
        .apiHandler({ method: 'upsertAssignmentDefinition', params: { updatedAt: isoInstant } });

      expect(invokeRequest).toHaveBeenCalledTimes(1);
      expect(typeof delivered).toBe('string');
      expect(JSON.parse(delivered!)).toEqual(successEnvelope);
    });

    it('stringifies the success payload exactly once', () => {
      const successEnvelope = { ok: true, requestId: 'req-once', data: { done: true } };
      let delivered: string | undefined;

      const runner = createGoogleScriptRunApiHandlerMock((_request, callbacks) => {
        callbacks.successHandler?.(successEnvelope);
      });

      runner
        .withSuccessHandler((value) => {
          delivered = value as string;
        })
        .apiHandler({ method: 'm' });

      // A second stringify would leave a JSON string (not an object) after one parse.
      expect(typeof delivered).toBe('string');
      expect(JSON.parse(delivered!)).toEqual(successEnvelope);
      expect(typeof JSON.parse(delivered!)).toBe('object');
    });

    it('delivers failure payloads raw without JSON stringification', () => {
      const failureHandler = vi.fn();
      const rawFailure = 'Exception: Google Apps Script request failed';

      const runner = createGoogleScriptRunApiHandlerMock((_request, callbacks) => {
        callbacks.failureHandler?.(rawFailure);
      });

      runner.withFailureHandler(failureHandler).apiHandler({ method: 'm' });

      expect(failureHandler).toHaveBeenCalledWith(rawFailure);
    });
  });

  describe('callback isolation', () => {
    it('keeps concurrent request handlers bound to their own success callbacks', () => {
      const alphaHandler = vi.fn();
      const betaHandler = vi.fn();
      const release: Record<string, () => void> = {};

      const runner = createGoogleScriptRunApiHandlerMock((request, callbacks) => {
        const method = (request as { method?: string }).method!;
        release[method] = () => callbacks.successHandler?.({ ok: true, requestId: method });
      });

      runner.withSuccessHandler(alphaHandler).apiHandler({ method: 'alpha' });
      runner.withSuccessHandler(betaHandler).apiHandler({ method: 'beta' });

      release.beta();
      release.alpha();

      expect(betaHandler).toHaveBeenCalledTimes(1);
      expect(JSON.parse(betaHandler.mock.calls[0][0] as string)).toMatchObject({
        requestId: 'beta',
      });
      expect(alphaHandler).toHaveBeenCalledTimes(1);
      expect(JSON.parse(alphaHandler.mock.calls[0][0] as string)).toMatchObject({
        requestId: 'alpha',
      });
    });
  });
});
