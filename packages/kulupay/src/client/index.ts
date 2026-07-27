export * from './vanilla';
export * from './react';
export * from './providers';
export { createKuluPayReactHooks, usePaymentProvider } from './react';
export type { CreateIntentData, PaymentIntent, PaymentStatus, PaymentClientProvider, PaymentConfirmOptions } from '@kulupay/core';

import { KuluPayClient, KuluPayClientOptions } from './vanilla';
import { createKuluPayReactHooks } from './react';

/**
 * KuluPay client with React hooks attached.
 * Following the better-auth pattern where the client is created once
 * and hooks are accessed as properties on the client instance.
 */
export type KuluPayClientWithHooks = KuluPayClient & {
    usePayment: ReturnType<typeof createKuluPayReactHooks>['usePayment'];
};

/**
 * Creates a KuluPay client.
 *
 * Following the better-auth pattern, the client is instantiated once
 * and exported from a shared module. React hooks are attached to the
 * client instance for use in components.
 *
 * @example
 * ```ts
 * // lib/pay-client.ts
 * export const payClient = createKuluPayClient({
 *   baseURL: "/api/pay",
 * });
 * ```
 *
 * Then in your component:
 * ```tsx
 * import { payClient } from "@/lib/pay-client";
 * const { createIntent, loading, error } = payClient.usePayment({ providerId: "mock" });
 * ```
 */
export const createKuluPayClient = (options: KuluPayClientOptions): KuluPayClientWithHooks => {
    const client = new KuluPayClient(options);
    const hooks = createKuluPayReactHooks(client);
    return Object.assign(client, { usePayment: hooks.usePayment });
};

/**
 * Alias for {@link createKuluPayClient}.
 * Matches the better-auth convention of `createAuthClient`.
 *
 * @example
 * ```ts
 * // lib/pay-client.ts
 * export const payClient = createPayClient({
 *   baseURL: "/api/pay",
 * });
 * ```
 */
export const createPayClient = createKuluPayClient;
export type PayClient = KuluPayClientWithHooks;
