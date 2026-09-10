import React, { useState } from "react";
import { Wallet, LogOut, Copy, Check, ExternalLink, ShieldCheck, AlertTriangle } from "lucide-react";
import { NETWORK_PASSPHRASE } from "../constants";

interface HeaderProps {
  isInstalled: boolean;
  isConnected: boolean;
  address: string | null;
  network: string | null;
  networkPassphrase: string | null;
  onConnect: () => void;
  onDisconnect: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  isInstalled,
  isConnected,
  address,
  network,
  networkPassphrase,
  onConnect,
  onDisconnect,
}) => {
  const [copied, setCopied] = useState(false);
  const [showDisconnectHelp, setShowDisconnectHelp] = useState(false);

  const isTestnet = networkPassphrase === NETWORK_PASSPHRASE;

  const handleCopy = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const truncatedAddress = address
    ? `${address.slice(0, 4)}...${address.slice(-4)}`
    : "";

  return (
    <header className="w-full border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        {/* Branding Logo */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 via-indigo-500 to-cyan-400 p-0.5 shadow-lg shadow-purple-500/20">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <span className="text-xl font-bold bg-gradient-to-r from-purple-400 to-cyan-300 bg-clip-text text-transparent">
                ★
              </span>
            </div>
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
              Stellar Pay
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
                Testnet
              </span>
            </h1>
            <p className="text-xs text-slate-400 hidden sm:block">Simple XLM Payment dApp</p>
          </div>
        </div>

        {/* Network & Wallet Controls */}
        <div className="flex items-center gap-3">
          {/* Network Badge */}
          {isConnected && (
            <div
              className={`hidden md:flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${
                isTestnet
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                  : "bg-amber-500/10 text-amber-400 border-amber-500/30"
              }`}
            >
              {isTestnet ? (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Stellar Testnet</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  <span>{network || "Wrong Network"}</span>
                </>
              )}
            </div>
          )}

          {/* Connection Controls */}
          {!isInstalled ? (
            <a
              href="https://www.freighter.app/"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 text-purple-300 border border-purple-500/30 hover:bg-slate-700 transition-all shadow-sm"
            >
              <span>Install Freighter</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          ) : !isConnected ? (
            <button
              onClick={onConnect}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-md shadow-purple-600/20 transition-all active:scale-95"
            >
              <Wallet className="w-4 h-4" />
              <span>Connect Wallet</span>
            </button>
          ) : (
            <div className="relative flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono text-slate-200">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>{truncatedAddress}</span>
                <button
                  onClick={handleCopy}
                  title="Copy address"
                  className="p-1 text-slate-400 hover:text-white transition-colors"
                  aria-label="Copy public key"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>

              <div className="relative">
                <button
                  onClick={() => setShowDisconnectHelp(!showDisconnectHelp)}
                  onBlur={() => setTimeout(() => setShowDisconnectHelp(false), 200)}
                  title="Disconnect app session"
                  className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-rose-400 border border-slate-800 transition-all"
                  aria-label="Disconnect wallet"
                >
                  <LogOut className="w-4 h-4" />
                </button>

                {showDisconnectHelp && (
                  <div className="absolute right-0 top-12 w-64 p-3 rounded-xl bg-slate-900 border border-slate-800 shadow-xl text-xs text-slate-300 z-50">
                    <p className="font-semibold text-white mb-1">App Session Disconnected</p>
                    <p className="text-slate-400 leading-relaxed mb-2">
                      App session state cleared. To revoke origin permission completely, open Freighter Settings → Connected Apps.
                    </p>
                    <button
                      onClick={onDisconnect}
                      className="w-full py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 font-medium transition-colors"
                    >
                      Confirm Disconnect
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
