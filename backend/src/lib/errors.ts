export type ErrorCode =
  | "BAD_REQUEST"
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "OUT_OF_STOCK"
  | "COUPON_INVALID"
  | "INVALID_TRANSITION"
  | "RATE_LIMITED"
  | "SERVICE_UNAVAILABLE"
  | "INTERNAL_ERROR";

const statusByCode: Record<ErrorCode, number> = {
  BAD_REQUEST: 400,
  VALIDATION_ERROR: 422,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  OUT_OF_STOCK: 409,
  COUPON_INVALID: 422,
  INVALID_TRANSITION: 409,
  RATE_LIMITED: 429,
  SERVICE_UNAVAILABLE: 503,
  INTERNAL_ERROR: 500,
};

export class AppError extends Error {
  readonly status: number;

  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
    this.status = statusByCode[code];
  }

  static badRequest(message: string, details?: unknown) {
    return new AppError("BAD_REQUEST", message, details);
  }
  static unauthorized(message = "Authentication required") {
    return new AppError("UNAUTHORIZED", message);
  }
  static forbidden(message = "You do not have access to this resource") {
    return new AppError("FORBIDDEN", message);
  }
  static notFound(resource: string) {
    return new AppError("NOT_FOUND", `${resource} not found`);
  }
  static conflict(message: string, details?: unknown) {
    return new AppError("CONFLICT", message, details);
  }
  static serviceUnavailable(message: string) {
    return new AppError("SERVICE_UNAVAILABLE", message);
  }
}
