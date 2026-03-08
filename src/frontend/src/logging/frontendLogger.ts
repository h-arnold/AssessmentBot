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

type FrontendLogOptions = {
  includeStack?: boolean;
  isDevelopmentRuntime?: boolean;
};

const SENSITIVE_FIELD_NAMES = new Set(['token', 'secret', 'password', 'authorisation', 'authorization', 'email']);
const REDACTED_VALUE = '[REDACTED]';
const MAX_SERIALISED_METADATA_LENGTH = 2000;

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
 * Sanitises metadata before emitting to the console endpoint.
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
 * Returns true when a log level is enabled in the current runtime mode.
 */
function isLevelEnabled(level: FrontendLogLevel, options: FrontendLogOptions | undefined): boolean {
  const isDevelopmentRuntime = options?.isDevelopmentRuntime ?? import.meta.env.DEV;

  if (isDevelopmentRuntime) {
    return true;
  }

  return level === 'warn' || level === 'error';
}

const consoleMethodByLevel: Record<FrontendLogLevel, (message?: unknown, ...optionalParams: unknown[]) => void> = {
  debug: (...args) => globalThis.console.debug(...args),
  info: (...args) => globalThis.console.info(...args),
  warn: (...args) => globalThis.console.warn(...args),
  error: (...args) => globalThis.console.error(...args),
};

/**
 * Emits a log entry to the browser console using a level-matched endpoint.
 */
function writeToConsole(entry: FrontendLogEntry): void {
  consoleMethodByLevel[entry.level](entry.context, entry);
}

/**
 * Writes a structured frontend log event to the console endpoint.
 */
export function logFrontendEvent(
  level: FrontendLogLevel,
  payload: FrontendLogPayload,
  options?: FrontendLogOptions
): void {
  if (!isLevelEnabled(level, options)) {
    return;
  }

  const stack = shouldIncludeStack(options) ? payload.stack : undefined;
  const entry: FrontendLogEntry = {
    ...payload,
    stack,
    metadata: sanitiseMetadata(payload.metadata),
    level,
    timestamp: new Date().toISOString(),
  };

  writeToConsole(entry);
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
