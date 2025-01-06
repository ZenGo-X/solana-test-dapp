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
}

interface SolanaProvider {
  publicKey: PublicKey;
  signMessage: (message: Uint8Array) => Promise<Uint8Array>;
  signTransaction: (transaction: Transaction) => Promise<Transaction>;
  signAllTransactions: (transactions: Transaction[]) => Promise<Transaction[]>;
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
  // 1. First, declare all hooks
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
  });

  // Add debug logging
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

  // if (!connection) {
  //   return (
  //     <div className="min-h-screen bg-gray-50 text-gray-900 p-6">
  //       <h1 className="text-3xl font-bold mb-6">Initializing connection...</h1>
  //       <appkit-button />
  //     </div>
  //   );
  // }

  // Helper functions
  const setLoadingState = (key: keyof LoadingState, value: boolean) => {
    setLoading((prev) => ({ ...prev, [key]: value }));
  };

  const waitForConfirmation = async (
    connection: Connection,
    signature: string,
    commitment: SendOptions["preflightCommitment"] = "confirmed"
  ): Promise<string> => {
    const strategy = {
      signature: signature,
      blockhash: (await connection.getLatestBlockhash(commitment)).blockhash,
      lastValidBlockHeight: (await connection.getLatestBlockhash(commitment))
        .lastValidBlockHeight,
    };

    const result = await connection.confirmTransaction(strategy);
    if (result.value.err) {
      throw new Error("Transaction failed");
    }
    return commitment;
  };

  // Wait for multiple confirmations
  const waitForAllConfirmations = async (
    connection: Connection,
    signatures: string[],
    commitment: SendOptions["preflightCommitment"] = "confirmed"
  ): Promise<string[]> => {
    const confirmations = await Promise.all(
      signatures.map((sig) => waitForConfirmation(connection, sig, commitment))
    );
    return confirmations;
  };

  // solana_getAccounts
  const getAccounts = async () => {
    if (!walletProvider?.publicKey) return;
    setLoadingState("getAccounts", true);
    try {
      const accounts = [walletProvider.publicKey.toString()];
      setMessage(`Available accounts: ${JSON.stringify(accounts)}`);
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
        "Hello from Solana AppKit! " + new Date().toISOString();
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
      const serialized = signed.serialize();

      setMessage(
        `Transaction signed! Serialized: ${serialized.toString("base64")}`
      );
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
      !walletProvider?.signTransaction ||
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

      const signed = await walletProvider.signTransaction(transaction);
      const signature = await connection.sendRawTransaction(
        signed.serialize(),
        params?.options
      );

      setLastSignature(signature);
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

  // solana_signAndSendAllTransactions (extension of RPC methods)
  const signAndSendAllTransactions = async () => {
    if (
      !walletProvider?.signAllTransactions ||
      !isConnected ||
      !address ||
      !connection
    )
      return;
    setLoadingState("signAndSendAllTransactions", true);
    try {
      // Create three example transactions
      const transactions = await Promise.all(
        [100, 200, 300].map(async (amount) => {
          const tx = new Transaction().add(
            SystemProgram.transfer({
              fromPubkey: new PublicKey(address),
              toPubkey: new PublicKey(address),
              lamports: amount,
            })
          );

          const latestBlockhash = await connection.getLatestBlockhash();
          tx.recentBlockhash = latestBlockhash.blockhash;
          tx.feePayer = new PublicKey(address);
          return tx;
        })
      );

      // Sign all transactions
      const signedTransactions = await walletProvider.signAllTransactions(
        transactions
      );

      // Send all transactions
      const signatures = await Promise.all(
        signedTransactions.map((tx) =>
          connection.sendRawTransaction(tx.serialize())
        )
      );

      setLastSignatures(signatures);

      // Wait for all confirmations
      const confirmations = await waitForAllConfirmations(
        connection,
        signatures
      );

      setMessage(
        `All transactions sent and confirmed!\n${signatures
          .map(
            (sig, i) => `Transaction ${i + 1} ID: ${sig} (${confirmations[i]})`
          )
          .join("\n")}`
      );

      await fetchBalance();
      return { signatures };
    } catch (error) {
      console.error("Error in sign and send all transactions:", error);
      setMessage(
        `Error in sign and send all transactions: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      throw error;
    } finally {
      setLoadingState("signAndSendAllTransactions", false);
    }
  };

  // Fetch balance
  const fetchBalance = async () => {
    if (!address || !connection) return;
    setLoadingState("fetchBalance", true);
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
      setLoadingState("fetchBalance", false);
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

      setLastSignature(signature);
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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-6 max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Solana RPC Methods Demo</h1>

        <div className="mb-4">
          <div className="flex items-center gap-2">
            <span className="font-medium">Network:</span>
            <span className={`px-4 py-2 rounded bg-yellow-500 text-white`}>
              {isDevnet ? "Devnet" : "Mainnet"}
            </span>
          </div>
        </div>

        {!isConnected && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="col-span-full">
              <appkit-button />
            </div>
          </div>
        )}

        {isConnected && (
          <div className="space-y-6">
            <div className="bg-white shadow rounded-lg p-6">
              <h2 className="font-bold mb-2">Connected Account</h2>
              <p className="break-all font-mono text-sm">{address}</p>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={fetchBalance}
                  disabled={loading.fetchBalance}
                  className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading.fetchBalance ? "Fetching..." : "Fetch Balance"}
                </button>
                <button
                  onClick={disconnect}
                  className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
                >
                  Disconnect
                </button>
              </div>
              {balance !== null && (
                <p className="mt-2 font-bold">Balance: {balance} SOL</p>
              )}
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={getAccounts}
                  disabled={loading.getAccounts}
                  className="w-full bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading.getAccounts ? "Getting Accounts..." : "Get Accounts"}
                </button>

                <button
                  onClick={requestAccounts}
                  disabled={loading.requestAccounts}
                  className="w-full bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading.requestAccounts
                    ? "Requesting..."
                    : "Request Accounts"}
                </button>

                <button
                  onClick={() => signMessage()}
                  disabled={loading.signMessage}
                  className="w-full bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading.signMessage ? "Signing..." : "Sign Message"}
                </button>

                <button
                  onClick={() => signTransaction()}
                  disabled={loading.signTransaction}
                  className="w-full bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading.signTransaction ? "Signing..." : "Sign Transaction"}
                </button>

                <button
                  onClick={() => signAndSendTransaction()}
                  disabled={loading.signAndSendTransaction}
                  className="w-full bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading.signAndSendTransaction
                    ? "Processing..."
                    : "Sign & Send Transaction"}
                </button>

                <button
                  onClick={signAllTransactions}
                  disabled={loading.signAllTransactions}
                  className="w-full bg-orange-500 text-white px-4 py-2 rounded hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading.signAllTransactions
                    ? "Signing..."
                    : "Sign Multiple Transactions"}
                </button>

                <button
                  onClick={signAndSendAllTransactions}
                  disabled={loading.signAndSendAllTransactions}
                  className="w-full bg-orange-500 text-white px-4 py-2 rounded hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed col-span-2"
                >
                  {loading.signAndSendAllTransactions
                    ? "Processing..."
                    : "Sign & Send Multiple Transactions"}
                </button>
              </div>

              {/* SPL Token Transfer Form */}
              <div className="bg-white shadow rounded-lg p-6">
                <h3 className="font-bold mb-4">Send SPL Token</h3>
                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Token Mint Address"
                    value={tokenAddress}
                    onChange={(e) => setTokenAddress(e.target.value)}
                    className="w-full p-2 border rounded"
                    disabled={loading.sendToken}
                  />
                  <input
                    type="text"
                    placeholder="Recipient Address"
                    value={recipientAddress}
                    onChange={(e) => setRecipientAddress(e.target.value)}
                    className="w-full p-2 border rounded"
                    disabled={loading.sendToken}
                  />
                  <input
                    type="number"
                    placeholder="Amount"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full p-2 border rounded"
                    disabled={loading.sendToken}
                  />
                  <button
                    onClick={sendSPLToken}
                    disabled={loading.sendToken}
                    className="w-full bg-indigo-500 text-white px-4 py-2 rounded hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading.sendToken ? "Sending Token..." : "Send SPL Token"}
                  </button>
                </div>
              </div>

              {message && (
                <div className="bg-white shadow rounded-lg p-6">
                  <h3 className="font-bold mb-2">Latest Action</h3>
                  <div className="space-y-2">
                    <p className="break-all font-mono text-sm whitespace-pre-wrap">
                      {message}
                    </p>

                    {lastSignatures.length > 0 ? (
                      <div className="mt-2">
                        <p className="font-medium">Transaction Explorers:</p>
                        {lastSignatures.map((sig, index) => (
                          <a
                            key={sig}
                            href={`https://${
                              isDevnet
                                ? "explorer.solana.com/?cluster=devnet"
                                : "explorer.solana.com"
                            }/tx/${sig}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block text-blue-500 hover:underline break-all mb-1"
                          >
                            View Transaction {index + 1} on Solana Explorer
                          </a>
                        ))}
                      </div>
                    ) : (
                      lastSignature && (
                        <div className="mt-2">
                          <p className="font-medium">Transaction Explorer:</p>
                          <a
                            href={`https://${
                              isDevnet
                                ? "explorer.solana.com/?cluster=devnet"
                                : "explorer.solana.com"
                            }/tx/${lastSignature}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-500 hover:underline break-all"
                          >
                            View on Solana Explorer
                          </a>
                        </div>
                      )
                    )}

                    {isSignatureValid !== null && (
                      <div
                        className={`mt-2 p-2 rounded ${
                          isSignatureValid
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        Signature is {isSignatureValid ? "valid" : "invalid"}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
