export type OnchainErrorCode =
    | "WALLET_NOT_FOUND"
    | "WALLET_NOT_CONNECTED"
    | "TRANSACTION_REJECTED"
    | "INSUFFICIENT_FUNDS"
    | "WRONG_CHAIN"
    | "CHAIN_NOT_ADDED"
    | "INVALID_RECIPIENT"
    | "TRANSACTION_FAILED"
    | "RPC_ERROR"
    | "MISSING_PAYMENT_DATA"
    | "INVALID_CONTRACT"
    | "CHAIN_MISMATCH"
    | "INSUFFICIENT_GAS"
    | "USER_REJECTED";

interface ErrorDefinition {
    message: string;
    developerMessage: string;
    hint?: string;
}

export const ONCHAIN_ERROR_CODES: Record<OnchainErrorCode, ErrorDefinition> = {
    WALLET_NOT_FOUND: {
        message: "No wallet found.",
        developerMessage: "window.ethereum (EVM) or window.tronWeb (Tron) is undefined. Install MetaMask or TronLink extension.",
        hint: "Install MetaMask from https://metamask.io or TronLink from https://www.tronlink.org",
    },
    WALLET_NOT_CONNECTED: {
        message: "Wallet not connected.",
        developerMessage: "No accounts returned from wallet. Call eth_requestAccounts (EVM) or tron_requestAccounts (Tron) first.",
        hint: "Click the Connect button to link your wallet.",
    },
    TRANSACTION_REJECTED: {
        message: "Transaction rejected.",
        developerMessage: "User rejected the signature request in the wallet popup (error code 4001).",
        hint: "Click Confirm again and approve the transaction in your wallet.",
    },
    INSUFFICIENT_FUNDS: {
        message: "Insufficient funds.",
        developerMessage: "Wallet balance is too low to cover gas + transaction value.",
        hint: "Fund your wallet with test ETH from https://sepoliafaucet.com (Ethereum) or https://shasta.tronlink.io (Tron testnet).",
    },
    WRONG_CHAIN: {
        message: "Wrong network.",
        developerMessage: "Wallet is on the wrong chain. Switch to the correct network in your wallet settings.",
        hint: "Switch to the correct network in your wallet.",
    },
    CHAIN_NOT_ADDED: {
        message: "Network not found in wallet.",
        developerMessage: "The target chain is not added to the wallet. Call wallet_addEthereumChain first.",
        hint: "Add the network in your wallet settings.",
    },
    INVALID_RECIPIENT: {
        message: "Invalid recipient address.",
        developerMessage: "Recipient address is zero address or malformed.",
        hint: "Check EVM_RECIPIENT_ADDRESS or TRON_RECIPIENT_ADDRESS in your .env file.",
    },
    TRANSACTION_FAILED: {
        message: "Transaction failed.",
        developerMessage: "Transaction was submitted but reverted or failed on-chain.",
        hint: "Check the transaction hash on a block explorer for revert details.",
    },
    RPC_ERROR: {
        message: "Network error.",
        developerMessage: "Failed to communicate with the onchain RPC node.",
        hint: "Check your internet connection and try again.",
    },
    MISSING_PAYMENT_DATA: {
        message: "Missing payment data.",
        developerMessage: "paymentMethodData is null or undefined. Ensure createIntent was called and intent.raw is populated.",
        hint: "Create a payment intent first before confirming.",
    },
    INVALID_CONTRACT: {
        message: "Token contract not found on this network.",
        developerMessage: "The token contract address does not exist on the current network. This usually means the server is configured with a contract from a different network (e.g. mainnet contract on testnet, or Shasta contract on Nile).",
        hint: "Check that the token contract address in your server config matches the network you're using.",
    },
    CHAIN_MISMATCH: {
        message: "Wallet is on the wrong chain.",
        developerMessage: "The wallet is connected to a different chain than the payment requires. Chain switching was attempted but failed.",
        hint: "Switch to the correct chain in your wallet and try again.",
    },
    INSUFFICIENT_GAS: {
        message: "Not enough gas to complete transaction.",
        developerMessage: "Wallet balance is insufficient to cover gas fees for this transaction.",
        hint: "Fund your wallet with native tokens for gas.",
    },
    USER_REJECTED: {
        message: "User rejected the request.",
        developerMessage: "The user cancelled the wallet connection or transaction signing request.",
        hint: "Try again and approve the request in your wallet.",
    },
};

export interface NetworkInfo {
    name: string;
    chainId: number;
    rpcUrl: string;
    explorerUrl: string;
    isTestnet: boolean;
    faucetUrl?: string;
}

export interface OnchainErrorContext {
    balance?: string;
    required?: string;
    chainId?: number | string;
    expectedChain?: string;
    actualChain?: string;
    address?: string;
    details?: string;
    network?: NetworkInfo;
}

export class OnchainError extends Error {
    readonly code: OnchainErrorCode;
    readonly developerMessage: string;
    readonly hint?: string;
    readonly context?: OnchainErrorContext;

    constructor(
        code: OnchainErrorCode,
        context?: OnchainErrorContext,
        cause?: unknown,
    ) {
        const def = ONCHAIN_ERROR_CODES[code];
        let message = def.message;
        let devMessage = def.developerMessage;
        let hint = def.hint;

        if (context) {
            if (context.balance !== undefined && context.required !== undefined) {
                devMessage = `Balance: ${context.balance}, required: ${context.required}. ${devMessage}`;
            }
            if (context.expectedChain && context.actualChain) {
                devMessage = `Expected chain ${context.expectedChain}, got ${context.actualChain}. ${devMessage}`;
            }
            if (context.chainId !== undefined) {
                devMessage = `Chain ID: ${context.chainId}. ${devMessage}`;
            }
            if (context.address) {
                devMessage = `Address: ${context.address}. ${devMessage}`;
            }
            if (context.details) {
                devMessage = `${devMessage} Details: ${context.details}`;
            }
        }

        if (context?.network) {
            const n = context.network;
            devMessage = `Network: ${n.name} (${n.chainId}), explorer: ${n.explorerUrl}. ${devMessage}`;

            if (code === "INSUFFICIENT_FUNDS" && n.faucetUrl) {
                hint = `Get free test tokens from ${n.faucetUrl}`;
            } else if (code === "INSUFFICIENT_FUNDS" && !n.isTestnet) {
                hint = "Fund your wallet with real tokens. This is mainnet — no free faucet available.";
            } else if (code === "WRONG_CHAIN") {
                hint = `Open your wallet extension and switch to ${n.name} (chainId: ${n.chainId}).`;
            } else if (code === "CHAIN_NOT_ADDED" && n.isTestnet) {
                hint = `Add ${n.name} (chainId: ${n.chainId}) to your wallet settings.`;
            } else if (code === "TRANSACTION_FAILED") {
                hint = `Check the transaction on ${n.explorerUrl}`;
            } else if (code === "INVALID_CONTRACT") {
                hint = `The token contract does not exist on ${n.name}. Verify the contract address in networks.ts matches this network. Explorer: ${n.explorerUrl}`;
            } else if (code === "WALLET_NOT_FOUND" && n.isTestnet) {
                hint = `Install MetaMask from https://metamask.io and switch to ${n.name}`;
            }
        }

        super(message, { cause });
        this.name = "OnchainError";
        this.code = code;
        this.developerMessage = devMessage;
        this.hint = hint;
        this.context = context;
    }

    static fromWalletError(error: any, network?: NetworkInfo): OnchainError {
        const code = (error?.code ?? error?.error?.code) as number | undefined;
        const msg = (error?.message ?? error?.error?.message ?? String(error ?? "")).toLowerCase();
        const ctx = (extra?: Partial<OnchainErrorContext>): OnchainErrorContext => ({
            details: error?.message,
            network,
            ...extra,
        });

        if (code === 4001 || msg.includes("rejected") || msg.includes("denied") || msg.includes("user rejected")) {
            return new OnchainError("TRANSACTION_REJECTED", ctx(), error);
        }

        if (code === 4902 || msg.includes("unrecognized chain") || msg.includes("chain not added")) {
            return new OnchainError("CHAIN_NOT_ADDED", ctx(), error);
        }

        if (code === -32002 || msg.includes("request accounts") || msg.includes("already pending")) {
            return new OnchainError("WALLET_NOT_CONNECTED", ctx(), error);
        }

        if (msg.includes("insufficient funds") || msg.includes("gas") && msg.includes("price")) {
            const balanceMatch = msg.match(/balance\s+(\d+)/);
            const costMatch = msg.match(/cost\s+(\d+)/);
            return new OnchainError(
                "INSUFFICIENT_FUNDS",
                ctx({
                    balance: balanceMatch?.[1],
                    required: costMatch?.[1],
                }),
                error,
            );
        }

        if (msg.includes("wrong chain") || msg.includes("incorrect chain") || msg.includes("network mismatch")) {
            return new OnchainError("WRONG_CHAIN", ctx(), error);
        }

        if (msg.includes("rpc") || msg.includes("connection") || msg.includes("timeout") || msg.includes("econnreset")) {
            return new OnchainError("RPC_ERROR", ctx(), error);
        }

        return new OnchainError("TRANSACTION_FAILED", ctx(), error);
    }

    toJSON() {
        return {
            name: this.name,
            code: this.code,
            message: this.message,
            developerMessage: this.developerMessage,
            hint: this.hint,
            context: this.context,
        };
    }
}
