/**
 * Accessible metric icon label with tooltip.
 *
 * Renders a Lucide icon wrapped in an antd Tooltip. The icon's `title` prop
 * exposes an `aria-label` for assistive technology, while the Tooltip provides
 * the visual hover affordance. Icon colour is derived from Ant Design's
 * `token.colorText` via `theme.useToken()`, so it automatically adapts to
 * dark mode.
 *
 * Uses the shared `LucideIcon` wrapper with explicit `size` and `strokeWidth`
 * props for consistent column-header appearance. The wrapper span applies
 * `color: token.colorText`, which `LucideIcon` inherits via `currentColor`.
 */

import type { JSX } from 'react';
import { theme, Tooltip } from 'antd';
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
 * Icon colour is derived from Ant Design's `token.colorText`, making it
 * automatically adapt to dark mode.
 *
 * @param {Readonly<MetricIconLabelProperties>} properties - Component properties.
 * @param {LucideIconComponent} properties.icon - The Lucide icon component to render.
 * @param {string} properties.label - The accessible label and tooltip text.
 * @returns {JSX.Element} The rendered icon with tooltip.
 */
export function MetricIconLabel({ icon, label }: MetricIconLabelProperties): JSX.Element {
  const { token } = theme.useToken();
  return (
    <Tooltip title={label}>
      <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '100%', color: token.colorText }}>
        <LucideIcon icon={icon} size={20} strokeWidth={1.5} title={label} />
      </span>
    </Tooltip>
  );
}
