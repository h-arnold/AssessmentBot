import { Alert, Flex, Select, Typography } from 'antd';
import type { JSX } from 'react';
import type { LinkableDefinition } from './getLinkableDefinitionsForModal';

export type LinkableDefinitionListProperties = Readonly<{
  linkableDefinitions: LinkableDefinition[];
  selectedDefinitionKey: string | null;
  onSelect: (definitionKey: string) => void;
}>;

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
 * @param {Readonly<LinkableDefinitionListProperties>} properties Component properties.
 * @returns {JSX.Element} The picker body.
 */
export function LinkableDefinitionList(
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
        options={linkableDefinitions.map((d) => ({
          value: d.definitionKey,
          label: d.primaryTitle,
          primaryTitle: d.primaryTitle,
          primaryTopic: d.primaryTopic,
          yearGroupLabel: d.yearGroupLabel,
        }))}
        optionRender={(option) => (
          <Flex vertical gap={2}>
            <Typography.Text strong ellipsis>
              {option.data.primaryTitle}
            </Typography.Text>
            <Typography.Text type="secondary" ellipsis>
              {option.data.primaryTopic} · {option.data.yearGroupLabel}
            </Typography.Text>
          </Flex>
        )}
      />
    </Flex>
  );
}
