import { BaseURLConfig, DynamicBaseURLConfig } from "../types";
import { KuluPayError } from "../error";

function checkHasPath(url: string): boolean {
	try {
		const parsedUrl = new URL(url);
		const pathname = parsedUrl.pathname.replace(/\/+$/, "") || "/";
		return pathname !== "/";
	} catch {
		throw new KuluPayError(
			`Invalid base URL: ${url}. Please provide a valid base URL.`,
		);
	}
}

function assertHasProtocol(url: string): void {
	try {
		const parsedUrl = new URL(url);
		if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
			throw new KuluPayError(
				`Invalid base URL: ${url}. URL must include 'http://' or 'https://'`,
			);
		}
	} catch (error) {
		if (error instanceof KuluPayError) {
			throw error;
		}
		throw new KuluPayError(
			`Invalid base URL: ${url}. Please provide a valid base URL.`,
		);
	}
}

function withPath(url: string, path = "/api/pay") {
	assertHasProtocol(url);

	const hasPath = checkHasPath(url);
	if (hasPath) {
		return url;
	}

	const trimmedUrl = url.replace(/\/+$/, "");

	if (!path || path === "/") {
		return trimmedUrl;
	}

	path = path.startsWith("/") ? path : `/${path}`;
	return `${trimmedUrl}${path}`;
}

export function getOrigin(url: string) {
	try {
		const parsedUrl = new URL(url);
		return parsedUrl.origin === "null" ? null : parsedUrl.origin;
	} catch {
		return null;
	}
}

export function getBaseURL(
	url?: string,
	path?: string,
	request?: Request,
    trustedProxyHeaders?: string[]
) {
	if (url) {
		return withPath(url, path);
	}

    // Simplified env check for now
    const fromEnv = typeof process !== "undefined" ? (process.env.BETTER_PAY_URL || process.env.BASE_URL) : undefined;
    if (fromEnv && fromEnv !== "/") {

        return withPath(fromEnv, path);
    }

	if (request) {
		const origin = getOrigin(request.url);
		if (!origin) {
			throw new KuluPayError(
				"Could not get origin from request. Please provide a valid base URL.",
			);
		}
		return withPath(origin, path);
	}

	return undefined;
}

export function isDynamicBaseURLConfig(
	config: BaseURLConfig | undefined,
): config is DynamicBaseURLConfig {
	return (
		typeof config === "object" &&
		config !== null &&
		"allowedHosts" in config &&
		Array.isArray(config.allowedHosts)
	);
}

export function getHostFromRequest(request: Request): string | null {
	const forwardedHost = request.headers.get("x-forwarded-host");
	if (forwardedHost) {
		return forwardedHost;
	}

	const host = request.headers.get("host");
	if (host) {
		return host;
	}

	try {
		const url = new URL(request.url);
		return url.host;
	} catch {
		return null;
	}
}

export function getProtocolFromRequest(
	request: Request,
	configProtocol?: "http" | "https" | "auto" | undefined,
): "http" | "https" {
	if (configProtocol === "http" || configProtocol === "https") {
		return configProtocol;
	}

	const forwardedProto = request.headers.get("x-forwarded-proto");
	if (forwardedProto === "http" || forwardedProto === "https") {
		return forwardedProto;
	}

	try {
		const url = new URL(request.url);
		if (url.protocol === "http:" || url.protocol === "https:") {
			return url.protocol.slice(0, -1) as "http" | "https";
		}
	} catch {}

	return "https";
}

export function resolveBaseURL(
	config: BaseURLConfig | undefined,
	basePath: string,
	request?: Request,
): string | undefined {
	if (isDynamicBaseURLConfig(config)) {
		if (request) {
            const host = getHostFromRequest(request);
            if (host) {
                const isAllowed = config.allowedHosts.some(pattern => {
                    if (pattern.includes("*")) {
                         // Simple wildcard match for now
                         const regex = new RegExp("^" + pattern.replace(/\./g, "\\.").replace(/\*/g, ".*") + "$");
                         return regex.test(host);
                    }
                    return host === pattern;
                });
                if (isAllowed) {
                    const protocol = getProtocolFromRequest(request, config.protocol);
                    return withPath(`${protocol}://${host}`, basePath);
                }
            }
            if (config.fallback) {
                return withPath(config.fallback, basePath);
            }
		}
		return getBaseURL(undefined, basePath, request);
	}

	if (typeof config === "string") {
		return getBaseURL(config, basePath, request);
	}

	return getBaseURL(undefined, basePath, request);
}
