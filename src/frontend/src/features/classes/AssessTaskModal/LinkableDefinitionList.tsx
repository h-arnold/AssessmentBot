import { Alert, Button, Flex, Select, Tooltip, Typography } from 'antd';
import type { BaseOptionType } from 'antd/es/select';
import { memo, type JSX } from 'react';
import type { LinkableDefinition } from './getLinkableDefinitionsForModal';

export type LinkableDefinitionListProperties = Readonly<{
  linkableDefinitions: LinkableDefinition[];
  selectedDefinitionKey: string | null;
  onSelect: (definitionKey: string) => void;
}>;

export type LinkExistingDefinitionButtonProperties = Readonly<{
  hasLinkableDefinitions: boolean;
  onLink: () => void;
}>;

type LinkableDefinitionOption = BaseOptionType & {
  primaryTitle: string;
  primaryTopic: string;
  yearGroupLabel: string;
};

/**
 * Renders the two-line label for a linkable definition option.
 *
 * @param {LinkableDefinitionOption} data The option's linkable definition display fields.
 * @returns {JSX.Element} The formatted option label.
 */
function renderLinkableDefinitionOption({ data }: { data: LinkableDefinitionOption }): JSX.Element {
  return (
    <Flex vertical gap="small">
      <Typography.Text strong ellipsis>{data.primaryTitle}</Typography.Text>
      <Typography.Text type="secondary" ellipsis>
        {data.primaryTopic} · {data.yearGroupLabel}
      </Typography.Text>
    </Flex>
  );
}

/**
 * Renders the choice prompt's action for linking an existing definition.
 *
 * @param {Readonly<LinkExistingDefinitionButtonProperties>} properties Availability and link action.
 * @returns {JSX.Element} The enabled action or its unavailable explanation.
 */
export function LinkExistingDefinitionButton(
  properties: Readonly<LinkExistingDefinitionButtonProperties>
): JSX.Element {
  const { hasLinkableDefinitions, onLink } = properties;
  if (hasLinkableDefinitions) {
    return <Button onClick={onLink}>Link to Existing Definition</Button>;
  }
  return (
    <Tooltip title="No assignment definitions exist for this class's year group.">
      <span>
        <Button disabled>Link to Existing Definition</Button>
      </span>
    </Tooltip>
  );
}

/**
 * Renders the "Link to Existing Definition" picker.
 *
 * @remarks
 * Presentational: no state, no side effects, no React Query, no service calls.
 * The component receives the derived `LinkableDefinition[]` and the current
 * selection, and emits `onSelect(definitionKey)` when the user picks a row
 * from the searchable Select dropdown. Every row is always selectable —
 * no `disabled` prop is used. The Select uses `showSearch` to enable
 * type-to-filter behaviour on the option labels.
 * The selected option displays as the `primaryTitle` only (via `labelRender`);
 * arrow keys, Enter, and Escape are handled by antd defaults.
 *
 * Wrapped in `React.memo` to prevent re-renders on parent state changes when
 * props are stable — the parent (`AssessTaskModal`) manages transient modal
 * state that otherwise triggers unnecessary re-renders of this leaf component.
 *
 * @param {Readonly<LinkableDefinitionListProperties>} properties Component properties.
 * @returns {JSX.Element} The picker body.
 */
export const LinkableDefinitionList = memo(function LinkableDefinitionList(
  properties: Readonly<LinkableDefinitionListProperties>
): JSX.Element {
  const { linkableDefinitions, selectedDefinitionKey, onSelect } = properties;

  return (
    <Flex vertical gap="middle">
      <Alert
        type="info"
        showIcon
        description="Choose the Assignment you want to link this one to:"
      />
      <Select
        data-testid="linkable-definition-select"
        showSearch={{ optionFilterProp: 'label' }}
        value={selectedDefinitionKey}
        onChange={(value) => onSelect(value as string)}
        style={{ width: '100%' }}
        // virtual={false} ensures option elements render in jsdom tests (virtual list omits unmounted options)
        virtual={false}
        notFoundContent="Not found"
        labelRender={(option) => option.label}
        options={linkableDefinitions.map((d) => {
          return {
            value: d.definitionKey,
            label: d.primaryTitle,
            primaryTitle: d.primaryTitle,
            primaryTopic: d.primaryTopic,
            yearGroupLabel: d.yearGroupLabel,
          };
        })}
        optionRender={renderLinkableDefinitionOption}
      />
    </Flex>
  );
});
