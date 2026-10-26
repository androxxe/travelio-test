export type ErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "RATE_LIMITED"
  | "UPSTREAM_RATE_LIMITED"
  | "UPSTREAM_REJECTED"
  | "UPSTREAM_INVALID_RESPONSE"
  | "UPSTREAM_UNAVAILABLE"
  | "INTERNAL_ERROR";

interface AppErrorOptions {
  details?: unknown;
  retryAfterSeconds?: number;
  cause?: unknown;
}

/**
 * Error that is safe to expose to API clients. Anything else becomes a generic 500.
 */
export class AppError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly details?: unknown;
  readonly retryAfterSeconds?: number;

  constructor(
    status: number,
    code: ErrorCode,
    message: string,
    options: AppErrorOptions = {},
  ) {
    super(message, { cause: options.cause });
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.details = options.details;
    this.retryAfterSeconds = options.retryAfterSeconds;
  }
}
