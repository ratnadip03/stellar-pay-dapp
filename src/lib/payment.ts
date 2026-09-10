import {
  TransactionBuilder,
  Operation,
  Asset,
  Memo,
  StrKey,
  BASE_FEE,
  Horizon,
} from "@stellar/stellar-sdk";
import { NETWORK_PASSPHRASE, STROOPS_PER_XLM, xlmToStroops, stroopsToXlm } from "../constants";
import { server, probeAccountExists, calculateMinimumReserveStroops } from "./horizon";
import { signTxXdr } from "./freighter";
import { parseHorizonError, FreighterError } from "./errors";
import type { TxProgress } from "../types";

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  isCreateAccount?: boolean;
}

/**
 * Validate payment input parameters strictly before building any transaction.
 */
export function validatePaymentInput(
  sourceAddress: string,
  destinationAddress: string,
  amountXlm: string,
  memoText: string | undefined,
  sourceAccount: Horizon.AccountResponse | null,
  isDestinationAccountExisting: boolean | null
): ValidationResult {
  const trimmedDest = destinationAddress.trim();
  const trimmedAmount = amountXlm.trim();

  // 1. Destination checks
  if (!trimmedDest) {
    return { isValid: false, error: "Destination address is required." };
  }

  if (trimmedDest.startsWith("M")) {
    return { isValid: false, error: "Muxed addresses (M...) are not supported in this dApp. Please use a standard Stellar address (G...)." };
  }

  if (trimmedDest.startsWith("C")) {
    return { isValid: false, error: "Smart contract addresses (C...) are not supported in this dApp. Please use a standard Stellar address (G...)." };
  }

  if (!StrKey.isValidEd25519PublicKey(trimmedDest)) {
    return { isValid: false, error: "Invalid Stellar public key format. Must be a valid 56-character G... address." };
  }

  if (trimmedDest === sourceAddress) {
    return { isValid: false, error: "Cannot send XLM to your own address." };
  }

  // 2. Amount checks
  if (!trimmedAmount) {
    return { isValid: false, error: "Payment amount is required." };
  }

  let sendStroops: bigint;
  try {
    sendStroops = xlmToStroops(trimmedAmount);
  } catch (err: any) {
    return { isValid: false, error: err.message || "Invalid amount format. Must be a positive number with max 7 decimal places." };
  }

  if (sendStroops <= 0n) {
    return { isValid: false, error: "Amount must be greater than 0 XLM." };
  }

  // 3. Minimum reserve & sender balance checks
  if (sourceAccount) {
    const nativeAsset = sourceAccount.balances.find((b) => b.asset_type === "native");
    const totalStroops = nativeAsset ? xlmToStroops(nativeAsset.balance) : 0n;
    const reserveStroops = calculateMinimumReserveStroops(sourceAccount);
    const estimatedFeeStroops = BigInt(Number(BASE_FEE) * 10);

    let sellingLiabilitiesStroops = 0n;
    if (nativeAsset && "selling_liabilities" in nativeAsset && typeof nativeAsset.selling_liabilities === "string") {
      sellingLiabilitiesStroops = xlmToStroops(nativeAsset.selling_liabilities);
    }

    const availableStroops = totalStroops > (reserveStroops + sellingLiabilitiesStroops + estimatedFeeStroops)
      ? totalStroops - (reserveStroops + sellingLiabilitiesStroops + estimatedFeeStroops)
      : 0n;

    if (sendStroops > availableStroops) {
      const minReserveXlm = stroopsToXlm(reserveStroops);
      return {
        isValid: false,
        error: `Insufficient available XLM. Your account requires a minimum reserve of ${minReserveXlm} XLM (based on your active subentries) plus network fee. Maximum sendable: ${stroopsToXlm(availableStroops)} XLM.`,
      };
    }
  }

  // 4. Destination exists check & 1 XLM requirement for createAccount
  const isCreateAccount = isDestinationAccountExisting === false;
  if (isCreateAccount) {
    if (sendStroops < STROOPS_PER_XLM) {
      return {
        isValid: false,
        isCreateAccount: true,
        error: "Destination account is new. A minimum payment of 1.0 XLM is required to create and fund a new Stellar account.",
      };
    }
  }

  // 5. Memo byte length check (max 28 bytes for Text memo)
  if (memoText && memoText.trim()) {
    const byteLength = new TextEncoder().encode(memoText.trim()).length;
    if (byteLength > 28) {
      return { isValid: false, error: `Memo text exceeds maximum allowed 28 bytes (currently ${byteLength} bytes).` };
    }
  }

  return { isValid: true, isCreateAccount };
}

/**
 * Execute full payment transaction lifecycle: build -> sign -> submit.
 */
export async function executePaymentTransaction(
  sourceAddress: string,
  destinationAddress: string,
  amountXlm: string,
  memoText: string | undefined,
  onProgress: (progress: TxProgress) => void
): Promise<TxProgress> {
  const trimmedDest = destinationAddress.trim();
  const trimmedAmount = amountXlm.trim();
  const trimmedMemo = memoText?.trim();

  try {
    // Step 1: Probe destination account status
    onProgress({ status: "building", message: "Fetching account data & probing destination..." });
    const sourceAccount = await server.loadAccount(sourceAddress);
    const destAccountExists = await probeAccountExists(trimmedDest);

    // Dynamic base fee estimate with fallback
    let feePerOp = Number(BASE_FEE) * 10; // 1000 stroops fallback
    try {
      const networkBaseFee = await server.fetchBaseFee();
      if (networkBaseFee) {
        feePerOp = Math.max(feePerOp, networkBaseFee * 10);
      }
    } catch {
      // ignore fee fetch error and use fallback
    }

    // Step 2: Build operation
    let operation: ReturnType<typeof Operation.payment> | ReturnType<typeof Operation.createAccount>;
    let isCreateAccount = false;

    if (!destAccountExists) {
      isCreateAccount = true;
      operation = Operation.createAccount({
        destination: trimmedDest,
        startingBalance: trimmedAmount,
      });
    } else {
      operation = Operation.payment({
        destination: trimmedDest,
        asset: Asset.native(),
        amount: trimmedAmount,
      });
    }

    const txBuilder = new TransactionBuilder(sourceAccount, {
      fee: feePerOp.toString(),
      networkPassphrase: NETWORK_PASSPHRASE,
    })
      .addOperation(operation)
      .setTimeout(180);

    if (trimmedMemo) {
      txBuilder.addMemo(Memo.text(trimmedMemo));
    } else {
      txBuilder.addMemo(Memo.none());
    }

    const unsignedTx = txBuilder.build();
    const unsignedXdr = unsignedTx.toXDR();

    // Step 3: Sign in Freighter
    onProgress({
      status: "awaiting-signature",
      message: `Confirm ${isCreateAccount ? "account creation & " : ""}payment of ${trimmedAmount} XLM in Freighter wallet...`,
    });

    let signedXdr: string;
    try {
      signedXdr = await signTxXdr(unsignedXdr, NETWORK_PASSPHRASE, sourceAddress);
    } catch (err: any) {
      const errorMsg = err instanceof FreighterError ? err.message : parseFreighterErrorMsg(err);
      const result: TxProgress = {
        status: "error",
        error: errorMsg,
      };
      onProgress(result);
      return result;
    }

    // Step 4: Submit to Horizon
    onProgress({ status: "submitting", message: "Submitting signed transaction to Stellar Testnet..." });
    const signedTx = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);
    
    let response: Horizon.HorizonApi.SubmitTransactionResponse;
    try {
      response = await server.submitTransaction(signedTx);
    } catch (submitErr: any) {
      // Handle race condition: op_already_exists if account was created mid-flight
      const parsedErr = parseHorizonError(submitErr);
      if (isCreateAccount && parsedErr.includes("already exists")) {
        // Retry build as plain payment automatically
        return retryAsPlainPayment(sourceAddress, trimmedDest, trimmedAmount, trimmedMemo, onProgress);
      }

      // Check for 504 Timeout
      if (submitErr?.response?.status === 504 || submitErr?.status === 504) {
        const result: TxProgress = {
          status: "error",
          isTimeout: true,
          error: "Horizon server request timed out (504). The network may be congested; check Stellar Explorer to verify status.",
        };
        onProgress(result);
        return result;
      }

      const result: TxProgress = {
        status: "error",
        error: parsedErr,
      };
      onProgress(result);
      return result;
    }

    if (!response.successful && response.successful !== undefined) {
      const result: TxProgress = {
        status: "error",
        error: "Transaction was submitted but failed on-chain consensus.",
      };
      onProgress(result);
      return result;
    }

    const finalResult: TxProgress = {
      status: "success",
      hash: response.hash,
      message: `Successfully sent ${trimmedAmount} XLM to ${trimmedDest.slice(0, 4)}...${trimmedDest.slice(-4)}!`,
    };
    onProgress(finalResult);
    return finalResult;

  } catch (err: any) {
    const errorMsg = parseHorizonError(err);
    const result: TxProgress = {
      status: "error",
      error: errorMsg,
    };
    onProgress(result);
    return result;
  }
}

async function retryAsPlainPayment(
  sourceAddress: string,
  destinationAddress: string,
  amountXlm: string,
  memoText: string | undefined,
  onProgress: (progress: TxProgress) => void
): Promise<TxProgress> {
  onProgress({ status: "building", message: "Account created elsewhere; rebuilding as plain payment..." });
  const sourceAccount = await server.loadAccount(sourceAddress);

  const txBuilder = new TransactionBuilder(sourceAccount, {
    fee: (Number(BASE_FEE) * 10).toString(),
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      Operation.payment({
        destination: destinationAddress,
        asset: Asset.native(),
        amount: amountXlm,
      })
    )
    .setTimeout(180);

  if (memoText) {
    txBuilder.addMemo(Memo.text(memoText));
  }

  const unsignedTx = txBuilder.build();
  const signedXdr = await signTxXdr(unsignedTx.toXDR(), NETWORK_PASSPHRASE, sourceAddress);
  const signedTx = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);
  const response = await server.submitTransaction(signedTx);

  const result: TxProgress = {
    status: "success",
    hash: response.hash,
    message: `Successfully sent ${amountXlm} XLM to ${destinationAddress.slice(0, 4)}...${destinationAddress.slice(-4)}!`,
  };
  onProgress(result);
  return result;
}

function parseFreighterErrorMsg(err: any): string {
  if (typeof err === "string") return err;
  if (err?.message) return err.message;
  return "Freighter transaction signing failed.";
}
