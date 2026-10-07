"use client";

import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo } from "react";
import { useConnections } from "wagmi";
import SelfDestructingVault from "../contracts/SelfDestructingVault";
import { getVaultContractAddress, getConditionContractAddress } from "../genlayer/client";
import { useWallet } from "../genlayer/wallet";
import { configError } from "../utils/toast";
import type { Vault, CreateVaultParams, DepositParams } from "../contracts/types";

/**
 * Hook to get the SelfDestructingVault contract instance
 *
 * Returns null if contract addresses are not configured.
 * The contract instance is recreated whenever the wallet address changes.
 * Read-only operations (getVault, getAllVaults, etc.) work without a connected wallet.
 */
export function useVaultContract(): SelfDestructingVault | null {
  const { address } = useWallet();
  const vaultAddress = getVaultContractAddress();
  const conditionAddress = getConditionContractAddress();
  const connections = useConnections();
  const contract = useMemo(() => {
    // Validate contract addresses are configured
    if (!vaultAddress || !conditionAddress) {
      configError(
        "Setup Required",
        "Contract addresses not configured. Please set NEXT_PUBLIC_VAULT_CONTRACT and NEXT_PUBLIC_CONDITION_CONTRACT in your .env file.",
        {
          label: "Setup Guide",
          onClick: () => window.open("/docs/setup", "_blank")
        }
      );
      // Return null to indicate contract is not available
      return null;
    }

    // Contract instance is recreated when address changes to ensure
    // the genlayer-js client is properly configured with the current account
    return new SelfDestructingVault(vaultAddress, conditionAddress, address);
  }, [vaultAddress, conditionAddress, address]);

  // Hand the contract the EIP-1193 provider of the connector the user is
  // actually connected with (RainbowKit can be WalletConnect / Coinbase /
  // Rainbow — none of which define window.ethereum). Writes only reach a
  // signer through this; without it genlayer-js posts eth_sendTransaction to
  // the Studio RPC, which has no signer and replies -32601.
  useEffect(() => {
    if (!contract) return;
    let cancelled = false;
    const conn = connections[0];
    if (!conn?.connector) {
      contract.setProvider(null);
      return;
    }
    conn.connector
      .getProvider()
      .then((provider: any) => {
        if (!cancelled) contract.setProvider(provider);
      })
      .catch(() => {
        if (!cancelled) contract.setProvider(null);
      });
    return () => {
      cancelled = true;
    };
  }, [contract, connections]);

  return contract;
}

/**
 * Hook to fetch all vaults
 * Refetches on window focus and after mutations
 * Returns empty array if contract is not configured
 */
export function useVaults() {
  const contract = useVaultContract();

  return useQuery<Vault[], Error>({
    queryKey: ["vaults"],
    queryFn: () => {
      if (!contract) {
        return Promise.resolve([]);
      }
      return contract.getAllVaults();
    },
    refetchOnWindowFocus: true,
    staleTime: 2000,
    enabled: !!contract, // Only run query if contract is available
  });
}

/**
 * Hook to fetch a single vault by ID
 * Refetches on window focus and after mutations
 * Returns null if contract is not configured or vault doesn't exist
 */
export function useVault(id: string) {
  const contract = useVaultContract();

  return useQuery<Vault | null, Error>({
    queryKey: ["vault", id],
    queryFn: () => {
      if (!contract) {
        return Promise.resolve(null);
      }
      return contract.getVault(id);
    },
    refetchOnWindowFocus: true,
    staleTime: 2000,
    enabled: !!id && !!contract, // Require both id and contract
  });
}

/**
 * Hook to create a new vault.
 *
 * The contract keys the vault (and its registered condition) by a caller-supplied
 * vault_id, so this hook mints one, registers the condition with the governor,
 * then creates the vault. All three steps must share the same id.
 *
 * Returns { vaultId, txHashes } so the UI can link to the new vault.
 */
export function useCreateVault() {
  const contract = useVaultContract();
  const invalidateVaultsData = useInvalidateVaultsData();

  return useMutation({
    mutationFn: async (params: CreateVaultParams) => {
      if (!contract) {
        throw new Error("Contract not available");
      }

      const vaultId = contract.generateVaultId();

      // 1. Register the condition — create_vault does NOT do this for us.
      const conditionHash = await contract.registerCondition(
        vaultId,
        params.check_url,
        params.condition,
        params.team_address
      );

      // 2. Create the vault, reusing the same id.
      const vaultHash = await contract.createVault(params, vaultId);

      return { vaultId, txHashes: { conditionHash, vaultHash } };
    },
    onSuccess: () => {
      invalidateVaultsData();
    },
  });
}

/**
 * Hook to deposit GEN tokens into a vault
 * Returns a mutation function that deposits and invalidates the vaults query
 */
export function useDeposit() {
  const contract = useVaultContract();
  const invalidateVaultsData = useInvalidateVaultsData();

  return useMutation({
    mutationFn: async (params: DepositParams) => {
      if (!contract) {
        throw new Error("Contract not available");
      }
      return contract.deposit(params);
    },
    onSuccess: () => {
      invalidateVaultsData();
    },
  });
}

/**
 * Hook to release funds from a vault (after condition is met)
 * Returns a mutation function that releases and invalidates the vaults query
 */
export function useRelease() {
  const contract = useVaultContract();
  const invalidateVaultsData = useInvalidateVaultsData();

  return useMutation({
    mutationFn: async (vaultId: string) => {
      if (!contract) {
        throw new Error("Contract not available");
      }
      return contract.release(vaultId);
    },
    onSuccess: () => {
      invalidateVaultsData();
    },
  });
}

/**
 * Hook to refund funds from a vault (after deadline without condition met)
 * Returns a mutation function that refunds and invalidates the vaults query
 */
export function useRefund() {
  const contract = useVaultContract();
  const invalidateVaultsData = useInvalidateVaultsData();

  return useMutation({
    mutationFn: async (vaultId: string) => {
      if (!contract) {
        throw new Error("Contract not available");
      }
      return contract.refund(vaultId);
    },
    onSuccess: () => {
      invalidateVaultsData();
    },
  });
}

/**
 * Hook to ask the ConditionGovernor to evaluate a vault's condition.
 * Runs the AI + live web fetch and stores the verdict on-chain.
 */
export function useEvaluateCondition() {
  const contract = useVaultContract();
  const invalidateVaultsData = useInvalidateVaultsData();

  return useMutation({
    mutationFn: async (vaultId: string) => {
      if (!contract) {
        throw new Error("Contract not available");
      }
      return contract.evaluateCondition(vaultId);
    },
    onSuccess: () => {
      invalidateVaultsData();
    },
  });
}

/**
 * Decide which exit a vault is eligible for, mirroring the contract's own rules.
 *
 *   condition met        -> release (funds to team)
 *   condition not met    -> refund  (funds back to depositors)
 *   deadline passed      -> refund is permitted regardless of verdict
 */
export function getVaultExit(vault: Vault): {
  canRelease: boolean;
  canRefund: boolean;
  label: string;
  hint: string;
} {
  const isActive = vault.status === "active";
  const verdict = (vault.verdict || "").toLowerCase();
  const deadlinePassed =
    !!vault.deadline && Date.now() / 1000 > Number(vault.deadline);

  const canRelease = isActive && verdict === "success";
  const canRefund =
    isActive && (verdict === "failure" || (deadlinePassed && verdict !== "success"));

  let label = "Awaiting evaluation";
  let hint = "This condition has not been evaluated yet.";

  if (verdict === "success") {
    label = "Release to team";
    hint = "Condition met — funds go to the team.";
  } else if (verdict === "failure") {
    label = "Refund depositors";
    hint = "Condition not met — funds return to depositors.";
  } else if (deadlinePassed) {
    label = "Refund depositors";
    hint = "Deadline passed without the condition being met — funds return to depositors.";
  }

  return { canRelease, canRefund, label, hint };
}

/**
 * Whether an evaluation was inconclusive (page unreadable/unjudgeable).
 *
 * The governor only stores a verdict when a read was confident, so an
 * inconclusive run leaves the vault with no verdict at all. Callers should
 * offer to re-run evaluate() rather than assuming the condition failed.
 */
export function isInconclusive(vault: Vault): boolean {
  return (
    vault.status === "active" &&
    (vault.verdict || "") === "" &&
    !!vault.deadline &&
    Date.now() / 1000 <= Number(vault.deadline)
  );
}

/**
 * Hook to invalidate all vault-related queries
 * Useful after mutations to refetch the latest data
 */
export function useInvalidateVaultsData() {
  const queryClient = useQueryClient();

  return useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["vaults"] });
    queryClient.invalidateQueries({ queryKey: ["vault"] });
  }, [queryClient]);
}