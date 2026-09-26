import { Button, Space } from 'antd';
import type { JSX } from 'react';
import { derivePrimaryActionState } from './assignmentWizardFormState';
import { APP_SPACE_SIZE_DEFAULT } from '../../theme/spacing';
import type { AssignmentDefinitionWizardReviewContentProperties } from './AssignmentDefinitionWizardReviewContent';

/**
 * Renders the review footer with cancel and primary action buttons.
 * Shared by the chrome-free review content and the full-shell modal, so both
 * surfaces keep a single footer definition inside their own chrome.
 *
 * @param {AssignmentDefinitionWizardReviewContentProperties} properties Review content properties.
 * @returns {JSX.Element} The footer element.
 */
export function AssignmentDefinitionWizardReviewFooter(
  properties: AssignmentDefinitionWizardReviewContentProperties
): JSX.Element {
  const onPrimaryClick = properties.onPrimaryAction ?? properties.onSubmit;
  // Falls back to the shared derivation so mode and parsed-state labels cannot diverge.
  const { primaryActionLabel: derivedPrimaryActionLabel } = derivePrimaryActionState(
    properties.mode === 'create',
    properties.hasParsedTasks ?? false,
    {}
  );
  const primaryActionLabel = properties.primaryActionLabel ?? derivedPrimaryActionLabel;
  const isPrimaryActionDisabled = properties.isPrimaryActionDisabled ?? false;

  return (
    <Space size={APP_SPACE_SIZE_DEFAULT}>
      <Button disabled={properties.isMutationBusy} onClick={properties.onCancel}>
        Cancel
      </Button>
      {onPrimaryClick === undefined ? null : (
        <Button
          disabled={isPrimaryActionDisabled || properties.isMutationBusy}
          loading={properties.isMutationBusy}
          onClick={onPrimaryClick}
          type="primary"
        >
          {primaryActionLabel}
        </Button>
      )}
    </Space>
  );
}
