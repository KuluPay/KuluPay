import { KuluPayOptions } from "../types";
import { getOrigin } from "../utils/url";

export const getTrustedOrigins = async (
	options: KuluPayOptions,
	request?: Request,
): Promise<string[]> => {
	const trustedOrigins: string[] = [];

	if (options.baseURL && typeof options.baseURL === "string") {
		const origin = getOrigin(options.baseURL);
		if (origin) {
			trustedOrigins.push(origin);
		}
	}

	if (Array.isArray(options.trustedOrigins)) {
		trustedOrigins.push(...options.trustedOrigins);
	} else if (typeof options.trustedOrigins === "function" && request) {
		const dynamic = await options.trustedOrigins(request).catch(() => []);
		trustedOrigins.push(...dynamic.filter((v): v is string => Boolean(v)));
	}

	return [...new Set(trustedOrigins)];
};
