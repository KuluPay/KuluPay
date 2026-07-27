import { describe, it, expect, beforeEach } from "vitest";
import { createOrm, createMemoryDriver } from "@farming-labs/orm";
import { getKuluPayTables } from "../db/get-tables";
import { sessionMiddleware, originCheckMiddleware, ownershipMiddleware, resolveSession } from "./middleware";
import { KuluPayAPIError } from "../error";
import type { KuluPayContext, KuluPaySession } from "../types";

function createTestContext(overrides?: Partial<KuluPayContext>): KuluPayContext {
    const orm = createOrm({
        schema: getKuluPayTables({ database: {} }) as any,
        driver: createMemoryDriver(),
    });

    return {
        options: {
            database: createMemoryDriver(),
            baseURL: "http://localhost:3000",
            trustedOrigins: ["http://localhost:3000", "http://localhost:5000"],
            auth: {
                getSession: async (request: Request): Promise<KuluPaySession | null> => {
                    const role = request.headers.get("x-test-role");
                    if (role === "none") return null;
                    return {
                        user: { id: "test-user-id", email: "test@test.com", name: "Test" },
                        session: { id: "test-session-id" },
                    };
                },
            },
        },
        providers: new Map(),
        orm: orm as any,
        baseURL: "http://localhost:3000",
        trustedOrigins: ["http://localhost:3000", "http://localhost:5000"],
        logger: { debug: () => {}, error: () => {} },
        plugins: [],
        ...overrides,
    };
}

describe("Middleware", () => {
    describe("resolveSession", () => {
        it("should resolve session from getSession function", async () => {
            const ctx = createTestContext();
            const request = new Request("http://localhost:3000/api/pay/test", {
                headers: { "Content-Type": "application/json" },
            });

            const session = await resolveSession(request, ctx);
            expect(session).toBeDefined();
            expect(session?.user.id).toBe("test-user-id");
        });

        it("should return null when getSession returns null", async () => {
            const ctx = createTestContext();
            const request = new Request("http://localhost:3000/api/pay/test", {
                headers: { "x-test-role": "none" },
            });

            const session = await resolveSession(request, ctx);
            expect(session).toBeNull();
        });

        it("should return null when no auth is configured", async () => {
            const ctx = createTestContext({
                options: {
                    database: createMemoryDriver(),
                    baseURL: "http://localhost:3000",
                } as any,
            });

            const request = new Request("http://localhost:3000/api/pay/test");
            const session = await resolveSession(request, ctx);
            expect(session).toBeNull();
        });

        it("should cache session on context for subsequent calls", async () => {
            const ctx = createTestContext();
            const request = new Request("http://localhost:3000/api/pay/test");

            await resolveSession(request, ctx);
            expect(ctx.session).toBeDefined();
            expect(ctx.session?.user.id).toBe("test-user-id");

            // Second call should return cached session
            const cached = await resolveSession(request, ctx);
            expect(cached).toBe(ctx.session);
        });
    });

    describe("sessionMiddleware", () => {
        it("should attach session to context when valid", async () => {
            const ctx = createTestContext();
            const mockCtx: any = {
                request: new Request("http://localhost:3000/api/pay/test", {
                    headers: { "Content-Type": "application/json" },
                }),
                context: ctx,
            };

            const result = await sessionMiddleware(mockCtx);
            expect(result.session).toBeDefined();
            expect(result.session.user.id).toBe("test-user-id");
            expect(ctx.session).toBeDefined();
        });

        it("should throw UNAUTHORIZED when no session", async () => {
            const ctx = createTestContext();
            const mockCtx: any = {
                request: new Request("http://localhost:3000/api/pay/test", {
                    headers: { "x-test-role": "none" },
                }),
                context: ctx,
            };

            await expect(sessionMiddleware(mockCtx)).rejects.toThrow();
            try {
                await sessionMiddleware(mockCtx);
            } catch (error) {
                expect(error instanceof KuluPayAPIError).toBe(true);
                expect((error as KuluPayAPIError).status).toBe(401);
                expect((error as KuluPayAPIError).code).toBe("UNAUTHORIZED");
            }
        });

        it("should throw UNAUTHORIZED when no request", async () => {
            const ctx = createTestContext();
            const mockCtx: any = {
                context: ctx,
            };

            await expect(sessionMiddleware(mockCtx)).rejects.toThrow();
        });
    });

    describe("originCheckMiddleware", () => {
        it("should allow trusted origins", async () => {
            const ctx = createTestContext();
            const mockCtx: any = {
                request: new Request("http://localhost:3000/api/pay/test", {
                    method: "POST",
                    headers: { origin: "http://localhost:3000" },
                }),
                context: ctx,
            };

            await expect(originCheckMiddleware(mockCtx)).resolves.toBeUndefined();
        });

        it("should reject untrusted origins", async () => {
            const ctx = createTestContext();
            const mockCtx: any = {
                request: new Request("http://localhost:3000/api/pay/test", {
                    method: "POST",
                    headers: { origin: "http://evil.com" },
                }),
                context: ctx,
            };

            try {
                await originCheckMiddleware(mockCtx);
                expect.fail("Should have thrown");
            } catch (error) {
                expect(error instanceof KuluPayAPIError).toBe(true);
                expect((error as KuluPayAPIError).status).toBe(403);
                expect((error as KuluPayAPIError).code).toBe("INVALID_ORIGIN");
            }
        });

        it("should reject missing origin", async () => {
            const ctx = createTestContext();
            const mockCtx: any = {
                request: new Request("http://localhost:3000/api/pay/test", {
                    method: "POST",
                }),
                context: ctx,
            };

            try {
                await originCheckMiddleware(mockCtx);
                expect.fail("Should have thrown");
            } catch (error) {
                expect(error instanceof KuluPayAPIError).toBe(true);
                expect((error as KuluPayAPIError).code).toBe("MISSING_OR_NULL_ORIGIN");
            }
        });

        it("should skip origin check for GET requests", async () => {
            const ctx = createTestContext();
            const mockCtx: any = {
                request: new Request("http://localhost:3000/api/pay/test", {
                    method: "GET",
                    headers: { origin: "http://evil.com" },
                }),
                context: ctx,
            };

            await expect(originCheckMiddleware(mockCtx)).resolves.toBeUndefined();
        });

        it("should skip origin check for OPTIONS requests", async () => {
            const ctx = createTestContext();
            const mockCtx: any = {
                request: new Request("http://localhost:3000/api/pay/test", {
                    method: "OPTIONS",
                }),
                context: ctx,
            };

            await expect(originCheckMiddleware(mockCtx)).resolves.toBeUndefined();
        });

        it("should support wildcard trusted origins", async () => {
            const ctx = createTestContext({
                trustedOrigins: ["http://localhost:3000", "https://*.myapp.com"],
                options: {
                    database: createMemoryDriver(),
                    baseURL: "http://localhost:3000",
                    trustedOrigins: ["http://localhost:3000", "https://*.myapp.com"],
                    auth: {
                        getSession: async () => ({
                            user: { id: "test", email: "test@test.com" },
                            session: { id: "test" },
                        }),
                    },
                } as any,
            });

            const mockCtx: any = {
                request: new Request("http://localhost:3000/api/pay/test", {
                    method: "POST",
                    headers: { origin: "https://app.myapp.com" },
                }),
                context: ctx,
            };

            await expect(originCheckMiddleware(mockCtx)).resolves.toBeUndefined();
        });
    });

    describe("ownershipMiddleware", () => {
        it("should allow access when user owns the resource", async () => {
            const ctx = createTestContext();
            ctx.session = {
                user: { id: "user-1", email: "test@test.com" },
                session: { id: "sess-1" },
            };

            const middleware = ownershipMiddleware(async () => "user-1");
            const mockCtx: any = { context: ctx };

            await expect(middleware(mockCtx)).resolves.toBeUndefined();
        });

        it("should throw FORBIDDEN when user does not own the resource", async () => {
            const ctx = createTestContext();
            ctx.session = {
                user: { id: "user-1", email: "test@test.com" },
                session: { id: "sess-1" },
            };

            const middleware = ownershipMiddleware(async () => "user-2");
            const mockCtx: any = { context: ctx };

            try {
                await middleware(mockCtx);
                expect.fail("Should have thrown");
            } catch (error) {
                expect(error instanceof KuluPayAPIError).toBe(true);
                expect((error as KuluPayAPIError).status).toBe(403);
                expect((error as KuluPayAPIError).code).toBe("FORBIDDEN");
            }
        });

        it("should throw PAYMENT_NOT_FOUND when resource does not exist", async () => {
            const ctx = createTestContext();
            ctx.session = {
                user: { id: "user-1", email: "test@test.com" },
                session: { id: "sess-1" },
            };

            const middleware = ownershipMiddleware(async () => null);
            const mockCtx: any = { context: ctx };

            try {
                await middleware(mockCtx);
                expect.fail("Should have thrown");
            } catch (error) {
                expect(error instanceof KuluPayAPIError).toBe(true);
                expect((error as KuluPayAPIError).status).toBe(404);
                expect((error as KuluPayAPIError).code).toBe("PAYMENT_NOT_FOUND");
            }
        });

        it("should throw UNAUTHORIZED when no session", async () => {
            const ctx = createTestContext();
            ctx.session = null;

            const middleware = ownershipMiddleware(async () => "user-1");
            const mockCtx: any = { context: ctx };

            try {
                await middleware(mockCtx);
                expect.fail("Should have thrown");
            } catch (error) {
                expect(error instanceof KuluPayAPIError).toBe(true);
                expect((error as KuluPayAPIError).status).toBe(401);
                expect((error as KuluPayAPIError).code).toBe("UNAUTHORIZED");
            }
        });
    });
});
