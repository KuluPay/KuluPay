export class KuluPayClientError extends Error {
    developerMessage?: string;
    hint?: string;

    constructor(
        public code: string,
        message: string,
        public status: number,
        public data?: any,
    ) {
        super(message);
        this.name = "KuluPayClientError";
    }
}

export { KuluPayClientError as KuluPayError };
