/** Error-envelope fields surfaced by the backend for a failed API call. */
export type ApiErrorEnvelope = {
  requestId: string;
  error: {
    code: string;
    message: string;
    retriable?: boolean;
    details?: Record<string, unknown>;
  };
  meta?: Record<string, unknown>;
};

/**
 * Transport error exposing the typed fields of an API error envelope,
 * including the optional structured `details` block.
 */
export class ApiTransportError extends Error {
  public readonly requestId: string;
  public readonly code: string;
  public readonly retriable: boolean | undefined;
  public readonly meta: Record<string, unknown> | undefined;
  public readonly details: Record<string, unknown> | undefined;

  /**
   * Builds a transport error from an API error envelope.
   *
   * @param {ApiErrorEnvelope} response API error envelope returned by the backend.
   */
  public constructor(response: ApiErrorEnvelope) {
    super(response.error.message);
    this.name = 'ApiTransportError';
    this.requestId = response.requestId;
    this.code = response.error.code;
    this.retriable = response.error.retriable;
    this.meta = response.meta;
    this.details = response.error.details;
  }
}
