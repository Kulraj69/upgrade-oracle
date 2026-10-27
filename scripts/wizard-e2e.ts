/** Local encrypted WizardConnect round trip. No mainnet branch or key exists.
 * Optional --chipnet probes Electrum using the resulting testnet address; it
 * broadcasts only if that fresh address actually has a spendable chipnet UTXO.
 * No protocol payloads, pairing secrets, xpubs or private keys are logged.
 */
import { randomBytes } from "node:crypto";
import { mkdtemp, writeFile, rm, mkdir } from "node:fs/promises";
import { WebSocketServer, WebSocket } from "ws";
import { once } from "node:events";
import assert from "node:assert/strict";
import {
  binToHex, deriveHdPrivateNodeFromSeed, deriveHdPath, deriveHdPathRelative,
  deriveHdPublicNode, encodeHdPublicKey, encodeTransaction, encodeDataPush,
  flattenBinArray, generateSigningSerializationBch, secp256k1, sha256,
} from "@bitauth/libauth";
import { initiateDappRelay, toBigInt, toUint8Array, type SignTransactionRequest } from "@wizardconnect/core";
import { DappConnectionManager } from "@wizardconnect/dapp";
import { WalletConnectionManager, type WalletAdapter } from "@wizardconnect/wallet";
import { addressBytecode, buildSealPlan, commitmentForReport, decodeRawTransaction, receiveAddress, validateSignedTransaction, wizardSignRequest, findSeals, type SealPlan } from "../src/lib/bch/seal";
import { fetchUtxos, broadcastTransaction } from "../src/lib/bch/network";
import reportJson from "../src/lib/bch/examples/recurring-payment.report.json";
import type { DoctorReport } from "../src/lib/bch/types";

// Minimal in-memory NIP-01 relay. The real WizardConnect SDK encrypts, signs,
// serializes and validates events across actual localhost WebSockets.
type RelayEvent = { id: string; kind: number; pubkey: string; created_at: number; tags: string[][]; content: string };
type Filter = { kinds?: number[]; authors?: string[]; since?: number; "#p"?: string[] };
function matches(event: RelayEvent, filter: Filter) {
  return (!filter.kinds || filter.kinds.includes(event.kind)) &&
    (!filter.authors || filter.authors.includes(event.pubkey)) &&
    (!filter.since || event.created_at >= filter.since) &&
    (!filter["#p"] || event.tags.some((tag) => tag[0] === "p" && filter["#p"]!.includes(tag[1])));
}
async function relayServer() {
  const server = new WebSocketServer({ host: "127.0.0.1", port: 0 });
  await once(server, "listening");
  const address = server.address(); assert(address && typeof address !== "string");
  const events: RelayEvent[] = [];
  const subscriptions = new Map<WebSocket, Map<string, Filter[]>>();
  server.on("connection", (socket) => {
    subscriptions.set(socket, new Map());
    socket.on("close", () => subscriptions.delete(socket));
    socket.on("message", (bytes) => {
      const [type, id, ...args] = JSON.parse(bytes.toString());
      if (type === "REQ") {
        subscriptions.get(socket)!.set(id, args);
        for (const event of events) if (args.some((filter: Filter) => matches(event, filter))) socket.send(JSON.stringify(["EVENT", id, event]));
        socket.send(JSON.stringify(["EOSE", id]));
      } else if (type === "CLOSE") subscriptions.get(socket)?.delete(id);
      else if (type === "EVENT") {
        const event = id as RelayEvent; events.push(event);
        socket.send(JSON.stringify(["OK", event.id, true, ""]));
        for (const [peer, subs] of subscriptions) for (const [subscription, filters] of subs)
          if (peer.readyState === WebSocket.OPEN && filters.some((filter) => matches(event, filter))) peer.send(JSON.stringify(["EVENT", subscription, event]));
      }
    });
  });
  return { server, url: `ws://127.0.0.1:${address.port}` };
}
async function timeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  try { return await Promise.race([promise, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("E2E step timed out.")), ms); })]); }
  finally { clearTimeout(timer!); }
}
async function main() {
  // SDK logging is disabled for this entire process. No raw error object is
  // emitted either: relay failures may include private pairing metadata.
  console.log = console.info = console.warn = console.error = console.debug = () => {};
  const temporary = await mkdtemp("/tmp/oracle-chipnet-");
  const seed = randomBytes(32);
  await writeFile(`${temporary}/seed`, seed, { mode: 0o600 });
  const root = deriveHdPrivateNodeFromSeed(seed);
  const account = deriveHdPath(root, "m/44'/1'/0'");
  const node = (path: number, index?: number) => deriveHdPathRelative(account, index === undefined ? `${path}` : `${path}/${index}`);
  const relayIdentity = randomBytes(32);
  let currentPlan: SealPlan | null = null;
  let adapterStep = "not received";
  const adapter: WalletAdapter = {
    walletName: "Oracle ephemeral chipnet test wallet", walletIcon: "",
    getRelayPrivateKey: () => relayIdentity,
    getPublicKey: (path, index) => deriveHdPublicNode(node(path, Number(index))).publicKey,
    getXpub: (path) => encodeHdPublicKey({ node: deriveHdPublicNode(node(path)), network: "testnet" }).hdPublicKey,
    async signTransaction(request: SignTransactionRequest) {
      adapterStep = "validate request";
      assert(currentPlan?.network === "chipnet");
      assert.equal(request.transaction.broadcast, false);
      const tx = typeof request.transaction.transaction === "string" ? decodeRawTransaction(request.transaction.transaction) : structuredClone(request.transaction.transaction);
      const sourceOutputs = request.transaction.sourceOutputs.map((o) => ({ ...o, valueSatoshis: toBigInt(o.valueSatoshis), lockingBytecode: toUint8Array(o.lockingBytecode) }));
      for (const [inputIndex, path, index] of request.inputPaths) {
        assert.equal(path, "receive");
        const key = node(0, index);
        adapterStep = "serialize sighash";
        const preimage = generateSigningSerializationBch({ transaction: tx, sourceOutputs, inputIndex }, { coveredBytecode: sourceOutputs[inputIndex].lockingBytecode, signingSerializationType: Uint8Array.of(0x61) });
        adapterStep = "sign preimage";
        const signature = secp256k1.signMessageHashSchnorr(key.privateKey, sha256.hash(sha256.hash(preimage)));
        if (typeof signature === "string") throw new Error("Signing failed.");
        tx.inputs[inputIndex].unlockingBytecode = flattenBinArray([encodeDataPush(Uint8Array.from([...signature, 0x61])), encodeDataPush(deriveHdPublicNode(key).publicKey)]);
      }
      adapterStep = "validate wallet result";
      const hex = binToHex(encodeTransaction(tx)); validateSignedTransaction(currentPlan!, hex);
      adapterStep = "signed successfully";
      return { signedTransaction: hex };
    },
  };
  const { server, url } = await relayServer();
  const dapp = new DappConnectionManager("Oracle E2E", undefined, { session: false });
  const wallet = new WalletConnectionManager(adapter);
  const ready = new Promise<void>((resolve) => dapp.once("walletready", () => resolve()));
  const relay = initiateDappRelay(({ client, status }) => dapp.updateConnection(client, status), { explicitRelayUrls: [url], maxReconnectAttempts: 1 });
  wallet.on("pendingSignRequest", ({ connectionId, request }) => {
    adapter.signTransaction(request).then((r) => wallet.sendSignResponse(connectionId, request.sequence, r.signedTransaction))
      .catch(() => wallet.sendSignError(connectionId, request.sequence, "Test wallet rejected the request."));
  });
  let step = "handshake";
  try {
    wallet.connect(relay.uri);
    await timeout(ready, 20_000);
    step = "derive receive key";
    const publicKey = dapp.getPubkey(0, 0n); assert(publicKey);
    assert.equal(binToHex(publicKey), binToHex(adapter.getPublicKey(0, 0n)));
    const address = receiveAddress(publicKey, "chipnet");
    currentPlan = buildSealPlan({ network: "chipnet", address, commitment: commitmentForReport(reportJson as DoctorReport), utxos: [{ txid: "12".repeat(32), vout: 0, valueSatoshis: 12_000n, lockingBytecode: addressBytecode(address, "chipnet") }] });
    step = "sign round trip";
    const response = await timeout(dapp.signTransaction(wizardSignRequest(currentPlan)), 15_000);
    step = "validate signed transaction";
    const offlineTxid = validateSignedTransaction(currentPlan, response.signedTransaction);
    assert.equal(findSeals(response.signedTransaction).length, 1);
    await mkdir("artifacts", { recursive: true });
    // Public fake transaction artifact only. Explicitly never a live recording.
    await writeFile("artifacts/wizard-offline-transaction.json", JSON.stringify({ kind: "offline-fake-utxo", hex: response.signedTransaction, txid: offlineTxid }) + "\n");
    process.stdout.write("PASS: encrypted WizardConnect handshake, xpub derivation, signing round trip, immutable NFT commitment, and BCH 2026 VM verification.\n");
    process.stdout.write("Offline fake UTXO transaction only; no on-chain txid is claimed.\n");
    if (process.argv.includes("--chipnet")) {
      try {
        const utxos = await fetchUtxos(address, "chipnet");
        if (!utxos.length) { process.stdout.write("Chipnet reachable; fresh runtime address has no funds. No broadcast.\n"); return; }
        currentPlan = buildSealPlan({ utxos, network: "chipnet", address, commitment: commitmentForReport(reportJson as DoctorReport) });
        const signed = await timeout(dapp.signTransaction(wizardSignRequest(currentPlan)), 15_000);
        validateSignedTransaction(currentPlan, signed.signedTransaction);
        const txid = await broadcastTransaction(signed.signedTransaction, "chipnet");
        process.stdout.write(`Chipnet broadcast: ${txid}\n`);
      } catch { process.stdout.write("Chipnet lookup/broadcast unavailable. No live transaction is claimed; see NOTES-bch.md.\n"); }
    }
  } catch {
    process.stderr.write(`E2E failed at: ${step}; wallet step: ${adapterStep}.\n`);
    throw new Error("E2E failed.");
  } finally {
    await rm(temporary, { recursive: true, force: true });
    await dapp.sendDisconnect().catch(() => {});
    wallet.disconnectAll();
    await new Promise((resolve) => setTimeout(resolve, 350));
    dapp.destroy(); relay.cleanup();
    for (const client of server.clients) client.terminate();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await rm(temporary, { recursive: true, force: true }); seed.fill(0); relayIdentity.fill(0);
  }
}
process.on("uncaughtException", () => { process.stderr.write("Wizard SDK transport error; no payload logged.\n"); process.exit(1); });
main().then(() => process.exit(0)).catch(() => { process.stderr.write("WizardConnect E2E failed. No secret or protocol payload was logged.\n"); process.exit(1); });
