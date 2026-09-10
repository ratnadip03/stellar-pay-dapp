import React from "react";
import { AlertOctagon, RefreshCw } from "lucide-react";

interface NetworkNoticeProps {
  currentNetwork: string | null;
  onRecheck: () => void;
}

export const NetworkNotice: React.FC<NetworkNoticeProps> = ({ currentNetwork, onRecheck }) => {
  return (
    <div className="w-full max-w-xl mx-auto my-6 p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 backdrop-blur-md shadow-lg shadow-amber-500/5">
      <div className="flex items-start gap-4">
        <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 shrink-0">
          <AlertOctagon className="w-6 h-6" />
        </div>
        <div className="flex-1">
          <h3 className="text-base font-bold text-amber-300 mb-1 flex items-center gap-2">
            Stellar Testnet Required
          </h3>
          <p className="text-xs text-amber-200/80 leading-relaxed mb-3">
            Your Freighter wallet is currently set to{" "}
            <strong className="text-amber-100 uppercase">{currentNetwork || "a non-testnet network"}</strong>.
            This dApp operates exclusively on <strong>Stellar Testnet</strong> to keep real assets safe.
          </p>
          <div className="p-3 rounded-xl bg-slate-950/60 border border-amber-500/20 mb-4 text-xs text-slate-300 space-y-1 font-mono">
            <p className="text-amber-400 font-semibold mb-1 font-sans">How to switch to Testnet:</p>
            <p>1. Open your Freighter browser extension</p>
            <p>2. Click the network selector in the top menu</p>
            <p>3. Select <strong className="text-emerald-400">TESTNET</strong></p>
          </div>
          <button
            onClick={onRecheck}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs hover:bg-amber-400 transition-all shadow-md shadow-amber-500/20"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Re-check Network Connection</span>
          </button>
        </div>
      </div>
    </div>
  );
};
