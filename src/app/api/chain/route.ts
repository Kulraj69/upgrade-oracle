import { readJson } from "@/lib/http";
import { InputError } from "@/lib/errors";
import { addressBytecode, decodeRawTransaction, networkFromQuery, validTxid } from "@/lib/bch/seal";
import { fetchUtxos, fetchTransaction, broadcastTransaction } from "@/lib/bch/network";
import { binToHex } from "@bitauth/libauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return Response.json({ error: "Please send application/json." }, { status: 415, headers });
  try {
    const data = await readJson(request);
    if (!data || typeof data !== "object") throw new InputError("Invalid chain request.");
    const input = data as Record<string, unknown>;
    if (input.net !== "chipnet" && input.net !== "mainnet") throw new InputError("Choose chipnet or mainnet.");
    const net = networkFromQuery(input.net);
    if (input.action === "utxos" && typeof input.address === "string") {
      try { addressBytecode(input.address, net); } catch { throw new InputError("Address does not match this network."); }
      const utxos = await fetchUtxos(input.address, net);
      return Response.json({ utxos: utxos.map((u) => ({ ...u, valueSatoshis: u.valueSatoshis.toString(), lockingBytecode: binToHex(u.lockingBytecode) })) }, { headers });
    }
    if (input.action === "transaction" && typeof input.txid === "string" && validTxid(input.txid))
      return Response.json(await fetchTransaction(input.txid.toLowerCase(), net), { headers });
    if (input.action === "broadcast" && typeof input.hex === "string" && input.hex.length <= 100_000) {
      try { decodeRawTransaction(input.hex); } catch { throw new InputError("Invalid transaction encoding."); }
      return Response.json({ txid: await broadcastTransaction(input.hex, net) }, { headers });
    }
    throw new InputError("Unsupported chain request.");
  } catch (error) {
    return Response.json({ error: error instanceof InputError ? error.message : "The Electrum request could not complete. Check the network and retry. If broadcasting, check the transaction ID before retrying; it may already be on chain." },
      { status: error instanceof InputError ? error.status : 502, headers });
  }
}
