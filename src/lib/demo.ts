import { InputError } from "./errors";
import { examples } from "./examples";
import type { AnalyzeInput, Recording, Report } from "./types";

const loaders: Record<string, () => Promise<{ default: unknown }>> = {
  next: () => import("@/recordings/next.json"),
  router: () => import("@/recordings/router.json"),
  eslint: () => import("@/recordings/eslint.json"),
};

export async function replayDemo(input: AnalyzeInput): Promise<Report> {
  const example = examples.find((e) => e.id === input.exampleId);
  if (
    !example ||
    JSON.stringify(input.bumps) !== JSON.stringify(example.input.bumps) ||
    JSON.stringify(input.files) !== JSON.stringify(example.input.files) ||
    input.repoUrl ||
    input.packageJson ||
    input.targetPackageJson
  )
    throw new InputError(
      "Demo mode replays the original example inputs. Choose a sample cartridge, or configure GLM_API_KEY for custom analysis.",
      422,
    );
  const recording = (await loaders[example.id]()).default as Recording;
  if (
    !recording.report ||
    recording.schemaVersion !== 1 ||
    recording.report.mode !== "live"
  )
    throw new InputError("This recorded example is not available yet.", 503);
  return {
    ...structuredClone(recording.report),
    mode: "demo",
    recording: {
      exampleId: example.id,
      recordedAt: recording.report.createdAt,
      input: recording.input,
    },
  };
}
