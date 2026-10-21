import type { App } from 'antd';
import type { PostAnalysisTaskOutcome } from '@/services/dataAnalysis/postAnalysis/runPostAnalysisTasks';

type NotificationHost = ReturnType<typeof App.useApp>['notification'];

/** Owns metadata warning identity and dismissal memory, independently of effects. */
export class PostAnalysisFeedback {
  private readonly ownerId: string;
  private readonly shown: Set<string>;
  private readonly owned: Map<string, NotificationHost>;
  private classId: string | null;
  private lifetime: object | null;

  /** Initialises mount-local ownership and dismissal memory.
   * @param {string} ownerId - React mount identity, disambiguating shared-host owners.
   */
  constructor(ownerId: string) {
    this.ownerId = ownerId;
    this.shown = new Set();
    this.owned = new Map();
    this.classId = null;
    this.lifetime = null;
  }

  /** Tracks actual owner departure; synchronous StrictMode replay cancels disposal.
   * @returns {() => void} Marks departure immediately and disposes notices after replay.
   */
  mount(): () => void {
    const lifetime = {};
    this.lifetime = lifetime;
    return () => {
      this.lifetime = null;
      queueMicrotask(() => {
        if (this.lifetime === null) this.destroy();
      });
    };
  }

  /** Destroys only this owner's keys when the class changes or becomes absent.
   * @param {string | null} classId - Next committed class identity.
   * @returns {void} Leaves ordinary same-class reattachments untouched.
   */
  navigate(classId: string | null): void {
    if (classId !== this.classId) this.destroy();
    this.classId = classId;
  }

  /** Publishes safe metadata-only warning copy at most once per attempted source.
   * @param {NotificationHost} host - Existing App context API, never a new host.
   * @param {string} source - Stable attempt identity.
   * @param {PostAnalysisTaskOutcome} outcome - Completed local task outcome.
   * @returns {void} No success feedback, actions or focus transfer.
   */
  show(host: NotificationHost, source: string, outcome: PostAnalysisTaskOutcome): void {
    if (!this.isMetadataOwner(outcome) || outcome.data.status !== 'failed') return;
    const key = JSON.stringify([this.ownerId, this.classId, outcome.data.taskId, source]);
    // Non-UI owners can use the lifecycle without an Ant Design App boundary.
    if (this.shown.has(key) || !host.warning) return;
    this.shown.add(key);
    this.owned.set(key, host);
    const isSaved = outcome.data.confirmedPersistence === true;
    host.warning({
      key,
      title: isSaved ? 'Class summary refresh failed' : 'Class summary not saved',
      description: isSaved
        ? 'The class summary was saved, but refreshed data could not be loaded. Reload the page to refresh it.'
        : 'Analysis is ready, but the class summary could not be saved. Reload the page to try again.',
      duration: 0,
      closable: true,
      role: 'status',
      onClose: () => {
        this.owned.delete(key);
      },
    });
  }

  /** Checks whether this mounted owner handles the task's feedback.
   * @param {PostAnalysisTaskOutcome} outcome - Completed task.
   * @returns {boolean} Whether this is mounted metadata work.
   */
  private isMetadataOwner(outcome: PostAnalysisTaskOutcome): boolean {
    return this.lifetime !== null && outcome.data.taskId === 'refreshABClassMetadata';
  }

  /** Disposes this owner's visible notices only; dismissal memory lasts the mount. */
  private destroy(): void {
    for (const [key, host] of this.owned) host.destroy(key);
    this.owned.clear();
  }
}
