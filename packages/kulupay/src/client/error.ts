export class KuluPayError extends Error {
    constructor(message: string, public code?: string) {
        super(message);
        this.name = "KuluPayError";
    }
}
