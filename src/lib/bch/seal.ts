import {
  binToHex,
  hexToBin,
  sha256,
  utf8ToBin,
  cashAddressToLockingBytecode,
  lockingBytecodeToCashAddress,
  encodeLockingBytecodeP2pkh,
  hash160,
  encodeTransaction,
  decodeTransaction,
  hashTransaction,
  decodeAuthenticationInstructions,
  authenticationInstructionsAreMalformed,
  createVirtualMachineBch2026,
  type Transaction,
  type Output,
} from "@bitauth/libauth";
import { sourceOutputToRelay } from "@wizardconnect/core/hdwalletv1-serialize";
import type { SignTransactionRequest } from "@wizardconnect/core";
import type { BchNetwork, DoctorReport } from "./types";

export const RULESET_VERSION = 1;
export const SEAL_SATS = 1000n;
export const SERVICE_FEE_SATS = 1000n;
export const SIGHASH = 0x61; // ALL | FORKID | UTXOS, required by hdwalletv1.
const MAX_SATS = 2_100_000_000_000_000n;

// Sorted object keys, original array order, UTF-8, no whitespace. Reports use
// JSON primitives only and integers within the interoperable safe range.
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "string")
    return JSON.stringify(value);
  if (typeof value === "number" && Number.isSafeInteger(value))
    return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (
    value &&
    typeof value === "object" &&
    Object.getPrototypeOf(value) === Object.prototype
  )
    return `{${Object.keys(value)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${canonicalJson((value as Record<string, unknown>)[key])}`,
      )
      .join(",")}}`;
  throw new Error("Report contains a value outside the canonical JSON format.");
}
export function hashHex(bytes: Uint8Array) {
  return binToHex(sha256.hash(bytes));
}
export function reportHash(report: unknown) {
  return hashHex(utf8ToBin(canonicalJson(report)));
}
export function reportFlags(report: DoctorReport) {
  return report.findings.reduce(
    (flags, finding) =>
      flags | { opportunity: 1, watch: 2, risk: 4 }[finding.severity],
    0,
  );
}
export function commitmentForReport(report: DoctorReport): Uint8Array {
  validateReport(report);
  return Uint8Array.from([
    ...hexToBin(reportHash(report)),
    ...sha256.hash(hexToBin(report.contract.bytecode)),
    RULESET_VERSION,
    reportFlags(report),
  ]);
}
export function validateReport(value: unknown): asserts value is DoctorReport {
  if (!value || typeof value !== "object")
    throw new Error("Choose a Contract Doctor report JSON.");
  const report = value as DoctorReport;
  if (
    report.schema !== "upgrade-oracle/bch-report-v1" ||
    report.rulesetVersion !== 1 ||
    !report.contract ||
    typeof report.contract.bytecode !== "string" ||
    !/^(?:[a-f0-9]{2})+$/i.test(report.contract.bytecode) ||
    report.contract.bytecode.length > 200_000 ||
    !Array.isArray(report.findings) ||
    report.findings.some(
      (f) => !f || !["risk", "watch", "opportunity"].includes(f.severity),
    )
  )
    throw new Error("This is not a supported Contract Doctor report.");
}
export function decodeCommitment(commitment: Uint8Array) {
  if (commitment.length !== 66)
    throw new Error("Expected a 66-byte Oracle commitment.");
  if (commitment[64] !== RULESET_VERSION || (commitment[65] & ~7) !== 0)
    throw new Error("Unsupported ruleset version or flags.");
  return {
    reportHash: binToHex(commitment.slice(0, 32)),
    bytecodeHash: binToHex(commitment.slice(32, 64)),
    rulesetVersion: commitment[64],
    flags: commitment[65],
  };
}
export function networkFromQuery(value: string | null | undefined): BchNetwork {
  if (!value || value === "chipnet") return "chipnet";
  if (value === "mainnet") return "mainnet";
  throw new Error("Network must be chipnet or mainnet.");
}
export function validTxid(txid: string) {
  return /^[a-f0-9]{64}$/i.test(txid);
}
export function explorerUrl(txid: string, network: BchNetwork) {
  if (!validTxid(txid)) throw new Error("Invalid transaction ID.");
  return network === "chipnet"
    ? `https://chipnet.chaingraph.cash/tx/${txid}`
    : `https://blockchair.com/bitcoin-cash/transaction/${txid}`;
}
export function receiveAddress(publicKey: Uint8Array, network: BchNetwork) {
  if (publicKey.length !== 33 || ![2, 3].includes(publicKey[0]))
    throw new Error("Wallet must provide a compressed public key.");
  const result = lockingBytecodeToCashAddress({
    bytecode: encodeLockingBytecodeP2pkh(hash160(publicKey)),
    prefix: network === "chipnet" ? "bchtest" : "bitcoincash",
    tokenSupport: true,
  });
  if (typeof result === "string")
    throw new Error("Could not derive receive address.");
  return result.address;
}
export function addressBytecode(
  address: string,
  network: BchNetwork,
): Uint8Array {
  const result = cashAddressToLockingBytecode(address);
  if (
    typeof result === "string" ||
    result.prefix !== (network === "chipnet" ? "bchtest" : "bitcoincash")
  )
    throw new Error("Address does not match the selected network.");
  return result.bytecode;
}
export type SealUtxo = {
  txid: string;
  vout: number;
  valueSatoshis: bigint;
  lockingBytecode: Uint8Array;
  token?: Output["token"];
};
export type SealPlan = {
  kind: "seal" | "prepare";
  network: BchNetwork;
  transaction: Transaction;
  sourceOutputs: Output[];
  feeSatoshis: bigint;
  serviceFeeSatoshis: bigint;
  addressIndex: number;
};
export class NeedsGenesisUtxo extends Error {
  constructor() {
    super(
      "No spendable vout-0 UTXO at this receive address. Prepare a self-send to create one, then seal the report.",
    );
  }
}

export function buildSealPlan(options: {
  utxos: SealUtxo[];
  address: string;
  network: BchNetwork;
  commitment?: Uint8Array;
  prepare?: boolean;
  feeAddress?: string;
  addressIndex?: number;
}): SealPlan {
  const { network, address, commitment, prepare = false } = options;
  const lockingBytecode = addressBytecode(address, network);
  if (
    lockingBytecode.length !== 25 ||
    lockingBytecode[0] !== 0x76 ||
    lockingBytecode[24] !== 0xac
  )
    throw new Error("Sealing requires the wallet's P2PKH receive address.");
  const addressIndex = options.addressIndex ?? 0;
  if (
    !Number.isSafeInteger(addressIndex) ||
    addressIndex < 0 ||
    addressIndex >= 0x80000000
  )
    throw new Error("Invalid receive address index.");
  if (!prepare) {
    if (!commitment) throw new Error("A report commitment is required.");
    decodeCommitment(commitment);
  }
  const seen = new Set<string>();
  const available = options.utxos
    .filter((u) => !u.token)
    .map((u) => {
      const outpoint = `${u.txid}:${u.vout}`;
      if (
        !validTxid(u.txid) ||
        !Number.isSafeInteger(u.vout) ||
        u.vout < 0 ||
        u.vout > 0xffffffff ||
        u.valueSatoshis <= 0n ||
        u.valueSatoshis > MAX_SATS ||
        binToHex(u.lockingBytecode) !== binToHex(lockingBytecode) ||
        seen.has(outpoint)
      )
        throw new Error("Invalid, duplicate, or foreign UTXO.");
      seen.add(outpoint);
      return u;
    })
    .sort((a, b) =>
      a.valueSatoshis > b.valueSatoshis
        ? -1
        : a.valueSatoshis < b.valueSatoshis
          ? 1
          : a.txid.localeCompare(b.txid) || a.vout - b.vout,
    );
  if (!available.length)
    throw new Error(
      "Fund this receive address with test BCH on chipnet, or with your BCH on mainnet, then refresh.",
    );
  if (available.length > 50)
    throw new Error(
      "Too many UTXOs. Use a receive address with at most 50 plain BCH UTXOs.",
    );
  const genesis = available.find((u) => u.vout === 0);
  if (!prepare && !genesis) throw new NeedsGenesisUtxo();
  const ordered = prepare
    ? available
    : [genesis!, ...available.filter((u) => u !== genesis)];
  const selected: SealUtxo[] = [];
  const feeOutput =
    !prepare && options.feeAddress
      ? {
          lockingBytecode: addressBytecode(options.feeAddress, network),
          valueSatoshis: SERVICE_FEE_SATS,
        }
      : null;
  if (feeOutput && ![23, 25, 35].includes(feeOutput.lockingBytecode.length))
    throw new Error("Unsupported service fee address.");
  for (const utxo of ordered) {
    selected.push(utxo);
    const total = selected.reduce((sum, u) => sum + u.valueSatoshis, 0n);
    if (total > MAX_SATS) throw new Error("Invalid total input amount.");
    const inputs = selected.map((u) => ({
      outpointTransactionHash: hexToBin(u.txid),
      outpointIndex: u.vout,
      sequenceNumber: 0xffffffff,
      unlockingBytecode: new Uint8Array(),
    }));
    const outputs: Output[] = prepare
      ? [{ lockingBytecode, valueSatoshis: total }]
      : [
          {
            lockingBytecode,
            valueSatoshis: SEAL_SATS,
            token: {
              category: hexToBin(genesis!.txid),
              amount: 0n,
              nft: { capability: "none", commitment: commitment! },
            },
          },
          ...(feeOutput ? [feeOutput] : []),
          { lockingBytecode, valueSatoshis: 0n },
        ];
    const transaction: Transaction = {
      version: 2,
      locktime: 0,
      inputs,
      outputs,
    };
    // Reserve 110 bytes per P2PKH unlocking script (covers Schnorr and DER),
    // then use 2 sat/byte. No remainder is silently donated as a fee.
    const feeSatoshis = BigInt(
      encodeTransaction({
        ...transaction,
        inputs: inputs.map((i) => ({
          ...i,
          unlockingBytecode: new Uint8Array(110),
        })),
      }).length * 2,
    );
    const spend = prepare ? 0n : SEAL_SATS + (feeOutput?.valueSatoshis ?? 0n);
    const change = total - spend - feeSatoshis;
    if (change < (prepare ? 3000n : 1000n)) continue;
    outputs[outputs.length - 1].valueSatoshis = change;
    return {
      kind: prepare ? "prepare" : "seal",
      network,
      transaction,
      sourceOutputs: selected.map((u) => ({
        lockingBytecode: u.lockingBytecode,
        valueSatoshis: u.valueSatoshis,
      })),
      feeSatoshis,
      serviceFeeSatoshis: feeOutput?.valueSatoshis ?? 0n,
      addressIndex,
    };
  }
  throw new Error(
    "Insufficient plain BCH for the seal, fee and change. Add funds to this receive address.",
  );
}

export function wizardSignRequest(
  plan: SealPlan,
): Pick<SignTransactionRequest, "transaction" | "inputPaths"> {
  return {
    transaction: {
      transaction: binToHex(encodeTransaction(plan.transaction)),
      // The SDK protocol type describes native libauth data, but the relay
      // calls JSON.stringify directly. Use its documented wire serializer.
      sourceOutputs: plan.sourceOutputs.map((output, index) =>
        sourceOutputToRelay({ ...plan.transaction.inputs[index], ...output }),
      ) as unknown as SignTransactionRequest["transaction"]["sourceOutputs"],
      broadcast: false,
      userPrompt: `${plan.network.toUpperCase()}: ${plan.kind === "seal" ? "Seal Contract Doctor report" : "Prepare vout-0 self-send"}. Network fee ${plan.feeSatoshis} sat; service fee ${plan.serviceFeeSatoshis} sat. Sign ALL|FORKID|UTXOS (0x61).`,
    },
    inputPaths: plan.transaction.inputs.map((_, i) => [
      i,
      "receive",
      plan.addressIndex,
    ]),
  };
}

export function decodeRawTransaction(hex: string): Transaction {
  if (!/^(?:[a-f0-9]{2})+$/i.test(hex) || hex.length > 2_000_000)
    throw new Error("Invalid transaction encoding.");
  const decoded = decodeTransaction(hexToBin(hex));
  if (typeof decoded === "string")
    throw new Error("Could not decode the transaction.");
  return decoded;
}
export function transactionId(hex: string): string {
  return hashTransaction(hexToBin(hex));
}
export function validateSignedTransaction(
  plan: SealPlan,
  signedHex: string,
): string {
  const transaction = decodeRawTransaction(signedHex);
  const unsigned = {
    ...transaction,
    inputs: transaction.inputs.map((i) => ({
      ...i,
      unlockingBytecode: new Uint8Array(),
    })),
  };
  if (
    binToHex(encodeTransaction(unsigned)) !==
    binToHex(encodeTransaction(plan.transaction))
  )
    throw new Error(
      "Wallet changed the planned transaction. Nothing was broadcast.",
    );
  for (const input of transaction.inputs) {
    const instructions = decodeAuthenticationInstructions(
      input.unlockingBytecode,
    );
    if (
      authenticationInstructionsAreMalformed(instructions) ||
      instructions.length !== 2 ||
      !("data" in instructions[0]) ||
      instructions[0].data.at(-1) !== SIGHASH
    )
      throw new Error("Wallet must sign with ALL | FORKID | UTXOS (0x61).");
  }
  const result = createVirtualMachineBch2026().verify({
    transaction,
    sourceOutputs: plan.sourceOutputs,
  });
  if (result !== true)
    throw new Error(
      "Signed transaction failed BCH 2026 VM validation. Nothing was broadcast.",
    );
  const fee =
    plan.sourceOutputs.reduce((n, o) => n + o.valueSatoshis, 0n) -
    transaction.outputs.reduce((n, o) => n + o.valueSatoshis, 0n);
  if (fee !== plan.feeSatoshis || fee < BigInt(signedHex.length / 2))
    throw new Error("Signed transaction has an unexpected fee.");
  return transactionId(signedHex);
}

export function findSeals(hex: string) {
  const tx = decodeRawTransaction(hex);
  return tx.outputs.flatMap((output, index) => {
    const token = output.token;
    if (!token?.nft || token.nft.capability !== "none" || token.amount !== 0n)
      return [];
    // A matching genesis input is required. A transfer with a 66-byte payload
    // is not misrepresented as an original Oracle seal.
    if (
      !tx.inputs.some(
        (input) =>
          input.outpointIndex === 0 &&
          binToHex(input.outpointTransactionHash) === binToHex(token.category),
      )
    )
      return [];
    try {
      return [
        {
          outputIndex: index,
          category: binToHex(token.category),
          commitment: binToHex(token.nft.commitment),
          ...decodeCommitment(token.nft.commitment),
        },
      ];
    } catch {
      return [];
    }
  });
}
