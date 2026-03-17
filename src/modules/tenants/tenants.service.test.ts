import { jest } from "@jest/globals";
import type { Tenant } from "@prisma/client";
import { HttpError } from "../../core/errors/http-error.js";

const findUniqueMock = jest.fn<(...args: unknown[]) => Promise<Tenant | null>>();
const findManyMock = jest.fn<(...args: unknown[]) => Promise<Tenant[]>>();
const createMock = jest.fn<(...args: unknown[]) => Promise<Tenant>>();
const updateMock = jest.fn<(...args: unknown[]) => Promise<Tenant>>();
const deleteMock = jest.fn<(...args: unknown[]) => Promise<Tenant>>();

jest.unstable_mockModule("../../database/prisma-client.js", () => ({
  default: () => ({
    tenant: {
      findUnique: findUniqueMock,
      findMany: findManyMock,
      create: createMock,
      update: updateMock,
      delete: deleteMock,
    },
  }),
}));

const { createTenant, getTenants, getTenantById, updateTenant, deleteTenant } =
  await import("./tenants.service.js");

const makeTenant = (overrides: Partial<Tenant> = {}): Tenant => ({
  id: "tenant-1",
  name: "Acme",
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe("createTenant", () => {
  beforeEach(() => {
    createMock.mockReset();
  });

  it("creates a tenant with trimmed name", async () => {
    createMock.mockResolvedValue(makeTenant({ name: "Acme Corp" }));
    const result = await createTenant({ name: "  Acme Corp  " });
    expect(createMock).toHaveBeenCalledWith({ data: { name: "Acme Corp" } });
    expect(result.name).toBe("Acme Corp");
  });

  it("throws 400 for empty name", async () => {
    await expect(createTenant({ name: "   " })).rejects.toBeInstanceOf(HttpError);
    await expect(createTenant({ name: "   " })).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe("getTenants", () => {
  beforeEach(() => {
    findUniqueMock.mockReset();
    findManyMock.mockReset();
  });

  it("returns first page and nextCursor when more exist", async () => {
    findManyMock.mockResolvedValue([
      makeTenant({ id: "1", name: "A" }),
      makeTenant({ id: "2", name: "B" }),
      makeTenant({ id: "3", name: "C" }),
    ]);
    const result = await getTenants({ limit: 2 });
    expect(result.items).toHaveLength(2);
    expect(result.nextCursor).toBe("2");
  });

  it("returns null nextCursor on last page", async () => {
    findManyMock.mockResolvedValue([makeTenant({ id: "1", name: "A" })]);
    const result = await getTenants({ limit: 2 });
    expect(result.nextCursor).toBeNull();
  });

  it("throws 400 when cursor is invalid", async () => {
    findUniqueMock.mockResolvedValue(null);

    await expect(getTenants({ cursor: "missing-cursor" })).rejects.toMatchObject({
      statusCode: 400,
      message: "Invalid cursor",
    });

    expect(findManyMock).not.toHaveBeenCalled();
  });

  it("applies cursor pagination when cursor is valid", async () => {
    findUniqueMock.mockResolvedValue(makeTenant({ id: "tenant-2" }));
    findManyMock.mockResolvedValue([makeTenant({ id: "tenant-3", name: "C" })]);

    await getTenants({ limit: 2, cursor: "tenant-2" });

    expect(findManyMock).toHaveBeenCalledWith({
      orderBy: { id: "asc" },
      take: 3,
      cursor: { id: "tenant-2" },
      skip: 1,
    });
  });
});

describe("getTenantById", () => {
  beforeEach(() => {
    findUniqueMock.mockReset();
  });

  it("returns the tenant when found", async () => {
    findUniqueMock.mockResolvedValue(makeTenant());
    const result = await getTenantById("tenant-1");
    expect(result?.name).toBe("Acme");
  });

  it("returns null when not found", async () => {
    findUniqueMock.mockResolvedValue(null);
    const result = await getTenantById("missing");
    expect(result).toBeNull();
  });
});

describe("updateTenant", () => {
  beforeEach(() => {
    findUniqueMock.mockReset();
    updateMock.mockReset();
  });

  it("throws 404 when tenant not found", async () => {
    findUniqueMock.mockResolvedValue(null);
    await expect(updateTenant("missing", { name: "New" })).rejects.toMatchObject({ statusCode: 404 });
  });

  it("throws 400 for empty name", async () => {
    await expect(updateTenant("tenant-1", { name: "  " })).rejects.toMatchObject({ statusCode: 400 });
  });

  it("updates the tenant name", async () => {
    findUniqueMock.mockResolvedValue(makeTenant());
    updateMock.mockResolvedValue(makeTenant({ name: "New Name" }));
    const result = await updateTenant("tenant-1", { name: "New Name" });
    expect(result.name).toBe("New Name");
  });
});

describe("deleteTenant", () => {
  beforeEach(() => {
    findUniqueMock.mockReset();
    deleteMock.mockReset();
  });

  it("throws 404 when tenant not found", async () => {
    findUniqueMock.mockResolvedValue(null);
    await expect(deleteTenant("missing")).rejects.toMatchObject({ statusCode: 404 });
  });

  it("deletes tenant when found", async () => {
    findUniqueMock.mockResolvedValue(makeTenant());
    deleteMock.mockResolvedValue(makeTenant());
    await expect(deleteTenant("tenant-1")).resolves.not.toThrow();
    expect(deleteMock).toHaveBeenCalledWith({ where: { id: "tenant-1" } });
  });
});
