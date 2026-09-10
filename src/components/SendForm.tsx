import React, { useState, useEffect, useId } from "react";
import { Send, AlertCircle, Info, ShieldCheck, Zap } from "lucide-react";
import { Horizon } from "@stellar/stellar-sdk";
import { validatePaymentInput } from "../lib/payment";
import { probeAccountExists, calculateMaxSendableStroops, calculateMinimumReserveStroops } from "../lib/horizon";
import { stroopsToXlm } from "../constants";

interface SendFormProps {
  sourceAddress: string;
  sourceAccount: Horizon.AccountResponse | null;
  disabled: boolean;
  onSendPayment: (destination: string, amount: string, memo?: string) => Promise<void>;
}

export const SendForm: React.FC<SendFormProps> = ({
  sourceAddress,
  sourceAccount,
  disabled,
  onSendPayment,
}) => {
  const [destination, setDestination] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isDestAccountExisting, setIsDestAccountExisting] = useState<boolean | null>(null);
  const [isCheckingDest, setIsCheckingDest] = useState(false);

  const destInputId = useId();
  const amountInputId = useId();
  const memoInputId = useId();
  const errorId = useId();

  // Memo byte count calculation
  const memoByteCount = new TextEncoder().encode(memo).length;
  const isMemoValid = memoByteCount <= 28;

  // Probe destination account status when destination changes
  useEffect(() => {
    const trimmed = destination.trim();
    if (trimmed.length === 56 && trimmed.startsWith("G")) {
      setIsCheckingDest(true);
      const timer = setTimeout(async () => {
        const exists = await probeAccountExists(trimmed);
        setIsDestAccountExisting(exists);
        setIsCheckingDest(false);
      }, 400);
      return () => clearTimeout(timer);
    } else {
      setIsDestAccountExisting(null);
    }
  }, [destination]);

  // Real-time validation
  useEffect(() => {
    if (!destination && !amount && !memo) {
      setValidationError(null);
      return;
    }

    const res = validatePaymentInput(
      sourceAddress,
      destination,
      amount,
      memo,
      sourceAccount,
      isDestAccountExisting
    );

    if (!res.isValid && res.error) {
      setValidationError(res.error);
    } else {
      setValidationError(null);
    }
  }, [destination, amount, memo, sourceAddress, sourceAccount, isDestAccountExisting]);

  const handleMaxAmount = () => {
    if (!sourceAccount) return;
    const maxStroops = calculateMaxSendableStroops(sourceAccount);
    if (maxStroops > 0n) {
      setAmount(stroopsToXlm(maxStroops));
    } else {
      setValidationError("No sendable XLM balance available above minimum account reserve requirements.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = validatePaymentInput(
      sourceAddress,
      destination,
      amount,
      memo,
      sourceAccount,
      isDestAccountExisting
    );

    if (!res.isValid || res.error) {
      setValidationError(res.error || "Please correct the form errors before submitting.");
      return;
    }

    setValidationError(null);
    await onSendPayment(destination.trim(), amount.trim(), memo.trim() || undefined);
  };

  const minReserveXlm = sourceAccount ? stroopsToXlm(calculateMinimumReserveStroops(sourceAccount)) : "1";

  return (
    <div className="w-full max-w-xl mx-auto glass-panel glass-panel-hover rounded-2xl p-6 shadow-xl my-6">
      <div className="flex items-center gap-2 mb-6 text-slate-300">
        <Send className="w-5 h-5 text-cyan-400" />
        <h2 className="text-lg font-bold text-white tracking-tight">Send XLM Payment</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Destination Address Field */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <label htmlFor={destInputId} className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Recipient Address <span className="text-rose-400">*</span>
            </label>
            <span className="text-[11px] text-slate-400">Standard Stellar Key (G...)</span>
          </div>
          <div className="relative">
            <input
              id={destInputId}
              type="text"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              disabled={disabled}
              placeholder="GXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
              className="w-full px-4 py-3 rounded-xl bg-slate-950/70 border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500 text-sm font-mono transition-all disabled:opacity-50"
              aria-describedby={validationError ? errorId : undefined}
            />
            {isCheckingDest && (
              <span className="absolute right-3 top-3.5 text-xs text-cyan-400 animate-pulse font-sans">
                Checking address...
              </span>
            )}
          </div>

          {/* Unfunded Destination Warning Notice */}
          {isDestAccountExisting === false && (
            <div className="mt-2.5 p-3 rounded-xl bg-cyan-950/40 border border-cyan-500/30 text-xs text-cyan-200 flex items-start gap-2">
              <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <span>
                <strong>New Account:</strong> This destination address is not funded yet. This payment will create and fund the account (minimum 1.0 XLM required).
              </span>
            </div>
          )}
        </div>

        {/* Amount Field */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <label htmlFor={amountInputId} className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Amount (XLM) <span className="text-rose-400">*</span>
            </label>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400">Min Reserve: {minReserveXlm} XLM</span>
              <button
                type="button"
                onClick={handleMaxAmount}
                disabled={disabled || !sourceAccount}
                className="px-2 py-0.5 rounded bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 font-bold border border-purple-500/30 transition-all text-[11px]"
              >
                MAX
              </button>
            </div>
          </div>
          <div className="relative">
            <input
              id={amountInputId}
              type="text"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={disabled}
              placeholder="0.0000000"
              className="w-full px-4 py-3 rounded-xl bg-slate-950/70 border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 text-base font-mono transition-all disabled:opacity-50"
            />
            <span className="absolute right-4 top-3.5 text-xs font-bold text-slate-400">XLM</span>
          </div>
        </div>

        {/* Optional Memo Field */}
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <label htmlFor={memoInputId} className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
              Memo <span className="text-slate-500 font-normal lowercase">(optional)</span>
            </label>
            <span className={`text-[11px] font-mono ${isMemoValid ? "text-slate-400" : "text-rose-400 font-bold"}`}>
              {memoByteCount} / 28 bytes
            </span>
          </div>
          <input
            id={memoInputId}
            type="text"
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            disabled={disabled}
            placeholder="Payment memo or reference note"
            className="w-full px-4 py-2.5 rounded-xl bg-slate-950/70 border border-slate-800 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 text-sm transition-all disabled:opacity-50"
          />
        </div>

        {/* Inline Error Output */}
        {validationError && (
          <div id={errorId} role="alert" className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{validationError}</span>
          </div>
        )}

        {/* Fee & Network Safety Note */}
        <div className="pt-2 flex items-center justify-between text-xs text-slate-400 border-t border-slate-800/60">
          <span className="flex items-center gap-1">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            Estimated Base Fee: ~0.0001 XLM
          </span>
          <span className="flex items-center gap-1 text-slate-400">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            Signed via Freighter
          </span>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={disabled || Boolean(validationError) || !destination || !amount}
          className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-600 hover:from-purple-500 hover:via-indigo-500 hover:to-cyan-500 text-white font-bold text-sm tracking-wide shadow-lg shadow-purple-600/25 transition-all active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Send XLM Payment
        </button>
      </form>
    </div>
  );
};
