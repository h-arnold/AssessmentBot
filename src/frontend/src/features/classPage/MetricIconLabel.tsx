/**
 * Accessible metric icon label with tooltip.
 *
 * Renders a Lucide icon wrapped in an antd Tooltip. The icon's `title` prop
 * exposes an `aria-label` for assistive technology, while the Tooltip provides
 * the visual hover affordance.
 */

import type { JSX } from 'react';
import { Tooltip } from 'antd';
import { LucideIcon, type LucideIconComponent } from '../../components/icons/LucideIcon';

type MetricIconLabelProperties = Readonly<{
  /** The Lucide icon component to render. */
  icon: LucideIconComponent;
  /** The accessible label and tooltip text. */
  label: string;
}>;

/**
 * Render an accessible metric icon with tooltip.
 *
 * @param {Readonly<MetricIconLabelProperties>} properties - Component properties.
 * @param {LucideIconComponent} properties.icon - The Lucide icon component to render.
 * @param {string} properties.label - The accessible label and tooltip text.
 * @returns {JSX.Element} The rendered icon with tooltip.
 */
export function MetricIconLabel({ icon, label }: MetricIconLabelProperties): JSX.Element {
  return (
    <Tooltip title={label}>
      <LucideIcon icon={icon} title={label} />
    </Tooltip>
  );
}
