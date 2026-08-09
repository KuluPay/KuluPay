export const REACT_CHECKOUT = `import { AmountDisplay } from "./amount-display";
import { CountdownTimer } from "./countdown-timer";
import { ConfirmationStatus } from "./confirmation-status";
import { Disclosures } from "./disclosures";
import { PayButton } from "./pay-button";

// This is a starter template — customize freely.
// Use AppKit for wallet connection and signing.
// See the demo app at demo/next/ for a complete example.

interface CheckoutProps {
  amount: string;
  tokenSymbol: string;
  timeRemaining: number;
  status: string;
  txHash: string | null;
  error: string | null;
  onPay: () => void;
}

export function Checkout(props: CheckoutProps) {
  return (
    <div className="kulupay-checkout" style={{ maxWidth: 420, margin: "0 auto", fontFamily: "system-ui, sans-serif" }}>
      <AmountDisplay amount={props.amount} token={props.tokenSymbol} />

      <CountdownTimer seconds={props.timeRemaining} />

      {props.status === "confirming" && (
        <p style={{ textAlign: "center", color: "#666" }}>Waiting for confirmations...</p>
      )}

      <PayButton
        onClick={props.onPay}
        status={props.status}
        disabled={props.status === "confirming" || props.status === "succeeded"}
        amount={props.amount}
        token={props.tokenSymbol}
      />

      {props.txHash && (
        <p style={{ fontSize: 12, color: "#999", wordBreak: "break-all" }}>
          TX: {props.txHash}
        </p>
      )}

      {props.error && (
        <p style={{ color: "#dc2626", fontSize: 14 }}>{props.error}</p>
      )}

      {props.status === "succeeded" && (
        <div style={{ padding: 16, background: "#e6ffe6", borderRadius: 8, textAlign: "center" }}>
          <p style={{ color: "green", fontWeight: 600 }}>Payment succeeded!</p>
        </div>
      )}

      {props.status === "expired" && (
        <div style={{ padding: 16, background: "#fef2f2", borderRadius: 8, textAlign: "center" }}>
          <p style={{ color: "#dc2626", fontWeight: 600 }}>Payment expired</p>
        </div>
      )}

      <Disclosures />
    </div>
  );
}
`;

export const REACT_AMOUNT_DISPLAY = `interface Props {
  amount: string;
  token: string;
}

export function AmountDisplay({ amount, token }: Props) {
  return (
    <div style={{ textAlign: "center", marginBottom: 16 }}>
      <h2 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>
        Pay {amount} {token}
      </h2>
    </div>
  );
}
`;

export const REACT_COUNTDOWN_TIMER = `import { useState, useEffect } from "react";

interface Props {
  seconds: number;
}

export function CountdownTimer({ seconds }: Props) {
  const [display, setDisplay] = useState(seconds);

  useEffect(() => {
    setDisplay(seconds);
  }, [seconds]);

  const mins = Math.floor(display / 60);
  const secs = display % 60;
  const isLow = display < 300;

  return (
    <p style={{
      textAlign: "center",
      fontSize: 13,
      color: isLow ? "#dc2626" : "#999",
      marginBottom: 16,
    }}>
      Expires in {mins}:{secs.toString().padStart(2, "0")}
    </p>
  );
}
`;

export const REACT_CONFIRMATION_STATUS = `interface Props {
  current: number;
  required: number;
}

export function ConfirmationStatus({ current, required }: Props) {
  const pct = Math.min(100, (current / required) * 100);
  return (
    <div style={{ marginBottom: 16 }}>
      <p style={{ fontSize: 14, color: "#666", marginBottom: 4 }}>
        Confirming {current}/{required}
      </p>
      <div style={{ height: 4, background: "#eee", borderRadius: 2, overflow: "hidden" }}>
        <div style={{
          height: "100%",
          width: \`\${pct}%\`,
          background: "#3b82f6",
          transition: "width 0.5s ease",
        }} />
      </div>
    </div>
  );
}
`;

export const REACT_DISCLOSURES = `export function Disclosures() {
  return (
    <div style={{ marginTop: 16, fontSize: 12, color: "#999" }}>
      <p>Send the exact amount. No refunds for wrong amounts or wrong chains.</p>
      <p>By proceeding, you agree to the terms of service.</p>
    </div>
  );
}
`;

export const REACT_PAY_BUTTON = `interface Props {
  onClick: () => void;
  status: string;
  disabled: boolean;
  amount: string;
  token: string;
}

export function PayButton({ onClick, status, disabled, amount, token }: Props) {
  const isLoading = status === "paying" || status === "connecting";

  return (
    <button
      onClick={onClick}
      disabled={disabled || isLoading || status === "confirming" || status === "succeeded"}
      style={{
        width: "100%",
        padding: "14px 24px",
        borderRadius: 8,
        border: "none",
        background: disabled ? "#ccc" : "#111",
        color: "#fff",
        fontSize: 16,
        fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {isLoading
        ? "Processing..."
        : status === "confirming"
        ? "Waiting for confirmations..."
        : status === "succeeded"
        ? "Paid"
        : \`Pay \${amount} \${token}\`}
    </button>
  );
}
`;
