import { Alert, Flex, Radio, Typography } from 'antd';
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
 * selection, and emits `onSelect(definitionKey)` when the user picks a row.
 * Every row is always selectable — no `disabled` prop is used. The
 * `Radio.Group` `name` prop enables native arrow-key navigation between rows.
 * The `Radio.Group` with `block` already applies width: 100%, so the outer
 * `Flex` does not need an explicit width style.
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
        description="Link to an existing definition to associate the Google Classroom assignment with it."
      />
      <Radio.Group
        value={selectedDefinitionKey}
        onChange={(event) => onSelect(event.target.value)}
        orientation="vertical"
        block
        name="linkable-definition"
      >
        {linkableDefinitions.map((definition) => (
          <Radio key={definition.definitionKey} value={definition.definitionKey}>
            <Flex vertical gap={2}>
              <Typography.Paragraph strong ellipsis={{ rows: 1 }} style={{ marginBottom: 0 }}>
                {definition.primaryTitle}
              </Typography.Paragraph>
              <Typography.Paragraph type="secondary" ellipsis={{ rows: 1 }} style={{ marginBottom: 0 }}>
                {definition.primaryTopic} · {definition.yearGroupLabel}
              </Typography.Paragraph>
            </Flex>
          </Radio>
        ))}
      </Radio.Group>
    </Flex>
  );
}
