/**
 * Accessible metric icon label with tooltip.
 *
 * Renders a Lucide icon wrapped in an antd Tooltip. The icon receives an explicit
 * `aria-label` for assistive technology, while the Tooltip provides the visual
 * hover affordance. Icon colour is derived from Ant Design's
 * `token.colorText` via `theme.useToken()`, so it automatically adapts to
 * dark mode.
 *
 * This component renders the icon directly via `createElement` rather than
 * using the shared `LucideIcon` wrapper. The `LucideIcon` wrapper routes the
 * icon through antd's `Icon` component, which injects `svgBaseProps`
 * (`width: '1em'`, `height: '1em'`, `fill: 'currentColor'`) into the inner
 * component's props. Even though `LucideIcon` overrides `fill` with `'none'`,
 * the antd injection of `width`/`height` as `'1em'` strings conflicts with
 * the numeric `size` prop, causing the stroke to render at the wrong visual
 * weight. Rendering directly avoids this interference.
 */

import type { JSX } from 'react';
import { theme, Tooltip } from 'antd';
import { createElement } from 'react';
import type { LucideIconComponent } from '../icons/LucideIcon';

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
        {createElement(icon, {
          size: 20,
          strokeWidth: 1.5,
          'aria-label': label,
        })}
      </span>
    </Tooltip>
  );
}
