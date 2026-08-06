"use client";

import { useEffect, useRef } from "react";
import type { PayClientLike } from "../types";
import { mountCheckout, type CheckoutHandle } from "../core/ui";

// Full React checkout — supports onchain payments via AppKit wallet connection.
// Requires the app to be wrapped in <KuluPayAppKitProvider client={payClient}>.
export { CheckoutPage, type CheckoutPageProps } from "../checkout-page";
export { KuluPayCheckout, type AppKitCheckoutProps } from "../appkit-checkout";

export interface VanillaCheckoutPageProps {
    intentId: string;
    clientSecret: string;
    client: PayClientLike;
    /** Merchant / app name shown in the header. */
    merchantName?: string;
    /** Light or dark theme. Default "light". */
    theme?: "light" | "dark";
}

/**
 * React wrapper around the framework-agnostic vanilla checkout core.
 * Does NOT support onchain wallet payments — use CheckoutPage for those.
 */
export function VanillaCheckoutPage({ intentId, clientSecret, client, merchantName, theme }: VanillaCheckoutPageProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const handleRef = useRef<CheckoutHandle | null>(null);

    useEffect(() => {
        if (!containerRef.current) return;
        handleRef.current = mountCheckout(containerRef.current, {
            intentId,
            clientSecret,
            client,
            merchantName,
            theme,
        });
        return () => {
            handleRef.current?.unmount();
            handleRef.current = null;
        };
    }, [intentId, clientSecret, client, merchantName, theme]);

    return <div ref={containerRef} />;
}
