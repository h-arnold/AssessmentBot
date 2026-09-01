import { HeatmapBuilderSurface } from '../features/taskHeatmap/HeatmapBuilderSurface';

/**
 * Thin composition root for the standalone Heatmaps page.
 *
 * Renders ONLY the feature-owned builder surface. The feature surface owns all
 * chrome, state, and behaviour for this page; this root contains no hooks,
 * services, or state machines (mirrors the thinness of `ClassesPage.tsx`).
 *
 * @returns {JSX.Element} The rendered Heatmaps page composition root.
 */
export function HeatmapsPage() {
  return <HeatmapBuilderSurface />;
}
