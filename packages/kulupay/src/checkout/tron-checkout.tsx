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
      <div style={pendingStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, justifyContent: "center" }}>
          <div style={{ width: 16, height: 16, border: "2px solid #a0a0ff", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
          <span style={{ fontSize: 15, color: "#a0a0ff", fontWeight: 600 }}>Waiting for confirmations</span>
        </div>
        {txHash && (
          <div style={{ fontSize: 12, color: "#71717a", wordBreak: "break-all", fontFamily: "monospace", textAlign: "center" }}>
            TX: {shortenAddress(txHash, 10)}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div style={infoCardStyle}>
        <div style={infoRowStyle}>
          <span style={infoLabelStyle}>Network</span>
          <span style={infoValueStyle}>{intent.network?.name || "Tron"}</span>
        </div>
        <div style={infoRowStyle}>
          <span style={infoLabelStyle}>Recipient</span>
          <span style={{ ...infoValueStyle, fontFamily: "monospace", fontSize: 12 }}>{shortenAddress(intent.recipient || intent.raw?.to || "")}</span>
        </div>
        {intent.token?.symbol && (
          <div style={infoRowStyle}>
            <span style={infoLabelStyle}>Token</span>
            <span style={infoValueStyle}>{intent.token.symbol}</span>
          </div>
        )}
      </div>

      {!connected ? (
        <div>
          <p style={{ fontSize: 14, color: "#a1a1aa", marginBottom: 14, fontWeight: 500 }}>Connect TronLink to pay</p>
          <button onClick={connect} style={tronConnectBtnStyle}>
            Connect TronLink
          </button>
        </div>
      ) : (
        <div>
          <div style={connectedBoxStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e" }} />
              <span style={{ color: "#22c55e", fontSize: 14, fontWeight: 600 }}>TronLink connected</span>
            </div>
            <span style={{ fontFamily: "monospace", fontSize: 12, color: "#a1a1aa" }}>{shortenAddress(address || "")}</span>
          </div>
          <button onClick={pay} disabled={paying} style={payBtnStyle(paying)}>
            {paying ? "Confirm in TronLink..." : `Pay ${formatAmount(intent.amount, intent.currency)}`}
          </button>
        </div>
      )}

      {error && (
        <div style={errorBoxStyle}>{error}</div>
      )}
      <div style={warningStyle}>
        <span style={{ marginRight: 6 }}>⚠</span>
        Send the exact amount in USDT. No refunds for wrong amounts or wrong chains.
      </div>
    </div>
  );
}

const infoCardStyle: React.CSSProperties = {
  marginBottom: 20,
  padding: 16,
  background: "#09090b",
  borderRadius: 12,
  border: "1px solid #27272a",
};

const infoRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "6px 0",
};

const infoLabelStyle: React.CSSProperties = {
  color: "#71717a",
  fontSize: 13,
  fontWeight: 500,
};

const infoValueStyle: React.CSSProperties = {
  fontWeight: 600,
  fontSize: 13,
  color: "#fafafa",
};

const pendingStyle: React.CSSProperties = {
  padding: 20,
  background: "#0a0a1a",
  borderRadius: 12,
  border: "1px solid #27273a",
  textAlign: "center",
  marginBottom: 16,
};

const tronConnectBtnStyle: React.CSSProperties = {
  width: "100%",
  padding: "14px 16px",
  borderRadius: 12,
  border: "1px solid #eb2f2f",
  background: "#1a0a0a",
  color: "#eb2f2f",
  cursor: "pointer",
  fontSize: 14,
  fontWeight: 600,
};

const connectedBoxStyle: React.CSSProperties = {
  padding: 14,
  background: "#0a1f0a",
  borderRadius: 12,
  border: "1px solid #1a3a1a",
  marginBottom: 16,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

const payBtnStyle = (disabled: boolean): React.CSSProperties => ({
  width: "100%",
  padding: "16px 24px",
  borderRadius: 12,
  border: "none",
  background: disabled ? "#3f3f46" : "#fafafa",
  color: disabled ? "#71717a" : "#09090b",
  fontSize: 16,
  fontWeight: 700,
  cursor: disabled ? "not-allowed" : "pointer",
});

const errorBoxStyle: React.CSSProperties = {
  marginTop: 16,
  padding: 14,
  background: "#2a0d0d",
  borderRadius: 12,
  border: "1px solid #5a1a1a",
  fontSize: 13,
  color: "#ff6b6b",
  lineHeight: 1.5,
};

const warningStyle: React.CSSProperties = {
  marginTop: 20,
  padding: "12px 14px",
  background: "#1a1505",
  borderRadius: 10,
  border: "1px solid #3a3010",
  fontSize: 12,
  color: "#a8a060",
  lineHeight: 1.5,
  display: "flex",
  alignItems: "flex-start",
};
