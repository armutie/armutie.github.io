export type ServiceErrorCode =
  | "network"
  | "unauthorized"
  | "invalid-image"
  | "upload"
  | "vision-timeout"
  | "vision-malformed"
  | "vision-no-food"
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
  ) {
    super(message);
    this.name = "ServiceError";
  }
}

export function serviceErrorMessage(error: unknown) {
  if (error instanceof ServiceError) return error.message;
  if (!navigator.onLine) return "You appear to be offline. Reconnect and try again.";
  return "Something went wrong. Try again.";
}
