import type { NextFunction, Request, Response } from "express";
import { logger } from "../core/logger/index.js";
import { HttpError } from "../core/errors/http-error.js";

type ErrorLike = Partial<HttpError>;
type LogData = {
  statusCode: number;
  code: string;
  message: string;
  stack: string | undefined;
};

const DEFAULT_ERROR_MESSAGE = "Internal server error";

const getSafeMessage = (error: ErrorLike, isHttpError: boolean, statusCode: number): string => {
  const isClientError = statusCode >= 400 && statusCode < 500;
  if (isHttpError || isClientError) {
    return error.message || DEFAULT_ERROR_MESSAGE;
  }
  return DEFAULT_ERROR_MESSAGE;
};

const getLogData = (err: unknown, statusCode: number, code: string): LogData => {
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;

  return {
    statusCode,
    code,
    message,
    stack,
  };
};

const logRequestFailure = (statusCode: number, logData: LogData): void => {
  if (statusCode >= 500) {
    logger.error("Request failed", logData);
    return;
  }

  logger.warn("Request failed", logData);
};

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
  const error = isHttpError ? (err as HttpError) : (err as ErrorLike);
  const statusCode = error.statusCode ?? 500;
  const code = error.code ?? "INTERNAL_SERVER_ERROR";
  const safeMessage = getSafeMessage(error, isHttpError, statusCode);
  const logData = getLogData(err, statusCode, code);

  logRequestFailure(statusCode, logData);

  res.status(statusCode).json({
    error: {
      code,
      message: safeMessage,
    },
  });
};
