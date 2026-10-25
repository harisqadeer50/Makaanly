export class ApiError extends Error {
  constructor(status, message, { code, details } = {}) {
    super(message);
    this.status = status;
    this.code = code || ApiError.codeFor(status);
    this.details = details;
    this.isOperational = true;
  }

  static codeFor(status) {
    return {
      400: 'BAD_REQUEST', 401: 'UNAUTHENTICATED', 403: 'FORBIDDEN',
      404: 'NOT_FOUND', 409: 'CONFLICT', 422: 'VALIDATION_ERROR', 429: 'RATE_LIMITED',
    }[status] || 'INTERNAL_ERROR';
  }

  static badRequest(msg = 'Bad request', opts) { return new ApiError(400, msg, opts); }
  static unauthenticated(msg = 'Please sign in to continue', opts) { return new ApiError(401, msg, opts); }
  static forbidden(msg = 'You do not have permission to do that', opts) { return new ApiError(403, msg, opts); }
  static notFound(msg = 'Not found', opts) { return new ApiError(404, msg, opts); }
  static conflict(msg = 'Conflict', opts) { return new ApiError(409, msg, opts); }
  static validation(details, msg = 'Please check the highlighted fields') {
    return new ApiError(422, msg, { details });
  }
}
