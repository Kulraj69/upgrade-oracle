import { decodeAuthenticationInstructions, hexToBin, authenticationInstructionsAreMalformed } from "@bitauth/libauth";
import type { Artifact } from "@cashscript/utils";
import { InputError } from "@/lib/errors";
import { analyzeRules } from "./rules";
import { pinnedSources } from "./sources";
import type { Compilation, DoctorReport } from "./types";

export function validateContractInput(input: unknown): { source: string; file: string } {
  if (!input || typeof input !== "object" || !("source" in input) || typeof input.source !== "string" || !input.source.trim())
    throw new InputError("Paste a CashScript contract to examine.");
  if (Buffer.byteLength(input.source, "utf8") > 20 * 1024)
    throw new InputError("Contracts must be 20 KB or smaller.", 413);
  const file = "file" in input ? input.file : "contract.cash";
  if (typeof file !== "string" || !/^[\w.-]{1,100}\.cash$/.test(file))
    throw new InputError("Use a simple filename ending in .cash.");
  return { source: input.source, file };
}

export function summarizeCompilation(artifact: Artifact, warnings: string[]): Compilation {
  const bytecode = artifact.debug?.bytecode;
  if (!bytecode || !/^(?:[a-f\d]{2})+$/i.test(bytecode)) throw new Error("Compiler returned invalid bytecode.");
  const instructions = decodeAuthenticationInstructions(hexToBin(bytecode));
  if (authenticationInstructionsAreMalformed(instructions)) throw new Error("Malformed compiler bytecode.");
  return { name: artifact.contractName, compiler: `${artifact.compiler.name} ${artifact.compiler.version}`,
    bytecode, bytecodeBytes: bytecode.length / 2,
    // Static, top-level non-push count; not an execution/VM-cost estimate.
    opcount: instructions.filter((instruction) => instruction.opcode > 0x60).length,
    instructionCount: instructions.length,
    constructorInputs: artifact.constructorInputs.map((input) => ({ ...input })), warnings };
}

export function createDoctorReport(source: string, file: string, compilation: Compilation): DoctorReport {
  return { schema: "upgrade-oracle/bch-report-v1", rulesetVersion: 1,
    contract: { file, source, ...compilation }, findings: analyzeRules(source, file, compilation), sources: pinnedSources };
}
