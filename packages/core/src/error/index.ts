export class KuluPayError extends Error {
    constructor(message: string, public code?: string) {
        super(message);
        this.name = "KuluPayError";
    }
}

export class ProviderError extends KuluPayError {
    constructor(message: string, public providerId: string, public raw?: any) {
        super(message, "PROVIDER_ERROR");
        this.name = "ProviderError";
    }
}

export class ValidationError extends KuluPayError {
    constructor(message: string) {
        super(message, "VALIDATION_ERROR");
        this.name = "ValidationError";
    }
}
