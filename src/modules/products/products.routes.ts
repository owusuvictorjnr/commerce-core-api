import { Router } from "express";
import type { NextFunction, Request, Response } from "express";
import { authMiddleware } from "../../middleware/auth.middleware.js";
import { tenantMiddleware } from "../../middleware/tenant.middleware.js";
import { HttpError } from "../../core/errors/http-error.js";
import { createProduct, getProducts, getProductById } from "./products.service.js";

type ProductsRouteDependencies = {
  createProduct: typeof createProduct;
  getProducts: typeof getProducts;
  getProductById: typeof getProductById;
};

type CreateProductBody = {
  name?: unknown;
  price?: unknown;
  description?: unknown;
};

const parsePositiveInt = (value: unknown): number | null => {
  if (value === undefined) return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const parseCreateProductBody = (body: CreateProductBody) => {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  let price: number;
  if (typeof body.price === "number") {
    price = body.price;
  } else if (typeof body.price === "string") {
    const trimmedPrice = body.price.trim();
    if (!trimmedPrice || !/^\d+(\.\d+)?$/.test(trimmedPrice)) {
      throw new HttpError(400, "VALIDATION_ERROR", "Product price must be a non-negative number");
    }
    price = Number(trimmedPrice);
  } else {
    throw new HttpError(400, "VALIDATION_ERROR", "Product price must be a non-negative number");
  }
  const description = typeof body.description === "string" ? body.description : undefined;

  if (!name) {
    throw new HttpError(400, "VALIDATION_ERROR", "Product name is required");
  }
  if (!Number.isFinite(price) || price < 0) {
    throw new HttpError(400, "VALIDATION_ERROR", "Product price must be a non-negative number");
  }

  return { name, price, description };
};

export const createProductsRouter = (
  deps: ProductsRouteDependencies = { createProduct, getProducts, getProductById },
) => {
  const productsRouter = Router();

  productsRouter.use(authMiddleware);
  productsRouter.use(tenantMiddleware);

  productsRouter.get("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = res.locals["tenantId"] as string;
      const limit = parsePositiveInt(req.query["limit"]);
      const cursor = typeof req.query["cursor"] === "string" ? req.query["cursor"] : undefined;

      if (req.query["limit"] !== undefined && limit === null) {
        throw new HttpError(400, "VALIDATION_ERROR", "Query parameter 'limit' must be a positive integer");
      }
      if (req.query["cursor"] !== undefined && typeof req.query["cursor"] !== "string") {
        throw new HttpError(400, "VALIDATION_ERROR", "Query parameter 'cursor' must be a string");
      }

      const opts = {
        ...(limit !== null ? { limit } : {}),
        ...(cursor !== undefined ? { cursor } : {}),
      };
      const result = await deps.getProducts(tenantId, opts);

      res.status(200).json({ data: result });
    } catch (error) {
      next(error);
    }
  });

  productsRouter.post("/", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = res.locals["tenantId"] as string;
      const body = req.body;
      if (body === null || typeof body !== "object" || Array.isArray(body)) {
        throw new HttpError(400, "VALIDATION_ERROR", "Request body must be a JSON object");
      }

      const { name, price, description } = parseCreateProductBody(body as CreateProductBody);

      const product = await deps.createProduct(tenantId, {
        name,
        price,
        ...(description !== undefined ? { description } : {}),
      });
      res.status(201).json({ data: product });
    } catch (error) {
      next(error);
    }
  });

  productsRouter.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = res.locals["tenantId"] as string;
      const id = (req.params["id"] as string) ?? "";

      const product = await deps.getProductById(tenantId, id);
      if (!product) {
        throw new HttpError(404, "NOT_FOUND", "Product not found");
      }

      res.status(200).json({ data: product });
    } catch (error) {
      next(error);
    }
  });

  return productsRouter;
};

export const productsRouter = createProductsRouter();
