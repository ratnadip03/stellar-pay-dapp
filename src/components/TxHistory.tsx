import React from "react";
import { History, ExternalLink, ArrowUpRight, PlusCircle } from "lucide-react";
import type { TxHistoryRecord } from "../types";
import { EXPLORER_TX } from "../constants";

interface TxHistoryProps {
  records: TxHistoryRecord[];
  onClear: () => void;
}

export const TxHistory: React.FC<TxHistoryProps> = ({ records, onClear }) => {
  if (records.length === 0) return null;

  return (
    <div className="w-full max-w-xl mx-auto glass-panel rounded-2xl p-6 shadow-xl my-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-slate-300">
          <History className="w-4 h-4 text-purple-400" />
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Session Activity</h3>
        </div>
        <button
          onClick={onClear}
          className="text-xs text-slate-400 hover:text-rose-400 transition-colors"
        >
          Clear History
        </button>
      </div>

      <div className="space-y-3">
        {records.map((tx) => (
          <div
            key={tx.id}
            className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between gap-3 text-xs"
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl ${tx.isCreateAccount ? "bg-cyan-500/10 text-cyan-400" : "bg-purple-500/10 text-purple-400"}`}>
                {tx.isCreateAccount ? <PlusCircle className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
              </div>
              <div>
                <p className="font-semibold text-white flex items-center gap-1.5">
                  <span>{tx.amount} XLM</span>
                  <span className="text-[10px] text-slate-400 font-mono">→ {tx.destination.slice(0, 4)}...{tx.destination.slice(-4)}</span>
                </p>
                <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                  {new Date(tx.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  {tx.memo && <span className="ml-2 text-slate-400">Memo: "{tx.memo}"</span>}
                </p>
              </div>
            </div>

            <a
              href={EXPLORER_TX(tx.hash)}
              target="_blank"
              rel="noreferrer"
              className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-purple-300 border border-slate-800 transition-colors"
              title="View on Explorer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        ))}
      </div>
    </div>
  );
};
