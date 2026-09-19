import { NextResponse } from "next/server";
import {
  createClient,
  createAccount,
  isSuccessful,
} from "genlayer-js";
import { studioDevnet } from "genlayer-js/chains";

// ── Backend signer for GitHub verification ────────────────────────────────
// The GitHubVerifier contract is designed to be driven from the ShipGuard
// backend ("Called by the ShipGuard backend"). We sign `submit`/`verify`
// with a service private key held server-side, so the user never has to sign
// a transaction (MetaMask dropped eth_sendTransaction, which broke the old
// client-side writeContract path).

const RPC_URL: string =
  process.env.NEXT_PUBLIC_GENLAYER_RPC_URL || "https://studio-next.genlayer.com/api";
const SIGNER_KEY: string | undefined = process.env.GITHUB_VERIFY_SIGNER_KEY?.trim();
const CONTRACT: string | undefined = process.env.NEXT_PUBLIC_GITHUB_VERIFY_CONTRACT;

function getClient() {
  if (!SIGNER_KEY) {
    throw new Error("GitHub verify backend not configured (GITHUB_VERIFY_SIGNER_KEY missing)");
  }
  const chain = { ...studioDevnet, rpcUrls: { default: { http: [RPC_URL] } } };
  return createClient({
    chain,
    endpoint: RPC_URL,
    account: createAccount(SIGNER_KEY as `0x${string}`),
  });
}

interface VerifyRequest {
  address: string; // wallet being verified
  handle: string; // claimed GitHub username
  code: string; // one-time code user published in a public gist
}

// Read-only on-chain status check (no signing required, but route server-side
// for the same RPC access).
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const wallet = searchParams.get("wallet");
  if (!wallet) {
    return NextResponse.json({ error: "wallet query param is required" }, { status: 400 });
  }
  if (!CONTRACT) {
    return NextResponse.json({ verifiedHandle: "" }, { status: 200 });
  }
  try {
    const client = getClient();
    const h = await client.readContract({
      address: CONTRACT as `0x${string}`,
      functionName: "get_gh_handle",
      args: [wallet],
    });
    const handle = typeof h === "string" ? h : String(h ?? "");
    return NextResponse.json({ verifiedHandle: handle });
  } catch {
    return NextResponse.json({ verifiedHandle: "" }, { status: 200 });
  }
}

export async function POST(req: Request) {
  let body: VerifyRequest;
  try {
    body = (await req.json()) as VerifyRequest;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { address, handle, code } = body || {};
  if (!address || !handle || !code) {
    return NextResponse.json(
      { error: "address, handle, and code are required" },
      { status: 400 },
    );
  }
  if (!CONTRACT) {
    return NextResponse.json(
      { error: "GitHub verify contract not configured on server" },
      { status: 500 },
    );
  }

  try {
    const ghHandle = handle.trim().replace(/^@/, "");

    // 1. Fetch the GitHub user profile (identity pin) — server-side.
    //    Never trust client-supplied user data; re-derive from GitHub API.
    const userRes = await fetch(
      `https://api.github.com/users/${encodeURIComponent(ghHandle)}`,
      { headers: { Accept: "application/vnd.github+json" } },
    );
    if (userRes.status === 404) {
      return NextResponse.json({ error: `GitHub user "@${ghHandle}" not found` }, { status: 404 });
    }
    if (!userRes.ok) {
      return NextResponse.json(
        { error: `GitHub API error (HTTP ${userRes.status})` },
        { status: 502 },
      );
    }
    const user = await userRes.json();

    // 2. Scan the user's public gists for the one-time code.
    let gistFound = false;
    let gistUrl = "";
    const gistsRes = await fetch(
      `https://api.github.com/users/${encodeURIComponent(ghHandle)}/gists?per_page=100`,
      { headers: { Accept: "application/vnd.github+json" } },
    );
    if (gistsRes.ok) {
      const gists = (await gistsRes.json()) as Array<{ files: Record<string, { content?: string }>; html_url: string }>;
      for (const g of gists) {
        for (const f of Object.values(g.files || {})) {
          if (f?.content && f.content.includes(code)) {
            gistFound = true;
            gistUrl = g.html_url;
            break;
          }
        }
        if (gistFound) break;
      }
    }

    const client = getClient();
    const j = (v: unknown) =>
      JSON.stringify(v, (_k, x) => (typeof x === "bigint" ? x.toString() : x));

    // 3. submit — record the evidence on-chain (backend-signed).
    const submitFees = await client.estimateTransactionFees({});
    const submitTx = await client.writeContract({
      address: CONTRACT as `0x${string}`,
      functionName: "submit",
      args: [
        address,
        ghHandle,
        code,
        user.login,
        user.type,
        user.html_url,
        gistFound,
        gistUrl,
      ],
      fees: submitFees,
    });
    const submitReceipt = await client.waitForTransactionReceipt({
      hash: submitTx,
      waitUntil: "finalized",
      retries: 400,
      interval: 5000,
    });
    if (!isSuccessful(submitReceipt)) {
      return NextResponse.json(
        { error: `Submit failed on-chain: ${j((submitReceipt as any).txExecutionError ?? "")}` },
        { status: 502 },
      );
    }

    // 4. verify — run AI consensus to finalize ownership (backend-signed).
    const verifyFees = await client.estimateTransactionFees({});
    const verifyTx = await client.writeContract({
      address: CONTRACT as `0x${string}`,
      functionName: "verify",
      args: [address],
      fees: verifyFees,
    });
    const verifyReceipt = await client.waitForTransactionReceipt({
      hash: verifyTx,
      waitUntil: "finalized",
      retries: 400,
      interval: 5000,
    });
    if (!isSuccessful(verifyReceipt)) {
      return NextResponse.json(
        { error: `Verify failed on-chain: ${j((verifyReceipt as any).txExecutionError ?? "")}` },
        { status: 502 },
      );
    }

    // 5. Read back the on-chain handle to confirm.
    let got = "";
    try {
      const h = await client.readContract({
        address: CONTRACT as `0x${string}`,
        functionName: "get_gh_handle",
        args: [address],
      });
      got = typeof h === "string" ? h : String(h ?? "");
    } catch {
      got = "";
    }

    if (!got) {
      return NextResponse.json(
        { error: "Verification did not resolve to an on-chain handle" },
        { status: 502 },
      );
    }

    return NextResponse.json({ verifiedHandle: got });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "GitHub verification failed" },
      { status: 502 },
    );
  }
}