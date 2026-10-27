import { major } from "semver";
import { TtlCache } from "./cache";
import { extractGithubReleases, extractMarkdownSections } from "./changelog";
import { InputError, UpstreamError } from "./errors";
import { Fetcher } from "./fetcher";
import { MAX_FILE_BYTES, MAX_PACKAGE_BYTES, parseRepoUrl } from "./input";
import { githubRepository, resolveRange } from "./versions";
import type { Bump, Note, ResolvedBump, SourceFile } from "./types";

type Registry = {
  versions: Record<string, unknown>;
  "dist-tags": Record<string, string>;
  repository?: unknown;
};
const registryCache = new TtlCache<{
  versions: string[];
  latest?: string;
  repository: string | null;
}>(60 * 60 * 1000, 40);

export async function resolveDependency(
  bump: Bump,
  fetcher: Fetcher,
): Promise<ResolvedBump> {
  const url = `https://registry.npmjs.org/${encodeURIComponent(bump.name)}`;
  let data = registryCache.get(bump.name);
  if (data) {
    fetcher.trace.push({
      id: `t${fetcher.trace.length + 1}`,
      label: `Resolve ${bump.name}`,
      url,
      method: "GET",
      status: "cached",
      ms: 0,
      bytes: new TextEncoder().encode(JSON.stringify(data)).byteLength,
      detail: "Cached version index",
    });
  } else {
    const registry = await fetcher.json<Registry>(url, `Resolve ${bump.name}`, {
      accept: "application/vnd.npm.install-v1+json",
      maxBytes: 35 * 1024 * 1024,
    });
    if (!registry.versions || !registry["dist-tags"])
      throw new UpstreamError(`npm returned no versions for ${bump.name}.`);
    data = {
      versions: Object.keys(registry.versions),
      latest: registry["dist-tags"].latest,
      repository: githubRepository(registry.repository),
    };
    registryCache.set(bump.name, data);
  }
  const resolved = resolveRange(bump, data.versions, data.latest);
  let repository = data.repository;
  if (!repository) {
    const manifest = await fetcher.json<{ repository?: unknown }>(
      `${url}/${resolved.to}`,
      `Locate ${bump.name} repository`,
      { accept: "application/json" },
    );
    repository = githubRepository(manifest.repository);
    registryCache.set(bump.name, { ...data, repository });
  }
  return { ...resolved, repository };
}

export async function fetchNotes(
  dep: ResolvedBump,
  fetcher: Fetcher,
): Promise<Note[]> {
  if (!dep.repository) return [];
  const base = `https://api.github.com/repos/${dep.repository}`;
  const notes: Note[] = [];
  const add = (incoming: Note[]) => {
    for (const note of incoming)
      if (!notes.some((n) => n.url === note.url && n.version === note.version))
        notes.push(note);
  };
  // Targeted tags retain major migrations even when the repository has thousands of newer releases.
  const majorVersions = dep.versions.filter((v) => v === `${major(v)}.0.0`);
  const targeted = [...new Set([...majorVersions, dep.to])].slice(-7);
  for (const version of targeted) {
    const tags = [
      ...new Set([
        `v${version}`,
        `${dep.name}@${version}`,
        `${dep.repository.split("/").at(-1)}@${version}`,
      ]),
    ];
    for (const tag of tags) {
      try {
        const release = await fetcher.json<unknown>(
          `${base}/releases/tags/${encodeURIComponent(tag)}`,
          `${dep.name} ${version} release`,
        );
        const found = extractGithubReleases([release], dep.versions);
        add(found);
        if (found.length) break;
      } catch {
        /* A missing tag is an ordinary fallback, visible in trace. */
      }
    }
  }
  // Bounded recent-release scan for intermediate patches/minors.
  try {
    add(
      extractGithubReleases(
        await fetcher.json<unknown>(
          `${base}/releases?per_page=100`,
          `${dep.name} release index`,
          { maxBytes: 6 * 1024 * 1024 },
        ),
        dep.versions,
      ),
    );
  } catch {
    /* Coverage records missing notes. */
  }
  const paths = [
    "CHANGELOG.md",
    `packages/${dep.name.split("/").at(-1)}/CHANGELOG.md`,
  ];
  const ref =
    dep.repository === "remix-run/react-router"
      ? `react-router@${dep.to}`
      : `v${dep.to}`;
  for (const path of paths) {
    try {
      const url = `https://raw.githubusercontent.com/${dep.repository}/${encodeURIComponent(ref)}/${path}`;
      const text = await fetcher.get(url, `${dep.name} changelog`, {
        accept: "text/plain",
        maxBytes: 2 * 1024 * 1024,
      });
      add(extractMarkdownSections(text, url, dep.versions));
    } catch {
      /* Missing monorepo/root changelogs are common. */
    }
  }
  // Official, version-pinned migration notes supplement terse commit-only releases.
  // The version is the major whose migration the document explicitly describes.
  const guides: {
    repository: string;
    version: string;
    ref: string;
    path: string;
  }[] = [
    {
      repository: "vercel/next.js",
      version: "16.0.0",
      ref: "v16.0.0",
      path: "docs/01-app/02-guides/upgrading/version-16.mdx",
    },
    {
      repository: "remix-run/react-router",
      version: "6.0.0",
      ref: "react-router@6.22.0",
      path: "docs/upgrading/v5.md",
    },
    {
      repository: "eslint/eslint",
      version: "9.0.0",
      ref: "v9.0.0",
      path: "docs/src/use/migrate-to-9.0.0.md",
    },
  ];
  for (const guide of guides.filter(
    (g) => g.repository === dep.repository && dep.versions.includes(g.version),
  )) {
    const url = `https://raw.githubusercontent.com/${guide.repository}/${encodeURIComponent(guide.ref)}/${guide.path}`;
    try {
      add([
        {
          version: guide.version,
          url,
          kind: "migration",
          text: await fetcher.get(
            url,
            `${dep.name} ${guide.version} migration notes`,
            { accept: "text/plain", maxBytes: 150 * 1024 },
          ),
        },
      ]);
    } catch {
      /* Release-note coverage still applies. */
    }
  }
  return notes;
}

export async function fetchRepository(
  repoUrl: string,
  fetcher: Fetcher,
): Promise<{ packageJson: string; files: SourceFile[]; warnings: string[] }> {
  const { owner, repo } = parseRepoUrl(repoUrl);
  const base = `https://api.github.com/repos/${owner}/${repo}`;
  const metadata = await fetcher.json<{ default_branch?: string }>(
    base,
    "Resolve GitHub repository",
  );
  if (!metadata.default_branch)
    throw new InputError(
      "The repository is unavailable or has no default branch.",
    );
  const commit = await fetcher.json<{ sha?: string }>(
    `${base}/commits/${encodeURIComponent(metadata.default_branch)}`,
    "Pin repository commit",
  );
  if (!commit.sha || !/^[a-f0-9]{40}$/.test(commit.sha))
    throw new UpstreamError("GitHub returned no valid repository commit.");
  const tree = await fetcher.json<{
    sha: string;
    truncated?: boolean;
    tree: { path: string; type: string; size?: number }[];
  }>(
    `${base}/git/trees/${commit.sha}?recursive=1`,
    "List repository source files",
    { maxBytes: 4 * 1024 * 1024 },
  );
  if (!tree.sha || !Array.isArray(tree.tree))
    throw new UpstreamError("GitHub returned no readable repository tree.");
  const raw = `https://raw.githubusercontent.com/${owner}/${repo}/${commit.sha}`;
  const packageJson = await fetcher.get(
    `${raw}/package.json`,
    "Read repository package.json",
    { maxBytes: MAX_PACKAGE_BYTES, accept: "text/plain", cache: false },
  );
  const candidates = tree.tree
    .filter(
      (item) =>
        item.type === "blob" &&
        (item.size ?? Infinity) <= MAX_FILE_BYTES &&
        !/(^|\/)(node_modules|dist|build|\.next|vendor|coverage)(\/|$)/.test(
          item.path,
        ) &&
        (/^(src|app|pages|lib|components)\/.*\.(?:[cm]?[jt]sx?|json)$/.test(
          item.path,
        ) ||
          /^(?:eslint\.config\.[cm]?js|\.eslintrc(?:\.[cm]?js|\.json)?|next\.config\.[cm]?[jt]s)$/.test(
            item.path,
          )),
    )
    .sort((a, b) => a.path.localeCompare(b.path));
  const files: SourceFile[] = [];
  const warnings: string[] = [];
  if (tree.truncated || candidates.length > 30)
    warnings.push(
      "Repository sampling is limited to 30 small source/config files; this is not a full-repository audit.",
    );
  for (const entry of candidates.slice(0, 30)) {
    const encoded = entry.path.split("/").map(encodeURIComponent).join("/");
    try {
      files.push({
        path: entry.path,
        content: await fetcher.get(`${raw}/${encoded}`, `Read ${entry.path}`, {
          maxBytes: MAX_FILE_BYTES,
          accept: "text/plain",
          cache: false,
        }),
      });
    } catch {
      warnings.push(
        `Could not read ${entry.path}; it was excluded from matching.`,
      );
    }
  }
  if (!files.length)
    warnings.push(
      "No eligible source files were found. All verdicts are limited to release-note review.",
    );
  return { packageJson, files, warnings };
}
