import { NextResponse } from "next/server";
import { createClient, createAccount, isSuccessful } from "genlayer-js";
import { studioDevnet } from "genlayer-js/chains";

// ── Backend signer for launching a raise ──────────────────────────────────
// Launching a raise is two on-chain writes (register_condition + create_vault).
// Client-side these both hit MetaMask's eth_sendTransaction, which MetaMask no
// longer implements — the same failure GitHub verification hit. GitHub verify
// is fixed by signing server-side with a service key, so we do the same here:
// the signer key is held server-side and the user never signs a transaction.
//
// Rationale: GitHub verify already uses a server signer (GITHUB_VERIFY_SIGNER_KEY)
// successfully, so we reuse that signer for raise creation. The raise's team
// wallet (where GEN is released to) is still the user-supplied address — the
// backend just relays/creates the on-chain record with the service key.

const RPC_URL: string =
  process.env.NEXT_PUBLIC_GENLAYER_RPC_URL || "https://studio-next.genlayer.com/api";
const SIGNER_KEY: string | undefined =
  process.env.GITHUB_VERIFY_SIGNER_KEY?.trim();
const VAULT_CONTRACT: string | undefined = process.env.NEXT_PUBLIC_VAULT_CONTRACT;
const CONDITION_CONTRACT: string | undefined =
  process.env.NEXT_PUBLIC_CONDITION_CONTRACT;

function getClient() {
  if (!SIGNER_KEY) {
    throw new Error("Raise backend not configured (GITHUB_VERIFY_SIGNER_KEY missing)");
  }
  const chain = { ...studioDevnet, rpcUrls: { default: { http: [RPC_URL] } } };
  return createClient({
    chain,
    endpoint: RPC_URL,
    account: createAccount(SIGNER_KEY as `0x${string}`),
  });
}

const j = (v: unknown) =>
  JSON.stringify(v, (_k, x) => (typeof x === "bigint" ? x.toString() : x));

interface RaiseCreateRequest {
  id: string; // vault id (namespaced to project)
  team_address: string; // where funds release to
  deadline: string; // unix seconds (string)
  condition: string; // deliverable condition
  check_url: string; // source-of-truth URL the validator checks
}

export async function POST(req: Request) {
  let body: RaiseCreateRequest;
  try {
    body = (await req.json()) as RaiseCreateRequest;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { id, team_address, deadline, condition, check_url } = body || {};
  if (!id || !team_address || !deadline || !condition || !check_url) {
    return NextResponse.json(
      { error: "id, team_address, deadline, condition, and check_url are required" },
      { status: 400 }
    );
  }
  if (!VAULT_CONTRACT || !CONDITION_CONTRACT) {
    return NextResponse.json(
      { error: "Vault/Condition contracts not configured on server" },
      { status: 500 }
    );
  }

  try {
    const client = getClient();

    // 1. Register the condition with the governor (backend-signed).
    const regFees = await client.estimateTransactionFees({});
    const regTx = await client.writeContract({
      address: CONDITION_CONTRACT as `0x${string}`,
      functionName: "register_condition",
      args: [id, check_url, condition, team_address],
      fees: regFees,
    });
    const regReceipt = await client.waitForTransactionReceipt({
      hash: regTx,
      waitUntil: "finalized",
      retries: 400,
      interval: 5000,
    });
    if (!isSuccessful(regReceipt)) {
      const detail = (regReceipt as any);
      const why = detail?.txExecutionError || detail?.error || "";
      return NextResponse.json(
        { error: `Register condition failed on-chain: ${j(why) || "see on-chain receipt"}` },
        { status: 502 }
      );
    }

    // 2. Create the vault, reusing the same id (backend-signed).
    const cvFees = await client.estimateTransactionFees({});
    const cvTx = await client.writeContract({
      address: VAULT_CONTRACT as `0x${string}`,
      functionName: "create_vault",
      args: [id, team_address, deadline, condition, CONDITION_CONTRACT],
      fees: cvFees,
    });
    const cvReceipt = await client.waitForTransactionReceipt({
      hash: cvTx,
      waitUntil: "finalized",
      retries: 400,
      interval: 5000,
    });
    if (!isSuccessful(cvReceipt)) {
      return NextResponse.json(
        { error: `Create vault failed on-chain: ${j((cvReceipt as any).txExecutionError ?? "")}` },
        { status: 502 }
      );
    }

    return NextResponse.json({ id });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Could not launch raise" },
      { status: 502 }
    );
  }
}