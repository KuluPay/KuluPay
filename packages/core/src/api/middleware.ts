import { KuluPayAPIError, KULUPAY_ERROR_CODES } from "../error";
import type { KuluPayContext, KuluPaySession } from "../types";
import { getOrigin } from "../utils/url";
import { createMiddleware } from "better-call";

/**
 * Resolves the session from the request using the configured `getSession` function.
 * If no auth is configured, returns null (open mode for dev/testing).
 * Caches the session on the context for downstream use.
 */
export async function resolveSession(
    request: Request,
    ctx: KuluPayContext,
): Promise<KuluPaySession | null> {
    if (ctx.session !== undefined) {
        return ctx.session;
    }

    const getSession = ctx.options.auth?.getSession;
    if (!getSession) {
        ctx.session = null;
        return null;
    }

    const session = await getSession(request).catch(() => null);
    ctx.session = session;
    return session;
}

/**
 * Middleware that requires a valid session.
 * Throws 401 UNAUTHORIZED if no session is found.
 * Attaches `session` to the context for downstream handlers.
 */
export const sessionMiddleware = createMiddleware(async (ctx: any): Promise<{ session: KuluPaySession }> => {
    const request = ctx.request || (ctx.headers ? new Request("http://localhost", { headers: ctx.headers }) : null);
    if (!request) {
        throw KuluPayAPIError.fromCode("UNAUTHORIZED");
    }

    const session = await resolveSession(request, ctx.context);
    if (!session?.user) {
        throw KuluPayAPIError.fromCode("UNAUTHORIZED");
    }

    ctx.context.session = session;
    return { session };
});

/**
 * Middleware that validates the Origin header against trusted origins.
 * Skips for GET/OPTIONS/HEAD requests (no state mutation).
 * Throws 403 INVALID_ORIGIN if origin doesn't match.
 */
export const originCheckMiddleware = createMiddleware(async (ctx: any): Promise<void> => {
    const request = ctx.request;
    if (!request) return;

    if (
        request.method === "GET" ||
        request.method === "OPTIONS" ||
        request.method === "HEAD"
    ) {
        return;
    }

    const headers = request.headers;
    const originHeader = headers.get("origin") || headers.get("referer") || "";

    if (!originHeader || originHeader === "null") {
        throw KuluPayAPIError.fromCode("MISSING_OR_NULL_ORIGIN");
    }

    const origin = getOrigin(originHeader);
    if (!origin) {
        throw KuluPayAPIError.fromCode("INVALID_ORIGIN");
    }

    const trustedOrigins = await resolveTrustedOrigins(request, ctx.context);
    const isTrusted = trustedOrigins.some((trusted) => {
        if (trusted.includes("*")) {
            return wildcardMatch(trusted, origin);
        }
        return trusted === origin;
    });

    if (!isTrusted) {
        throw KuluPayAPIError.fromCode("INVALID_ORIGIN");
    }
});

/**
 * Creates an ownership middleware that checks if a resource belongs to the session user.
 * @param getResourceUserId - Function that retrieves the userId of the resource being accessed
 */
export function ownershipMiddleware(
    getResourceUserId: (ctx: any) => Promise<string | null>,
) {
    return createMiddleware(async (ctx: any): Promise<void> => {
        const session = ctx.context?.session;
        if (!session?.user?.id) {
            throw KuluPayAPIError.fromCode("UNAUTHORIZED");
        }

        const resourceUserId = await getResourceUserId(ctx);
        if (resourceUserId === null) {
            throw KuluPayAPIError.fromCode("PAYMENT_NOT_FOUND");
        }

        if (resourceUserId !== session.user.id) {
            throw KuluPayAPIError.fromCode("FORBIDDEN");
        }
    });
}

/**
 * Resolves trusted origins from config (static list or dynamic function).
 * Always includes the baseURL origin.
 */
async function resolveTrustedOrigins(
    request: Request,
    ctx: KuluPayContext,
): Promise<string[]> {
    const baseOrigin = getOrigin(ctx.baseURL);
    const origins: string[] = baseOrigin ? [baseOrigin] : [];

    const configured = ctx.options.trustedOrigins;
    if (Array.isArray(configured)) {
        origins.push(...configured);
    } else if (typeof configured === "function") {
        const dynamic = await configured(request).catch(() => []);
        origins.push(...dynamic.filter((v): v is string => Boolean(v)));
    }

    return [...new Set(origins)];
}

/**
 * Simple wildcard pattern matcher.
 * Supports `*` for single segment and `**` for multiple segments.
 */
function wildcardMatch(pattern: string, value: string): boolean {
    const regex = pattern
        .replace(/[.+^${}()|[\]\\]/g, "\\$&")
        .replace(/\*\*/g, ".*")
        .replace(/\*/g, "[^/]*");
    return new RegExp(`^${regex}$`).test(value);
}
