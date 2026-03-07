import { normaliseUnknownError } from '../errors/normaliseUnknownError';

type FrontendLogLevel = 'debug' | 'info' | 'warn' | 'error';

type FrontendLogPayload = {
  context: string;
  errorMessage?: string;
  stack?: string;
  requestId?: string;
  errorCode?: string;
  metadata?: Record<string, unknown>;
};

export type FrontendLogEntry = FrontendLogPayload & {
  level: FrontendLogLevel;
  timestamp: string;
};

type FrontendLogSink = (entry: FrontendLogEntry) => void;

type FrontendLogOptions = {
  includeStack?: boolean;
};

const SENSITIVE_FIELD_NAMES = new Set(['token', 'secret', 'password', 'authorisation', 'email']);
const REDACTED_VALUE = '[REDACTED]';
const MAX_SERIALISED_METADATA_LENGTH = 2000;

const LOG_BUFFER_GLOBAL_KEY = '__ASSESSMENT_BOT_FRONTEND_LOG_BUFFER__';
const MAX_BUFFERED_LOG_ENTRIES = 200;

type FrontendLogBufferHost = {
  [LOG_BUFFER_GLOBAL_KEY]?: FrontendLogEntry[];
};

/**
 * Writes frontend logs to an in-memory global buffer for diagnostics.
 */
function writeToGlobalLogBuffer(entry: FrontendLogEntry): void {
  const host = globalThis as FrontendLogBufferHost;
  const existingBuffer = host[LOG_BUFFER_GLOBAL_KEY] ?? [];
  existingBuffer.push(entry);
  if (existingBuffer.length > MAX_BUFFERED_LOG_ENTRIES) {
    existingBuffer.splice(0, existingBuffer.length - MAX_BUFFERED_LOG_ENTRIES);
  }
  host[LOG_BUFFER_GLOBAL_KEY] = existingBuffer;
}

let logSink: FrontendLogSink = writeToGlobalLogBuffer;

/**
 * Registers a sink for structured frontend log entries.
 */
export function setFrontendLogSink(sink: FrontendLogSink): void {
  logSink = sink;
}

/**
 * Restores the default in-memory sink.
 */
export function resetFrontendLogSink(): void {
  logSink = writeToGlobalLogBuffer;
}

/**
 * Returns true when a metadata key should be redacted.
 */
function isSensitiveKey(key: string): boolean {
  return SENSITIVE_FIELD_NAMES.has(key.toLowerCase());
}

/**
 * Truncates long metadata string values to keep log payloads bounded.
 */
function truncateValue(value: string): string {
  if (value.length <= MAX_SERIALISED_METADATA_LENGTH) {
    return value;
  }

  return `${value.slice(0, MAX_SERIALISED_METADATA_LENGTH)}...[truncated]`;
}

/**
 * Recursively redacts sensitive metadata values.
 */
function redactValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item));
  }

  if (typeof value === 'object' && value !== null) {
    const entries = Object.entries(value as Record<string, unknown>).map(([key, nestedValue]) => {
      if (isSensitiveKey(key)) {
        return [key, REDACTED_VALUE] as const;
      }

      return [key, redactValue(nestedValue)] as const;
    });

    return Object.fromEntries(entries);
  }

  if (typeof value === 'string') {
    return truncateValue(value);
  }

  return value;
}

/**
 * Sanitises metadata before emitting to the active sink.
 */
function sanitiseMetadata(metadata: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!metadata) {
    return undefined;
  }

  return redactValue(metadata) as Record<string, unknown>;
}

/**
 * Returns true when stack traces should be included in log entries.
 */
function shouldIncludeStack(options: FrontendLogOptions | undefined): boolean {
  if (typeof options?.includeStack === 'boolean') {
    return options.includeStack;
  }

  return import.meta.env.DEV;
}

/**
 * Writes a structured frontend log event to the active sink.
 */
export function logFrontendEvent(
  level: FrontendLogLevel,
  payload: FrontendLogPayload,
  options?: FrontendLogOptions
): void {
  const stack = shouldIncludeStack(options) ? payload.stack : undefined;

  logSink({
    ...payload,
    stack,
    metadata: sanitiseMetadata(payload.metadata),
    level,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Normalises and logs unknown errors using a consistent payload shape.
 */
export function logFrontendError(
  context: string,
  error: unknown,
  metadata?: Record<string, unknown>,
  options?: FrontendLogOptions
): void {
  const normalisedError = normaliseUnknownError(error);

  logFrontendEvent(
    'error',
    {
      context,
      errorMessage: normalisedError.errorMessage,
      stack: normalisedError.stack,
      metadata,
    },
    options
  );
}
