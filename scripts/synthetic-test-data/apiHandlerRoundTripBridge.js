import {
  loadApiHandlerModule,
  setupApiHandlerTestContext,
  teardownApiHandlerTestContext,
} from '../../tests/helpers/apiHandlerTestUtils.js';
import { loadSyntheticAnalysisProfile } from './loadSyntheticAnalysisProfile.js';

/**
 * Node-side round-trip bridge between the synthetic analysis corpus and the real
 * `apiHandler` dispatcher.
 *
 * @remarks
 * The bridge composes the established `tests/helpers/apiHandlerTestUtils.js`
 * dispatcher seams rather than reimplementing envelope behaviour. Each call
 * installs isolated controller/transport seams that supply the committed
 * generated transport views, dispatches once through the real `apiHandler`, then
 * restores every seam so overlapping requests cannot leak state into one
 * another. The returned backend envelope (success or failure) travels through
 * the caller's success path, matching `google.script.run` semantics; only a
 * thrown dispatch error is routed to the failure path. It does not seed
 * persistence or re-exercise controllers and response mappers.
 */

/**
 * Creates a round-trip bridge for a committed synthetic analysis profile.
 *
 * @param {{vi: object, profileName: string}} options Bridge options: the Vitest API used by the shared seam helper and the committed profile name.
 * @returns {{invokeRequest: (request: unknown, callbacks: {successHandler?: (value: unknown) => void, failureHandler?: (error: unknown) => void}) => void}} The bridge handle.
 */
export function createApiHandlerRoundTripBridge(options) {
  const { vi, profileName } = options;
  const classesById = new Map(
    Object.entries(loadSyntheticAnalysisProfile(profileName, 'classesById'))
  );
  const assignmentDefinitionPartials = loadSyntheticAnalysisProfile(
    profileName,
    'assignmentDefinitionPartials'
  );

  const seamBehaviours = {
    abclassMutationsBehaviour: {
      getABClass_: (parameters) => classesById.get(parameters.classId) ?? null,
    },
    assignmentDefinitionBehaviour: {
      getAssignmentDefinitionPartials_: () => assignmentDefinitionPartials,
      deleteAssignmentDefinition_: () => null,
    },
  };

  return {
    invokeRequest(request, callbacks) {
      const context = setupApiHandlerTestContext(vi, seamBehaviours);

      let response;
      try {
        response = loadApiHandlerModule().apiHandler(request);
      } catch (error) {
        teardownApiHandlerTestContext(vi, context);
        callbacks.failureHandler?.(error);
        return;
      }

      teardownApiHandlerTestContext(vi, context);
      callbacks.successHandler?.(response);
    },
  };
}
