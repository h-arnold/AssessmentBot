/**
 * Metric display metadata constants and types.
 *
 * Defines the shared display metadata (labels and icons) and metric key types
 * consumed by the Class page and other metric display surfaces.
 *
 * @module metricDisplayMeta
 */

import { ListTodo, Merge, SpellCheck, Target } from 'lucide-react';
import type { LucideIconComponent } from '../../../components/icons/LucideIcon';

// ---------------------------------------------------------------------------
// Exported types
// ---------------------------------------------------------------------------

/** The metric keys that appear as sub-columns under each heatmap task group. */
export type HeatmapMetricKey = 'completeness' | 'accuracy' | 'spag';

/** All metric column keys (heatmap sub-columns plus the average rollup). */
export type MetricColumnKey = 'completeness' | 'accuracy' | 'spag' | 'average';

// ---------------------------------------------------------------------------
// Metric display metadata
// ---------------------------------------------------------------------------

/** Shared metric display metadata: label and icon for each metric key. */
export const METRIC_DISPLAY_META: ReadonlyMap<
  MetricColumnKey,
  { readonly label: string; readonly icon: LucideIconComponent }
> = new Map([
  ['completeness', { label: 'Completeness', icon: ListTodo }],
  ['accuracy', { label: 'Accuracy', icon: Target }],
  ['spag', { label: 'SPaG', icon: SpellCheck }],
  ['average', { label: 'Average', icon: Merge }],
]);

/** The three metric keys appearing as sub-columns under each heatmap task group. */
export const HEATMAP_METRIC_KEYS: readonly HeatmapMetricKey[] = [
  'completeness',
  'accuracy',
  'spag',
];
