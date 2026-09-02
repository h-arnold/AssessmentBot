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
  // Wrap the feature surface in the shared page-width token so it matches every
  // sibling top-level page (--app-page-width-wide-data) without reintroducing a
  // duplicate heading or page chrome — PageTitleCard already supplies the title.
  return (
    <div className="app-page-content">
      <HeatmapBuilderSurface />
    </div>
  );
}
