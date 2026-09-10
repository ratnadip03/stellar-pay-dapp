import { Networks } from "@stellar/stellar-sdk";

export const HORIZON_URL = "https://horizon-testnet.stellar.org";
export const FRIENDBOT_URL = "https://friendbot.stellar.org";
export const EXPLORER_TX = (hash: string) =>
  `https://stellar.expert/explorer/testnet/tx/${hash}`;
export const NETWORK_PASSPHRASE = Networks.TESTNET;

// The base reserve is 0.5 XLM. An account's minimum balance is
// (2 + subentry_count + num_sponsoring - num_sponsored) x base reserve,
// so 1 XLM is only the floor for an account with no subentries.
export const BASE_RESERVE_XLM = 0.5;
export const MIN_ACCOUNT_BALANCE_XLM = 2 * BASE_RESERVE_XLM;
export const STROOPS_PER_XLM = 10_000_000n;

/**
 * Converts XLM decimal string to integer stroops (BigInt) with zero floating-point loss.
 * 1 XLM = 10,000,000 stroops (7 decimal places max).
 */
export function xlmToStroops(xlm: string): bigint {
  const clean = xlm.trim();
  if (!clean || isNaN(Number(clean))) {
    throw new Error("Invalid XLM number format");
  }

  const parts = clean.split(".");
  if (parts.length > 2) {
    throw new Error("Invalid decimal format");
  }

  const intPart = parts[0] || "0";
  let fracPart = parts[1] || "";

  if (fracPart.length > 7) {
    throw new Error("XLM amount cannot exceed 7 decimal places");
  }

  // Pad fraction to 7 digits
  fracPart = fracPart.padEnd(7, "0");

  const stroopString = (BigInt(intPart) * STROOPS_PER_XLM + BigInt(fracPart)).toString();
  return BigInt(stroopString);
}

/**
 * Converts BigInt stroops back to a trimmed XLM string (up to 7 decimals).
 */
export function stroopsToXlm(stroops: bigint): string {
  if (stroops < 0n) {
    throw new Error("Stroops cannot be negative");
  }

  const intPart = stroops / STROOPS_PER_XLM;
  const fracPart = (stroops % STROOPS_PER_XLM).toString().padStart(7, "0");

  // Trim trailing zeros in fractional part
  const trimmedFrac = fracPart.replace(/0+$/, "");

  if (trimmedFrac.length === 0) {
    return intPart.toString();
  }

  return `${intPart}.${trimmedFrac}`;
}

/**
 * Format raw XLM string to max 7 decimals with trailing zero trim.
 */
export function formatXlmDisplay(xlmString: string): string {
  try {
    const stroops = xlmToStroops(xlmString);
    return stroopsToXlm(stroops);
  } catch {
    return xlmString;
  }
}
