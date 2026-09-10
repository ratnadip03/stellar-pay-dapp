import { AccountResponse } from "@stellar/stellar-sdk/lib/horizon";

export type TxStatus = "idle" | "building" | "awaiting-signature" | "submitting" | "success" | "error";

export interface WalletState {
  isInstalled: boolean;
  isConnected: boolean;
  address: string | null;
  network: string | null;
  networkPassphrase: string | null;
  balance: string | null; // Trimmed XLM string
  rawAccount: AccountResponse | null;
  isLoadingBalance: boolean;
  error: string | null;
}

export interface PaymentParams {
  destination: string;
  amount: string;
  memo?: string;
}

export interface TxProgress {
  status: TxStatus;
  message?: string;
  hash?: string;
  error?: string;
  isTimeout?: boolean;
}

export interface TxHistoryRecord {
  id: string;
  hash: string;
  destination: string;
  amount: string;
  memo?: string;
  timestamp: number;
  isCreateAccount: boolean;
}
