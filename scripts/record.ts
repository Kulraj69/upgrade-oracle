import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { runLiveAgent } from "../src/lib/agent";
import { examples } from "../src/lib/examples";
import { Fetcher } from "../src/lib/fetcher";
import type { Recording } from "../src/lib/types";

async function main() {
  if (!process.env.GLM_API_KEY)
    throw new Error(
      "Set GLM_API_KEY in the shell before recording. No demo fallback is allowed.",
    );
  const output = path.resolve("src/recordings");
  await mkdir(output, { recursive: true });
  const selected = process.argv.slice(2);
  for (const example of examples.filter(
    (e) => !selected.length || selected.includes(e.id),
  )) {
    console.log(
      `Recording ${example.id}: fetching real notes and calling GLM…`,
    );
    const signal = AbortSignal.timeout(270_000);
    const fetcher = new Fetcher(signal);
    try {
      const report = await runLiveAgent(example.input, { fetcher, signal });
      if (
        !report.findings.length ||
        !report.trace.some((t) => t.method === "POST" && t.status === "ok")
      )
        throw new Error(
          "Recording has no cited findings or successful model calls.",
        );
      if (
        report.findings.some(
          (f) => !report.notes[f.receipt.noteIndex]?.text.includes(f.quote),
        )
      )
        throw new Error("Recording citation verification failed.");
      const recording: Recording = {
        schemaVersion: 1,
        exampleId: example.id,
        input: example.input,
        report,
      };
      await writeFile(
        path.join(output, `${example.id}.json`),
        JSON.stringify(recording, null, 2) + "\n",
      );
      console.log(
        `Saved ${example.id}: ${report.findings.length} cited findings, ${report.trace.length} trace steps, ${(report.durationMs / 1000).toFixed(1)} s.`,
      );
    } catch (error) {
      await mkdir("artifacts", { recursive: true });
      await writeFile(
        `artifacts/${example.id}-failed-trace.json`,
        JSON.stringify(fetcher.trace, null, 2),
      );
      throw error;
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Recording failed.");
  process.exitCode = 1;
});
