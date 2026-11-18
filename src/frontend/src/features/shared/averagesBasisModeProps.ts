/**
 * Optional analysis-mode contract shared by the two averaging card hosts.
 *
 * Lives in `features/shared` because it crosses `classPage` (which resolves
 * and threads the props) and `taskHeatmap` (whose table card hosts the mode
 * control), plus the shared `renderAveragesBasisControlExtra`; the heatmap
 * feature must not import from `features/classPage`.
 */

import type { AnalysisMode } from '@/services/dataAnalysis/dataAnalysis.zod';
import type { BaselineAvailability } from './baselineAvailability';

/**
 * Optional mode props threaded from the Class page to its averaging cards.
 *
 * - `analysisMode` reaches the column builders so an `excluded` cell keeps a
 *   mode-aware accessible label; when it is absent the weighting-only wording
 *   is used.
 * - `onAnalysisModeChange` and `baselineAvailability` feed the host card's
 *   `AveragesBasisControl`, which mounts only when all three props are supplied.
 *
 * Direct renders omit the trio and keep their original card head.
 */
export type AveragesBasisModeProps = Readonly<{
  /** The page's current analysis mode (§9.27.3 threading chain). */
  analysisMode?: AnalysisMode;
  /** Change the analysis mode (page-owned state; no persistence). */
  onAnalysisModeChange?: (mode: AnalysisMode) => void;
  /** Baseline availability for the host card's `AveragesBasisControl`. */
  baselineAvailability?: BaselineAvailability;
}>;
