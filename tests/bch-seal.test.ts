import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { binToHex, encodeTransaction, encodeDataPush, flattenBinArray, generateSigningSerializationBch, hexToBin, secp256k1, sha256, createVirtualMachineBch2026 } from "@bitauth/libauth";
import { addressBytecode, buildSealPlan, canonicalJson, commitmentForReport, decodeCommitment, decodeRawTransaction, findSeals, NeedsGenesisUtxo, receiveAddress, reportHash, validateSignedTransaction, wizardSignRequest, type SealPlan, type SealUtxo } from "@/lib/bch/seal";
import fixture from "@/lib/bch/examples/recurring-payment.report.json";
import type { DoctorReport } from "@/lib/bch/types";

const report = fixture as DoctorReport;
// Ephemeral chipnet-only signing material. Never serialized or printed.
const privateKey = randomBytes(32);
const publicKey = secp256k1.derivePublicKeyCompressed(privateKey);
if (typeof publicKey === "string") throw new Error("Test key generation failed.");
const address = receiveAddress(publicKey, "chipnet");
const lockingBytecode = addressBytecode(address, "chipnet");
const coin = (vout = 0, valueSatoshis = 12_000n, id?: string): SealUtxo => ({ txid: id ? id.repeat(32) : Array.from({ length: 32 }, (_, i) => i.toString(16).padStart(2, "0")).join(""), vout, valueSatoshis, lockingBytecode });
const planFor = (utxos = [coin()]) => buildSealPlan({ utxos, address, network: "chipnet", commitment: commitmentForReport(report) });
function sign(plan: SealPlan, sighash = 0x61) {
  const tx = structuredClone(plan.transaction);
  tx.inputs.forEach((input, inputIndex) => {
    const serialization = generateSigningSerializationBch({ transaction: tx, sourceOutputs: plan.sourceOutputs, inputIndex }, { coveredBytecode: plan.sourceOutputs[inputIndex].lockingBytecode, signingSerializationType: Uint8Array.of(sighash) });
    const signature = secp256k1.signMessageHashSchnorr(privateKey, sha256.hash(sha256.hash(serialization)));
    if (typeof signature === "string") throw new Error("Test signing failed.");
    input.unlockingBytecode = flattenBinArray([encodeDataPush(Uint8Array.from([...signature, sighash])), encodeDataPush(publicKey as Uint8Array)]);
  });
  return binToHex(encodeTransaction(tx));
}

describe("canonical commitments", () => {
  it("sorts keys, preserves array order and unicode, and rejects ambiguous values", () => {
    expect(canonicalJson({ z: [2, 1], a: "✦" })).toBe('{"a":"✦","z":[2,1]}');
    expect(reportHash({ a: 1, b: 2 })).toBe(reportHash({ b: 2, a: 1 }));
    expect(() => canonicalJson({ a: undefined })).toThrow();
    expect(() => canonicalJson(NaN)).toThrow();
    expect(() => canonicalJson(1.5)).toThrow();
  });
  it("encodes both hashes, ruleset, and flags in 66 bytes", () => {
    const commitment = commitmentForReport(report);
    const decoded = decodeCommitment(commitment);
    expect(commitment).toHaveLength(66);
    expect(decoded).toMatchObject({ reportHash: reportHash(report), bytecodeHash: binToHex(sha256.hash(hexToBin(report.contract.bytecode))), rulesetVersion: 1, flags: 2 });
    const edited = structuredClone(report); edited.contract.source += "\n";
    expect(commitmentForReport(edited)).not.toEqual(commitment);
    expect(() => decodeCommitment(new Uint8Array(128))).toThrow();
    const unknown = commitment.slice(); unknown[64] = 2;
    expect(() => decodeCommitment(unknown)).toThrow();
    unknown[64] = 1; unknown[65] = 128;
    expect(() => decodeCommitment(unknown)).toThrow();
  });
});

describe("immutable NFT genesis and signing", () => {
  it("builds and signs a real transaction which passes the BCH 2026 VM", () => {
    const plan = planFor();
    const hex = sign(plan);
    expect(hex.slice(10, 74)).toBe(binToHex(hexToBin(coin().txid).reverse()));
    expect(validateSignedTransaction(plan, hex)).toMatch(/^[a-f0-9]{64}$/);
    expect(createVirtualMachineBch2026().verify({ transaction: decodeRawTransaction(hex), sourceOutputs: plan.sourceOutputs })).toBe(true);
    expect(findSeals(hex)[0]).toMatchObject({ category: coin().txid, reportHash: reportHash(report), flags: 2 });
    expect(plan.transaction.outputs[0].token?.nft?.capability).toBe("none");
    expect(plan.transaction.outputs[0].token?.amount).toBe(0n);
    expect(() => JSON.stringify(wizardSignRequest(plan))).not.toThrow();
    expect(wizardSignRequest(plan)).toMatchObject({ inputPaths: [[0, "receive", 0]], transaction: { broadcast: false } });
  });
  it("finds the vout-0 input and funds a genesis with multiple plain UTXOs", () => {
    const plan = planFor([coin(1, 5000n, "34"), coin(0, 600n)]);
    expect(plan.transaction.inputs[0].outpointIndex).toBe(0);
    expect(plan.transaction.inputs).toHaveLength(2);
    expect(validateSignedTransaction(plan, sign(plan))).toMatch(/^[a-f0-9]{64}$/);
  });
  it("offers a fee-only prep self-send without a genesis UTXO", () => {
    expect(() => planFor([coin(1)])).toThrow(NeedsGenesisUtxo);
    const plan = buildSealPlan({ utxos: [coin(1)], address, network: "chipnet", prepare: true });
    expect(plan.transaction.outputs).toHaveLength(1);
    expect(plan.transaction.outputs[0].token).toBeUndefined();
    expect(plan.transaction.outputs[0].valueSatoshis).toBe(12_000n - plan.feeSatoshis);
    expect(validateSignedTransaction(plan, sign(plan))).toBeTruthy();
    expect(findSeals(sign(plan))).toEqual([]);
  });
  it("accounts for service fee and returns all remaining funds as change", () => {
    const plan = buildSealPlan({ utxos: [coin()], address, network: "chipnet", commitment: commitmentForReport(report), feeAddress: address });
    expect(plan.serviceFeeSatoshis).toBe(1000n);
    expect(plan.transaction.outputs).toHaveLength(3);
    expect(plan.transaction.outputs.reduce((sum, output) => sum + output.valueSatoshis, plan.feeSatoshis)).toBe(12_000n);
    expect(validateSignedTransaction(plan, sign(plan))).toBeTruthy();
  });
  it("excludes existing tokens and rejects duplicates, foreign scripts, wrong network, and insufficient funds", () => {
    const tokenCoin = { ...coin(), token: { category: hexToBin("ab".repeat(32)), amount: 1n } };
    expect(() => planFor([tokenCoin])).toThrow();
    expect(() => planFor([coin(), coin()])).toThrow(/duplicate/);
    expect(() => planFor([{ ...coin(), lockingBytecode: Uint8Array.of(0x51) }])).toThrow(/foreign/);
    expect(() => planFor([coin(0, 600n)])).toThrow(/Insufficient/);
    expect(() => buildSealPlan({ utxos: [coin()], address, network: "mainnet", commitment: commitmentForReport(report) })).toThrow(/network/);
  });
  it("rejects changed outputs, changed signatures, and the wrong sighash", () => {
    const plan = planFor();
    expect(() => validateSignedTransaction(plan, sign(plan, 0x41))).toThrow(/0x61/);
    const tampered = decodeRawTransaction(sign(plan)); tampered.outputs[1].valueSatoshis--;
    expect(() => validateSignedTransaction(plan, binToHex(encodeTransaction(tampered)))).toThrow(/changed/);
    const invalid = decodeRawTransaction(sign(plan)); invalid.inputs[0].unlockingBytecode[5] ^= 1;
    expect(() => validateSignedTransaction(plan, binToHex(encodeTransaction(invalid)))).toThrow(/VM validation/);
  });
  it("does not label transfers, mutable NFTs, or lookalike commitments as genesis seals", () => {
    const tx = planFor().transaction;
    tx.inputs[0].outpointIndex = 1;
    expect(findSeals(binToHex(encodeTransaction(tx)))).toEqual([]);
    tx.inputs[0].outpointIndex = 0; tx.outputs[0].token!.nft!.capability = "mutable";
    expect(findSeals(binToHex(encodeTransaction(tx)))).toEqual([]);
  });
});
