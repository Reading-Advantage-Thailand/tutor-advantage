import { NextFunction, Request, RequestHandler, Response } from "express";
import * as OpenApiValidator from "express-openapi-validator";

type OpenApiError = Error & {
  status?: number;
  path?: string;
  errors?: unknown[];
};

export function createOpenApiMiddleware(apiSpec: string): RequestHandler[] {
  const validateResponses =
    process.env.NODE_ENV === "test" ||
    process.env.CI === "true" ||
    process.env.OPENAPI_VALIDATE_RESPONSES === "true";

  return OpenApiValidator.middleware({
    apiSpec,
    validateRequests: {
      allowUnknownQueryParameters: false,
    },
    validateResponses,
    validateSecurity: false,
    ignoreUndocumented: true,
  }) as RequestHandler[];
}

export function openApiValidationErrorHandler(
  err: OpenApiError,
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (!err.status) {
    next(err);
    return;
  }

  const status = err.status >= 500 ? 500 : err.status;
  res.status(status).json({
    error: {
      code:
        status >= 500
          ? "OPENAPI_RESPONSE_VALIDATION_FAILED"
          : "OPENAPI_REQUEST_VALIDATION_FAILED",
      message: err.message,
      requestId: req.id,
      ...(err.path || err.errors
        ? { details: { path: err.path, errors: err.errors } }
        : {}),
    },
  });
}
