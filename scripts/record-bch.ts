// Deterministic compiler/rules fixtures, never model outputs.
import { readFileSync, writeFileSync } from "node:fs";
import { compileString } from "cashc";
import {
  createDoctorReport,
  summarizeCompilation,
} from "../src/lib/bch/doctor";
for (const name of ["recurring-payment", "p2sh-covenant", "token-vault"]) {
  const source = readFileSync(`src/lib/bch/examples/${name}.cash`, "utf8");
  const warnings: string[] = [];
  const artifact = compileString(source, {
    warningListener: (w) => warnings.push(w.message),
  });
  const report = createDoctorReport(
    source,
    `${name}.cash`,
    summarizeCompilation(artifact, warnings),
  );
  writeFileSync(
    `src/lib/bch/examples/${name}.report.json`,
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(
    `Recorded ${name}: ${report.contract.bytecodeBytes} bytes, ${report.findings.length} findings.`,
  );
}
