import { describe, it, expect, beforeEach } from "vitest";
import { kuluPay } from "../../pay";
import type { PaymentProvider, PaymentIntent, CreateIntentData } from "@kulupay/core";
import { getTestInstance } from "@kulupay/core/test-utils";

// Mock provider that doesn't need external APIs
const mockProvider: PaymentProvider = {
    id: "mock",
    checkout: "redirect",
    createIntent: async (data: CreateIntentData): Promise<PaymentIntent> => {
        return {
            id: `mock_pi_${Date.now()}`,
            amount: data.amount,
            currency: data.currency,
            status: "pending",
            clientSecret: `mock_secret_${Date.now()}`,
            metadata: { ...data.metadata, userId: data.userId },
        };
    },
    getIntent: async (id: string): Promise<PaymentIntent> => {
        return {
            id,
            amount: 100,
            currency: "usd",
            status: "succeeded",
        };
    },
    cancelIntent: async (id: string): Promise<PaymentIntent> => {
        return {
            id,
            amount: 100,
            currency: "usd",
            status: "canceled",
        };
    },
};

async function createTestPay() {
    const { options } = await getTestInstance({ providers: [mockProvider] });
    return kuluPay({
        ...options,
        auth: {
            getSession: async (request: Request) => {
                const role = request.headers.get("x-test-role");
                if (role === "none") return null;
                return {
                    user: { id: "test-user-id", email: "test@test.com", name: "Test" },
                    session: { id: "test-session-id" },
                };
            },
        },
        providers: [mockProvider],
    });
}

function createRequest(
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

describe("Intent Routes", () => {
    let pay: Awaited<ReturnType<typeof createTestPay>>;

    beforeEach(async () => {
        pay = await createTestPay();
    });

    describe("POST /create-intent", () => {
        it("should create an intent successfully", async () => {
            const request = createRequest("/create-intent", {
                method: "POST",
                origin: "http://localhost:3000",
                body: {
                    amount: 100,
                    currency: "usd",
                    providerId: "mock",
                },
            });
            const response = await pay.handler(request);
            expect(response.status).toBe(200);
            const data = await response.json();
            expect(data.amount).toBe(100);
            expect(data.currency).toBe("usd");
            expect(data.status).toBe("pending");
            expect(data.clientSecret).toBeDefined();
        });

        it("should reject without session", async () => {
            const request = createRequest("/create-intent", {
                method: "POST",
                origin: "http://localhost:3000",
                headers: { "x-test-role": "none" },
                body: {
                    amount: 100,
                    currency: "usd",
                    providerId: "mock",
                },
            });
            const response = await pay.handler(request);
            expect(response.status).toBe(401);
            const data = await response.json();
            expect(data.error.code).toBe("UNAUTHORIZED");
        });

        it("should reject with invalid provider", async () => {
            const request = createRequest("/create-intent", {
                method: "POST",
                origin: "http://localhost:3000",
                body: {
                    amount: 100,
                    currency: "usd",
                    providerId: "nonexistent",
                },
            });
            const response = await pay.handler(request);
            expect(response.status).toBe(404);
            const data = await response.json();
            expect(data.error.code).toBe("PROVIDER_NOT_FOUND");
        });

        it("should reject with untrusted origin", async () => {
            const request = createRequest("/create-intent", {
                method: "POST",
                origin: "http://evil.com",
                body: {
                    amount: 100,
                    currency: "usd",
                    providerId: "mock",
                },
            });
            const response = await pay.handler(request);
            expect(response.status).toBe(403);
            const data = await response.json();
            expect(data.error.code).toBe("INVALID_ORIGIN");
        });

        it("should reject with invalid currency", async () => {
            const request = createRequest("/create-intent", {
                method: "POST",
                origin: "http://localhost:3000",
                body: {
                    amount: 100,
                    currency: "invalid",
                    providerId: "mock",
                },
            });
            const response = await pay.handler(request);
            expect(response.status).toBe(400);
            const data = await response.json();
            expect(data.error.code).toBe("INVALID_CURRENCY");
        });

        it("should use userId from session, not body", async () => {
            const request = createRequest("/create-intent", {
                method: "POST",
                origin: "http://localhost:3000",
                body: {
                    amount: 100,
                    currency: "usd",
                    providerId: "mock",
                    userId: "hacker-user-id",
                },
            });
            const response = await pay.handler(request);
            expect(response.status).toBe(200);
            const data = await response.json();
            // The mock provider puts userId in metadata
            expect(data.metadata.userId).toBe("test-user-id");
        });
    });

    describe("GET /get-intent", () => {
        it("should get intent successfully", async () => {
            // First create an intent
            const createReq = createRequest("/create-intent", {
                method: "POST",
                origin: "http://localhost:3000",
                body: { amount: 100, currency: "usd", providerId: "mock" },
            });
            const createRes = await pay.handler(createReq);
            const created = await createRes.json();

            // Now get it
            const getReq = createRequest(`/get-intent?id=${created.id}&providerId=mock`);
            const getRes = await pay.handler(getReq);
            expect(getRes.status).toBe(200);
            const data = await getRes.json();
            expect(data.id).toBe(created.id);
        });

        it("should reject without session", async () => {
            const getReq = createRequest(`/get-intent?id=fake_id&providerId=mock`, {
                headers: { "x-test-role": "none" },
            });
            const getRes = await pay.handler(getReq);
            expect(getRes.status).toBe(401);
        });
    });

    describe("POST /confirm-intent", () => {
        it("should reject without required fields", async () => {
            const request = createRequest("/confirm-intent", {
                method: "POST",
                origin: "http://localhost:3000",
                body: { intentId: "fake" },
            });
            const response = await pay.handler(request);
            expect(response.status).toBe(400);
            const data = await response.json();
            expect(data.error.code).toBe("MISSING_FIELD");
        });

        it("should reject with non-existent intent", async () => {
            const request = createRequest("/confirm-intent", {
                method: "POST",
                origin: "http://localhost:3000",
                body: {
                    intentId: "nonexistent",
                    txHash: "0xabc",
                    clientSecret: "fake_secret",
                },
            });
            const response = await pay.handler(request);
            expect(response.status).toBe(404);
            const data = await response.json();
            expect(data.error.code).toBe("PAYMENT_NOT_FOUND");
        });
    });

    describe("GET /checkout-intent", () => {
        it("should reject without required fields", async () => {
            const request = createRequest("/checkout-intent");
            const response = await pay.handler(request);
            expect(response.status).toBe(400);
            const data = await response.json();
            expect(data.error.code).toBe("MISSING_FIELD");
        });
    });
});
