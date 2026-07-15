/**
 * Shared page title and navigation card components.
 *
 * Provides a consistent two-card navigation pattern across all pages:
 *
 * 1. **`PageTitleCard`** — a `Card` (`size="small"`) containing only a
 *    `Typography.Title`. No buttons, no actions. Used for the page-level
 *    heading and (on child pages) the parent page heading.
 *
 * 2. **`PageNavCard`** — a `Card` (`size="small"`) containing a back button
 *    (`type="default"`, icon + label) on the left and action buttons
 *    right-aligned on the right via `Space`.
 *
 * This separation keeps title and navigation concerns independent, so child
 * pages can stack a parent title card above their own title + nav cards
 * without inheriting the parent's action buttons.
 *
 * @remarks
 * Uses `type="default"` for the back button (not `type="text"`) so it carries
 * Ant Design's standard padding and border, visually consistent with other
 * action buttons.
 *
 * @see docs/developer/frontend/frontend-spacing-and-padding-standards.md §4.1
 */

import type { JSX } from 'react';
import { Button, Card, Flex, Space, Typography } from 'antd';
import { ArrowLeft } from 'lucide-react';
import { APP_SPACE_SIZE_TIGHT } from '../../theme/spacing';

type TitleLevel = 2 | 3 | 4;

type PageTitleCardProperties = Readonly<{
  /** The page title text. */
  title: string;
  /** The Typography.Title heading level. */
  titleLevel?: TitleLevel;
}>;

type PageNavCardProperties = Readonly<{
  /** Optional back callback. When provided, a back button is rendered. */
  onBack?: () => void;
  /** The back button label text. */
  backLabel?: string;
  /** The back button aria-label for accessibility. */
  backAriaLabel?: string;
  /** Action buttons rendered right-aligned. */
  actions?: React.ReactNode;
}>;

/** Default back button label. */
const DEFAULT_BACK_LABEL = 'Back';

/** Default back button aria-label. */
const DEFAULT_BACK_ARIA_LABEL = 'Go back';

/** Default title heading level. */
const DEFAULT_TITLE_LEVEL: TitleLevel = 4;

/**
 * Render a page title card — a Card containing only a Typography.Title.
 *
 * @param {PageTitleCardProperties} properties - Component properties.
 * @param {string} properties.title - The page title text.
 * @param {TitleLevel} [properties.titleLevel=4] - The Typography.Title heading level.
 * @returns {JSX.Element} The rendered title Card.
 */
export function PageTitleCard({
  title,
  titleLevel = DEFAULT_TITLE_LEVEL,
}: PageTitleCardProperties): JSX.Element {
  return (
    <Card size="small">
      <Typography.Title level={titleLevel} style={{ margin: 0 }}>
        {title}
      </Typography.Title>
    </Card>
  );
}

/**
 * Render a page navigation card — back button on the left, actions on the right.
 *
 * @param {PageNavCardProperties} properties - Component properties.
 * @param {() => void} [properties.onBack] - Optional back callback.
 * @param {string} [properties.backLabel="Back"] - The back button label text.
 * @param {string} [properties.backAriaLabel="Go back"] - The back button aria-label.
 * @param {React.ReactNode} [properties.actions] - Action buttons for the right side.
 * @returns {JSX.Element} The rendered navigation Card.
 */
export function PageNavCard({
  onBack,
  backLabel = DEFAULT_BACK_LABEL,
  backAriaLabel = DEFAULT_BACK_ARIA_LABEL,
  actions,
}: PageNavCardProperties): JSX.Element {
  return (
    <Card size="small">
      <Flex justify="space-between" align="center">
        {onBack ? (
          <Button
            type="default"
            icon={<ArrowLeft size={16} />}
            aria-label={backAriaLabel}
            onClick={onBack}
          >
            {backLabel}
          </Button>
        ) : <div />}
        {actions ? (
          <Space size={APP_SPACE_SIZE_TIGHT}>{actions}</Space>
        ) : <div />}
      </Flex>
    </Card>
  );
}
