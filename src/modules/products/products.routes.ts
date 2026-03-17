import { Router } from "express";
import type { NextFunction, Request, Response } from "express";
import { authMiddleware } from "../../middleware/auth.middleware.js";
import { tenantMiddleware } from "../../middleware/tenant.middleware.js";
import { HttpError } from "../../core/errors/http-error.js";
import { createProduct, getProducts, getProductById, updateProduct, deleteProduct } from "./products.service.js";

type ProductsRouteDependencies = {
  createProduct: typeof createProduct;
  getProducts: typeof getProducts;
  getProductById: typeof getProductById;
  updateProduct: typeof updateProduct;
  deleteProduct: typeof deleteProduct;
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

const parseProductPrice = (value: unknown): number => {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0) {
      throw new HttpError(400, "VALIDATION_ERROR", "Product price must be a non-negative number");
    }
    return value;
  }

  if (typeof value === "string") {
    const trimmedPrice = value.trim();
    if (!trimmedPrice || !/^\d+(\.\d+)?$/.test(trimmedPrice)) {
      throw new HttpError(400, "VALIDATION_ERROR", "Product price must be a non-negative number");
    }
    return Number(trimmedPrice);
  }

  throw new HttpError(400, "VALIDATION_ERROR", "Product price must be a non-negative number");
};

const parseCreateProductBody = (body: CreateProductBody) => {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const price = parseProductPrice(body.price);
  const description = typeof body.description === "string" ? body.description : undefined;

  if (!name) {
    throw new HttpError(400, "VALIDATION_ERROR", "Product name is required");
  }

  return { name, price, description };
};

const readBodyRecord = (body: unknown): Record<string, unknown> => {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    throw new HttpError(400, "VALIDATION_ERROR", "Request body must be a JSON object");
  }

  return body as Record<string, unknown>;
};

const parseOptionalName = (value: unknown): string | undefined => {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new HttpError(400, "VALIDATION_ERROR", "Product name must be a string");
  }
  return value;
};

const parseOptionalPrice = (value: unknown): number | undefined => {
  if (value === undefined) {
    return undefined;
  }

  return parseProductPrice(value);
};

const parseOptionalDescription = (value: unknown): string | undefined => {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new HttpError(400, "VALIDATION_ERROR", "Product description must be a string");
  }
  return value;
};

const parseUpdateProductBody = (
  body: unknown,
): { name?: string; price?: number; description?: string } => {
  const record = readBodyRecord(body);
  const name = parseOptionalName(record["name"]);
  const price = parseOptionalPrice(record["price"]);
  const description = parseOptionalDescription(record["description"]);

  return {
    ...(name !== undefined ? { name } : {}),
    ...(price !== undefined ? { price } : {}),
    ...(description !== undefined ? { description } : {}),
  };
};

export const createProductsRouter = (
  deps: ProductsRouteDependencies = {
    createProduct,
    getProducts,
    getProductById,
    updateProduct,
    deleteProduct,
  },
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

  productsRouter.put("/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = res.locals["tenantId"] as string;
      const id = (req.params["id"] as string) ?? "";
      const input = parseUpdateProductBody(req.body);
      const product = await deps.updateProduct(tenantId, id, input);
      res.status(200).json({ data: product });
    } catch (error) {
      next(error);
    }
  });

  productsRouter.delete("/:id", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tenantId = res.locals["tenantId"] as string;
      const id = (req.params["id"] as string) ?? "";
      await deps.deleteProduct(tenantId, id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  return productsRouter;
};

export const productsRouter = createProductsRouter();
