import {
  createGoogleScriptRunApiHandlerMock,
  type GoogleScriptRunApiHandler,
  type GoogleScriptRunApiHandlerCallbacks,
} from './googleScriptRunHarness';

/**
 * Invokes the script-owned synthetic dispatcher round-trip bridge for one request.
 *
 * @remarks
 * The Node integration spec supplies this invocation, so the adapter never
 * imports the `scripts/` domain and stays inside the frontend test boundary.
 */
export type SyntheticBridgeInvocation = (
  request: unknown,
  callbacks: GoogleScriptRunApiHandlerCallbacks
) => void;

/**
 * Creates the frontend `google.script.run.apiHandler` runner for a synthetic
 * dispatcher round-trip invocation.
 *
 * @remarks
 * The runner composes the in-tree `googleScriptRunHarness` rather than
 * reimplementing GAS callback behaviour: success values keep the harness's
 * mandatory single JSON stringification, raw failures stay raw, and every call
 * receives its own callback chain so overlapping requests cannot overwrite one
 * another's handlers.
 *
 * @param {SyntheticBridgeInvocation} invokeRequest - The script-owned bridge invocation.
 * @returns {GoogleScriptRunApiHandler} The harness runner.
 */
export function createSyntheticApiRoundTripRunner(
  invokeRequest: SyntheticBridgeInvocation
): GoogleScriptRunApiHandler {
  return createGoogleScriptRunApiHandlerMock(invokeRequest);
}
