/** Stable error codes the API returns, so a client can branch without parsing messages. */
export const ERROR_CODES = {
  unauthorized: "unauthorized",
  validationFailed: "validation_failed",
  notFound: "not_found",
  internal: "internal_error",
  requestError: "request_error",
  invalidCurrency: "invalid_currency",
  invalidTimezone: "invalid_timezone",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/** The single error body shape: a machine-readable code and a human message. */
export interface ErrorBody {
  code: string;
  error: string;
}

/** Build an error body. Domain refusals pass the store reason as the code. */
export function errorBody(code: string, message: string): ErrorBody {
  return { code, error: message };
}
