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

	// In the future, we can add more logic here to handle 
    // wildcards or dynamic trusted origins, similar to better-auth
	return trustedOrigins;
};
