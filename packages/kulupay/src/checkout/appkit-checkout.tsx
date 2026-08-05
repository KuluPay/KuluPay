"use client";
import React, { useState, useEffect, useCallback } from "react";
import { useAppKit, useAppKitAccount, useAppKitBalance } from "@reown/appkit/react";
import { useSendTransaction } from "wagmi";
import type { PaymentIntent } from "@kulupay/core";
import { useKuluPayAppKitStatus } from "../integrations/appkit-react";
import type { ProviderChainConfig } from "@kulupay/core";
import {
    type CheckoutIntentData,
    type PayClientLike,
    formatTokenAmount,
    shortenAddress,
    timeRemaining,
} from "./types";

export interface AppKitCheckoutProps {
    /** The payment intent from the server (createIntent response) */
    intent: CheckoutIntentData;
    /** The KuluPay client (from createPayClient) */
    client: PayClientLike & {
        confirmIntent: (opts: { body: { intentId: string; txHash: string; clientSecret: string } }) => Promise<{ data: any; error: any }>;
        verifyIntent: (opts: { intentId: string; clientSecret: string }) => Promise<{ data: any; error: any }>;
    };
    /** Called when payment status changes */
    onStatusChange?: (status: string, txHash?: string) => void;
    /** Called when transaction is confirmed on-chain */
    onConfirmed?: (txHash: string) => void;
    /** Called on error */
    onError?: (error: Error) => void;
    /** Custom button text */
    connectButtonText?: string;
    payButtonText?: string;
    /** Show countdown timer if intent has deadline */
    showTimer?: boolean;
}

type CheckoutState = "idle" | "connecting" | "sending" | "confirming" | "confirmed" | "error";

export function KuluPayCheckout({
    intent,
    client,
    onStatusChange,
    onConfirmed,
    onError,
    connectButtonText = "Connect Wallet",
    payButtonText = "Pay",
    showTimer = true,
}: AppKitCheckoutProps) {
    const { open } = useAppKit();
    const { isConnected, address } = useAppKitAccount();
    const { fetchBalance } = useAppKitBalance();
    const { sendTransactionAsync, isPending: isSendingTx } = useSendTransaction();
    const { appKit, isLoading: appKitLoading, initFromChains } = useKuluPayAppKitStatus();

    // Initialize AppKit lazily from the intent's chainConfig
    useEffect(() => {
        if (!appKit && !appKitLoading && intent.chainConfig) {
            initFromChains([intent.chainConfig as ProviderChainConfig]);
        }
    }, [appKit, appKitLoading, initFromChains, intent]);

    const [state, setState] = useState<CheckoutState>("idle");
    const [txHash, setTxHash] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [balance, setBalance] = useState<{ formatted: string; symbol: string } | null>(null);
    const [polling, setPolling] = useState(false);

    const isTron = intent.metadata?.family === "tron";
    const token = intent.token;
    const raw = intent.raw;

    // Fetch balance when connected
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

    // Poll for confirmation after txHash is submitted
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
                // Continue polling
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
        if (!appKit) {
            setError("AppKit is not initialized yet");
            setState("error");
            return;
        }

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

            if (isTron) {
                // Tron: use the wallet provider directly
                const provider = appKit.modal.getWalletProvider();
                if (!provider) throw new Error("No wallet provider");
                const result = await (provider as any).request({
                    method: "tron_sendTransaction",
                    params: [raw],
                });
                hash = typeof result === "string" ? result : result?.txid ?? result?.hash ?? "";
            } else {
                // EVM: use wagmi sendTransaction
                hash = await sendTransactionAsync({
                    to: raw.to as `0x${string}`,
                    value: raw.value ? BigInt(raw.value) : BigInt(0),
                    data: raw.data as `0x${string}` | undefined,
                });
            }

            setTxHash(hash);
            setState("confirming");
            onStatusChange?.("pending_confirmation", hash);

            // Submit txHash to server for verification
            try {
                await client.confirmIntent({
                    body: {
                        intentId: intent.id,
                        txHash: hash,
                        clientSecret: intent.clientSecret,
                    },
                });
            } catch {
                // Server confirmation will be picked up by polling
            }
        } catch (err: any) {
            setState("error");
            setError(err?.message ?? "Transaction failed");
            onError?.(err instanceof Error ? err : new Error(err?.message ?? "Transaction failed"));
        }
    };

    const timer = intent.deadline ? timeRemaining(intent.deadline) : null;
    const isExpired = timer?.total === 0;

    const getButtonText = () => {
        if (isExpired) return "Expired";
        if (appKitLoading) return "Initializing...";
        if (!appKit) return "Loading...";
        if (state === "connecting") return "Connecting...";
        if (state === "sending") return "Sending...";
        if (state === "confirming") return "Confirming...";
        if (state === "confirmed") return "Confirmed!";
        if (state === "error") return "Retry";
        if (!isConnected) return connectButtonText;
        return payButtonText;
    };

    const isDisabled = isExpired || appKitLoading || !appKit || state === "connecting" || state === "sending" || state === "confirming" || state === "confirmed";

    return (
        <div className="kulupay-checkout">
            <div className="kulupay-checkout__header">
                <h3>Pay {formatTokenAmount(intent.amount.toString(), token?.decimals ?? 18)} {token?.symbol}</h3>
                {intent.description && <p>{intent.description}</p>}
            </div>

            {showTimer && timer && !isExpired && (
                <div className="kulupay-checkout__timer">
                    Time remaining: {timer.mins}:{timer.secs.toString().padStart(2, "0")}
                </div>
            )}

            {isExpired && (
                <div className="kulupay-checkout__expired">
                    Payment expired
                </div>
            )}

            {isConnected && address && (
                <div className="kulupay-checkout__account">
                    <span>Connected: {shortenAddress(address)}</span>
                    {balance && (
                        <span>Balance: {balance.formatted} {balance.symbol}</span>
                    )}
                </div>
            )}

            {error && (
                <div className="kulupay-checkout__error">
                    {error}
                </div>
            )}

            {txHash && (
                <div className="kulupay-checkout__txhash">
                    TX: {shortenAddress(txHash, 10)}
                </div>
            )}

            <button
                className="kulupay-checkout__button"
                onClick={handlePay}
                disabled={isDisabled}
            >
                {getButtonText()}
            </button>

            {state === "confirmed" && (
                <div className="kulupay-checkout__success">
                    Payment confirmed! Thank you.
                </div>
            )}
        </div>
    );
}
