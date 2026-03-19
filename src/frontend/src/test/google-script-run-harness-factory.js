/**
 * Creates a `google.script.run.apiHandler` mock with per-call callback isolation.
 *
 * Each chained `withSuccessHandler(...).withFailureHandler(...).apiHandler(...)` call
 * receives a fresh runner instance so overlapping requests cannot overwrite one
 * another's handlers.
 *
 * @param {(request: unknown, callbacks: { successHandler: ((response: unknown) => void) | undefined; failureHandler: ((error: unknown) => void) | undefined; }) => void} invokeRequest
 * The request callback to execute when `apiHandler` is invoked.
 * @returns {{ withSuccessHandler: (handler: (response: unknown) => void) => unknown; withFailureHandler: (handler: (error: unknown) => void) => unknown; apiHandler: (request: unknown) => void; }} The mocked runner.
 */
export function createGoogleScriptRunApiHandlerMock(invokeRequest) {
  return createRunner();

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
        invokeRequest(request, {
          successHandler,
          failureHandler,
        });
      },
    };
  }
}
