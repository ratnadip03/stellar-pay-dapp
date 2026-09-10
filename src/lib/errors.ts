export class FreighterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FreighterError";
  }
}

/**
 * Normalizes Freighter API errors which can be plain strings or structured objects
 * like `{ code: number; message: string }`. Also handles user rejection cleanly.
 */
export function normalizeFreighterError(e: unknown): string {
  if (!e) return "Unknown Freighter error occurred";

  if (typeof e === "string") {
    return parseFreighterMessage(e);
  }

  if (typeof e === "object") {
    const obj = e as Record<string, unknown>;
    
    // Structured error object with code and/or message
    const message = typeof obj.message === "string" ? obj.message : null;
    const code = typeof obj.code === "number" ? obj.code : null;

    if (message) {
      if (isUserDeclined(message, code)) {
        return "Transaction cancelled by user in Freighter.";
      }
      return parseFreighterMessage(message);
    }

    if (code !== null) {
      if (code === -4 || code === 4) {
        return "Transaction cancelled by user in Freighter.";
      }
      return `Freighter error (code ${code})`;
    }
  }

  return "An unexpected error occurred while communicating with Freighter.";
}

function isUserDeclined(msg: string, code: number | null): boolean {
  const lower = msg.toLowerCase();
  if (code === -4 || code === 4) return true;
  return (
    lower.includes("user declined") ||
    lower.includes("user rejected") ||
    lower.includes("declined by user") ||
    lower.includes("rejected by user") ||
    lower.includes("cancelled by user") ||
    lower.includes("canceled by user")
  );
}

function parseFreighterMessage(msg: string): string {
  if (isUserDeclined(msg, null)) {
    return "Transaction cancelled by user in Freighter.";
  }
  if (msg.toLowerCase().includes("not installed")) {
    return "Freighter extension is not installed or enabled in your browser.";
  }
  return msg;
}

/**
 * Extract human-readable error explanation from Horizon server response error object.
 * Horizon result_codes is an object `{ transaction: string; operations?: string[] }`.
 */
export function parseHorizonError(err: any): string {
  console.error("Horizon operation error details:", err);

  // Check response.data.extras or fallback data.extras (for BadResponseError)
  const extras = err?.response?.data?.extras || err?.data?.extras;
  const resultCodes = extras?.result_codes;

  if (resultCodes) {
    const txCode = resultCodes.transaction;
    const opCodes: string[] = Array.isArray(resultCodes.operations) ? resultCodes.operations : [];

    // If transaction code is specific (not generic tx_failed), return mapped tx code
    if (txCode && txCode !== "tx_failed") {
      const mapped = mapTxCode(txCode);
      if (mapped) return mapped;
    }

    // Iterate operations for specific op_* codes when transaction is tx_failed
    for (const opCode of opCodes) {
      const mapped = mapOpCode(opCode);
      if (mapped) return mapped;
    }

    if (txCode) {
      const mapped = mapTxCode(txCode);
      if (mapped) return mapped;
    }
  }

  // Handle HTTP status codes
  if (err?.response?.status === 404 || err?.status === 404) {
    return "Account or resource not found on Stellar Testnet.";
  }

  if (err?.response?.status === 504 || err?.status === 504) {
    return "Horizon network request timed out (504). Transaction status may still be pending on-chain.";
  }

  if (err?.message && typeof err.message === "string") {
    if (err.message.includes("Network Error") || err.message.includes("Failed to fetch")) {
      return "Network connection failed. Please check your connection to Stellar Testnet.";
    }
    return err.message;
  }

  return "Transaction failed on Stellar Testnet. Please try again.";
}

function mapTxCode(code: string): string | null {
  switch (code) {
    case "tx_insufficient_balance":
      return "Insufficient XLM balance to pay for transaction base fee and minimum reserve.";
    case "tx_insufficient_fee":
      return "Transaction fee is too low for current Stellar network surge conditions.";
    case "tx_bad_seq":
      return "Account sequence number out of sync. Please refresh your balance and try again.";
    case "tx_too_late":
      return "Transaction expired before consensus was reached.";
    case "tx_bad_auth":
      return "Transaction signature authorization failed.";
    default:
      return null;
  }
}

function mapOpCode(code: string): string | null {
  switch (code) {
    case "op_no_destination":
      return "Destination account does not exist on Testnet. A minimum of 1 XLM is required to create a new account.";
    case "op_underfunded":
      return "Source account lacks sufficient unlocked XLM balance for this payment.";
    case "op_low_reserve":
      return "Payment amount is too low to satisfy the 1 XLM minimum reserve for creating a new destination account.";
    case "op_already_exists":
      return "Destination account already exists on Testnet.";
    case "op_malformed":
      return "Payment operation details are malformed or invalid.";
    default:
      return null;
  }
}
