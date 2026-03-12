import type { NextFunction, Request, Response } from "express";
import { logger } from "../core/logger/index.js";
import { HttpError } from "../core/errors/http-error.js";

export const notFoundMiddleware = (_req: Request, res: Response): void => {
  void _req;
  res.status(404).json({
    error: {
      code: "NOT_FOUND",
      message: "Route not found",
    },
  });
};

export const errorMiddleware = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  void _next;
  void _req;
  const isHttpError = err instanceof HttpError;
  const error = isHttpError ? (err as HttpError) : (err as Partial<HttpError>);
  const statusCode = error.statusCode ?? 500;
  const code = error.code ?? "INTERNAL_SERVER_ERROR";
  const defaultMessage = "Internal server error";
  const safeMessage =
    isHttpError || (statusCode >= 400 && statusCode < 500)
      ? error.message || defaultMessage
      : defaultMessage;

  const logData = {
    statusCode,
    code,
    message: error instanceof Error ? error.message : String(err),
    stack: error instanceof Error ? error.stack : undefined,
  };

  if (statusCode >= 500) {
    logger.error("Request failed", logData);
  } else {
    logger.warn("Request failed", logData);
  }

  res.status(statusCode).json({
    error: {
      code,
      message: safeMessage,
    },
  });
};
