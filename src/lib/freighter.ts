/**
 * SDK SURFACE AUDIT (Confirmed against @stellar/freighter-api v6.0.1):
 * 
 * 1. isConnected() -> Promise<{ isConnected: boolean; error?: FreighterApiError }>
 * 2. requestAccess() -> Promise<{ address: string; error?: FreighterApiError }>
 * 3. getAddress() -> Promise<{ address: string; error?: FreighterApiError }>
 * 4. getNetwork() -> Promise<{ network: string; networkPassphrase: string; error?: FreighterApiError }>
 * 5. signTransaction(xdr, { networkPassphrase, address }) -> Promise<{ signedTxXdr: string; signerAddress: string; error?: FreighterApiError }>
 * 6. WatchWalletChanges -> Class for polling/listening to account & network changes.
 * 
 * DISCONNECT ARCHITECTURE NOTE:
 * Freighter API intentionally exposes NO programmatic disconnect or permission revocation function.
 * App-level disconnect is implemented by clearing React state, wiping localStorage keys, and resetting session.
 * The UI provides explicit guidance for users to revoke origin access via Freighter Extension Settings -> Connected Apps.
 */

import {
  isConnected,
  requestAccess,
  getAddress,
  getNetwork,
  signTransaction,
  WatchWalletChanges,
} from "@stellar/freighter-api";
import { normalizeFreighterError, FreighterError } from "./errors";

export interface FreighterNetworkInfo {
  network: string;
  networkPassphrase: string;
}

/**
 * Check if the Freighter extension is installed in the browser.
 */
export async function checkFreighterInstalled(): Promise<boolean> {
  try {
    const res = await isConnected();
    if ("error" in res && res.error) {
      return false;
    }
    return Boolean(res.isConnected);
  } catch (err) {
    console.error("Error checking Freighter installation:", err);
    return false;
  }
}

/**
 * Trigger the Freighter connection popup to request user authorization.
 */
export async function connectWallet(): Promise<string> {
  const installed = await checkFreighterInstalled();
  if (!installed) {
    throw new FreighterError("Freighter extension is not installed. Please install it from freighter.app.");
  }

  const res = await requestAccess();
  if ("error" in res && res.error) {
    throw new FreighterError(normalizeFreighterError(res.error));
  }

  if (!res.address) {
    throw new FreighterError("No address returned from Freighter wallet.");
  }

  return res.address;
}

/**
 * Retrieve currently active public key address without triggering a popup (if allowed).
 */
export async function getConnectedAddress(): Promise<string | null> {
  try {
    const res = await getAddress();
    if ("error" in res && res.error) {
      return null;
    }
    return res.address || null;
  } catch {
    return null;
  }
}

/**
 * Retrieve network info (short network name and passphrase).
 */
export async function getFreighterNetwork(): Promise<FreighterNetworkInfo | null> {
  try {
    const res = await getNetwork();
    if ("error" in res && res.error) {
      return null;
    }
    return {
      network: res.network || "UNKNOWN",
      networkPassphrase: res.networkPassphrase || "",
    };
  } catch {
    return null;
  }
}

/**
 * Sign an unsigned XDR string using Freighter wallet extension.
 */
export async function signTxXdr(
  xdr: string,
  networkPassphrase: string,
  userAddress: string
): Promise<string> {
  const res = await signTransaction(xdr, {
    networkPassphrase,
    address: userAddress,
  });

  if ("error" in res && res.error) {
    throw new FreighterError(normalizeFreighterError(res.error));
  }

  if (!("signedTxXdr" in res) || !res.signedTxXdr) {
    throw new FreighterError("Freighter returned no signed transaction XDR.");
  }

  return res.signedTxXdr;
}

/**
 * Setup a watcher instance for wallet address/network switches.
 */
export function createWalletWatcher(
  onChange: (data: { address?: string; network?: string }) => void
): () => void {
  try {
    const watcher = new WatchWalletChanges();
    // WatchWalletChanges exposes watch method or event emitter
    if (watcher && typeof (watcher as any).watch === "function") {
      (watcher as any).watch(onChange);
      return () => {
        if (typeof (watcher as any).stop === "function") {
          (watcher as any).stop();
        }
      };
    }
  } catch (e) {
    console.warn("WatchWalletChanges init warning:", e);
  }

  // Fallback periodic poll if watcher class unsupported
  const interval = setInterval(async () => {
    const addr = await getConnectedAddress();
    const net = await getFreighterNetwork();
    onChange({ address: addr || undefined, network: net?.network });
  }, 3000);

  return () => clearInterval(interval);
}
