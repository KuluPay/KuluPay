import { createOrm, createMemoryDriver } from "@farming-labs/orm";
import { getKuluPayTables } from "../db/get-tables";
import { createKuluPayContext } from "../context/create-context";
import type { KuluPayOptions, KuluPayContext, KuluPaySession } from "../types";

export const testUser = {
    id: "test-user-id",
    email: "test@kulupay.com",
    name: "Test User",
};

export const adminUser = {
    id: "admin-user-id",
    email: "admin@kulupay.com",
    name: "Admin User",
    role: "admin",
};

/**
 * Creates a mock session resolver for testing.
 * Returns the test user by default, or admin if the request
 * has an "x-test-role: admin" header.
 */
function createMockGetSession() {
    return async (request: Request): Promise<KuluPaySession | null> => {
        const role = request.headers.get("x-test-role");
        if (role === "admin") {
            return {
                user: { id: adminUser.id, email: adminUser.email, name: adminUser.name, role: "admin" },
                session: { id: "test-session-admin" },
            };
        }
        if (role === "none" || role === "unauthorized") {
            return null;
        }
        return {
            user: { id: testUser.id, email: testUser.email, name: testUser.name },
            session: { id: "test-session-id" },
        };
    };
}

/**
 * Creates a mock authorize function for testing.
 * Admins can do everything, regular users can't refund/capture/analytics.
 */
function createMockAuthorize() {
    return async (action: string, _ctx: KuluPayContext, session: KuluPaySession): Promise<boolean> => {
        if (action === "refund" || action === "capture" || action === "analytics" || action === "list-all-payments" || action === "list-all-subscriptions") {
            return (session.user as any).role === "admin";
        }
        return true;
    };
}

/**
 * Creates a test KuluPay context with memory database and mock auth.
 * Follows the better-auth getTestInstance pattern.
 */
export async function getTestInstance(overrides?: Partial<KuluPayOptions>) {
    const options: KuluPayOptions = {
        database: createMemoryDriver(),
        baseURL: "http://localhost:3000",
        basePath: "/api/pay",
        trustedOrigins: ["http://localhost:3000", "http://localhost:5000"],
        auth: {
            getSession: createMockGetSession(),
            authorize: createMockAuthorize(),
        },
        ...overrides,
    };

    const ctx = await createKuluPayContext(options);
    const orm = ctx.orm;

    return {
        ctx,
        orm,
        options,
        testUser,
        adminUser,
    };
}

/**
 * Creates a mock Request object for testing endpoints.
 */
export function createTestRequest(
    path: string,
    options: {
        method?: string;
        body?: any;
        headers?: Record<string, string>;
        origin?: string;
    } = {},
): Request {
    const method = options.method || "GET";
    const url = `http://localhost:3000/api/pay${path}`;
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...options.headers,
    };
    if (options.origin) {
        headers["origin"] = options.origin;
    }

    return new Request(url, {
        method,
        headers,
        body: options.body ? JSON.stringify(options.body) : undefined,
    });
}
