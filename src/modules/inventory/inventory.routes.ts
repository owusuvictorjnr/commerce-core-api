import { Router } from "express";
import type { NextFunction, Request, Response } from "express";
import { authMiddleware } from "../../middleware/auth.middleware.js";
import { tenantMiddleware } from "../../middleware/tenant.middleware.js";
import { HttpError } from "../../core/errors/http-error.js";
import {
  getInventoryByProduct,
  upsertInventory,
  adjustInventory,
} from "./inventory.service.js";

type InventoryRouteDependencies = {
  getInventoryByProduct: typeof getInventoryByProduct;
  upsertInventory: typeof upsertInventory;
  adjustInventory: typeof adjustInventory;
};

export const createInventoryRouter = (
  deps: InventoryRouteDependencies = {
    getInventoryByProduct,
    upsertInventory,
    adjustInventory,
  },
) => {
  const inventoryRouter = Router();
  inventoryRouter.use(authMiddleware);
  inventoryRouter.use(tenantMiddleware);

  // GET /inventory/:productId — get current inventory for a product
  inventoryRouter.get("/:productId", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = res.locals["tenantId"] as string;
      const productId = (req.params["productId"] as string) ?? "";
      const inventory = await deps.getInventoryByProduct(tenantId, productId);
      res.status(200).json({ data: inventory });
    } catch (error) {
      next(error);
    }
  });

  // PUT /inventory/:productId — create or replace inventory quantity
  inventoryRouter.put("/:productId", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = res.locals["tenantId"] as string;
      const productId = (req.params["productId"] as string) ?? "";
      const body = req.body;
      if (body === null || typeof body !== "object" || Array.isArray(body)) {
        throw new HttpError(400, "VALIDATION_ERROR", "Request body must be a JSON object");
      }
      const qty = (body as Record<string, unknown>)["quantity"];
      if (!Number.isInteger(qty) || (qty as number) < 0) {
        throw new HttpError(400, "VALIDATION_ERROR", "quantity must be a non-negative integer");
      }
      const inventory = await deps.upsertInventory(tenantId, productId, {
        quantity: qty as number,
      });
      res.status(200).json({ data: inventory });
    } catch (error) {
      next(error);
    }
  });

  // POST /inventory/:productId/adjust — adjust quantity by a signed integer delta
  inventoryRouter.post(
    "/:productId/adjust",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const tenantId = res.locals["tenantId"] as string;
        const productId = (req.params["productId"] as string) ?? "";
        const body = req.body;
        if (body === null || typeof body !== "object" || Array.isArray(body)) {
          throw new HttpError(400, "VALIDATION_ERROR", "Request body must be a JSON object");
        }
        const adjustment = (body as Record<string, unknown>)["adjustment"];
        if (!Number.isInteger(adjustment)) {
          throw new HttpError(400, "VALIDATION_ERROR", "adjustment must be an integer");
        }
        const inventory = await deps.adjustInventory(tenantId, productId, {
          adjustment: adjustment as number,
        });
        res.status(200).json({ data: inventory });
      } catch (error) {
        next(error);
      }
    },
  );

  return inventoryRouter;
};

export const inventoryRouter = createInventoryRouter();
