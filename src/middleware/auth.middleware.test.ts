import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";
import { authMiddleware } from "./auth.middleware.js";
import { errorMiddleware } from "./error.middleware.js";

const JWT_SECRET = "test-secret-key";

describe("authMiddleware", () => {
	const createTestApp = () => {
		const app = express();
		app.use(authMiddleware);
		app.get("/", (_req: express.Request, res: express.Response) => {
			const auth = res.locals["auth"];
			res.status(200).json({ auth });
		});
		app.use((err: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
			errorMiddleware(err, _req, res, next);
		});
		return app;
	};

	const createToken = (payload: Record<string, unknown>): string => {
		return jwt.sign(payload, JWT_SECRET);
	};

	beforeAll(() => {
		process.env["JWT_SECRET"] = JWT_SECRET;
		process.env["NODE_ENV"] = "development";
		process.env["AUTH_BYPASS"] = "false";
	});

	afterAll(() => {
		delete process.env["JWT_SECRET"];
		delete process.env["NODE_ENV"];
		delete process.env["AUTH_BYPASS"];
	});

	it("returns 401 when authorization header is missing", async () => {
		const app = createTestApp();

		const response = await request(app).get("/");

		expect(response.status).toBe(401);
		expect(response.body.error.code).toBe("UNAUTHORIZED");
	});

	it("returns 401 when token is invalid", async () => {
		const app = createTestApp();

		const response = await request(app)
			.get("/")
			.set("Authorization", "Bearer invalid-token");

		expect(response.status).toBe(401);
		expect(response.body.error.code).toBe("UNAUTHORIZED");
	});

	it("returns 401 when token lacks userId/subject", async () => {
		const app = createTestApp();
		const token = createToken({ email: "user@example.com" });

		const response = await request(app)
			.get("/")
			.set("Authorization", `Bearer ${token}`);

		expect(response.status).toBe(401);
		expect(response.body.error.code).toBe("UNAUTHORIZED");
		expect(response.body.error.message).toContain("subject");
	});

	it("returns 401 when subject claim is not a string", async () => {
		const app = createTestApp();
		const token = createToken({ sub: 123, email: "user@example.com" });

		const response = await request(app)
			.get("/")
			.set("Authorization", `Bearer ${token}`);

		expect(response.status).toBe(401);
		expect(response.body.error.code).toBe("UNAUTHORIZED");
		expect(response.body.error.message).toContain("subject");
	});

	it("returns 401 when subject claim is whitespace only", async () => {
		const app = createTestApp();
		const token = createToken({ sub: "   ", email: "user@example.com" });

		const response = await request(app)
			.get("/")
			.set("Authorization", `Bearer ${token}`);

		expect(response.status).toBe(401);
		expect(response.body.error.code).toBe("UNAUTHORIZED");
		expect(response.body.error.message).toContain("subject");
	});

	it("returns 401 when userId claim is not a string", async () => {
		const app = createTestApp();
		const token = createToken({ userId: { id: "user-2" }, email: "user2@example.com" });

		const response = await request(app)
			.get("/")
			.set("Authorization", `Bearer ${token}`);

		expect(response.status).toBe(401);
		expect(response.body.error.code).toBe("UNAUTHORIZED");
		expect(response.body.error.message).toContain("subject");
	});

	it("returns 401 when token lacks email claim", async () => {
		const app = createTestApp();
		const token = createToken({ sub: "user-1" });

		const response = await request(app)
			.get("/")
			.set("Authorization", `Bearer ${token}`);

		expect(response.status).toBe(401);
		expect(response.body.error.code).toBe("UNAUTHORIZED");
		expect(response.body.error.message).toContain("email");
	});

	it("returns 401 when email claim is not a string", async () => {
		const app = createTestApp();
		const token = createToken({ sub: "user-1", email: 123 });

		const response = await request(app)
			.get("/")
			.set("Authorization", `Bearer ${token}`);

		expect(response.status).toBe(401);
		expect(response.body.error.code).toBe("UNAUTHORIZED");
		expect(response.body.error.message).toContain("email");
	});

	it("returns 401 when email claim is empty string", async () => {
		const app = createTestApp();
		const token = createToken({ sub: "user-1", email: "" });

		const response = await request(app)
			.get("/")
			.set("Authorization", `Bearer ${token}`);

		expect(response.status).toBe(401);
		expect(response.body.error.code).toBe("UNAUTHORIZED");
		expect(response.body.error.message).toContain("email");
	});

	it("returns 401 when email claim is whitespace only", async () => {
		const app = createTestApp();
		const token = createToken({ sub: "user-1", email: "   " });

		const response = await request(app)
			.get("/")
			.set("Authorization", `Bearer ${token}`);

		expect(response.status).toBe(401);
		expect(response.body.error.code).toBe("UNAUTHORIZED");
		expect(response.body.error.message).toContain("email");
	});

	it("returns 200 and sets auth context when token is valid", async () => {
		const app = createTestApp();
		const token = createToken({ sub: "user-1", email: "user@example.com" });

		const response = await request(app)
			.get("/")
			.set("Authorization", `Bearer ${token}`);

		expect(response.status).toBe(200);
		expect(response.body.auth.userId).toBe("user-1");
		expect(response.body.auth.email).toBe("user@example.com");
		expect(response.body.auth.token).toBeDefined();
	});

	it("returns 200 when userId is from userId field instead of sub", async () => {
		const app = createTestApp();
		const token = createToken({ userId: "user-2", email: "user2@example.com" });

		const response = await request(app)
			.get("/")
			.set("Authorization", `Bearer ${token}`);

		expect(response.status).toBe(200);
		expect(response.body.auth.userId).toBe("user-2");
		expect(response.body.auth.email).toBe("user2@example.com");
	});

	it("returns 200 and trims userId claim", async () => {
		const app = createTestApp();
		const token = createToken({ userId: "  user-3  ", email: "user3@example.com" });

		const response = await request(app)
			.get("/")
			.set("Authorization", `Bearer ${token}`);

		expect(response.status).toBe(200);
		expect(response.body.auth.userId).toBe("user-3");
		expect(response.body.auth.email).toBe("user3@example.com");
	});
});
