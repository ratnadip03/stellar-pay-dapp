import { useState, useEffect, useCallback, useRef } from "react";
import { Header } from "./components/Header";
import { NetworkNotice } from "./components/NetworkNotice";
import { BalanceCard } from "./components/BalanceCard";
import { SendForm } from "./components/SendForm";
import { TxFeedback } from "./components/TxFeedback";
import { TxHistory } from "./components/TxHistory";
import {
  checkFreighterInstalled,
  connectWallet,
  getConnectedAddress,
  getFreighterNetwork,
  createWalletWatcher,
} from "./lib/freighter";
import { fetchAccountBalance, fundWithFriendbot } from "./lib/horizon";
import { executePaymentTransaction } from "./lib/payment";
import type { WalletState, TxProgress, TxHistoryRecord } from "./types";
import { NETWORK_PASSPHRASE } from "./constants";
import { Wallet, Shield, AlertTriangle } from "lucide-react";

const STORAGE_CONNECTED = "stellar_pay_connected";
const STORAGE_ADDRESS = "stellar_pay_address";

export function App() {
  const [wallet, setWallet] = useState<WalletState>({
    isInstalled: false,
    isConnected: false,
    address: null,
    network: null,
    networkPassphrase: null,
    balance: null,
    rawAccount: null,
    isLoadingBalance: false,
    error: null,
  });

  const [txProgress, setTxProgress] = useState<TxProgress | null>(null);
  const [txHistory, setTxHistory] = useState<TxHistoryRecord[]>([]);

  // Ref to prevent StrictMode double execution of initial effects
  const isInitialized = useRef(false);

  // Refresh balance helper
  const loadBalance = useCallback(async (targetAddress: string) => {
    setWallet((prev) => ({ ...prev, isLoadingBalance: true }));
    const res = await fetchAccountBalance(targetAddress);
    setWallet((prev) => ({
      ...prev,
      balance: res.balance,
      rawAccount: res.rawAccount,
      isLoadingBalance: false,
      error: res.error || null,
    }));
  }, []);

  // Check network helper
  const updateNetwork = useCallback(async () => {
    const netInfo = await getFreighterNetwork();
    if (netInfo) {
      setWallet((prev) => ({
        ...prev,
        network: netInfo.network,
        networkPassphrase: netInfo.networkPassphrase,
      }));
    }
  }, []);

  // Initial wallet detection & session restoration
  useEffect(() => {
    if (isInitialized.current) return;
    isInitialized.current = true;

    async function initWallet() {
      const installed = await checkFreighterInstalled();
      setWallet((prev) => ({ ...prev, isInstalled: installed }));

      if (!installed) return;

      const wasConnected = localStorage.getItem(STORAGE_CONNECTED) === "true";
      const savedAddress = localStorage.getItem(STORAGE_ADDRESS);

      if (wasConnected && savedAddress) {
        const liveAddress = await getConnectedAddress();
        if (liveAddress && liveAddress === savedAddress) {
          const netInfo = await getFreighterNetwork();
          setWallet((prev) => ({
            ...prev,
            isConnected: true,
            address: liveAddress,
            network: netInfo?.network || null,
            networkPassphrase: netInfo?.networkPassphrase || null,
          }));
          loadBalance(liveAddress);
        } else {
          // Session mismatch or revoked
          localStorage.removeItem(STORAGE_CONNECTED);
          localStorage.removeItem(STORAGE_ADDRESS);
        }
      }
    }

    initWallet();
  }, [loadBalance]);

  // Wallet event listener watcher for live account or network changes
  useEffect(() => {
    if (!wallet.isConnected) return;

    const cleanupWatcher = createWalletWatcher(async (data) => {
      if (data.network) {
        updateNetwork();
      }
      if (data.address && data.address !== wallet.address) {
        setWallet((prev) => ({ ...prev, address: data.address || null }));
        localStorage.setItem(STORAGE_ADDRESS, data.address);
        loadBalance(data.address);
      }
    });

    return () => cleanupWatcher();
  }, [wallet.isConnected, wallet.address, updateNetwork, loadBalance]);

  // Connect Handler
  const handleConnect = async () => {
    try {
      setWallet((prev) => ({ ...prev, error: null }));
      const address = await connectWallet();
      const netInfo = await getFreighterNetwork();

      localStorage.setItem(STORAGE_CONNECTED, "true");
      localStorage.setItem(STORAGE_ADDRESS, address);

      setWallet((prev) => ({
        ...prev,
        isConnected: true,
        address,
        network: netInfo?.network || null,
        networkPassphrase: netInfo?.networkPassphrase || null,
      }));

      await loadBalance(address);
    } catch (err: any) {
      setWallet((prev) => ({
        ...prev,
        error: err?.message || "Failed to connect Freighter wallet.",
      }));
    }
  };

  // Disconnect Handler (App level reset)
  const handleDisconnect = () => {
    localStorage.removeItem(STORAGE_CONNECTED);
    localStorage.removeItem(STORAGE_ADDRESS);

    setWallet({
      isInstalled: wallet.isInstalled,
      isConnected: false,
      address: null,
      network: null,
      networkPassphrase: null,
      balance: null,
      rawAccount: null,
      isLoadingBalance: false,
      error: null,
    });
    setTxProgress(null);
  };

  // Friendbot Funding Handler
  const handleFundFriendbot = async () => {
    if (!wallet.address) return;
    const res = await fundWithFriendbot(wallet.address);
    if (res.success) {
      await loadBalance(wallet.address);
    } else {
      throw new Error(res.message);
    }
  };

  // Payment Execution Handler
  const handleSendPayment = async (destination: string, amount: string, memo?: string) => {
    if (!wallet.address) return;

    // Verify network passphrase again right before transaction build
    const netInfo = await getFreighterNetwork();
    const currentPassphrase = netInfo?.networkPassphrase || wallet.networkPassphrase;

    if (currentPassphrase !== NETWORK_PASSPHRASE) {
      setTxProgress({
        status: "error",
        error: "Network mismatch! Please switch your Freighter wallet to Stellar Testnet before sending payments.",
      });
      return;
    }

    const result = await executePaymentTransaction(
      wallet.address,
      destination,
      amount,
      memo,
      (progress) => setTxProgress(progress)
    );

    if (result.status === "success" && result.hash) {
      // Add to session ledger
      const record: TxHistoryRecord = {
        id: result.hash,
        hash: result.hash,
        destination,
        amount,
        memo,
        timestamp: Date.now(),
        isCreateAccount: result.message?.includes("account creation") || false,
      };
      setTxHistory((prev) => [record, ...prev]);

      // Auto-refetch balance after successful payment
      await loadBalance(wallet.address);
    }
  };

  const isTestnet = wallet.networkPassphrase === NETWORK_PASSPHRASE;

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 font-sans selection:bg-purple-500 selection:text-white">
      {/* Header Bar */}
      <Header
        isInstalled={wallet.isInstalled}
        isConnected={wallet.isConnected}
        address={wallet.address}
        network={wallet.network}
        networkPassphrase={wallet.networkPassphrase}
        onConnect={handleConnect}
        onDisconnect={handleDisconnect}
      />

      {/* Main Container */}
      <main className="flex-1 w-full max-w-xl mx-auto px-4 py-8 flex flex-col items-center">
        {/* Welcome Hero Card for Unconnected State */}
        {!wallet.isConnected && (
          <div className="w-full text-center py-10 px-6 glass-panel rounded-3xl my-6 relative overflow-hidden shadow-2xl">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-tr from-purple-600 to-cyan-400 p-0.5 shadow-xl shadow-purple-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
                <Wallet className="w-8 h-8 text-purple-400" />
              </div>
            </div>

            <h2 className="text-2xl font-extrabold text-white tracking-tight mb-2">
              Stellar Testnet Payment dApp
            </h2>
            <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed mb-6">
              Connect your Freighter wallet to view your testnet XLM balance, send payments to any Stellar address, and track transactions with instant Explorer feedback.
            </p>

            {!wallet.isInstalled ? (
              <div className="p-4 rounded-2xl bg-slate-900/90 border border-purple-500/30 text-xs text-slate-300 max-w-sm mx-auto">
                <div className="flex items-center justify-center gap-2 text-purple-300 font-bold mb-1">
                  <AlertTriangle className="w-4 h-4 text-purple-400" />
                  <span>Freighter Required</span>
                </div>
                <p className="text-slate-400 mb-3">
                  The Freighter browser extension is required to sign transactions securely without sharing secret keys.
                </p>
                <a
                  href="https://www.freighter.app/"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold transition-all shadow-md"
                >
                  Install Freighter Extension
                </a>
              </div>
            ) : (
              <button
                onClick={handleConnect}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-sm shadow-xl shadow-purple-600/30 transition-all active:scale-95"
              >
                Connect Freighter Wallet
              </button>
            )}

            {wallet.error && (
              <p className="mt-4 text-xs font-semibold text-rose-400 bg-rose-500/10 p-2.5 rounded-xl border border-rose-500/20 max-w-sm mx-auto">
                {wallet.error}
              </p>
            )}
          </div>
        )}

        {/* Connected Wallet App Dashboard */}
        {wallet.isConnected && wallet.address && (
          <div className="w-full space-y-2">
            {/* Network Guard Notice (shown if Freighter is on Mainnet/wrong network) */}
            {!isTestnet && (
              <NetworkNotice
                currentNetwork={wallet.network}
                onRecheck={updateNetwork}
              />
            )}

            {/* Balance Card */}
            <BalanceCard
              address={wallet.address}
              balance={wallet.balance}
              isLoading={wallet.isLoadingBalance}
              rawAccount={wallet.rawAccount}
              onRefresh={() => loadBalance(wallet.address!)}
              onFundFriendbot={handleFundFriendbot}
            />

            {/* Send Payment Form (Blocked if wrong network) */}
            {isTestnet ? (
              <SendForm
                sourceAddress={wallet.address}
                sourceAccount={wallet.rawAccount}
                disabled={Boolean(txProgress && ["building", "awaiting-signature", "submitting"].includes(txProgress.status))}
                onSendPayment={handleSendPayment}
              />
            ) : (
              <div className="w-full max-w-xl mx-auto p-6 glass-panel rounded-2xl text-center text-xs text-slate-400 my-6">
                Payment form disabled while connected to non-testnet network. Switch Freighter to Testnet to enable.
              </div>
            )}

            {/* Session Transaction History */}
            <TxHistory
              records={txHistory}
              onClear={() => setTxHistory([])}
            />
          </div>
        )}
      </main>

      {/* Transaction Progress / Result Feedback Modal */}
      <TxFeedback
        progress={txProgress}
        onClose={() => setTxProgress(null)}
      />

      {/* Footer */}
      <footer className="w-full border-t border-slate-900 py-6 text-center text-xs text-slate-400 mt-auto">
        <div className="max-w-xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-purple-400" />
            <span>Non-custodial dApp • Keys remain in Freighter</span>
          </p>
          <p>Rise In Stellar Challenge — White Belt</p>
        </div>
      </footer>
    </div>
  );
}
