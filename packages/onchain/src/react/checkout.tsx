"use client";
import React, { useState, useEffect, useCallback } from "react";
import { useAppKit, useAppKitAccount, useAppKitBalance, useAppKitNetwork } from "@reown/appkit/react";
import { useSendTransaction, useSwitchChain } from "wagmi";
import type { PaymentIntent, ProviderChainConfig } from "@kulupay/core";

export type CheckoutState = "idle" | "connecting" | "sending" | "confirming" | "confirmed" | "error";

export interface OnchainCheckoutSlots {
    header?: (props: { amount: string; symbol: string; description?: string }) => React.ReactNode;
    timer?: (props: { remaining: number; isExpired: boolean }) => React.ReactNode;
    account?: (props: { address: string | null; balance: { formatted: string; symbol: string } | null; isConnected: boolean }) => React.ReactNode;
    error?: (props: { message: string; onRetry: () => void }) => React.ReactNode;
    button?: (props: { state: CheckoutState; onClick: () => void; disabled: boolean; text: string }) => React.ReactNode;
    txStatus?: (props: { txHash: string | null; state: CheckoutState }) => React.ReactNode;
    success?: (props: { txHash: string }) => React.ReactNode;
}

export interface OnchainCheckoutProps {
    intent: PaymentIntent & {
        chainConfig?: ProviderChainConfig | null;
        description?: string | null;
        deadline?: number | null;
    };
    client: {
        confirmIntent: (opts: { body: { intentId: string; txHash: string; clientSecret: string } }) => Promise<{ data: any; error: any }>;
        verifyIntent: (opts: { intentId: string; clientSecret: string }) => Promise<{ data: any; error: any }>;
    };
    appKit?: {
        modal: { getWalletProvider: () => any };
    };
    slots?: OnchainCheckoutSlots;
    theme?: Record<string, string>;
    onStatusChange?: (status: string, txHash?: string) => void;
    onConfirmed?: (txHash: string) => void;
    onError?: (error: Error) => void;
    connectButtonText?: string;
    payButtonText?: string;
    showTimer?: boolean;
}

function getTokenRawAmount(intent: any): string {
    const converted = intent.metadata?.priceConversion?.cryptoAmount;
    if (converted) return converted.toString();
    if (intent.raw?.value && intent.raw.value !== "0") return intent.raw.value;
    if (
        intent.raw?.data &&
        typeof intent.raw.data === "string" &&
        intent.raw.data.startsWith("0xa9059cbb") &&
        intent.raw.data.length >= 138
    ) {
        return BigInt(`0x${intent.raw.data.slice(-64)}`).toString();
    }
    return "";
}

function resolveTokenInfo(intent: any): { symbol: string; decimals: number } {
    if (intent.token?.symbol && intent.token?.decimals) {
        return { symbol: intent.token.symbol, decimals: intent.token.decimals };
    }
    if (intent.metadata?.token?.symbol && intent.metadata?.token?.decimals) {
        return { symbol: intent.metadata.token.symbol, decimals: intent.metadata.token.decimals };
    }
    if (intent.raw?.tokenSymbol) {
        const chainTokens = intent.chainConfig?.tokens as any;
        if (chainTokens) {
            for (const key of Object.keys(chainTokens)) {
                const t = chainTokens[key];
                if (t?.symbol === intent.raw.tokenSymbol) {
                    return { symbol: t.symbol, decimals: t.decimals };
                }
            }
        }
        return { symbol: intent.raw.tokenSymbol, decimals: 18 };
    }
    if (intent.chainConfig?.tokens) {
        const tokens = intent.chainConfig.tokens as any;
        for (const key of Object.keys(tokens)) {
            const t = tokens[key];
            if (t?.symbol && t?.decimals) {
                return { symbol: t.symbol, decimals: t.decimals };
            }
        }
    }
    return { symbol: "", decimals: 18 };
}

function formatTokenAmount(rawAmount: string, decimals: number): string {
    const value = BigInt(rawAmount) / BigInt(10 ** decimals);
    const remainder = BigInt(rawAmount) % BigInt(10 ** decimals);
    const intPart = value.toString();
    const decPart = remainder.toString().padStart(decimals, "0").slice(0, 4);
    return `${intPart}.${decPart}`;
}

function shortenAddress(addr: string, chars = 6): string {
    if (!addr) return "";
    return `${addr.slice(0, chars)}...${addr.slice(-4)}`;
}

function timeRemaining(deadline: number): { mins: number; secs: number; total: number } {
    const total = Math.max(0, Math.floor((deadline - Date.now()) / 1000));
    return {
        mins: Math.floor(total / 60),
        secs: total % 60,
        total,
    };
}

export function OnchainCheckout({
    intent,
    client,
    appKit,
    slots,
    theme,
    onStatusChange,
    onConfirmed,
    onError,
    connectButtonText = "Connect Wallet",
    payButtonText = "Pay",
    showTimer = true,
}: OnchainCheckoutProps) {
    const { open } = useAppKit();
    const { isConnected, address } = useAppKitAccount();
    const { fetchBalance } = useAppKitBalance();
    const { sendTransactionAsync, isPending: isSendingTx } = useSendTransaction();
    const { switchChainAsync } = useSwitchChain();
    const network = useAppKitNetwork();

    const [state, setState] = useState<CheckoutState>("idle");
    const [txHash, setTxHash] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [balance, setBalance] = useState<{ formatted: string; symbol: string } | null>(null);
    const [polling, setPolling] = useState(false);

    const isTron = intent.metadata?.family === "tron";
    const { symbol: tokenSymbol, decimals: tokenDecimals } = resolveTokenInfo(intent);
    const raw = intent.raw;
    const tokenAmount = getTokenRawAmount(intent);
    const displayAmount = tokenAmount ? formatTokenAmount(tokenAmount, tokenDecimals) : "";

    useEffect(() => {
        if (isConnected && state === "connecting") {
            setState("idle");
        }
    }, [isConnected, state]);

    useEffect(() => {
        if (isConnected && address) {
            fetchBalance().then((res: any) => {
                if (res?.data) {
                    setBalance({ formatted: res.data.formatted, symbol: res.data.symbol });
                }
            }).catch(() => {});
        } else {
            setBalance(null);
        }
    }, [isConnected, address, fetchBalance]);

    const pollForConfirmation = useCallback(async () => {
        if (polling || !txHash || !intent.clientSecret) return;
        setPolling(true);

        const maxAttempts = 60;
        for (let i = 0; i < maxAttempts; i++) {
            try {
                const result = await client.verifyIntent({
                    intentId: intent.id,
                    clientSecret: intent.clientSecret,
                });
                if (result?.data?.status === "succeeded") {
                    setState("confirmed");
                    onStatusChange?.("succeeded", txHash);
                    onConfirmed?.(txHash);
                    setPolling(false);
                    return;
                }
                if (result?.data?.status === "failed") {
                    setState("error");
                    setError("Payment failed on-chain verification");
                    onStatusChange?.("failed", txHash);
                    onError?.(new Error("Payment failed"));
                    setPolling(false);
                    return;
                }
            } catch {
            }
            await new Promise((r) => setTimeout(r, 3000));
        }
        setPolling(false);
    }, [polling, txHash, intent.id, intent.clientSecret, client, onStatusChange, onConfirmed, onError]);

    useEffect(() => {
        if (txHash && state === "confirming") {
            pollForConfirmation();
        }
    }, [txHash, state, pollForConfirmation]);

    const handlePay = async () => {
        if (!isConnected) {
            setState("connecting");
            open();
            return;
        }

        if (!raw) {
            setError("No transaction data in intent");
            setState("error");
            onError?.(new Error("No transaction data in intent"));
            return;
        }

        setState("sending");
        setError(null);

        try {
            let hash: string;

            if (!isTron && intent.chainConfig) {
                const targetChainId = intent.chainConfig.chainId;
                const currentChainId = network?.chainId;
                if (currentChainId !== targetChainId) {
                    await switchChainAsync({ chainId: targetChainId });
                }
            }

            if (isTron) {
                const provider = appKit?.modal?.getWalletProvider?.();
                if (!provider) throw new Error("No wallet provider");
                const result = await (provider as any).request({
                    method: "tron_sendTransaction",
                    params: [raw],
                });
                hash = typeof result === "string" ? result : result?.txid ?? result?.hash ?? "";
            } else {
                hash = await sendTransactionAsync({
                    to: raw.to as `0x${string}`,
                    value: raw.value ? BigInt(raw.value) : BigInt(0),
                    data: raw.data as `0x${string}` | undefined,
                });
            }

            setTxHash(hash);
            setState("confirming");
            onStatusChange?.("pending_confirmation", hash);

            try {
                await client.confirmIntent({
                    body: {
                        intentId: intent.id,
                        txHash: hash,
                        clientSecret: intent.clientSecret!,
                    },
                });
            } catch {
            }
        } catch (err: any) {
            setState("error");
            setError(err?.message ?? "Transaction failed");
            onError?.(err instanceof Error ? err : new Error(err?.message ?? "Transaction failed"));
        }
    };

    const handleRetry = () => {
        setState("idle");
        setError(null);
        setTxHash(null);
    };

    const timer = intent.deadline ? timeRemaining(intent.deadline) : null;
    const isExpired = timer?.total === 0;

    const getButtonText = () => {
        if (isExpired) return "Expired";
        if (state === "connecting") return "Connecting...";
        if (state === "sending") return "Sending...";
        if (state === "confirming") return "Confirming...";
        if (state === "confirmed") return "Confirmed!";
        if (state === "error") return "Retry";
        if (!isConnected) return connectButtonText;
        return payButtonText;
    };

    const isDisabled = isExpired || state === "connecting" || state === "sending" || state === "confirming" || state === "confirmed";

    const themeStyle = theme ? { ...theme } as React.CSSProperties : undefined;

    return (
        <div className="kulupay-checkout" style={themeStyle}>
            {slots?.header ? (
                slots.header({ amount: displayAmount, symbol: tokenSymbol, description: intent.description ?? undefined })
            ) : (
                <div className="kulupay-checkout__header">
                    <h3>Pay {displayAmount} {tokenSymbol}</h3>
                    {intent.description && <p>{intent.description}</p>}
                </div>
            )}

            {showTimer && timer && (
                slots?.timer ? (
                    slots.timer({ remaining: timer.total, isExpired })
                ) : !isExpired ? (
                    <div className="kulupay-checkout__timer">
                        Time remaining: {timer.mins}:{timer.secs.toString().padStart(2, "0")}
                    </div>
                ) : (
                    <div className="kulupay-checkout__expired">Payment expired</div>
                )
            )}

            {slots?.account ? (
                slots.account({ address: address ?? null, balance, isConnected })
            ) : (
                isConnected && address && (
                    <div className="kulupay-checkout__account">
                        <span>Connected: {shortenAddress(address)}</span>
                        {balance && (
                            <span>Balance: {balance.formatted} {balance.symbol}</span>
                        )}
                    </div>
                )
            )}

            {error && (
                slots?.error ? (
                    slots.error({ message: error, onRetry: handleRetry })
                ) : (
                    <div className="kulupay-checkout__error">{error}</div>
                )
            )}

            {txHash && (
                slots?.txStatus ? (
                    slots.txStatus({ txHash, state })
                ) : (
                    <div className="kulupay-checkout__txhash">
                        TX: {shortenAddress(txHash, 10)}
                    </div>
                )
            )}

            {slots?.button ? (
                slots.button({ state, onClick: handlePay, disabled: isDisabled, text: getButtonText() })
            ) : (
                <button
                    className="kulupay-checkout__button"
                    onClick={handlePay}
                    disabled={isDisabled}
                >
                    {getButtonText()}
                </button>
            )}

            {state === "confirmed" && txHash && (
                slots?.success ? (
                    slots.success({ txHash })
                ) : (
                    <div className="kulupay-checkout__success">
                        Payment confirmed! Thank you.
                    </div>
                )
            )}
        </div>
    );
}
