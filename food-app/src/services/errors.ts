export type ServiceErrorCode =
  | "network"
  | "unauthorized"
  | "auth-rate-limit"
  | "invalid-image"
  | "upload"
  | "vision-timeout"
  | "vision-malformed"
  | "vision-no-food"
  | "vision-unavailable"
  | "vision-quota"
  | "vision-configuration"
  | "nutrition-unavailable"
  | "no-match"
  | "duplicate"
  | "storage"
  | "unknown";

export class ServiceError extends Error {
  constructor(
    public readonly code: ServiceErrorCode,
    message: string,
    public readonly cause?: unknown,
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}

export function serviceErrorMessage(error: unknown) {
  if (error instanceof ServiceError) {
    return error.requestId ? `${error.message} Reference: ${error.requestId}.` : error.message;
  }
  if (!navigator.onLine) return "You appear to be offline. Reconnect and try again.";
  return "Something went wrong. Try again.";
}
