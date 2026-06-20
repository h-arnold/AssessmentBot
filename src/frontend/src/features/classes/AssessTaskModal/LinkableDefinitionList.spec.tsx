import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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
  it('renders the Alert with the updated copy', () => {
    render(
      <LinkableDefinitionList
        linkableDefinitions={[createLinkable()]}
        selectedDefinitionKey={null}
        onSelect={() => {}}
      />
    );

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Choose the Assignment you want to link this one to:'
    );
  });

  it('renders a combobox', () => {
    render(
      <LinkableDefinitionList
        linkableDefinitions={[createLinkable()]}
        selectedDefinitionKey={null}
        onSelect={() => {}}
      />
    );

    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('does not render a radio group', () => {
    render(
      <LinkableDefinitionList
        linkableDefinitions={[createLinkable()]}
        selectedDefinitionKey={null}
        onSelect={() => {}}
      />
    );

    expect(screen.queryByRole('radio')).toBeNull();
    expect(screen.queryByRole('radiogroup')).toBeNull();
  });

  it('shows the expected options when opened', () => {
    const definitions = [
      createLinkable({ definitionKey: 'def-001', primaryTitle: 'Essay 1' }),
      createLinkable({ definitionKey: 'def-002', primaryTitle: 'Essay 2' }),
      createLinkable({ definitionKey: 'def-003', primaryTitle: 'Essay 3' }),
    ];

    render(
      <LinkableDefinitionList
        linkableDefinitions={definitions}
        selectedDefinitionKey={null}
        onSelect={() => {}}
      />
    );

    const combobox = screen.getByRole('combobox');
    fireEvent.mouseDown(combobox);

    expect(screen.getByText('Essay 1')).toBeInTheDocument();
    expect(screen.getByText('Essay 2')).toBeInTheDocument();
    expect(screen.getByText('Essay 3')).toBeInTheDocument();
  });

  it('renders the title and subtitle for each option', () => {
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

    const combobox = screen.getByRole('combobox');
    fireEvent.mouseDown(combobox);

    expect(screen.getByText('Essay')).toBeInTheDocument();
    expect(screen.getByText('Writing · Year 10')).toBeInTheDocument();
  });

  it('calls onSelect with the definitionKey when an option is selected', () => {
    const onSelect = vi.fn();

    render(
      <LinkableDefinitionList
        linkableDefinitions={[
          createLinkable({ definitionKey: 'def-001', primaryTitle: 'Essay 1' }),
          createLinkable({ definitionKey: 'def-002', primaryTitle: 'Essay 2' }),
        ]}
        selectedDefinitionKey={null}
        onSelect={onSelect}
      />
    );

    const combobox = screen.getByRole('combobox');

    // Select the first option
    fireEvent.mouseDown(combobox);
    fireEvent.click(screen.getAllByRole('option')[0]);
    expect(onSelect).toHaveBeenCalledWith('def-001');
    expect(onSelect).toHaveBeenCalledTimes(1);

    // Re-open the dropdown and select the second option
    fireEvent.mouseDown(combobox);
    fireEvent.click(screen.getAllByRole('option')[1]);
    expect(onSelect).toHaveBeenCalledWith('def-002');
    const EXPECTED_CALL_COUNT_AFTER_TWO_SELECTIONS = 2;
    expect(onSelect.mock.calls).toHaveLength(EXPECTED_CALL_COUNT_AFTER_TWO_SELECTIONS);
  });

  it('reflects the selectedDefinitionKey prop', () => {
    render(
      <LinkableDefinitionList
        linkableDefinitions={[
          createLinkable({ definitionKey: 'def-001', primaryTitle: 'Essay 1' }),
          createLinkable({ definitionKey: 'def-002', primaryTitle: 'Essay 2' }),
        ]}
        selectedDefinitionKey="def-002"
        onSelect={() => {}}
      />
    );

    expect(screen.getByText('Essay 2')).toBeInTheDocument();
  });

  it('renders with no options when linkableDefinitions is empty', () => {
    render(
      <LinkableDefinitionList
        linkableDefinitions={[]}
        selectedDefinitionKey={null}
        onSelect={() => {}}
      />
    );

    expect(screen.getByRole('combobox')).toBeInTheDocument();

    const combobox = screen.getByRole('combobox');
    fireEvent.mouseDown(combobox);

    expect(screen.getByText('Not found')).toBeInTheDocument();
  });
});
