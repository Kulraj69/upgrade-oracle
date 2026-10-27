import { validRange } from "semver";
import { InputError } from "./errors";
import type { AnalyzeInput, Bump, SourceFile } from "./types";

export const MAX_PACKAGE_BYTES = 50 * 1024;
export const MAX_FILE_BYTES = 20 * 1024;
export const MAX_BODY_BYTES = 240 * 1024;
export const MAX_DEPS = 6;
export const byteLength = (value: string) =>
  new TextEncoder().encode(value).byteLength;
const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
export const validPackageName = (value: string) =>
  /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/.test(value) &&
  value.length <= 214;

export function parseManifest(text: string): Record<string, string> {
  if (byteLength(text) > MAX_PACKAGE_BYTES)
    throw new InputError("Each package.json must be 50 KB or smaller.", 413);
  let manifest: unknown;
  try {
    manifest = JSON.parse(text);
  } catch {
    throw new InputError("package.json is not valid JSON.");
  }
  if (!isRecord(manifest))
    throw new InputError("package.json must contain a JSON object.");
  const deps: Record<string, string> = Object.create(null);
  for (const key of ["devDependencies", "dependencies"]) {
    const entries = manifest[key];
    if (entries === undefined) continue;
    if (!isRecord(entries)) throw new InputError(`${key} must be an object.`);
    for (const [name, version] of Object.entries(entries)) {
      if (
        !validPackageName(name) ||
        typeof version !== "string" ||
        version.length > 150
      )
        throw new InputError(
          "Dependencies must have valid npm names and string versions.",
        );
      deps[name] = version;
    }
  }
  return deps;
}

export function parseBumpText(text: string): Bump[] {
  return text
    .split(/\n|,/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(\S+)\s+(.+?)\s*(?:->|→)\s*(.+)$/);
      if (!match)
        throw new InputError(
          `Use “package from -> to”, for example “next 14.2.0 -> 16.0.0”.`,
        );
      return { name: match[1], from: match[2].trim(), to: match[3].trim() };
    });
}

export function validateBumps(value: unknown): Bump[] {
  if (!Array.isArray(value) || value.length > MAX_DEPS)
    throw new InputError("Analyze at most 6 dependency bumps at a time.");
  const names = new Set<string>();
  return value.map((item) => {
    if (
      !isRecord(item) ||
      typeof item.name !== "string" ||
      !validPackageName(item.name) ||
      typeof item.from !== "string" ||
      typeof item.to !== "string"
    )
      throw new InputError(
        "Each bump needs a valid package name, from version, and to version.",
      );
    if (
      item.from.length > 150 ||
      item.to.length > 150 ||
      !validRange(item.from) ||
      (item.to !== "latest" && !validRange(item.to))
    )
      throw new InputError(
        `Use npm semver ranges for ${item.name}; the target may also be “latest”.`,
      );
    if (names.has(item.name))
      throw new InputError(`Specify ${item.name} only once.`);
    names.add(item.name);
    return { name: item.name, from: item.from, to: item.to };
  });
}

export function parseRepoUrl(input: string): { owner: string; repo: string } {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new InputError("Use a public GitHub repository URL.");
  }
  const match = url.pathname
    .replace(/\/$/, "")
    .match(/^\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_.-]+)$/);
  if (
    url.protocol !== "https:" ||
    url.hostname !== "github.com" ||
    url.port ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !match
  )
    throw new InputError(
      "Use https://github.com/owner/repository with no branch or file path.",
    );
  return { owner: match[1], repo: match[2].replace(/\.git$/, "") };
}

export function validateInput(value: unknown): AnalyzeInput {
  if (!isRecord(value))
    throw new InputError(
      "Send a JSON object with dependency bumps and source files.",
    );
  const input: AnalyzeInput = { files: [] };
  for (const key of ["packageJson", "targetPackageJson"] as const) {
    if (value[key] !== undefined && value[key] !== "") {
      if (typeof value[key] !== "string")
        throw new InputError(`${key} must be pasted JSON text.`);
      parseManifest(value[key]);
      input[key] = value[key];
    }
  }
  if (value.bumps !== undefined) input.bumps = validateBumps(value.bumps);
  if (value.repoUrl !== undefined && value.repoUrl !== "") {
    if (typeof value.repoUrl !== "string" || value.repoUrl.length > 300)
      throw new InputError("Use a public GitHub repository URL.");
    parseRepoUrl(value.repoUrl);
    input.repoUrl = value.repoUrl;
  }
  if (input.repoUrl && input.packageJson)
    throw new InputError(
      "Choose either a repository or a pasted package.json.",
    );
  if (input.targetPackageJson && !input.packageJson && !input.repoUrl)
    throw new InputError(
      "A target manifest needs a current package.json or repository.",
    );
  if (value.files !== undefined) {
    if (!Array.isArray(value.files) || value.files.length > 5)
      throw new InputError("Attach at most 5 source files.");
    const paths = new Set<string>();
    input.files = value.files.map((file): SourceFile => {
      if (
        !isRecord(file) ||
        typeof file.path !== "string" ||
        typeof file.content !== "string" ||
        !file.path.trim() ||
        file.path.length > 200 ||
        /[\x00-\x1f]/.test(file.path)
      )
        throw new InputError(
          "Each source file needs a filename and text content.",
        );
      if (byteLength(file.content) > MAX_FILE_BYTES)
        throw new InputError(`${file.path} exceeds the 20 KB file limit.`, 413);
      if (paths.has(file.path))
        throw new InputError("Source filenames must be unique.");
      paths.add(file.path);
      return { path: file.path, content: file.content };
    });
  }
  if (input.repoUrl && input.files.length)
    throw new InputError(
      "Repository mode fetches its own source files; remove pasted files.",
    );
  if (value.exampleId !== undefined) {
    if (
      typeof value.exampleId !== "string" ||
      !["next", "router", "eslint"].includes(value.exampleId)
    )
      throw new InputError("Choose one of the three recorded examples.");
    input.exampleId = value.exampleId;
  }
  if (!input.bumps?.length && !input.packageJson && !input.repoUrl)
    throw new InputError(
      "Add a dependency bump, paste package.json, or enter a GitHub repository.",
    );
  return input;
}
