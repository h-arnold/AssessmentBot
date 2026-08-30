import { Typography } from 'antd';

/**
 * Feature-owned entry component for the standalone Heatmaps builder surface.
 *
 * @remarks
 * Placeholder stub only. Section 6 assembles the full builder surface (selection
 * bar, merged heatmap table, and chrome). The composition boundary
 * `HeatmapsPage` → `HeatmapBuilderSurface` is final; only this component's internals
 * are replaced in Section 6. This stub intentionally imports nothing from `pages/`
 * to preserve the feature/pages dependency direction.
 *
 * @returns {JSX.Element} The rendered placeholder builder surface.
 */
export function HeatmapBuilderSurface() {
  return <Typography.Title level={2}>Heatmaps</Typography.Title>;
}
