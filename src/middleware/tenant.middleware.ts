import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../core/errors/http-error.js";

export const TENANT_HEADER = "x-tenant-id";

export const tenantMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const tenantId = req.header(TENANT_HEADER);

  if (!tenantId) {
    next(new HttpError(400, "VALIDATION_ERROR", `Missing required header: ${TENANT_HEADER}`));
    return;
  }

  res.locals["tenantId"] = tenantId;
  next();
};
