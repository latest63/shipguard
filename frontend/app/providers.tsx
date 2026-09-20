"use client";

import { Toaster } from "sonner";
import { WagmiProviders } from "@/lib/wagmi-setup";
import { WalletProvider } from "@/lib/genlayer/WalletProvider";
import { installMetaMaskCompat } from "@/lib/metamask-compat";

// MetaMask no longer implements eth_sendTransaction, which genlayer-js
// relies on for every writeContract. Install the compat shim as early as
// we render anything in the browser (idempotent; no-op without MetaMask).
installMetaMaskCompat();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProviders>
      <WalletProvider>
        {children}
        <Toaster
          position="bottom-right"
          theme="dark"
          richColors
          closeButton
          offset="80px"
          toastOptions={{
            style: {
              background: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              color: 'hsl(var(--foreground))',
              boxShadow: '0 8px 32px hsl(var(--background) / 0.8)',
            },
          }}
        />
      </WalletProvider>
    </WagmiProviders>
  );
}
