import { Worker } from "node:worker_threads";
import type { Artifact } from "@cashscript/utils";
import { InputError } from "@/lib/errors";
import { summarizeCompilation } from "./doctor";

let active = 0;
// compileString uses an empty in-memory import resolver: pasted imports cannot
// read disk. The worker adds a deadline and a heap cap for untrusted programs.
export async function compileContract(source: string) {
  if (active >= 2)
    throw new InputError("The compiler is busy. Please retry shortly.", 429);
  active++;
  try {
    const result = await new Promise<{
      artifact: Artifact;
      warnings: string[];
    }>((resolve, reject) => {
      const worker = new Worker(
        `
        const { parentPort, workerData } = require('node:worker_threads');
        (async () => {
          const { compileString } = await import('cashc');
          const warnings = [];
          try {
            const artifact = compileString(workerData, { files: {}, warningListener: w => { if (warnings.length < 20) warnings.push(w.message); } });
            parentPort.postMessage({ artifact, warnings });
          } catch (error) { parentPort.postMessage({ error: String(error.message).slice(0, 1200) }); }
        })().catch(() => parentPort.postMessage({ error: 'Compiler unavailable.' }));
      `,
        {
          eval: true,
          workerData: source,
          resourceLimits: { maxOldGenerationSizeMb: 128 },
          stdout: true,
          stderr: true,
        },
      );
      // Do not forward parser/compiler output to server logs.
      worker.stdout?.resume();
      worker.stderr?.resume();
      const timer = setTimeout(() => {
        reject(new InputError("Compilation exceeded the 5 second limit.", 422));
        void worker.terminate();
      }, 5000);
      worker.once("message", (value) => {
        clearTimeout(timer);
        void worker.terminate();
        if (value.error) reject(new InputError(value.error, 422));
        else resolve(value);
      });
      worker.once("error", () => {
        clearTimeout(timer);
        reject(
          new InputError("Compilation failed within resource limits.", 422),
        );
      });
      worker.once("exit", (code) => {
        clearTimeout(timer);
        if (code !== 0)
          reject(
            new InputError("Compiler stopped within resource limits.", 422),
          );
      });
    });
    return summarizeCompilation(result.artifact, result.warnings);
  } finally {
    active--;
  }
}
