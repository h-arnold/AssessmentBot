export type ApiErrorEnvelope = {
  requestId: string;
  error: {
    code: string;
    message: string;
    retriable?: boolean;
  };
  meta?: Record<string, unknown>;
};

/**
 * Transport error carrying details from an API error envelope.
 */
export class ApiTransportError extends Error {
  public readonly requestId: string;
  public readonly code: string;
  public readonly retriable: boolean | undefined;
  public readonly meta: Record<string, unknown> | undefined;

  /**
   * Builds a transport error from an API error envelope.
   */
  public constructor(response: ApiErrorEnvelope) {
    super(response.error.message);
    this.name = 'ApiTransportError';
    this.requestId = response.requestId;
    this.code = response.error.code;
    this.retriable = response.error.retriable;
    this.meta = response.meta;
  }
}
