/**
 * The Recent Assignments section for the Class page.
 *
 * Renders a section `Card` (`size="small"`, `title="Recent Assignments"`)
 * wrapping:
 * - A row of up to three `RecentAssignmentCard` components, centre-aligned
 *   via `Flex`, when `recentAssignments` is non-empty.
 * - An `Empty` component with a CTA button inside the card body when
 *   `recentAssignments` is empty.
 *
 * @remarks
 * Pure presentational component; owns no state and performs no data fetching.
 * The `onStartNewAssessment` callback is passed from the page composition root
 * and is wired to both the empty-state CTA button and the header action.
 *
 * The empty state is a positive nudge for new classes (not an error). The
 * card `title` ("Recent Assignments") renders above both the card row and
 * the empty state so the section structure is always clear.
 *
 * @see SPEC_CLASS_PAGE.md — "RecentAssignmentsSection"
 * @see CLASS_PAGE_LAYOUT.md — "3. Recent Assignments Section"
 */

import type { JSX } from 'react';
import { Button, Card, Empty, Flex } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { RecentAssignmentCardModel } from './classPageAdapter.zod';
import { RecentAssignmentCard } from './RecentAssignmentCard';
import { pageContent } from '../../pages/pageContent';

type RecentAssignmentsSectionProperties = Readonly<{
  /** The list of recent assignment cards to render (up to 3). */
  recentAssignments: RecentAssignmentCardModel[];
  /** Callback invoked when the user clicks "Start New Assessment". */
  onStartNewAssessment: () => void;
}>;

/**
 * Render the Recent Assignments section.
 *
 * Renders a section `Card` with `title="Recent Assignments"` wrapping either
 * a row of `RecentAssignmentCard` components (1-3, centre-aligned) or an
 * `Empty` component with a CTA button when recentAssignments is empty.
 *
 * @param {Readonly<RecentAssignmentsSectionProperties>} root0 - Component properties.
 * @param {RecentAssignmentCardModel[]} root0.recentAssignments - The list of recent assignment cards.
 * @param {() => void} root0.onStartNewAssessment - Callback invoked when the user clicks "Start New Assessment".
 * @returns {JSX.Element} The Recent Assignments section card.
 */
export function RecentAssignmentsSection({
  recentAssignments,
  onStartNewAssessment,
}: RecentAssignmentsSectionProperties): JSX.Element {
  return (
    <Card size="small" title="Recent Assignments">
      {recentAssignments.length === 0 ? (
        <Empty
          description={pageContent.classDetail.recentAssignmentsEmpty}
        >
          <Button type="primary" icon={<PlusOutlined />} onClick={onStartNewAssessment}>
            Start New Assessment
          </Button>
        </Empty>
      ) : (
        <Flex justify="center" gap="middle" wrap>
          {recentAssignments.map((card) => (
            <RecentAssignmentCard key={card.assignmentId} card={card} />
          ))}
        </Flex>
      )}
    </Card>
  );
}
