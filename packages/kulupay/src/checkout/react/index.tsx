"use client";

import { useEffect, useRef } from "react";
import type { PayClientLike } from "../types";
import { mountCheckout, type CheckoutHandle } from "../core/ui";

export interface CheckoutPageProps {
    intentId: string;
    clientSecret: string;
    client: PayClientLike;
    /** Merchant / app name shown in the header. */
    merchantName?: string;
    /** Light or dark theme. Default "light". */
    theme?: "light" | "dark";
}

/**
 * React binding for the KuluPay checkout.
 * Thin wrapper around the framework-agnostic checkout core.
 */
export function CheckoutPage({ intentId, clientSecret, client, merchantName, theme }: CheckoutPageProps) {
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
