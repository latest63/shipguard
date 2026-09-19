/**
 * MetaMask compatibility shim.
 *
 * MetaMask no longer implements `eth_sendTransaction` (deprecated by
 * EIP-1193, removed in recent MetaMask releases). The genlayer-js SDK calls
 * it directly on the injected provider to send consensus transactions, so
 * every writeContract fails with:
 *   "Method not found: eth_sendTransaction"
 *
 * This module wraps `window.ethereum` and re-implements `eth_sendTransaction`
 * using `eth_signTransaction` + `eth_sendRawTransaction`, both of which
 * MetaMask still supports. Every other method passes through untouched.
 *
 * Idempotent: safe to call more than once; no-ops if there's no injected
 * provider or if the shim is already installed.
 */

let installed = false;

const MARKER = "__shipguardMetaMaskCompat";

export function installMetaMaskCompat(): void {
  if (installed || typeof window === "undefined") return;
  const eth = (window as any).ethereum;
  if (!eth || eth[MARKER]) return;

  const origRequest = eth.request?.bind(eth);
  if (typeof origRequest !== "function") return;

  const patched = new Proxy(eth, {
    get(target: any, prop: string | symbol) {
      // Intercept `request` to translate the deprecated method.
      if (prop === "request") {
        return async (args: { method: string; params?: any[] }) => {
          if (args?.method === "eth_sendTransaction") {
            const tx = (args.params?.[0] ?? {}) as Record<string, any>;
            // Build a signing request with only the fields MetaMask accepts.
            const signable: Record<string, any> = {};
            if (tx.from) signable.from = tx.from;
            if (tx.to) signable.to = tx.to;
            if (tx.data !== undefined) signable.data = tx.data;
            if (tx.value !== undefined) signable.value = tx.value;
            if (tx.gas !== undefined) signable.gas = tx.gas;
            if (tx.nonce !== undefined) signable.nonce = tx.nonce;
            if (tx.gasPrice !== undefined) signable.gasPrice = tx.gasPrice;

            const signed = await target.request({
              method: "eth_signTransaction",
              params: [signable],
            });
            return target.request({
              method: "eth_sendRawTransaction",
              params: [signed],
            });
          }
          // Everything else passes through to the real MetaMask provider.
          return origRequest(args);
        };
      }
      const v = target[prop];
      return typeof v === "function" ? v.bind(target) : v;
    },
  });

  patched[MARKER] = true;
  Object.defineProperty(window, "ethereum", {
    value: patched,
    writable: false,
    configurable: true,
  });
  installed = true;
  console.info(
    "[ShipGuard] MetaMask compat shim installed (eth_sendTransaction -> sign+sendRaw)"
  );
}
