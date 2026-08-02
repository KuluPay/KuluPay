"use client";

import { useState, useEffect } from "react";
import type { CheckoutProps } from "./types";
import { formatAmount, shortenAddress } from "./types";

export function TronCheckout({ intent, client, onStartPolling, onUpdateStatus }: CheckoutProps) {
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(intent.txHash);

  useEffect(() => {
    const checkTronLink = () => {
      const tw = (window as any).tronWeb;
      if (tw?.defaultAddress?.base58) {
        setAddress(tw.defaultAddress.base58);
        setConnected(true);
        return true;
      }
      return false;
    };

    if (checkTronLink()) return;

    const interval = setInterval(() => {
      if (checkTronLink()) clearInterval(interval);
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const connect = async () => {
    setError(null);
    const tl = (window as any).tronLink;
    const tw = (window as any).tronWeb;

    if (tl?.request) {
      try {
        const res = await tl.request({ method: "tron_requestAccounts" });
        if (res?.code === 200) {
          setTimeout(() => {
            if (tw?.defaultAddress?.base58) {
              setAddress(tw.defaultAddress.base58);
              setConnected(true);
            }
          }, 500);
        } else if (res?.code === 4001) {
          setError("TronLink connection rejected");
        }
      } catch (err: any) {
        setError(err.message || "Failed to connect TronLink");
      }
    } else if (tw?.defaultAddress?.base58) {
      setAddress(tw.defaultAddress.base58);
      setConnected(true);
    } else {
      setError("TronLink not found. Please install the TronLink extension.");
    }
  };

  const pay = async () => {
    if (!connected) return;
    setError(null);
    setPaying(true);

    try {
      const tw = (window as any).tronWeb;
      if (!tw) throw new Error("TronWeb not available");

      const from = tw.defaultAddress.base58;
      const recipient = intent.recipient || intent.raw?.to;
      const token = intent.token;

      if (!recipient) throw new Error("Missing recipient address");

      let hash: string;

      if (token?.address) {
        const decimals = token.decimals || 6;
        const rawAmount = Math.floor((intent.amount / 100) * Math.pow(10, decimals));

        const { transaction } = await tw.transactionBuilder.triggerSmartContract(
          token.address,
          "transfer(address,uint256)",
          { feeLimit: 100_000_000 },
          [
            { type: "address", value: recipient },
            { type: "uint256", value: rawAmount },
          ],
          from,
        );

        const signedTx = await tw.trx.sign(transaction);
        await tw.trx.sendRawTransaction(signedTx);
        hash = transaction.txID;
      } else {
        const result = await tw.trx.sendTransaction(recipient, Math.floor(intent.amount / 100));
        hash = typeof result === "string" ? result : result?.txid || result?.txID || "";
      }

      setTxHash(hash);
      onUpdateStatus("pending_confirmation", hash);

      const { error: confirmError } = await client.confirmIntent({
        body: {
          intentId: intent.id,
          txHash: hash,
          clientSecret: intent.clientSecret,
        },
      });

      if (confirmError) {
        throw new Error(confirmError.message || "Failed to confirm with server");
      }

      onStartPolling();
    } catch (err: any) {
      setError(err.message || "Payment failed");
      onUpdateStatus("failed");
    } finally {
      setPaying(false);
    }
  };

  if (intent.status === "pending_confirmation") {
    return (
      <div style={{ padding: 16, background: "#1a1a2e", borderRadius: 12, border: "1px solid #3030a0", textAlign: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 14, color: "#a0a0ff", marginBottom: 4 }}>Waiting for confirmations</div>
        {txHash && (
          <div style={{ fontSize: 12, color: "#666", wordBreak: "break-all" }}>TX: {shortenAddress(txHash, 10)}</div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 16, padding: 12, background: "#1a1a1a", borderRadius: 8, fontSize: 13 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={{ color: "#888" }}>Network</span>
          <span style={{ fontWeight: 600 }}>{intent.network?.name || "Tron"}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "#888" }}>Recipient</span>
          <span style={{ fontFamily: "monospace", fontSize: 12 }}>{shortenAddress(intent.recipient || intent.raw?.to || "")}</span>
        </div>
        {intent.token?.symbol && (
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
            <span style={{ color: "#888" }}>Token</span>
            <span style={{ fontWeight: 600 }}>{intent.token.symbol}</span>
          </div>
        )}
      </div>

      {!connected ? (
        <div>
          <p style={{ fontSize: 14, color: "#888", marginBottom: 12 }}>Connect TronLink to pay</p>
          <button onClick={connect} style={{ width: "100%", padding: "12px 16px", borderRadius: 10, border: "1px solid #eb2f2f", background: "#1a0a0a", color: "#eb2f2f", cursor: "pointer", fontSize: 14, fontWeight: 600 }}>
            Connect TronLink
          </button>
        </div>
      ) : (
        <div>
          <div style={{ padding: 12, background: "#0d1f0d", borderRadius: 8, border: "1px solid #1a3a1a", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "#22c55e", fontSize: 14, fontWeight: 600 }}>TronLink connected</span>
            <span style={{ fontFamily: "monospace", fontSize: 12, color: "#888" }}>{shortenAddress(address || "")}</span>
          </div>
          <button onClick={pay} disabled={paying} style={{ width: "100%", padding: "14px 24px", borderRadius: 10, border: "none", background: paying ? "#333" : "#fafafa", color: paying ? "#888" : "#0a0a0a", fontSize: 16, fontWeight: 600, cursor: paying ? "not-allowed" : "pointer" }}>
            {paying ? "Confirm in TronLink..." : `Pay ${formatAmount(intent.amount, intent.currency)}`}
          </button>
        </div>
      )}

      {error && (
        <div style={{ marginTop: 16, padding: 12, background: "#2a0d0d", borderRadius: 8, border: "1px solid #5a1a1a", fontSize: 13, color: "#ff6b6b" }}>
          {error}
        </div>
      )}
      <p style={{ marginTop: 16, fontSize: 11, color: "#555" }}>Send the exact amount in USDT. No refunds for wrong amounts or wrong chains.</p>
    </div>
  );
}
