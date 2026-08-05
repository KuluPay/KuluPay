"use client";
import React, { createContext, useContext, useState, useMemo, useCallback } from "react";
import { WagmiConfig } from "wagmi";
import { createKuluPayAppKit, type KuluPayAppKitInstance } from "../client/appkit";
import type { PayClient } from "../client/react";
import type { ProviderChainConfig } from "@kulupay/core";

export interface KuluPayAppKitProviderProps {
    /**
     * The KuluPay client instance created by createPayClient().
     * Must include walletConnectProjectId in its options for onchain payments.
     * The provider reads everything it needs from the client — no other props.
     */
    client: PayClient;
    /** App metadata for WalletConnect (optional) */
    metadata?: {
        name: string;
        description: string;
        url: string;
        icons: string[];
    };
    children: React.ReactNode;
    /** Shown while AppKit is initializing */
    fallback?: React.ReactNode;
}

interface KuluPayAppKitContextValue {
    appKit: KuluPayAppKitInstance | null;
    isLoading: boolean;
    error: Error | null;
    /** Initialize AppKit with chains from an intent response */
    initFromChains: (chains: ProviderChainConfig[]) => void;
}

const KuluPayAppKitContext = createContext<KuluPayAppKitContextValue>({
    appKit: null,
    isLoading: false,
    error: null,
    initFromChains: () => {},
});

/**
 * React provider that initializes AppKit from the KuluPay client.
 *
 * Takes only `client={payClient}` — no projectId, no chains props.
 * Reads walletConnectProjectId from client.$options.
 * Chains are provided lazily via initFromChains() when an intent is created
 * (the intent response includes chainConfig from the server).
 *
 * Usage:
 * ```tsx
 * const payClient = createPayClient({
 *   baseURL: "http://localhost:3000",
 *   walletConnectProjectId: "xxx",
 * });
 *
 * <KuluPayAppKitProvider client={payClient}>
 *   {children}
 * </KuluPayAppKitProvider>
 * ```
 */
export function KuluPayAppKitProvider({
    client,
    metadata,
    children,
    fallback,
}: KuluPayAppKitProviderProps) {
    const projectId = client.$options.walletConnectProjectId;
    const [appKit, setAppKit] = useState<KuluPayAppKitInstance | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const initFromChains = useCallback((chains: ProviderChainConfig[]) => {
        if (appKit) return; // already initialized
        if (!projectId) {
            setError(new Error(
                "walletConnectProjectId not set on client. " +
                "Pass it to createPayClient({ walletConnectProjectId: 'xxx' })."
            ));
            return;
        }
        if (chains.length === 0) return;

        setIsLoading(true);
        try {
            const instance = createKuluPayAppKit({ projectId, chains, metadata });
            setAppKit(instance);
            setError(null);
        } catch (err) {
            setError(err as Error);
        } finally {
            setIsLoading(false);
        }
    }, [appKit, projectId, metadata]);

    const contextValue = useMemo(
        () => ({ appKit, isLoading, error, initFromChains }),
        [appKit, isLoading, error, initFromChains],
    );

    if (isLoading) {
        return (
            <KuluPayAppKitContext.Provider value={contextValue}>
                {fallback ?? null}
            </KuluPayAppKitContext.Provider>
        );
    }

    if (error) {
        return (
            <KuluPayAppKitContext.Provider value={contextValue}>
                {fallback ?? (
                    <div>Failed to initialize KuluPay AppKit: {error.message}</div>
                )}
            </KuluPayAppKitContext.Provider>
        );
    }

    if (!appKit) {
        // AppKit not yet initialized — waiting for chains from first intent
        return (
            <KuluPayAppKitContext.Provider value={contextValue}>
                {children}
            </KuluPayAppKitContext.Provider>
        );
    }

    return (
        <KuluPayAppKitContext.Provider value={contextValue}>
            <WagmiConfig config={appKit.wagmiConfig}>
                {children}
            </WagmiConfig>
        </KuluPayAppKitContext.Provider>
    );
}

/**
 * Hook to access the KuluPay AppKit instance.
 * Must be used within a KuluPayAppKitProvider.
 */
export function useKuluPayAppKit(): KuluPayAppKitInstance {
    const ctx = useContext(KuluPayAppKitContext);
    if (!ctx.appKit) {
        throw new Error("useKuluPayAppKit must be used within a KuluPayAppKitProvider");
    }
    return ctx.appKit;
}

/**
 * Hook to check if AppKit is ready.
 */
export function useKuluPayAppKitStatus() {
    const ctx = useContext(KuluPayAppKitContext);
    return { appKit: ctx.appKit, isLoading: ctx.isLoading, error: ctx.error, initFromChains: ctx.initFromChains };
}

export { useAppKit, useAppKitAccount, useAppKitNetwork, useAppKitProvider, useDisconnect, useAppKitBalance } from "@reown/appkit/react";
export { useSendTransaction, useEstimateGas, useBalance } from "wagmi";
