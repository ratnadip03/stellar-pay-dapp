import React, { useState } from "react";
import { RefreshCw, Coins, ExternalLink, Sparkles, AlertCircle, Copy, Check } from "lucide-react";
import { Horizon } from "@stellar/stellar-sdk";

interface BalanceCardProps {
  address: string;
  balance: string | null;
  isLoading: boolean;
  rawAccount: Horizon.AccountResponse | null;
  onRefresh: () => void;
  onFundFriendbot: () => Promise<void>;
}

export const BalanceCard: React.FC<BalanceCardProps> = ({
  address,
  balance,
  isLoading,
  rawAccount,
  onRefresh,
  onFundFriendbot,
}) => {
  const [isFunding, setIsFunding] = useState(false);
  const [fundingMessage, setFundingMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const isUnfunded = !rawAccount && balance === "0";

  const handleFund = async () => {
    setIsFunding(true);
    setFundingMessage(null);
    try {
      await onFundFriendbot();
      setFundingMessage("Account funded! Balance refreshed.");
    } catch (err: any) {
      setFundingMessage(err?.message || "Friendbot funding failed.");
    } finally {
      setIsFunding(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full max-w-xl mx-auto glass-panel glass-panel-hover rounded-2xl p-6 shadow-xl relative overflow-hidden my-6">
      {/* Background ambient glow */}
      <div className="absolute -right-10 -top-10 w-40 h-40 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -left-10 -bottom-10 w-40 h-40 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Card Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-slate-400 text-xs font-semibold uppercase tracking-wider">
          <Coins className="w-4 h-4 text-purple-400" />
          <span>Connected Wallet Balance</span>
        </div>
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-xs font-medium text-slate-300 hover:text-white border border-slate-800 transition-all disabled:opacity-50"
          title="Refresh account balance"
          aria-label="Refresh XLM balance"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin text-purple-400" : ""}`} />
          <span>{isLoading ? "Refreshing..." : "Refresh"}</span>
        </button>
      </div>

      {/* Main Balance Display */}
      <div className="my-3">
        {isLoading && !balance ? (
          <div className="h-14 w-48 bg-slate-800/50 rounded-xl animate-pulse my-2" />
        ) : isUnfunded ? (
          <div className="py-2">
            <span className="text-3xl font-extrabold text-slate-400">0.00</span>
            <span className="ml-2 text-lg font-bold text-slate-500">XLM</span>
          </div>
        ) : (
          <div className="flex items-baseline gap-2">
            <span className="text-4xl sm:text-5xl font-black bg-gradient-to-r from-white via-slate-100 to-purple-200 bg-clip-text text-transparent tracking-tight">
              {balance || "0"}
            </span>
            <span className="text-xl font-extrabold text-purple-400">XLM</span>
          </div>
        )}
      </div>

      {/* Address & Explorer Link */}
      <div className="mt-4 pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 font-mono text-slate-400 bg-slate-950/50 px-3 py-1.5 rounded-xl border border-slate-900">
          <span>{address.slice(0, 8)}...{address.slice(-8)}</span>
          <button
            onClick={handleCopy}
            className="p-1 hover:text-white transition-colors"
            title="Copy address"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>

        <a
          href={`https://stellar.expert/explorer/testnet/account/${address}`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1 text-slate-400 hover:text-purple-300 transition-colors font-medium"
        >
          <span>View on StellarExpert</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      {/* Unfunded Account Banner / Friendbot Call to Action */}
      {isUnfunded && (
        <div className="mt-5 p-4 rounded-xl bg-purple-950/40 border border-purple-500/30 text-xs">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-bold text-purple-200 mb-1">Account Unfunded on Testnet</h4>
              <p className="text-slate-300 leading-relaxed mb-3">
                This address does not exist on Stellar Testnet yet. Use Stellar Friendbot to receive 10,000 free Testnet XLM instantly!
              </p>
              <button
                onClick={handleFund}
                disabled={isFunding}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold transition-all shadow-lg shadow-purple-600/30 disabled:opacity-50"
              >
                <Sparkles className={`w-4 h-4 ${isFunding ? "animate-spin text-amber-300" : ""}`} />
                <span>{isFunding ? "Funding via Friendbot..." : "Fund with Friendbot (10,000 XLM)"}</span>
              </button>
              {fundingMessage && (
                <p className="mt-2 text-xs font-semibold text-emerald-400">{fundingMessage}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
