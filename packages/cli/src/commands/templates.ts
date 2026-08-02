import { PKG } from "../utils/packages";

export const REACT_USE_CHECKOUT = `import { useState, useEffect, useCallback, useRef } from "react";
import { CheckoutController, type CheckoutConfig, type CheckoutState } from "${PKG.core}/checkout";

export function useCheckout(config: CheckoutConfig) {
  const controllerRef = useRef<CheckoutController | null>(null);
  const [state, setState] = useState<CheckoutState | null>(null);

  if (!controllerRef.current) {
    controllerRef.current = new CheckoutController(config);
  }

  useEffect(() => {
    const controller = controllerRef.current!;
    const unsubscribe = controller.subscribe(setState);
    controller.startCountdown();
    setState(controller.getState());
    return () => {
      unsubscribe();
      controller.destroy();
    };
  }, []);

  const connectWallet = useCallback((walletId: string) => {
    return controllerRef.current?.connectWallet(walletId);
  }, []);

  const pay = useCallback(() => {
    return controllerRef.current?.pay();
  }, []);

  return {
    state,
    connectWallet,
    pay,
  };
}
`;

export const REACT_CHECKOUT = `import { useCheckout } from "./use-checkout";
import { WalletPicker } from "./wallet-picker";
import { AmountDisplay } from "./amount-display";
import { CountdownTimer } from "./countdown-timer";
import { ConfirmationStatus } from "./confirmation-status";
import { Disclosures } from "./disclosures";
import { PayButton } from "./pay-button";
import type { CheckoutConfig } from "${PKG.core}/checkout";

export function Checkout(props: CheckoutConfig) {
  const { state, connectWallet, pay } = useCheckout(props);

  if (!state) return null;

  return (
    <div className="kulupay-checkout" style={{ maxWidth: 420, margin: "0 auto", fontFamily: "system-ui, sans-serif" }}>
      <AmountDisplay amount={state.amount} token={state.tokenSymbol} />

      <CountdownTimer seconds={state.timeRemaining} />

      {state.status !== "succeeded" && state.status !== "expired" && (
        <WalletPicker
          wallets={state.availableWallets}
          connected={state.walletConnected}
          connectedWallet={state.connectedWallet}
          onConnect={connectWallet}
        />
      )}

      {state.status === "confirming" && state.confirmations && (
        <ConfirmationStatus
          current={state.confirmations.current}
          required={state.confirmations.required}
        />
      )}

      {state.status === "confirming" && !state.confirmations && (
        <p style={{ textAlign: "center", color: "#666" }}>Waiting for confirmations...</p>
      )}

      <PayButton
        onClick={pay}
        status={state.status}
        disabled={!state.walletConnected}
        amount={state.amount}
        token={state.tokenSymbol}
      />

      {state.txHash && (
        <p style={{ fontSize: 12, color: "#999", wordBreak: "break-all" }}>
          TX: {state.txHash}
        </p>
      )}

      {state.error && (
        <p style={{ color: "#dc2626", fontSize: 14 }}>{state.error}</p>
      )}

      {state.status === "succeeded" && (
        <div style={{ padding: 16, background: "#e6ffe6", borderRadius: 8, textAlign: "center" }}>
          <p style={{ color: "green", fontWeight: 600 }}>Payment succeeded!</p>
        </div>
      )}

      {state.status === "expired" && (
        <div style={{ padding: 16, background: "#fef2f2", borderRadius: 8, textAlign: "center" }}>
          <p style={{ color: "#dc2626", fontWeight: 600 }}>Payment expired</p>
        </div>
      )}

      <Disclosures />
    </div>
  );
}
`;

export const REACT_WALLET_PICKER = `import type { WalletInfo } from "${PKG.core}/checkout";

interface Props {
  wallets: WalletInfo[];
  connected: boolean;
  connectedWallet: string | null;
  onConnect: (walletId: string) => void;
}

export function WalletPicker({ wallets, connected, connectedWallet, onConnect }: Props) {
  if (connected) {
    return (
      <div style={{ padding: 12, background: "#e6ffe6", borderRadius: 8, marginBottom: 12 }}>
        <span style={{ color: "green", fontWeight: 600 }}>
          {connectedWallet} connected
        </span>
      </div>
    );
  }

  const installed = wallets.filter((w) => w.installed);
  const others = wallets.filter((w) => !w.installed);

  return (
    <div style={{ marginBottom: 16 }}>
      <p style={{ fontWeight: 600, marginBottom: 8 }}>Select a wallet</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {installed.map((w) => (
          <button
            key={w.id}
            onClick={() => onConnect(w.id)}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "10px 14px",
              borderRadius: 8,
              border: "1px solid #ccc",
              background: "#fff",
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            <span>{w.name}</span>
            <span style={{ fontSize: 12, color: "green" }}>Installed</span>
          </button>
        ))}
        {others.length > 0 && (
          <>
            <p style={{ fontSize: 12, color: "#999", margin: "8px 0 4px" }}>Other wallets</p>
            {others.map((w) => (
              <button
                key={w.id}
                onClick={() => onConnect(w.id)}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "10px 14px",
                  borderRadius: 8,
                  border: "1px solid #eee",
                  background: "#fafafa",
                  cursor: "pointer",
                  fontSize: 14,
                  opacity: 0.7,
                }}
              >
                <span>{w.name}</span>
              </button>
            ))}
          </>
        )}
      </div>
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

export const REACT_PAY_BUTTON = `import type { CheckoutStatus } from "${PKG.core}/checkout";

interface Props {
  onClick: () => void;
  status: CheckoutStatus;
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
