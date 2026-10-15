import {
  createAssignmentDefinitionPartials,
  createClassPartials,
  createDatasetState,
  createMockQueryResult,
} from '../heatmapsPageDataFixtures';
import type { StartupWarmupDatasetKey } from '../../query/sharedQueries';

/**
 * Build the ready dataset result used by the Heatmaps page-data hook specs.
 *
 * @param {StartupWarmupDatasetKey} datasetKey - The dataset requested by the hook.
 * @returns {object} A ready query and dataset-state pair.
 */
export function createReadyHeatmapsDatasetResult(datasetKey: StartupWarmupDatasetKey): {
  query: ReturnType<typeof createMockQueryResult<unknown>>;
  datasetState: ReturnType<typeof createDatasetState>;
} {
  return {
    query: createMockQueryResult<unknown>({
      data: getHeatmapsDatasetData(datasetKey),
    }),
    datasetState: createDatasetState(),
  };
}

/**
 * Select the fixture supported by the Heatmaps hook and reject unsupported keys.
 *
 * @param {StartupWarmupDatasetKey} datasetKey - The requested startup dataset.
 * @returns {unknown} The corresponding fixture data.
 */
function getHeatmapsDatasetData(datasetKey: StartupWarmupDatasetKey): unknown {
  switch (datasetKey) {
    case 'classPartials': {
      return createClassPartials();
    }
    case 'assignmentDefinitionPartials': {
      return createAssignmentDefinitionPartials();
    }
    default: {
      throw new Error(`Unsupported Heatmaps dataset: ${datasetKey}`);
    }
  }
}
