import { createClient } from "genlayer-js";
import { GENLAYER_CHAIN } from "../genlayer/client";
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

  constructor(vaultAddress: string, conditionAddress: string, address?: string | null) {
    this.vaultAddress = vaultAddress as `0x${string}`;
    this.conditionAddress = conditionAddress as `0x${string}`;

    const config: any = {
      chain: GENLAYER_CHAIN,
    };

    if (address) {
      config.account = address as `0x${string}`;
    }

    this.client = createClient(config);
  }

  /**
   * Update the address used for transactions
   */
  updateAccount(address: string): void {
    const config: any = {
      chain: GENLAYER_CHAIN,
      account: address as `0x${string}`,
    };
    this.client = createClient(config);
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
      throw error;
    }
  }

  /**
   * Release funds from a vault (after condition is met).
   * Emits a transfer to the team -> requires a message fee allocation.
   */
  async release(vaultId: string): Promise<string> {
    try {
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
