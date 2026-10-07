import { createClient } from "genlayer-js";
import { GENLAYER_CHAIN, GENLAYER_CHAIN_ID, getStudioUrl } from "../genlayer/client";
import type { Vault, CreateVaultParams, DepositParams } from "./types";

/**
 * SelfDestructingVault contract class for interacting with the GenLayer Vault contract
 *
 * IMPORTANT — GenLayer message fees (v0.3.0 / Studio Next):
 * Any contract method that emits an outgoing transfer (`release`, `refund`) MUST be
 * priced with `estimateTransactionFeesForWrite`, NOT `estimateTransactionFees`.
 * `emit_transfer` produces an internal message, and the network requires that
 * message's budget to be declared in `fees.messageAllocations` at submission time.
 * Estimating with `estimateTransactionFees({})` returns an empty allocation list and
 * the transaction dies with `no_matching_allocation`
 * (Mode1MessageFeesRequireGenVMPerEmissionSupport) before the transfer runs.
 */
class SelfDestructingVault {
  private vaultAddress: `0x${string}`;
  private conditionAddress: `0x${string}`;
  private client: any;
  private provider: any = null;
  private config: any = { chain: GENLAYER_CHAIN };

  constructor(vaultAddress: string, conditionAddress: string, address?: string | null) {
    this.vaultAddress = vaultAddress as `0x${string}`;
    this.conditionAddress = conditionAddress as `0x${string}`;

    if (address) {
      this.config.account = address as `0x${string}`;
    }

    this.client = createClient(this.config);
  }

  /**
   * Attach the EIP-1193 provider of the wallet the user ACTUALLY connected
   * with. The UI connects through RainbowKit/wagmi, which can hand us
   * WalletConnect / Coinbase Wallet / Rainbow — none of which inject
   * `window.ethereum`. Without this, genlayer-js silently falls back to the
   * bare Studio HTTP RPC for `eth_sendTransaction`, and that node has no
   * signer, so it answers -32601 "Method not found: eth_sendTransaction".
   *
   * The SDK reads `config.provider` on every request, so mutating the config
   * here is enough — no client rebuild needed.
   */
  setProvider(provider: any | null): void {
    this.provider = provider ?? null;
    this.config.provider = this.provider;
  }

  /** 
   * Update the address used for transactions
   */
  updateAccount(address: string): void {
    this.config.account = address as `0x${string}`;
    this.client = createClient(this.config);
  }

  /**
   * Before any write: put the attached wallet on Studio Next (chain 61997).
   * genlayer-js skips this check on Studio chains, and a deposit signed while
   * the wallet sits on another network would be broadcast THERE instead.
   */
  private async prepareWallet(): Promise<void> {
    const provider = this.provider;
    if (!provider?.request) return;
    const targetHex = `0x${GENLAYER_CHAIN_ID.toString(16)}`;
    let current: string | null = null;
    try {
      current = await provider.request({ method: "eth_chainId" });
    } catch {
      return; // provider can't answer — let the write itself surface the error
    }
    if (current && String(current).toLowerCase() === targetHex.toLowerCase()) return;
    try {
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: targetHex }],
      });
    } catch (e: any) {
      if (e?.code === 4902) {
        await provider.request({
          method: "wallet_addEthereumChain",
          params: [{
            chainId: targetHex,
            chainName: GENLAYER_CHAIN.name,
            nativeCurrency: GENLAYER_CHAIN.nativeCurrency,
            rpcUrls: [getStudioUrl()],
            blockExplorerUrls: [],
          }],
        });
      } else {
        throw new Error(
          `Switch your wallet to ${GENLAYER_CHAIN.name} (chain ${GENLAYER_CHAIN_ID}) and try again.`
        );
      }
    }
  }

  /** Turn the SDK's transport failure into something a human can act on. */
  private static translate(error: any, action: string): Error {
    const detail = String(error?.details || error?.message || error || "");
    if (/Method not found|does not exist \/ is not available|eth_sendTransaction/i.test(detail)) {
      return new Error(
        `${action}: your wallet never received the request — it went to the RPC instead. ` +
        `Reconnect with “Connect wallet” and approve the wallet pop-up. ` +
        `(If you're in a private window or a plain mobile browser, open MetaMask's in-app browser instead.)`
      );
    }
    return error instanceof Error ? error : new Error(`${action} failed.`);
  }

  /**
   * Mint a unique vault id. The contract keys both the vault and its registered
   * condition by this id, so it must be generated once and reused for
   * registerCondition -> createVault -> deposit.
   */
  generateVaultId(): string {
    return `vault-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  /**
   * Register the condition with the ConditionGovernor contract.
   * Must be called before createVault; createVault does not register it.
   */
  async registerCondition(
    vaultId: string,
    checkUrl: string,
    successCondition: string,
    teamAddress: string
  ): Promise<string> {
    try {
      await this.prepareWallet();
      const fees = await this.client.estimateTransactionFees({});
      const result = await this.client.writeContract({
        address: this.conditionAddress,
        functionName: "register_condition",
        args: [vaultId, checkUrl, successCondition, teamAddress],
        fees,
      });
      return result.hash;
    } catch (error) {
      console.error("Error registering condition:", error);
      throw new Error("Failed to register condition");
    }
  }

  /**
   * Ask the ConditionGovernor to evaluate the condition (AI + web fetch).
   */
  async evaluateCondition(vaultId: string): Promise<string> {
    try {
      await this.prepareWallet();
      const fees = await this.client.estimateTransactionFees({});
      const result = await this.client.writeContract({
        address: this.conditionAddress,
        functionName: "evaluate",
        args: [vaultId],
        fees,
      });
      return result.hash;
    } catch (error) {
      console.error("Error evaluating condition:", error);
      throw new Error("Failed to evaluate condition");
    }
  }

  /**
   * Create a new vault.
   *
   * Contract signature:
   *   create_vault(vault_id, team_address, deadline, condition, condition_contract) -> str
   */
  async createVault(params: CreateVaultParams, vaultId: string): Promise<string> {
    try {
      await this.prepareWallet();
      const fees = await this.client.estimateTransactionFees({});
      const result = await this.client.writeContract({
        address: this.vaultAddress,
        functionName: "create_vault",
        args: [
          vaultId,
          params.team_address,
          params.deadline,
          params.condition,
          this.conditionAddress,
        ],
        fees,
      });
      return result.hash;
    } catch (error) {
      console.error("Error creating vault:", error);
      throw new Error("Failed to create vault");
    }
  }

  /**
   * Deposit GEN tokens into a vault
   */
  async deposit(params: DepositParams): Promise<string> {
    try {
      await this.prepareWallet();
      const fees = await this.client.estimateTransactionFees({});
      const result = await this.client.writeContract({
        address: this.vaultAddress,
        functionName: "deposit",
        args: [params.vault_id],
        value: BigInt(params.amount),
        fees,
      });
      return result.hash;
    } catch (error: any) {
      console.error("Error depositing to vault:", error);
      throw SelfDestructingVault.translate(error, "Deposit failed");
    }
  }

  /**
   * Release funds from a vault (after condition is met).
   * Emits a transfer to the team -> requires a message fee allocation.
   */
  async release(vaultId: string): Promise<string> {
    try {
      await this.prepareWallet();
      const fees = await this.client.estimateTransactionFeesForWrite({
        address: this.vaultAddress,
        functionName: "release",
        args: [vaultId],
        account: this.client.account,
      });
      const result = await this.client.writeContract({
        address: this.vaultAddress,
        functionName: "release",
        args: [vaultId],
        fees,
      });
      return result.hash;
    } catch (error) {
      console.error("Error releasing vault:", error);
      throw new Error("Failed to release vault");
    }
  }

  /**
   * Refund funds to depositors (condition not met / deadline passed).
   * Emits one transfer PER DEPOSITOR -> requires a message fee allocation.
   */
  async refund(vaultId: string): Promise<string> {
    try {
      await this.prepareWallet();
      const fees = await this.client.estimateTransactionFeesForWrite({
        address: this.vaultAddress,
        functionName: "refund",
        args: [vaultId],
        account: this.client.account,
      });
      const result = await this.client.writeContract({
        address: this.vaultAddress,
        functionName: "refund",
        args: [vaultId],
        fees,
      });
      return result.hash;
    } catch (error) {
      console.error("Error refunding vault:", error);
      throw new Error("Failed to refund vault");
    }
  }

  /**
   * Get a single vault by ID
   */
  async getVault(vaultId: string): Promise<Vault | null> {
    try {
      const vault: any = await this.client.readContract({
        address: this.vaultAddress,
        functionName: "get_vault",
        args: [vaultId],
      });

      if (!vault) return null;

      // Convert Map structure to plain object
      if (vault instanceof Map) {
        const vaultObj = Array.from(vault.entries()).reduce(
          (obj: any, [key, value]: any) => {
            obj[key] = value;
            return obj;
          },
          {} as Record<string, any>
        ) as Vault;
        return vaultObj;
      }

      return vault as Vault;
    } catch (error) {
      console.error("Error fetching vault:", error);
      throw new Error("Failed to fetch vault");
    }
  }

  /**
   * Get all vaults
   */
  async getAllVaults(): Promise<Vault[]> {
    try {
      const vaults: any = await this.client.readContract({
        address: this.vaultAddress,
        functionName: "get_all_vaults",
        args: [],
      });

      // Convert GenLayer Map structure to typed array
      if (vaults instanceof Map) {
        return Array.from(vaults.entries()).map(([id, vaultData]: any) => {
          const vaultObj = Array.from((vaultData as any).entries()).reduce(
            (obj: any, [key, value]: any) => {
              obj[key] = value;
              return obj;
            },
            {} as Record<string, any>
          ) as Vault;
          vaultObj.id = id;
          return vaultObj;
        });
      }

      // Plain object map (some SDK versions decode TreeMap to a JS object)
      if (vaults && typeof vaults === "object") {
        return Object.entries(vaults).map(([id, vaultData]: [string, any]) => {
          if (vaultData instanceof Map) {
            const obj = Array.from(vaultData.entries()).reduce(
              (acc: any, [k, v]: any) => { acc[k] = v; return acc; },
              {} as Record<string, any>
            ) as Vault;
            obj.id = id;
            return obj;
          }
          return { ...(vaultData as Vault), id };
        });
      }

      return [];
    } catch (error) {
      console.error("Error fetching vaults:", error);
      throw new Error("Failed to fetch vaults from contract");
    }
  }

  /**
   * Get the raw verdict dict for a vault's condition.
   * Shape: { decision: "success" | "failure" | "pending", reason: string, ... }
   */
  async getVerdict(vaultId: string): Promise<any | null> {
    try {
      const verdict = await this.client.readContract({
        address: this.conditionAddress,
        functionName: "get_verdict",
        args: [vaultId],
      });
      return verdict ?? null;
    } catch (error) {
      console.error("Error fetching verdict:", error);
      return null;
    }
  }

  /**
   * Get the condition details (dict) for a vault from the governor contract.
   */
  async getCondition(vaultId: string): Promise<any | null> {
    try {
      const condition = await this.client.readContract({
        address: this.conditionAddress,
        functionName: "get_condition",
        args: [vaultId],
      });
      return condition ?? null;
    } catch (error) {
      console.error("Error fetching condition:", error);
      return null;
    }
  }
}

export default SelfDestructingVault;
