/**
 * MetaMask compatibility shim.
 *
 * MetaMask no longer implements `eth_sendTransaction` (deprecated by
 * EIP-1193, removed in recent MetaMask releases). The genlayer-js SDK calls
 * it directly on the injected provider to send consensus transactions, so
 * every writeContract fails with:
 *   "Method not found: eth_sendTransaction"
 *
 * This module patches the injected provider's `request` and re-implements
 * `eth_sendTransaction` using `eth_signTransaction` + `eth_sendRawTransaction`,
 * both of which MetaMask still supports. Every other method passes through
 * untouched.
 *
 * CRASH SAFETY: this runs at module evaluation, so it may never throw.
 * Several wallets (Coinbase, Brave, Rabby) publish `window.ethereum` as a
 * NON-configurable property — `Object.defineProperty(window, "ethereum", ...)`
 * then throws `Cannot redefine property: ethereum` and white-screens the
 * whole app. Strategy 1 patches the provider object itself (works regardless
 * of how `window.ethereum` is defined, and every holder of the provider
 * reference sees the fix); Strategy 2 only redefines the window property if
 * it is actually redefinable; otherwise we warn and back off.
 *
 * Idempotent: safe to call more than once; no-ops if there's no injected
 * provider or if the shim is already installed.
 */

let installed = false;

const MARKER = "__shipguardMetaMaskCompat";

export function installMetaMaskCompat(): void {
  if (installed || typeof window === "undefined") return;
  try {
    const eth = (window as any).ethereum;

    if (!eth) {
      // The wallet may inject after our module runs; retry once when it lands.
      window.addEventListener("ethereum#initialized", () => installMetaMaskCompat(), {
        once: true,
      });
      return;
    }
    if (eth[MARKER]) {
      installed = true;
      return;
    }

    const origRequest = eth.request?.bind(eth);
    if (typeof origRequest !== "function") return;

    const wrappedRequest = async (args: { method: string; params?: any[] }) => {
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

        const signed = await origRequest({
          method: "eth_signTransaction",
          params: [signable],
        });
        // eth_signTransaction returns { raw: "0x...", tx: {...} } —
        // eth_sendRawTransaction needs the raw hex string, not the object.
        const rawTx = typeof signed === "string" ? signed : signed.raw;
        return origRequest({
          method: "eth_sendRawTransaction",
          params: [rawTx],
        });
      }
      // Everything else passes through to the real provider.
      return origRequest(args);
    };

    // ── Strategy 1: patch the provider object itself ────────────────────
    let patched = false;
    try {
      eth.request = wrappedRequest;
      patched = eth.request === wrappedRequest;
    } catch {
      patched = false;
    }

    // ── Strategy 2: swap a proxy into window.ethereum (only if allowed) ─
    if (!patched) {
      try {
        const desc = Object.getOwnPropertyDescriptor(window, "ethereum");
        if (desc && desc.configurable === false) {
          throw new Error("window.ethereum is non-configurable");
        }
        const proxy = new Proxy(eth, {
          get(target: any, prop: string | symbol) {
            if (prop === "request") return wrappedRequest;
            const v = target[prop];
            return typeof v === "function" ? v.bind(target) : v;
          },
        });
        Object.defineProperty(window, "ethereum", {
          value: proxy,
          writable: false,
          configurable: true,
        });
        patched = true;
      } catch {
        patched = false;
      }
    }

    if (!patched) {
      console.warn(
        "[ShipGuard] MetaMask compat shim could not install (provider is locked down); eth_sendTransaction may be unavailable on this wallet."
      );
      return;
    }

    try {
      eth[MARKER] = true;
    } catch {
      // Frozen provider: the module-level `installed` flag still guards us.
    }
    installed = true;
    console.info(
      "[ShipGuard] MetaMask compat shim installed (eth_sendTransaction -> sign+sendRaw)"
    );
  } catch (e) {
    // A compat shim must never take the page down.
    console.warn("[ShipGuard] MetaMask compat shim skipped:", e);
  }
}
