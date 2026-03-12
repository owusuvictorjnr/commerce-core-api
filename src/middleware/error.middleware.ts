import type { NextFunction, Request, Response } from "express";
import { logger } from "../core/logger/index.js";

type HttpError = Error & {
  statusCode?: number;
  code?: string;
};

export const notFoundMiddleware = (_req: Request, res: Response): void => {
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
  const error = err as HttpError;
  const statusCode = error.statusCode ?? 500;
  const code = error.code ?? "INTERNAL_SERVER_ERROR";
  const defaultMessage = "Internal server error";
  const safeMessage =
    statusCode === 500 && code === "INTERNAL_SERVER_ERROR"
      ? defaultMessage
      : error.message || defaultMessage;

  logger.error("Request failed", {
    statusCode,
    code,
    message: error instanceof Error ? error.message : String(err),
    stack: error instanceof Error ? error.stack : undefined,
  });

  res.status(statusCode).json({
    error: {
      code,
      message: safeMessage,
    },
  });
};
