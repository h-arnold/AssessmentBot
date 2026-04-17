export type BlockingLoadErrorState = Readonly<{
  dataUpdatedAt: number;
  message: string;
}>;

/**
 * Returns the blocking load error while the currently cached dataset remains refresh-invalidated.
 *
 * @param {BlockingLoadErrorState | null} blockingLoadError Current blocking load-error state.
 * @param {number} dataUpdatedAt Timestamp of the currently cached dataset.
 * @returns {string | null} Blocking load error message while the dataset remains invalidated.
 */
export function getBlockingLoadErrorMessage(
  blockingLoadError: BlockingLoadErrorState | null,
  dataUpdatedAt: number
): string | null {
  if (blockingLoadError === null) {
    return null;
  }

  if (dataUpdatedAt > blockingLoadError.dataUpdatedAt) {
    return null;
  }

  return blockingLoadError.message;
}
