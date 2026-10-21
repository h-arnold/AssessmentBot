import { useLayoutEffect, useState } from 'react';
import { App } from 'antd';
import { renderWithFrontendProviders } from '../renderWithFrontendProviders';
import { usePostAnalysisTasks } from '@/hooks/usePostAnalysisTasks';
import type { PostAnalysisContext } from '@/services/dataAnalysis/postAnalysis/postAnalysis.zod';
import type { PostAnalysisTaskDescriptor } from '@/services/dataAnalysis/postAnalysis/runPostAnalysisTasks';

/** Renders the shared hook through the existing frontend provider helper.
 * @param {PostAnalysisContext | null} context - Explicit owner context.
 * @param {readonly PostAnalysisTaskDescriptor[]} tasks - Local task probes or production registry.
 * @param {boolean} isStrict - Whether to replay mount effects under StrictMode.
 * @returns {object} Committed snapshots and context update/unmount controls.
 */
export function renderPostAnalysisOwner(
  context: PostAnalysisContext | null,
  tasks: readonly PostAnalysisTaskDescriptor[],
  isStrict: boolean
) {
  let observed: ReturnType<typeof usePostAnalysisTasks>;
  let updateContext: (next: PostAnalysisContext | null) => void;

  /** Observes committed state through the existing provider helper.
   * @returns {React.JSX.Element} Owner commit marker.
   */
  function Owner() {
    const [input, setInput] = useState(context);
    const state = usePostAnalysisTasks(input, tasks, input?.classFull.classId ?? null);
    useLayoutEffect(() => {
      observed = state;
      updateContext = setInput;
    }, [state]);
    return <div data-testid="post-analysis-owner">{input?.classFull.classId}</div>;
  }

  const view = renderWithFrontendProviders(
    <App>
      <Owner />
    </App>,
    {
      renderOptions: { reactStrictMode: isStrict },
    }
  );
  return {
    ...view,
    read: () => observed,
    update: (next: PostAnalysisContext | null) => updateContext(next),
  };
}
