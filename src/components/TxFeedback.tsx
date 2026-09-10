import React, { useState } from "react";
import { CheckCircle2, XCircle, Clock, Loader2, ExternalLink, Copy, Check, ShieldAlert } from "lucide-react";
import type { TxProgress } from "../types";
import { EXPLORER_TX } from "../constants";

interface TxFeedbackProps {
  progress: TxProgress | null;
  onClose: () => void;
}

export const TxFeedback: React.FC<TxFeedbackProps> = ({ progress, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!progress || progress.status === "idle") return null;

  const handleCopyHash = () => {
    if (progress.hash) {
      navigator.clipboard.writeText(progress.hash);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const isPending = ["building", "awaiting-signature", "submitting"].includes(progress.status);

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="w-full max-w-md glass-panel rounded-2xl p-6 shadow-2xl border border-slate-700/80 relative overflow-hidden">
        {/* Ambient indicator top border */}
        <div
          className={`absolute top-0 left-0 right-0 h-1.5 ${
            isPending
              ? "bg-gradient-to-r from-purple-500 via-indigo-500 to-cyan-500 animate-pulse"
              : progress.status === "success"
              ? "bg-emerald-500"
              : "bg-rose-500"
          }`}
        />

        {/* Status Header */}
        <div className="flex items-center gap-3 mb-4">
          {isPending && (
            <div className="p-2.5 rounded-full bg-purple-500/20 text-purple-400">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          )}

          {progress.status === "success" && (
            <div className="p-2.5 rounded-full bg-emerald-500/20 text-emerald-400">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          )}

          {progress.status === "error" && (
            <div className="p-2.5 rounded-full bg-rose-500/20 text-rose-400">
              {progress.isTimeout ? <Clock className="w-6 h-6 text-amber-400" /> : <XCircle className="w-6 h-6" />}
            </div>
          )}

          <div>
            <h3 className="text-base font-bold text-white capitalize">
              {progress.status === "building" && "Building Transaction"}
              {progress.status === "awaiting-signature" && "Confirm in Freighter"}
              {progress.status === "submitting" && "Submitting to Horizon"}
              {progress.status === "success" && "Transaction Successful!"}
              {progress.status === "error" && (progress.isTimeout ? "Network Timeout" : "Transaction Failed")}
            </h3>
            <p className="text-xs text-slate-400">Stellar Testnet Horizon Network</p>
          </div>
        </div>

        {/* Status Messages */}
        <div className="my-4 text-xs text-slate-200 leading-relaxed">
          {progress.message && <p className="mb-3 font-medium">{progress.message}</p>}

          {progress.status === "awaiting-signature" && (
            <div className="p-3 rounded-xl bg-purple-950/40 border border-purple-500/30 text-purple-200 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-purple-400 shrink-0" />
              <span>Please open your Freighter extension popup to review and sign the transaction.</span>
            </div>
          )}

          {progress.status === "error" && progress.error && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300">
              <p className="font-semibold text-rose-200 mb-1">Error Reason:</p>
              <p>{progress.error}</p>
            </div>
          )}

          {/* Success Hash & Explorer Section */}
          {progress.hash && (
            <div className="mt-4 p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-slate-400 text-[11px]">
                <span>Transaction Hash</span>
                <button
                  onClick={handleCopyHash}
                  className="flex items-center gap-1 hover:text-white transition-colors"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? "Copied" : "Copy Hash"}</span>
                </button>
              </div>
              <p className="font-mono text-xs text-slate-300 break-all bg-slate-900 p-2 rounded border border-slate-800">
                {progress.hash}
              </p>
              <a
                href={EXPLORER_TX(progress.hash)}
                target="_blank"
                rel="noreferrer"
                className="mt-2 flex items-center justify-center gap-2 w-full py-2 px-3 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 font-semibold text-xs transition-all"
              >
                <span>View on StellarExpert Explorer</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          )}
        </div>

        {/* Modal Actions */}
        {!isPending && (
          <div className="mt-6 flex justify-end">
            <button
              onClick={onClose}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition-all"
            >
              Close Window
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
