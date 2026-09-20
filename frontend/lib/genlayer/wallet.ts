"use client";

/**
 * Wallet hook backed by RainbowKit + wagmi (via the compat wrapper).
 *
 * This re-exports the migration target from `./wallet-compat`, which delegates
 * connection to RainbowKit/wagmi — so the wallet the user actually connects
 * (MetaMask or any RainbowKit wallet) is the one every `useWallet()` consumer
 * sees. The old hand-rolled `WalletProvider` only knew raw MetaMask and threw
 * "MetaMask not found" for anything else, so it is no longer the source.
 */
export { useWallet, CompatProvider as WalletProvider } from "../wallet-compat";
export type { WalletState } from "./WalletProvider";

/**
 * Utility function to format address for display
 * @param address - The address to format
 * @param maxLength - Maximum length before truncation (default: 12)
 */
export function formatAddress(
  address: string | null,
  maxLength: number = 12
): string {
  if (!address) return "";
  if (address.length <= maxLength) return address;

  const prefixLength = Math.floor((maxLength - 3) / 2);
  const suffixLength = Math.ceil((maxLength - 3) / 2);

  return `${address.slice(0, prefixLength)}...${address.slice(-suffixLength)}`;
}