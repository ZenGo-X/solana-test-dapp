import { useState, useEffect } from "react";
import { createAppKit } from "@reown/appkit/react";
import { SolanaAdapter } from "@reown/appkit-adapter-solana/react";
import { solana, solanaDevnet } from "@reown/appkit/networks";
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import {
  useAppKitAccount,
  useAppKitProvider,
  useDisconnect,
} from "@reown/appkit/react";
import { useAppKitConnection } from "@reown/appkit-adapter-solana/react";
import {
  SystemProgram,
  PublicKey,
  LAMPORTS_PER_SOL,
  Transaction,
  Connection,
  TransactionSignature,
  SendOptions,
  VersionedTransaction,
  TransactionMessage,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createTransferInstruction,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";
import { verify, etc } from "@noble/ed25519";
import { sha512 } from "@noble/hashes/sha512";
import logoPath from "./assets/zengo-logo.svg";
import customLogoPath from "./assets/logo.svg";

// Set up SHA-512 for ed25519
etc.sha512Sync = (...m) => sha512(etc.concatBytes(...m));

// Constants
const DEVNET_USDT = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";
const DEFAULT_NETWORK = import.meta.env.VITE_DEFAULT_NETWORK || "devnet";
const projectId = import.meta.env.VITE_PROJECT_ID;
const DEVNET_RPC_URL = import.meta.env.VITE_RPC_URL_DEVNET;

if (!projectId) {
  throw new Error("Missing VITE_PROJECT_ID in .env file");
}

if (!DEVNET_RPC_URL) {
  throw new Error("Missing VITE_RPC_URL_DEVNET in .env file");
}

// Initialize Solana adapter with wallets
const solanaAdapter = new SolanaAdapter({
  wallets: [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
  connectionSettings: {
    commitment: "confirmed",
    wsEndpoint: DEVNET_RPC_URL,
  },
});

const metadata = {
  name: "Solana Zengo Test",
  description: "AppKit Example",
  url: import.meta.env.VITE_APP_URL || "http://localhost:5173",
  icons: ["https://assets.reown.com/reown-profile-pic.png"],
};

// Create AppKit instance
createAppKit({
  adapters: [solanaAdapter],
  networks: [solanaDevnet, solana],
  defaultNetwork: DEFAULT_NETWORK === "devnet" ? solanaDevnet : solana,
  metadata,
  projectId,
  features: {
    analytics: true,
  },
});

interface LoadingState {
  getAccounts: boolean;
  requestAccounts: boolean;
  signMessage: boolean;
  signTransaction: boolean;
  sendTransaction: boolean;
  signAllTransactions: boolean;
  signAndSendTransaction: boolean;
  signAndSendAllTransactions: boolean;
  sendToken: boolean;
  fetchBalance: boolean;
  signAndSendV0Transaction: boolean;
}

interface SolanaProvider {
  publicKey: PublicKey;
  signMessage: (message: Uint8Array) => Promise<Uint8Array>;
  signTransaction: (transaction: Transaction) => Promise<Transaction>;
  signAllTransactions: (transactions: Transaction[]) => Promise<Transaction[]>;
  signAndSendTransaction: (
    transaction: Transaction | VersionedTransaction
  ) => Promise<string>;
}

// RPC Method Types
interface SignMessageParams {
  message: string;
  pubkey: string;
}

interface SignTransactionParams {
  transaction: string;
}

interface SignAndSendTransactionParams {
  transaction: string;
  options?: {
    skipPreflight?: boolean;
    preflightCommitment?: "processed" | "confirmed" | "finalized";
    maxRetries?: number;
    minContextSlot?: number;
  };
}

export default function App() {
  const { address, isConnected } = useAppKitAccount();
  const { disconnect } = useDisconnect();
  const { walletProvider } = useAppKitProvider<SolanaProvider>("solana");
  const { connection } = useAppKitConnection();
  const [isDevnet] = useState(DEFAULT_NETWORK === "devnet");
  const [balance, setBalance] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const [tokenAddress, setTokenAddress] = useState("");
  const [recipientAddress, setRecipientAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [lastSignature, setLastSignature] =
    useState<TransactionSignature | null>(null);
  const [lastSignatures, setLastSignatures] = useState<string[]>([]);
  const [isSignatureValid, setIsSignatureValid] = useState<boolean | null>(
    null
  );
  const [showTransactionExplorer, setShowTransactionExplorer] =
    useState<boolean>(false);

  const [loading, setLoading] = useState<LoadingState>({
    getAccounts: false,
    requestAccounts: false,
    signMessage: false,
    signTransaction: false,
    sendTransaction: false,
    signAllTransactions: false,
    signAndSendTransaction: false,
    signAndSendAllTransactions: false,
    sendToken: false,
    fetchBalance: false,
    signAndSendV0Transaction: false,
  });

  useEffect(() => {
    console.log("Connection status:", {
      hasConnection: !!connection,
      connectionDetails: connection,
    });
  }, [connection]);

  // Move this check after all hooks
  useEffect(() => {
    if (isDevnet && !tokenAddress) {
      setTokenAddress(DEVNET_USDT);
    }
  }, [isDevnet, tokenAddress]);

  // Helper functions
  const startNewAction = () => {
    // Only reset the signature validation status, not the transaction explorer
    setIsSignatureValid(null);
  };

  // Helper to hide Transaction Explorer for non-transaction methods
  const hideTransactionExplorer = () => {
    setShowTransactionExplorer(false);
  };

  const setLoadingState = (key: keyof LoadingState, value: boolean) => {
    if (value) {
      // If we're starting a new action, reset the relevant UI state
      startNewAction();
    }
    setLoading((prev) => ({ ...prev, [key]: value }));
  };

  const waitForConfirmation = async (
    connection: Connection,
    signature: string,
    commitment: SendOptions["preflightCommitment"] = "confirmed"
  ): Promise<string> => {
    console.log("waitForConfirmation", signature, commitment);
    const TIMEOUT = 30000; // 30 seconds
    const RETRY_INTERVAL = 1000; // 1 second
    const startTime = Date.now();

    while (Date.now() - startTime < TIMEOUT) {
      const response = await connection.getSignatureStatus(signature);
      const status = response.value;

      if (status) {
        if (status.err) {
          throw new Error(`Transaction failed: ${status.err.toString()}`);
        }

        if (
          status.confirmationStatus === commitment ||
          status.confirmationStatus === "finalized"
        ) {
          return status.confirmationStatus;
        }
      }

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, RETRY_INTERVAL));
    }

    throw new Error(
      `Transaction confirmation timeout after ${TIMEOUT / 1000} seconds`
    );
  };

  // solana_getAccounts
  const getAccounts = async () => {
    if (!walletProvider?.publicKey) return;
    setLoadingState("getAccounts", true);
    try {
      const accounts = [walletProvider.publicKey.toString()];
      setMessage(`Available accounts: ${JSON.stringify(accounts)}`);
      // Hide transaction explorer for this action
      hideTransactionExplorer();
      return accounts;
    } catch (error) {
      console.error("Error getting accounts:", error);
      setMessage(
        `Error getting accounts: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      throw error;
    } finally {
      setLoadingState("getAccounts", false);
    }
  };

  // solana_requestAccounts
  const requestAccounts = async () => {
    setLoadingState("requestAccounts", true);
    try {
      const accounts = await getAccounts();
      setMessage(`Requested accounts: ${JSON.stringify(accounts)}`);
      // Hide transaction explorer for this action
      hideTransactionExplorer();
      return accounts;
    } catch (error) {
      console.error("Error requesting accounts:", error);
      setMessage(
        `Error requesting accounts: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      throw error;
    } finally {
      setLoadingState("requestAccounts", false);
    }
  };

  // solana_signMessage
  const signMessage = async (params?: SignMessageParams) => {
    if (!walletProvider?.signMessage || !isConnected) return;
    setLoadingState("signMessage", true);
    try {
      // Use provided message or default
      const messageStr =
        params?.message ||
        "Hello from Solana Zengo Test! " + new Date().toISOString();
      const encodedMessage = new TextEncoder().encode(messageStr);
      const signature = await walletProvider.signMessage(encodedMessage);

      // Verify signature
      const isValid = await verify(
        signature,
        encodedMessage,
        walletProvider.publicKey.toBytes()
      );

      setIsSignatureValid(isValid);
      const signatureHex = Buffer.from(signature).toString("hex");
      setMessage(
        `Message signed and verified!\nSignature: ${signatureHex}\nValid: ${isValid}`
      );
      // Hide transaction explorer for this action
      hideTransactionExplorer();
      return { signature: signatureHex };
    } catch (error) {
      console.error("Error signing message:", error);
      setMessage(
        `Error signing message: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      setIsSignatureValid(null);
      throw error;
    } finally {
      setLoadingState("signMessage", false);
    }
  };

  // solana_signTransaction
  const signTransaction = async (params?: SignTransactionParams) => {
    if (!walletProvider?.signTransaction || !isConnected || !address) return;
    setLoadingState("signTransaction", true);
    try {
      let transaction: Transaction;

      if (params?.transaction) {
        // If transaction is provided, deserialize it
        transaction = Transaction.from(
          Buffer.from(params.transaction, "base64")
        );
      } else {
        // Create a default transaction if none provided
        transaction = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: new PublicKey(address),
            toPubkey: new PublicKey(address),
            lamports: 100,
          })
        );

        const latestBlockhash = await connection!.getLatestBlockhash();
        transaction.recentBlockhash = latestBlockhash.blockhash;
        transaction.feePayer = new PublicKey(address);
      }

      const signed = await walletProvider.signTransaction(transaction);
      console.log("signed transaction", signed);
      const serialized = signed.serialize();

      setMessage(
        `Transaction signed! Serialized: ${serialized.toString("base64")}`
      );
      // Hide transaction explorer for this action
      hideTransactionExplorer();
      return { signature: signed.signatures[0].signature?.toString("base64") };
    } catch (error) {
      console.error("Error signing transaction:", error);
      setMessage(
        `Error signing transaction: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      throw error;
    } finally {
      setLoadingState("signTransaction", false);
    }
  };

  // solana_signAndSendTransaction
  const signAndSendTransaction = async (
    params?: SignAndSendTransactionParams
  ) => {
    if (
      !walletProvider?.signAndSendTransaction ||
      !isConnected ||
      !address ||
      !connection
    )
      return;
    setLoadingState("signAndSendTransaction", true);
    try {
      let transaction: Transaction;

      if (params?.transaction) {
        // If transaction is provided, deserialize it
        transaction = Transaction.from(
          Buffer.from(params.transaction, "base64")
        );
      } else {
        // Create a default transaction if none provided
        transaction = new Transaction().add(
          SystemProgram.transfer({
            fromPubkey: new PublicKey(address),
            toPubkey: new PublicKey(address),
            lamports: 100,
          })
        );

        const latestBlockhash = await connection.getLatestBlockhash();
        transaction.recentBlockhash = latestBlockhash.blockhash;
        transaction.feePayer = new PublicKey(address);
      }

      // Use walletProvider.signAndSendTransaction directly
      const signature = await walletProvider.signAndSendTransaction(
        transaction
      );

      console.log("signature", signature);

      // Update the UI to show transaction info
      setLastSignature(signature);
      // Explicitly show transaction explorer for transaction operations
      setShowTransactionExplorer(true);

      const confirmationMessage = await waitForConfirmation(
        connection,
        signature,
        params?.options?.preflightCommitment
      );

      setMessage(
        `Transaction signed and sent!\nTransaction ID: ${signature}\nStatus: ${confirmationMessage}`
      );
      await fetchBalance();

      return { signature };
    } catch (error) {
      console.error("Error in sign and send transaction:", error);
      setMessage(
        `Error in sign and send transaction: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      throw error;
    } finally {
      setLoadingState("signAndSendTransaction", false);
    }
  };

  // solana_signAllTransactions
  const signAllTransactions = async () => {
    if (
      !walletProvider?.signAllTransactions ||
      !isConnected ||
      !address ||
      !connection
    )
      return;
    setLoadingState("signAllTransactions", true);
    try {
      const tx1 = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: new PublicKey(address),
          toPubkey: new PublicKey(address),
          lamports: 100,
        })
      );

      const tx2 = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: new PublicKey(address),
          toPubkey: new PublicKey(address),
          lamports: 200,
        })
      );

      const latestBlockhash = await connection.getLatestBlockhash();
      tx1.recentBlockhash = latestBlockhash.blockhash;
      tx1.feePayer = new PublicKey(address);
      tx2.recentBlockhash = latestBlockhash.blockhash;
      tx2.feePayer = new PublicKey(address);

      const signedTxs = await walletProvider.signAllTransactions([tx1, tx2]);
      console.log("signedTxs", signedTxs);
      const signatures = signedTxs.map((tx) =>
        tx.signatures[0].signature?.toString("base64")
      );

      setMessage(
        `Multiple transactions signed!\nSignatures: ${signatures.join("\n")}`
      );

      return { signatures };
    } catch (error) {
      console.error("Error signing all transactions:", error);
      setMessage(
        `Error signing all transactions: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      throw error;
    } finally {
      setLoadingState("signAllTransactions", false);
    }
  };

  // Fetch balance
  const fetchBalance = async () => {
    if (!address || !connection) return;
    // Use direct setting of loading state to avoid affecting transaction explorer
    setLoading((prev) => ({ ...prev, fetchBalance: true }));
    try {
      const balance = await connection.getBalance(new PublicKey(address));
      setBalance(balance / LAMPORTS_PER_SOL);
    } catch (error) {
      console.error("Error fetching balance:", error);
      setMessage(
        `Error fetching balance: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      // Restore the loading state without affecting the transaction explorer display
      setLoading((prev) => ({ ...prev, fetchBalance: false }));
    }
  };

  // Send SPL Token Transaction
  const sendSPLToken = async () => {
    if (
      !walletProvider?.signTransaction ||
      !isConnected ||
      !address ||
      !connection
    )
      return;
    setLoadingState("sendToken", true);
    try {
      const senderPubkey = new PublicKey(address);
      const mint = new PublicKey(tokenAddress);
      const recipient = new PublicKey(recipientAddress);

      // Get mint info to fetch decimals
      const mintInfo = await connection.getParsedAccountInfo(mint);
      if (
        !mintInfo.value ||
        !mintInfo.value.data ||
        typeof mintInfo.value.data !== "object"
      ) {
        throw new Error("Failed to fetch mint info");
      }
      const decimals = (mintInfo.value.data as any).parsed.info.decimals;

      const senderATA = await getAssociatedTokenAddress(mint, senderPubkey);
      const recipientATA = await getAssociatedTokenAddress(mint, recipient);

      const transaction = new Transaction();

      const recipientAccount = await connection.getAccountInfo(recipientATA);
      if (!recipientAccount) {
        transaction.add(
          createAssociatedTokenAccountInstruction(
            senderPubkey,
            recipientATA,
            recipient,
            mint,
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
          )
        );
      }

      transaction.add(
        createTransferInstruction(
          senderATA,
          recipientATA,
          senderPubkey,
          BigInt(parseFloat(amount) * 10 ** decimals)
        )
      );

      const latestBlockhash = await connection.getLatestBlockhash();
      transaction.recentBlockhash = latestBlockhash.blockhash;
      transaction.feePayer = senderPubkey;

      const signed = await walletProvider.signTransaction(transaction);
      const signature = await connection.sendRawTransaction(signed.serialize());

      // Update the UI to show transaction info
      setLastSignature(signature);
      // Explicitly show transaction explorer for transaction operations
      setShowTransactionExplorer(true);

      const confirmationMessage = await waitForConfirmation(
        connection,
        signature
      );
      setMessage(
        `SPL Token sent!\nTransaction ID: ${signature}\nStatus: ${confirmationMessage}`
      );
    } catch (error) {
      console.error("Error sending SPL token:", error);
      setMessage(
        `Error sending token: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setLoadingState("sendToken", false);
    }
  };

  // Add this new function for v0 transactions
  const signAndSendV0Transaction = async () => {
    console.log("signAndSendV0Transaction");
    if (
      !walletProvider?.signAndSendTransaction ||
      !isConnected ||
      !address ||
      !connection
    )
      return;
    setLoadingState("signAndSendV0Transaction", true);
    try {
      const payer = new PublicKey(address);

      // Create a simple transfer instruction
      const transferInstruction = SystemProgram.transfer({
        fromPubkey: payer,
        toPubkey: payer, // Sending to self as example
        lamports: 100,
      });

      // Get latest blockhash
      const { blockhash } = await connection.getLatestBlockhash();

      // Create a message
      const message = new TransactionMessage({
        payerKey: payer,
        recentBlockhash: blockhash,
        instructions: [transferInstruction],
      }).compileToV0Message();

      // Create a v0 transaction
      const transaction = new VersionedTransaction(message);

      // Use signAndSendTransaction directly
      const signature = await walletProvider.signAndSendTransaction(
        transaction
      );

      console.log("signature", signature);

      // Update the UI to show transaction info
      setLastSignature(signature);
      // Explicitly show transaction explorer for transaction operations
      setShowTransactionExplorer(true);

      const confirmationMessage = await waitForConfirmation(
        connection,
        signature,
        "confirmed"
      );

      setMessage(
        `V0 Transaction signed and sent!\nTransaction ID: ${signature}\nStatus: ${confirmationMessage}`
      );
      await fetchBalance();

      return { signature };
    } catch (error) {
      console.error("Error in sign and send v0 transaction:", error);
      setMessage(
        `Error in sign and send v0 transaction: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      throw error;
    } finally {
      setLoadingState("signAndSendV0Transaction", false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <header className="bg-white shadow-sm py-4 px-6 border-b border-slate-200">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <img
            src={logoPath}
            alt="ZenGo Solana Wallet Connect Demo"
            className="h-10"
          />
          <div className="flex items-center gap-4">
            {isConnected && (
              <>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-slate-600">
                    Network:
                  </span>
                  <span
                    className={`px-3 py-1 text-xs font-semibold rounded-full ${
                      isDevnet
                        ? "bg-amber-100 text-amber-800"
                        : "bg-emerald-100 text-emerald-800"
                    }`}
                  >
                    {isDevnet ? "Devnet" : "Mainnet"}
                  </span>
                </div>
                {balance !== null && (
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-slate-600">
                      Balance:
                    </span>
                    <span className="font-bold text-sm">{balance} SOL</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto py-8 px-6">
        {!isConnected ? (
          <div className="flex flex-col items-center justify-center min-h-[70vh]">
            <div className="max-w-md w-full bg-white shadow-xl rounded-2xl p-8 text-center bg-gradient-to-br from-white to-purple-50">
              <img
                src={customLogoPath}
                alt="ZenGo Solana Wallet Connect Demo"
                className="h-24 mx-auto mb-8 animate-fadeIn"
              />
              {/* <h1 className="text-2xl font-bold mb-4 text-slate-800">
                Solana Wallet Connect
              </h1> */}
              <p className="mb-8 text-slate-600">
                Connect your wallet to experience the power of Solana blockchain
              </p>
              <div className="inline-block">
                <appkit-button />
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            <div className="bg-white shadow-md rounded-xl p-6 border border-slate-100">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="font-semibold text-lg mb-1">
                    Connected Account
                  </h2>
                  <p className="break-all font-mono text-sm bg-slate-50 p-2 rounded border border-slate-200">
                    {address}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={fetchBalance}
                    disabled={loading.fetchBalance}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {loading.fetchBalance ? (
                      <>
                        <svg
                          className="animate-spin h-4 w-4 text-white"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                        <span>Fetching...</span>
                      </>
                    ) : (
                      "Refresh Balance"
                    )}
                  </button>
                  <button
                    onClick={disconnect}
                    className="bg-slate-200 text-slate-800 px-4 py-2 rounded-lg hover:bg-slate-300 transition-colors"
                  >
                    Disconnect
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white shadow-md rounded-xl p-6 border border-slate-100">
                <h3 className="font-semibold text-lg mb-4 text-slate-800">
                  Account Methods
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <button
                    onClick={getAccounts}
                    disabled={loading.getAccounts}
                    className="w-full bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading.getAccounts
                      ? "Getting Accounts..."
                      : "Get Accounts"}
                  </button>

                  <button
                    onClick={requestAccounts}
                    disabled={loading.requestAccounts}
                    className="w-full bg-blue-600 text-white px-4 py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading.requestAccounts
                      ? "Requesting..."
                      : "Request Accounts"}
                  </button>
                </div>
              </div>

              <div className="bg-white shadow-md rounded-xl p-6 border border-slate-100">
                <h3 className="font-semibold text-lg mb-4 text-slate-800">
                  Signing Methods
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <button
                    onClick={() => signMessage()}
                    disabled={loading.signMessage}
                    className="w-full bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading.signMessage ? "Signing..." : "Sign Message"}
                  </button>

                  <button
                    onClick={() => signTransaction()}
                    disabled={loading.signTransaction}
                    className="w-full bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading.signTransaction
                      ? "Signing..."
                      : "Sign Transaction"}
                  </button>

                  <button
                    onClick={signAllTransactions}
                    disabled={loading.signAllTransactions}
                    className="w-full bg-green-600 text-white px-4 py-3 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed col-span-2"
                  >
                    {loading.signAllTransactions
                      ? "Signing..."
                      : "Sign Multiple Transactions"}
                  </button>
                </div>
              </div>

              <div className="bg-white shadow-md rounded-xl p-6 border border-slate-100">
                <h3 className="font-semibold text-lg mb-4 text-slate-800">
                  Transaction Methods
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <button
                    onClick={() => signAndSendTransaction()}
                    disabled={loading.signAndSendTransaction}
                    className="w-full bg-purple-600 text-white px-4 py-3 rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading.signAndSendTransaction
                      ? "Processing..."
                      : "Sign & Send Transaction"}
                  </button>

                  <button
                    onClick={signAndSendV0Transaction}
                    disabled={loading.signAndSendV0Transaction}
                    className="w-full bg-purple-600 text-white px-4 py-3 rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading.signAndSendV0Transaction
                      ? "Processing..."
                      : "Sign & Send V0 Transaction"}
                  </button>
                </div>
              </div>

              <div className="bg-white shadow-md rounded-xl p-6 border border-slate-100">
                <h3 className="font-semibold text-lg mb-4 text-slate-800">
                  Send SPL Token
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Token Mint Address
                    </label>
                    <input
                      type="text"
                      placeholder="Token Mint Address"
                      value={tokenAddress}
                      onChange={(e) => setTokenAddress(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      disabled={loading.sendToken}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Recipient Address
                    </label>
                    <input
                      type="text"
                      placeholder="Recipient Address"
                      value={recipientAddress}
                      onChange={(e) => setRecipientAddress(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      disabled={loading.sendToken}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Amount
                    </label>
                    <input
                      type="number"
                      placeholder="Amount"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full p-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      disabled={loading.sendToken}
                    />
                  </div>
                  <button
                    onClick={sendSPLToken}
                    disabled={loading.sendToken}
                    className="w-full bg-indigo-600 text-white px-4 py-3 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                  >
                    {loading.sendToken ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg
                          className="animate-spin h-4 w-4 text-white"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                        Sending Token...
                      </span>
                    ) : (
                      "Send SPL Token"
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Last Action Result */}
            {message && (
              <div className="bg-white shadow-lg rounded-xl p-6 border border-slate-100 animate-fadeIn">
                <h3 className="font-semibold text-lg mb-4 flex items-center gap-2 text-slate-800">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 text-indigo-600"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Last Action Result
                </h3>
                <div className="rounded-lg bg-slate-50 p-4 border border-slate-200">
                  <pre className="break-all font-mono text-sm whitespace-pre-wrap text-slate-800">
                    {message}
                  </pre>
                </div>

                {isSignatureValid !== null && (
                  <div
                    className={`mt-4 p-3 rounded-lg flex items-center gap-2 ${
                      isSignatureValid
                        ? "bg-green-50 text-green-800 border border-green-200"
                        : "bg-red-50 text-red-800 border border-red-200"
                    }`}
                  >
                    {isSignatureValid ? (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>
                    ) : (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                          clipRule="evenodd"
                        />
                      </svg>
                    )}
                    <span className="font-medium">
                      Signature is {isSignatureValid ? "valid" : "invalid"}
                    </span>
                  </div>
                )}

                {showTransactionExplorer && (
                  <>
                    {lastSignatures.length > 0 ? (
                      <div className="mt-4">
                        <h4 className="font-medium mb-2 text-slate-700">
                          Transaction Explorers:
                        </h4>
                        <div className="space-y-2">
                          {lastSignatures.map((sig, index) => (
                            <a
                              key={sig}
                              href={`https://explorer.solana.com/tx/${sig}${
                                isDevnet ? "?cluster=devnet" : ""
                              }`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block text-indigo-600 hover:text-indigo-800 hover:underline break-all p-2 bg-indigo-50 rounded-lg border border-indigo-100"
                            >
                              <span className="font-medium">
                                Transaction {index + 1}:{" "}
                              </span>
                              <span className="font-mono text-xs">
                                {sig.slice(0, 20)}...{sig.slice(-20)}
                              </span>
                              <span className="ml-2 text-xs bg-indigo-100 px-2 py-1 rounded-full">
                                View on Explorer
                              </span>
                            </a>
                          ))}
                        </div>
                      </div>
                    ) : (
                      lastSignature && (
                        <div className="mt-4">
                          <h4 className="font-medium mb-2 text-slate-700">
                            Transaction Explorer:
                          </h4>
                          <a
                            href={`https://explorer.solana.com/tx/${lastSignature}${
                              isDevnet ? "?cluster=devnet" : ""
                            }`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-between text-indigo-600 hover:text-indigo-800 hover:bg-indigo-100 break-all p-3 bg-indigo-50 rounded-lg border border-indigo-100 transition-colors"
                          >
                            <span className="font-mono text-xs">
                              {lastSignature.slice(0, 20)}...
                              {lastSignature.slice(-20)}
                            </span>
                            <span className="ml-2 text-xs bg-indigo-100 px-2 py-1 rounded-full flex items-center gap-1">
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                className="h-4 w-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                                />
                              </svg>
                              View on Explorer
                            </span>
                          </a>
                        </div>
                      )
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="mt-12 py-6 border-t border-slate-200">
        <div className="max-w-6xl mx-auto px-6 text-center text-slate-500 text-sm">
          ZenGo Solana Wallet Connect Demo • All rights reserved
        </div>
      </footer>
    </div>
  );
}
