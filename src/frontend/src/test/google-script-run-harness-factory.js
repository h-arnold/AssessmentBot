/**
 * Creates a `google.script.run.apiHandler` mock with per-call callback isolation.
 *
 * Each chained `withSuccessHandler(...).withFailureHandler(...).apiHandler(...)` call
 * receives a fresh runner instance so overlapping requests cannot overwrite one
 * another's handlers.
 *
 * Live `Date` values are rejected on the request graph and on the success-response
 * graph before serialisation. Real `google.script.run` prohibits `Date` (including
 * nested values); `JSON.stringify` would silently convert them to ISO strings and
 * hide the transport violation. ISO 8601 strings remain valid and pass through.
 *
 * This factory is injected into Playwright via `Function.prototype.toString()`, so
 * every helper must stay nested inside the exported function (no outer-scope imports).
 *
 * @param {(request: unknown, callbacks: { successHandler: ((response: unknown) => void) | undefined; failureHandler: ((error: unknown) => void) | undefined; }) => void} invokeRequest
 * The request callback to execute when `apiHandler` is invoked.
 * @returns {{ withSuccessHandler: (handler: (response: unknown) => void) => unknown; withFailureHandler: (handler: (error: unknown) => void) => unknown; apiHandler: (request: unknown) => void; }} The mocked runner.
 */
export function createGoogleScriptRunApiHandlerMock(invokeRequest) {
  const LIVE_DATE_FIX =
    'Convert Date values to ISO 8601 strings at the API boundary before transport (for example with DateUtils.normaliseDateFields or DateUtils.deepConvertDates).';

  return createRunner();

  /**
   * Throws a clear `TypeError` when a live `Date` is present anywhere in `value`.
   *
   * Walks plain objects and arrays with a cycle guard so nested transport graphs
   * are covered without relying on `JSON.stringify`'s silent Date coercion.
   *
   * @param {*} value - Request or success-response graph to inspect.
   * @param {string} boundary - Human-readable boundary label for the error message.
   * @param {WeakSet<object>} [seen] - Cycle guard for nested object graphs.
   * @returns {void} Returns nothing.
   * @throws {TypeError} When a live `Date` is found; actionable fix is ISO-string conversion at the API boundary.
   */
  function assertNoLiveDates(value, boundary, seen) {
    if (value instanceof Date) {
      throw new TypeError(
        'google.script.run ' + boundary + ' contains a live Date. ' + LIVE_DATE_FIX
      );
    }

    if (value === null || typeof value !== 'object') {
      return;
    }

    const visited = seen || new WeakSet();
    if (visited.has(value)) {
      return;
    }
    visited.add(value);

    if (Array.isArray(value)) {
      for (const item of value) {
        assertNoLiveDates(item, boundary, visited);
      }
      return;
    }

    for (const key of Object.keys(value)) {
      assertNoLiveDates(value[key], boundary, visited);
    }
  }

  /**
   * Creates a runner snapshot with the currently registered handlers.
   *
   * @param {((response: unknown) => void) | undefined} successHandler The current success handler.
   * @param {((error: unknown) => void) | undefined} failureHandler The current failure handler.
   * @returns {{ withSuccessHandler: (handler: (response: unknown) => void) => unknown; withFailureHandler: (handler: (error: unknown) => void) => unknown; apiHandler: (request: unknown) => void; }} The runner snapshot.
   */
  function createRunner(successHandler, failureHandler) {
    return {
      withSuccessHandler(nextSuccessHandler) {
        return createRunner(nextSuccessHandler, failureHandler);
      },
      withFailureHandler(nextFailureHandler) {
        return createRunner(successHandler, nextFailureHandler);
      },
      apiHandler(request) {
        assertNoLiveDates(request, 'request');
        invokeRequest(request, {
          successHandler: successHandler
            ? (value) => {
                assertNoLiveDates(value, 'success response');
                successHandler(JSON.stringify(value));
              }
            : undefined,
          failureHandler,
        });
      },
    };
  }
}
