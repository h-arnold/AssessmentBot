/**
 * Host-card `extra` resolver for the shared `AveragesBasisControl`.
 *
 * Both averaging cards need the same guard: mount the control only when the
 * Class page supplies all three mode props. Direct renders omit them and keep
 * their original card head; standalone Heatmaps renders no control. The guard
 * lives here, outside the component module, so the component file keeps its
 * react-refresh single-component export contract.
 */

import type { JSX } from 'react';
import type { AveragesBasisModeProps } from '@/features/shared/averagesBasisModeProps';
import { AveragesBasisControl } from './AveragesBasisControl';

/**
 * Build a host card's `extra` slot when the full mode contract is supplied.
 *
 * @param {AveragesBasisModeProps} properties - The optional mode props from the host page.
 * @returns {JSX.Element | undefined} The control, or undefined without all three props.
 */
export function renderAveragesBasisControlExtra({
  analysisMode,
  onAnalysisModeChange,
  baselineAvailability,
}: AveragesBasisModeProps): JSX.Element | undefined {
  if (
    analysisMode === undefined ||
    onAnalysisModeChange === undefined ||
    baselineAvailability === undefined
  ) {
    return undefined;
  }
  return (
    <AveragesBasisControl
      analysisMode={analysisMode}
      onAnalysisModeChange={onAnalysisModeChange}
      baselineAvailability={baselineAvailability}
    />
  );
}
