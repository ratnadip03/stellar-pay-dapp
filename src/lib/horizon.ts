import { Horizon } from "@stellar/stellar-sdk";
import { HORIZON_URL, FRIENDBOT_URL, BASE_RESERVE_XLM, xlmToStroops, stroopsToXlm } from "../constants";

export const server = new Horizon.Server(HORIZON_URL);

export interface AccountFetchResult {
  exists: boolean;
  balance: string; // Formatted XLM string (e.g., "1000")
  rawAccount: Horizon.AccountResponse | null;
  error?: string;
}

/**
 * Fetch account info and native XLM balance from Horizon Testnet.
 * Gracefully handles 404 (unfunded account) without throwing.
 */
export async function fetchAccountBalance(address: string): Promise<AccountFetchResult> {
  try {
    const account = await server.loadAccount(address);
    const nativeAsset = account.balances.find((b) => b.asset_type === "native");
    
    if (!nativeAsset) {
      return {
        exists: true,
        balance: "0",
        rawAccount: account,
      };
    }

    const stroops = xlmToStroops(nativeAsset.balance);
    const formatted = stroopsToXlm(stroops);

    return {
      exists: true,
      balance: formatted,
      rawAccount: account,
    };
  } catch (err: any) {
    if (err?.response?.status === 404 || err?.status === 404) {
      return {
        exists: false,
        balance: "0",
        rawAccount: null,
      };
    }

    console.error("Failed to load account from Horizon:", err);
    return {
      exists: false,
      balance: "0",
      rawAccount: null,
      error: "Unable to connect to Stellar Testnet Horizon server.",
    };
  }
}

/**
 * Check if a recipient account exists on Testnet Horizon.
 * Returns true if account exists, false if 404.
 */
export async function probeAccountExists(address: string): Promise<boolean> {
  try {
    await server.loadAccount(address);
    return true;
  } catch (err: any) {
    if (err?.response?.status === 404 || err?.status === 404) {
      return false;
    }
    return false;
  }
}

/**
 * Fund an account on Stellar Testnet using Friendbot.
 */
export async function fundWithFriendbot(address: string): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch(`${FRIENDBOT_URL}/?addr=${encodeURIComponent(address)}`);
    
    if (response.ok || response.status === 200) {
      return { success: true, message: "Successfully funded account with 10,000 Testnet XLM!" };
    }

    if (response.status === 400) {
      // 400 from Friendbot usually means account already funded
      return { success: true, message: "Account is already funded on Testnet." };
    }

    const text = await response.text();
    return { success: false, message: `Friendbot response: ${text || response.statusText}` };
  } catch (err: any) {
    console.error("Friendbot request error:", err);
    return { success: false, message: "Failed to connect to Stellar Friendbot service." };
  }
}

/**
 * Compute real minimum balance reserve required for an account.
 * Minimum reserve = (2 + subentry_count + num_sponsoring - num_sponsored) * 0.5 XLM
 */
export function calculateMinimumReserveStroops(account: Horizon.AccountResponse | null): bigint {
  if (!account) {
    // Standard unfunded or new account minimum reserve
    return BigInt(Math.round(2 * BASE_RESERVE_XLM * 10_000_000));
  }

  const subentries = BigInt(account.subentry_count || 0);
  const sponsoring = BigInt(account.num_sponsoring || 0);
  const sponsored = BigInt(account.num_sponsored || 0);

  const reserveMultiplier = 2n + subentries + sponsoring - sponsored;
  const reserveStroops = reserveMultiplier * BigInt(Math.round(BASE_RESERVE_XLM * 10_000_000));

  return reserveStroops;
}

/**
 * Calculate the maximum sendable XLM amount in integer stroops after subtracting
 * minimum reserve, liabilities, and padded transaction base fee.
 */
export function calculateMaxSendableStroops(
  account: Horizon.AccountResponse | null,
  estimatedFeeStroops: bigint = 1000n // Default padded fee: 10 * 100 stroops
): bigint {
  if (!account) return 0n;

  const nativeAsset = account.balances.find((b) => b.asset_type === "native");
  if (!nativeAsset) return 0n;

  const totalStroops = xlmToStroops(nativeAsset.balance);
  const reserveStroops = calculateMinimumReserveStroops(account);

  // Read selling liabilities if present
  let sellingLiabilitiesStroops = 0n;
  if ("selling_liabilities" in nativeAsset && typeof nativeAsset.selling_liabilities === "string") {
    sellingLiabilitiesStroops = xlmToStroops(nativeAsset.selling_liabilities);
  }

  const lockedStroops = reserveStroops + sellingLiabilitiesStroops + estimatedFeeStroops;

  if (totalStroops <= lockedStroops) {
    return 0n;
  }

  return totalStroops - lockedStroops;
}
