import { createApp } from "./app.js";

describe("createApp", () => {
  it("creates an Express application instance", () => {
    const app = createApp();

    expect(app).toBeDefined();
    expect(typeof app.use).toBe("function");
  });
});