"use client";
import React, { createContext, useContext, useState, useMemo, useCallback } from "react";
import { WagmiConfig } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createAppKit } from "@reown/appkit/react";
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
    /** Reown AppKit theme options for UI customization */
    themeOptions?: {
        themeMode?: "dark" | "light" | "auto";
        themeVariables?: Record<string, string>;
        customWallets?: any[];
        enableWallets?: any[];
        featuredWallets?: string[];
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

const GLOBAL_KEY = "__KuluPayAppKitContext__";

const KuluPayAppKitContext: React.Context<KuluPayAppKitContextValue> =
    (globalThis as any)[GLOBAL_KEY] ??
    createContext<KuluPayAppKitContextValue>({
        appKit: null,
        isLoading: false,
        error: null,
        initFromChains: () => {},
    });

if (!(globalThis as any)[GLOBAL_KEY]) {
    (globalThis as any)[GLOBAL_KEY] = KuluPayAppKitContext;
}

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
    themeOptions,
    children,
    fallback,
}: KuluPayAppKitProviderProps) {
    const projectId = client.$options.walletConnectProjectId;
    const [appKit, setAppKit] = useState<KuluPayAppKitInstance | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const queryClient = useMemo(() => new QueryClient(), []);

    const initFromChains = useCallback((chains: ProviderChainConfig[]) => {
        console.log('[KuluPayAppKit] initFromChains called', { hasAppKit: !!appKit, projectId: projectId ? projectId.slice(0, 8) + '...' : 'MISSING', chainsCount: chains.length, chainNames: chains.map(c => c.name) });
        if (appKit) return; // already initialized
        if (!projectId) {
            console.error('[KuluPayAppKit] No projectId — set NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID');
            setError(new Error(
                "walletConnectProjectId not set on client. " +
                "Pass it to createPayClient({ walletConnectProjectId: 'xxx' })."
            ));
            return;
        }
        if (chains.length === 0) return;

        setIsLoading(true);
        try {
            console.log('[KuluPayAppKit] Creating AppKit instance...');
            const instance = createKuluPayAppKit({ projectId, chains, metadata, themeOptions }, createAppKit);
            console.log('[KuluPayAppKit] AppKit instance created successfully');
            setAppKit(instance);
            setError(null);
        } catch (err) {
            console.error('[KuluPayAppKit] Failed to create AppKit:', err);
            setError(err as Error);
        } finally {
            setIsLoading(false);
        }
    }, [appKit, projectId, metadata, themeOptions]);

    const contextValue = useMemo(
        () => ({ appKit, isLoading, error, initFromChains }),
        [appKit, isLoading, error, initFromChains],
    );

    if (appKit) {
        return (
            <KuluPayAppKitContext.Provider value={contextValue}>
                <QueryClientProvider client={queryClient}>
                    <WagmiConfig config={appKit.wagmiConfig}>
                        {children}
                    </WagmiConfig>
                </QueryClientProvider>
            </KuluPayAppKitContext.Provider>
        );
    }

    // AppKit not yet initialized or error — still render children so checkout
    // components can show their own loading/error states via useKuluPayAppKitStatus()
    return (
        <KuluPayAppKitContext.Provider value={contextValue}>
            {children}
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
export { useSendTransaction, useEstimateGas, useBalance, useSwitchChain } from "wagmi";
