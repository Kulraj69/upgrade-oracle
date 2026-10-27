import { ElectrumClient, type RPCParameter, type ElectrumClientEvents } from "@electrum-cash/network";
import { binToHex } from "@bitauth/libauth";
import { addressBytecode, decodeRawTransaction, hashHex, transactionId, validTxid, type SealUtxo } from "./seal";
import type { BchNetwork } from "./types";

const servers: Record<BchNetwork, string[]> = {
  chipnet: ["chipnet.bch.ninja", "chipnet.imaginary.cash"],
  mainnet: ["bch.imaginary.cash", "electrum.bch.ninja"],
};
async function deadline<T>(work: Promise<T>, ms = 7000): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  try { return await Promise.race([work, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Electrum request timed out.")), ms); })]); }
  finally { clearTimeout(timer!); }
}
export async function withElectrum<T>(network: BchNetwork, run: (client: ElectrumClient<ElectrumClientEvents>) => Promise<T>): Promise<T> {
  for (const host of servers[network]) {
    const client = new ElectrumClient("Upgrade Oracle", "1.5.0", host, {
      port: 50004, encrypted: true, timeoutInMilliSeconds: 4500, verifyConnectionTimeoutInMilliSeconds: 7000,
    });
    client.on("error", () => {});
    try {
      await deadline(client.connect());
      return await run(client);
    } catch { /* Public endpoints can be unavailable; try the other pinned host. */ }
    finally { await deadline(client.disconnect(), 2000).catch(() => {}); }
  }
  throw new Error(`Could not complete the ${network} Electrum request. The server may be unavailable or the transaction may not exist on this network.`);
}
export async function rpc(client: ElectrumClient<ElectrumClientEvents>, method: string, ...params: RPCParameter[]): Promise<unknown> {
  return deadline(client.request(method, ...params));
}
export async function rawTransaction(client: ElectrumClient<ElectrumClientEvents>, txid: string) {
  if (!validTxid(txid)) throw new Error("Invalid transaction ID.");
  const hex = await rpc(client, "blockchain.transaction.get", txid);
  if (typeof hex !== "string") throw new Error("Electrum returned an invalid transaction.");
  decodeRawTransaction(hex);
  if (transactionId(hex) !== txid.toLowerCase()) throw new Error("Electrum transaction hash mismatch.");
  return hex;
}
export async function fetchUtxos(address: string, network: BchNetwork): Promise<SealUtxo[]> {
  const lockingBytecode = addressBytecode(address, network);
  const scripthash = hashHex(lockingBytecode).match(/../g)!.reverse().join("");
  return withElectrum(network, async (client) => {
    const result = await rpc(client, "blockchain.scripthash.listunspent", scripthash, "include_tokens");
    if (!Array.isArray(result) || result.length > 50) throw new Error("Use an address with at most 50 UTXOs.");
    const utxos: SealUtxo[] = [];
    const cache = new Map<string, string>();
    for (const item of result) {
      if (!item || !validTxid(item.tx_hash) || !Number.isSafeInteger(item.tx_pos) || item.tx_pos < 0)
        throw new Error("Malformed Electrum UTXO.");
      let raw = cache.get(item.tx_hash);
      if (!raw) { raw = await rawTransaction(client, item.tx_hash); cache.set(item.tx_hash, raw); }
      const tx = decodeRawTransaction(raw);
      const output = tx.outputs[item.tx_pos];
      if (!output || binToHex(output.lockingBytecode) !== binToHex(lockingBytecode)) throw new Error("Electrum output does not belong to this address.");
      // Never select token-bearing or coinbase outputs. Values come from the
      // hash-checked transaction, not the listunspent response's numeric field.
      if (output.token || tx.inputs.some((input) => input.outpointIndex === 0xffffffff && input.outpointTransactionHash.every((b) => b === 0))) continue;
      utxos.push({ txid: item.tx_hash, vout: item.tx_pos, ...output });
    }
    return utxos;
  });
}
export async function fetchTransaction(txid: string, network: BchNetwork) {
  return withElectrum(network, async (client) => {
    const hex = await rawTransaction(client, txid);
    const tx = decodeRawTransaction(hex);
    const output = tx.outputs[0];
    let height: number | null = null;
    if (output) {
      const script = hashHex(output.lockingBytecode).match(/../g)!.reverse().join("");
      const history = await rpc(client, "blockchain.scripthash.get_history", script);
      if (Array.isArray(history)) {
        const item = history.find((item) => item.tx_hash === txid.toLowerCase());
        if (item && Number.isSafeInteger(item.height)) height = item.height;
      }
    }
    return { hex, height };
  });
}
export async function broadcastTransaction(hex: string, network: BchNetwork) {
  decodeRawTransaction(hex);
  const expected = transactionId(hex);
  return withElectrum(network, async (client) => {
    const result = await rpc(client, "blockchain.transaction.broadcast", hex);
    if (result !== expected) throw new Error("Broadcast did not return the expected transaction ID.");
    return expected;
  });
}
