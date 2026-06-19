import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LinkableDefinitionList } from './LinkableDefinitionList';
import type { LinkableDefinition } from './getLinkableDefinitionsForModal';

const createLinkable = (
  overrides: Partial<LinkableDefinition> = {}
): LinkableDefinition => ({
  definitionKey: 'def-001',
  primaryTitle: 'Essay',
  primaryTopic: 'Writing',
  yearGroupKey: 'year-10',
  yearGroupLabel: 'Year 10',
  updatedAt: '2025-01-01T00:00:00.000Z',
  alternateTitles: [],
  alternateTopics: [],
  documentType: 'SLIDES',
  referenceDocumentId: 'ref-001',
  templateDocumentId: 'tpl-001',
  ...overrides,
});

describe('LinkableDefinitionList', () => {
  it('renders the Alert with the extended copy', () => {
    render(
      <LinkableDefinitionList
        linkableDefinitions={[createLinkable()]}
        selectedDefinitionKey={null}
        onSelect={() => {}}
      />
    );

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Link to an existing definition to associate the Google Classroom assignment with it.'
    );
  });

  it('renders one Radio per LinkableDefinition', () => {
    const definitions = [
      createLinkable({ definitionKey: 'def-001' }),
      createLinkable({ definitionKey: 'def-002' }),
      createLinkable({ definitionKey: 'def-003' }),
    ];

    render(
      <LinkableDefinitionList
        linkableDefinitions={definitions}
        selectedDefinitionKey={null}
        onSelect={() => {}}
      />
    );

    expect(screen.getAllByRole('radio')).toHaveLength(definitions.length);
  });

  it('does not disable any Radio row', () => {
    const definitions = [
      createLinkable({ definitionKey: 'def-001' }),
      createLinkable({ definitionKey: 'def-002' }),
      createLinkable({ definitionKey: 'def-003' }),
    ];

    render(
      <LinkableDefinitionList
        linkableDefinitions={definitions}
        selectedDefinitionKey={null}
        onSelect={() => {}}
      />
    );

    const radios = screen.getAllByRole('radio');
    radios.forEach((radio) => {
      expect(radio).not.toBeDisabled();
    });
  });

  it('renders the title and subtitle for each row', () => {
    render(
      <LinkableDefinitionList
        linkableDefinitions={[
          createLinkable({
            definitionKey: 'def-001',
            primaryTitle: 'Essay',
            primaryTopic: 'Writing',
            yearGroupLabel: 'Year 10',
          }),
        ]}
        selectedDefinitionKey={null}
        onSelect={() => {}}
      />
    );

    expect(screen.getByText('Essay')).toBeInTheDocument();
    expect(screen.getByText('Writing · Year 10')).toBeInTheDocument();
  });

  it('renders Radio.Group with name="linkable-definition"', () => {
    render(
      <LinkableDefinitionList
        linkableDefinitions={[createLinkable()]}
        selectedDefinitionKey={null}
        onSelect={() => {}}
      />
    );

    // The name prop on Radio.Group propagates to each <input type="radio">
    // rather than the radiogroup container element.
    const radios = screen.getAllByRole('radio');
    radios.forEach((radio) => {
      expect(radio).toHaveAttribute('name', 'linkable-definition');
    });
  });

  it('renders Radio.Group with orientation="vertical" and block', () => {
    render(
      <LinkableDefinitionList
        linkableDefinitions={[createLinkable()]}
        selectedDefinitionKey={null}
        onSelect={() => {}}
      />
    );

    const radioGroup = screen.getByRole('radiogroup');
    expect(radioGroup).toHaveClass('ant-radio-group-vertical');
    expect(radioGroup).toHaveClass('ant-radio-group-block');
    expect(screen.getAllByRole('radio')).toHaveLength(1);
  });

  it('calls onSelect with the definitionKey when a row is selected', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();

    render(
      <LinkableDefinitionList
        linkableDefinitions={[
          createLinkable({ definitionKey: 'def-001' }),
          createLinkable({ definitionKey: 'def-002' }),
        ]}
        selectedDefinitionKey={null}
        onSelect={onSelect}
      />
    );

    const radios = screen.getAllByRole('radio');
    await user.click(radios[0]);
    expect(onSelect).toHaveBeenCalledWith('def-001');

    await user.click(radios[1]);
    expect(onSelect).toHaveBeenCalledWith('def-002');
  });

  it('visually reflects the selectedDefinitionKey prop', () => {
    render(
      <LinkableDefinitionList
        linkableDefinitions={[
          createLinkable({ definitionKey: 'def-001' }),
          createLinkable({ definitionKey: 'def-002' }),
        ]}
        selectedDefinitionKey="def-002"
        onSelect={() => {}}
      />
    );
    const radios = screen.getAllByRole('radio');
    expect(radios[0]).not.toBeChecked();
    expect(radios[1]).toBeChecked();
  });

  it('renders without error and produces no radios when linkableDefinitions is empty', () => {
    render(
      <LinkableDefinitionList
        linkableDefinitions={[]}
        selectedDefinitionKey={null}
        onSelect={() => {}}
      />
    );

    // The Alert should still render
    expect(screen.getByRole('alert')).toBeInTheDocument();
    // No radio rows when there are no definitions
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
  });
});
