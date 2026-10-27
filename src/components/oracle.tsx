"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Braces,
  Check,
  CircleHelp,
  Cpu,
  FileCode2,
  GitBranch,
  LoaderCircle,
  Plus,
  Power,
  Radio,
  ShieldCheck,
  Terminal,
  Upload,
  X,
} from "lucide-react";
import { bchDependencyExamples as examples } from "@/lib/bch/dependency-examples";
import { BchTabs } from "./bch-tabs";
import { parseBumpText, validateInput } from "@/lib/input";
import type { AnalyzeInput, Report, SourceFile, TraceStep } from "@/lib/types";
import { AnalysisReport } from "./report";
import { TracePanel } from "./trace-panel";
import { NightScene } from "./night-scene";

type InputMode = "bumps" | "manifest" | "repo";

export function Oracle({ live }: { live: boolean }) {
  const initial = examples[0];
  const [mode, setMode] = useState<InputMode>("bumps");
  const [sample, setSample] = useState<string | undefined>(undefined);
  const [bumpText, setBumpText] = useState("cashscript 0.11.0 -> 0.14.0");
  const [files, setFiles] = useState<SourceFile[]>(
    structuredClone(initial.input.files),
  );
  const [activeFile, setActiveFile] = useState(0);
  const [manifest, setManifest] = useState(
    '{\n  "dependencies": {\n    "cashscript": "0.11.0"\n  }\n}',
  );
  const [targetManifest, setTargetManifest] = useState(
    '{\n  "dependencies": {\n    "cashscript": "0.14.0"\n  }\n}',
  );
  const [repoUrl, setRepoUrl] = useState("");
  const [repoBumps, setRepoBumps] = useState("");
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");
  const [failedTrace, setFailedTrace] = useState<TraceStep[]>([]);
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [help, setHelp] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const abort = useRef<AbortController | null>(null);
  const output = useRef<HTMLDivElement>(null);
  const helpDialog = useRef<HTMLDialogElement>(null);
  const upload = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!busy) return;
    const interval = setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => clearInterval(interval);
  }, [busy]);
  useEffect(() => {
    if (help) helpDialog.current?.showModal();
    else helpDialog.current?.close();
  }, [help]);
  useEffect(() => () => abort.current?.abort(), []);
  function edit() {
    setSample(undefined);
    setDirty(true);
    setError("");
  }
  function chooseSample(id: string) {
    const example = examples.find((e) => e.id === id)!;
    setMode("bumps");
    setSample(undefined);
    setBumpText(
      example.input
        .bumps!.map((b) => `${b.name} ${b.from} -> ${b.to}`)
        .join("\n"),
    );
    setFiles(structuredClone(example.input.files));
    setActiveFile(0);
    setReport(null);
    setError("");
    setFailedTrace([]);
    setDirty(false);
    setUploadError("");
  }
  function updateFile(field: "path" | "content", value: string) {
    edit();
    setFiles((current) =>
      current.map((file, index) =>
        index === activeFile ? { ...file, [field]: value } : file,
      ),
    );
  }
  function addFile() {
    if (files.length >= 5) return;
    edit();
    const used = new Set(files.map((f) => f.path));
    let n = files.length + 1;
    while (used.has(`src/file-${n}.tsx`)) n++;
    setFiles([...files, { path: `src/file-${n}.tsx`, content: "" }]);
    setActiveFile(files.length);
  }
  function removeFile() {
    edit();
    setFiles(files.filter((_, index) => index !== activeFile));
    setActiveFile(Math.max(0, activeFile - 1));
  }
  async function uploadFiles(list: FileList | null) {
    if (!list) return;
    try {
      const incoming = Array.from(list);
      if (incoming.length + files.length > 5)
        throw new Error(
          "Up to 5 files total. Remove a sample file to make room.",
        );
      if (incoming.some((file) => file.size > 20 * 1024))
        throw new Error("Each source file must be 20 KB or smaller.");
      const additions = await Promise.all(
        incoming.map(async (file) => ({
          path: file.name,
          content: await file.text(),
        })),
      );
      if (
        new Set([...files, ...additions].map((f) => f.path)).size !==
        files.length + additions.length
      )
        throw new Error(
          "Filenames must be unique. Rename duplicates before uploading.",
        );
      edit();
      setFiles([...files, ...additions]);
      setActiveFile(files.length);
      setUploadError("");
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : "Could not read these files.",
      );
    }
    if (upload.current) upload.current.value = "";
  }
  async function analyze() {
    if (busy || !live) return;
    setError("");
    setFailedTrace([]);
    let input: AnalyzeInput;
    try {
      input = validateInput(
        mode === "bumps"
          ? {
              bumps: parseBumpText(bumpText),
              files,
              ...(sample ? { exampleId: sample } : {}),
            }
          : mode === "manifest"
            ? {
                packageJson: manifest,
                ...(targetManifest.trim()
                  ? { targetPackageJson: targetManifest }
                  : {}),
                files,
              }
            : {
                repoUrl,
                ...(repoBumps.trim()
                  ? { bumps: parseBumpText(repoBumps) }
                  : {}),
                files: [],
              },
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Please check your input.");
      return;
    }
    setBusy(true);
    setElapsed(0);
    const controller = new AbortController();
    abort.current = controller;
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        signal: controller.signal,
      });
      const data = await response.json();
      const left = response.headers.get("X-RateLimit-Remaining");
      if (left !== null) setRemaining(Number(left));
      if (!response.ok) {
        setFailedTrace(data.trace ?? []);
        throw new Error(
          data.error || "The terminal could not complete this analysis.",
        );
      }
      setReport(data as Report);
      setDirty(false);
      setTimeout(() => {
        output.current?.focus({ preventScroll: true });
        if (window.innerWidth < 900)
          output.current?.scrollIntoView({
            behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
              ? "instant"
              : "smooth",
            block: "start",
          });
      }, 30);
    } catch (err) {
      setError(
        controller.signal.aborted
          ? "Analysis cancelled. You can edit your input and try again."
          : err instanceof Error
            ? err.message
            : "The connection was interrupted. Please try again.",
      );
    } finally {
      setBusy(false);
      abort.current = null;
    }
  }
  const active = files[activeFile];
  return (
    <>
      <NightScene />
      <div className="app-shell">
        <header className="site-header">
          <Link href="/" className="wordmark" aria-label="Upgrade Oracle home">
            <span className="logo-mark">
              <Cpu size={22} />
            </span>
            <span>
              UPGRADE ORACLE<small>AN INSTRUMENT FOR WHAT COMES NEXT</small>
            </span>
          </Link>
          <button className="header-link" onClick={() => setHelp(true)}>
            <CircleHelp size={15} />
            <span>Operator’s manual</span>
            <ArrowUpRight size={13} />
          </button>
        </header>
        <main>
          <BchTabs active="dependencies" />
          <div className="above-terminal">
            <span>
              <i /> NIGHT SHIFT / SYSTEM ONLINE
            </span>
            <span>
              EST. 1981 <span className="dim">/</span> REBUILT FOR TOMORROW
            </span>
          </div>
          <div className="hardware">
            <div className="hardware-top">
              <span className="model-plate">
                UPGRADE ORACLE <b>5150</b>
              </span>
              <div className="vents" aria-hidden="true" />
              <span className="power-label">
                <i /> POWER
              </span>
            </div>
            <div className="screen-bezel">
              <div className="crt-screen">
                <div className="screen-bar">
                  <span>
                    <Terminal size={13} /> ORACLE.OS <b>v1.0</b>
                  </span>
                  <span className={`mode-badge ${live ? "live" : "demo"}`}>
                    <i />
                    {live
                      ? "Live dependency analysis"
                      : "Dependency model is off"}
                  </span>
                </div>
                <section className="screen-intro">
                  <div>
                    <p className="terminal-kicker">
                      DEPENDENCY UPGRADES. WITHOUT THE GUESSWORK.
                    </p>
                    <h1>
                      Know what breaks.
                      <br />
                      Before it breaks<span className="cursor">_</span>
                    </h1>
                    <p>
                      Real release notes. Your code. Cited answers.
                      <br className="desktop-break" /> A little foresight for
                      your next <code>npm install</code>.
                    </p>
                  </div>
                  <div className="oracle-emblem" aria-hidden="true">
                    <div className="orbital orbit-one" />
                    <div className="orbital orbit-two" />
                    <div className="orbital orbit-three" />
                    <div className="orb-core">✳</div>
                    <span>
                      THE FUTURE IS
                      <br />
                      IN THE CHANGELOG.
                    </span>
                  </div>
                </section>
                <div className="cartridge-bar">
                  <span>
                    {live ? "LIVE INPUT PRESETS" : "NO RECORDED BCH RUNS"} <ArrowRight size={12} />
                  </span>
                  <div>
                    {(live ? examples : []).map((example, index) => (
                      <button
                        key={example.id}
                        className={`cartridge ${sample === example.id ? "active" : ""}`}
                        onClick={() => chooseSample(example.id)}
                        disabled={busy}
                      >
                        <span className="cartridge-number">0{index + 1}</span>
                        <strong>{example.title}</strong>
                        <span>{example.subtitle}</span>
                        {sample === example.id && <Check size={12} />}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="workspace-grid">
                  <section
                    className="input-console"
                    aria-label="Analysis inputs"
                  >
                    <div className="section-label">
                      <span>01 / INPUT DECK</span>
                      <span>MAX. 6 DEPENDENCIES</span>
                    </div>
                    <div
                      className="input-tabs"
                      role="tablist"
                      aria-label="Input method"
                    >
                      {(
                        [
                          { id: "bumps", icon: Terminal, label: "Bumps" },
                          {
                            id: "manifest",
                            icon: Braces,
                            label: "package.json",
                          },
                          { id: "repo", icon: GitBranch, label: "GitHub" },
                        ] as const
                      ).map((tab) => (
                        <button
                          key={tab.id}
                          id={`tab-${tab.id}`}
                          role="tab"
                          aria-selected={mode === tab.id}
                          aria-controls="input-method-panel"
                          disabled={busy}
                          onClick={() => {
                            setMode(tab.id);
                            edit();
                          }}
                        >
                          <tab.icon size={13} />
                          {tab.label}
                        </button>
                      ))}
                    </div>
                    <div
                      id="input-method-panel"
                      role="tabpanel"
                      aria-labelledby={`tab-${mode}`}
                    >
                      {mode === "bumps" && (
                        <div className="field">
                          <label htmlFor="bumps">
                            DEPENDENCY BUMPS<span>one per line</span>
                          </label>
                          <textarea
                            id="bumps"
                            className="bump-input"
                            value={bumpText}
                            onChange={(e) => {
                              setBumpText(e.target.value);
                              edit();
                            }}
                            spellCheck={false}
                            disabled={busy}
                            placeholder="next 14.2.0 -> 16.0.0"
                          />
                          <small>
                            package name · current version → target version
                          </small>
                        </div>
                      )}
                      {mode === "manifest" && (
                        <>
                          <div className="field">
                            <label htmlFor="current-manifest">
                              CURRENT PACKAGE.JSON<span>50 KB max</span>
                            </label>
                            <textarea
                              id="current-manifest"
                              value={manifest}
                              onChange={(e) => {
                                setManifest(e.target.value);
                                edit();
                              }}
                              spellCheck={false}
                              disabled={busy}
                              rows={6}
                            />
                          </div>
                          <div className="field">
                            <label htmlFor="target-manifest">
                              TARGET PACKAGE.JSON<span>optional</span>
                            </label>
                            <textarea
                              id="target-manifest"
                              value={targetManifest}
                              onChange={(e) => {
                                setTargetManifest(e.target.value);
                                edit();
                              }}
                              spellCheck={false}
                              disabled={busy}
                              rows={6}
                              placeholder="Leave empty to target latest stable versions"
                            />
                            <small>
                              Empty target selects latest stable versions, up to
                              6 dependencies.
                            </small>
                          </div>
                        </>
                      )}
                      {mode === "repo" && (
                        <>
                          <div className="field">
                            <label htmlFor="repo-url">
                              PUBLIC GITHUB REPOSITORY
                            </label>
                            <input
                              id="repo-url"
                              type="url"
                              value={repoUrl}
                              onChange={(e) => {
                                setRepoUrl(e.target.value);
                                edit();
                              }}
                              disabled={busy}
                              placeholder="https://github.com/owner/repository"
                            />
                            <small>
                              Reads package.json and up to 30 source/config
                              files under 20 KB from the default branch.
                            </small>
                          </div>
                          <div className="field">
                            <label htmlFor="repo-bumps">
                              SELECT DEPENDENCY BUMPS<span>optional</span>
                            </label>
                            <textarea
                              id="repo-bumps"
                              className="bump-input"
                              value={repoBumps}
                              onChange={(e) => {
                                setRepoBumps(e.target.value);
                                edit();
                              }}
                              disabled={busy}
                              placeholder="next 14.2.0 -> 16.0.0"
                            />
                            <small>
                              Required when package.json has more than 6
                              dependencies.
                            </small>
                          </div>
                        </>
                      )}
                    </div>
                    {mode !== "repo" && (
                      <div className="source-deck">
                        <div className="source-heading">
                          <label htmlFor="source-code">
                            SOURCE FILES <span>{files.length}/5</span>
                          </label>
                          <div>
                            <input
                              ref={upload}
                              type="file"
                              accept=".ts,.tsx,.js,.jsx,.json,.mjs,.cjs,.mts,.cts"
                              multiple
                              hidden
                              onChange={(e) => uploadFiles(e.target.files)}
                            />
                            <button
                              title="Upload source files"
                              aria-label="Upload source files"
                              onClick={() => upload.current?.click()}
                              disabled={busy || files.length >= 5}
                            >
                              <Upload size={13} />
                            </button>
                            <button
                              title="Add source file"
                              aria-label="Add source file"
                              onClick={addFile}
                              disabled={busy || files.length >= 5}
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                        </div>
                        <div className="file-tabs" aria-label="Source files">
                          {files.map((file, index) => (
                            <button
                              key={index}
                              onClick={() => setActiveFile(index)}
                              aria-pressed={activeFile === index}
                              title={file.path}
                            >
                              <FileCode2 size={12} />
                              {file.path.split("/").at(-1)}
                            </button>
                          ))}
                        </div>
                        {active ? (
                          <div className="code-editor">
                            <div className="file-path">
                              <input
                                aria-label="Source filename"
                                value={active.path}
                                onChange={(e) =>
                                  updateFile("path", e.target.value)
                                }
                                disabled={busy}
                              />
                              <button
                                aria-label={`Remove ${active.path}`}
                                title="Remove file"
                                onClick={removeFile}
                                disabled={busy}
                              >
                                <X size={13} />
                              </button>
                            </div>
                            <div className="editor-content">
                              <div className="line-numbers" aria-hidden="true">
                                {Array.from(
                                  {
                                    length: Math.max(
                                      10,
                                      active.content.split("\n").length,
                                    ),
                                  },
                                  (_, i) => (
                                    <span key={i}>
                                      {String(i + 1).padStart(2, "0")}
                                    </span>
                                  ),
                                )}
                              </div>
                              <textarea
                                id="source-code"
                                value={active.content}
                                onChange={(e) =>
                                  updateFile("content", e.target.value)
                                }
                                spellCheck={false}
                                disabled={busy}
                                aria-label="Source code"
                              />
                            </div>
                            <div className="editor-footer">
                              <span>UTF-8</span>
                              <span>
                                {new TextEncoder()
                                  .encode(active.content)
                                  .byteLength.toLocaleString()}{" "}
                                / 20,480 BYTES
                              </span>
                            </div>
                          </div>
                        ) : (
                          <button
                            className="empty-file"
                            onClick={addFile}
                            disabled={busy}
                          >
                            <Plus size={16} /> Add source code to find affected
                            lines
                          </button>
                        )}
                        <p className="input-hint">
                          Paste or upload up to 5 files · 20 KB each
                        </p>
                        {uploadError && (
                          <p className="form-error" role="alert">
                            {uploadError}
                          </p>
                        )}
                      </div>
                    )}
                    <button
                      className="analyze-button"
                      onClick={analyze}
                      disabled={busy || !live}
                    >
                      {busy ? (
                        <>
                          <LoaderCircle size={17} className="spin" />
                          {live
                            ? "CONSULTING THE ORACLE"
                            : "READING RECORDED RUN"}
                        </>
                      ) : (
                        <>
                          <span>CONSULT THE ORACLE</span>
                          <ArrowRight size={18} />
                        </>
                      )}
                    </button>
                    {busy && (
                      <button
                        className="cancel-button"
                        onClick={() => abort.current?.abort()}
                      >
                        Cancel analysis · {elapsed}s elapsed
                      </button>
                    )}
                    <p className="run-note">
                      <ShieldCheck size={12} />
                      {live
                        ? "Source stays in memory. Matching snippets go to the model."
                        : "Optional dependency analysis is off. Contract Doctor needs no key."}
                    </p>
                    {remaining !== null && (
                      <p className="remaining-note">
                        {remaining} analyses remaining in this hour
                      </p>
                    )}
                    {!live && !sample && (
                      <p className="demo-hint">
                        Dependency analysis needs a server model. Use Contract Doctor for deterministic analysis without a key.
                      </p>
                    )}
                    {error && (
                      <div className="form-error" role="alert">
                        <strong>TRANSMISSION INTERRUPTED</strong>
                        <p>{error}</p>
                      </div>
                    )}
                    {failedTrace.length > 0 && (
                      <TracePanel trace={failedTrace} failed />
                    )}
                  </section>
                  <section
                    className="output-console"
                    ref={output}
                    tabIndex={-1}
                    aria-label="Analysis results"
                  >
                    <div className="section-label">
                      <span>02 / ORACLE READOUT</span>
                      <span>
                        {busy
                          ? "PROCESSING"
                          : report
                            ? "COMPLETE"
                            : "AWAITING INPUT"}
                      </span>
                    </div>
                    {report && !busy ? (
                      <>
                        {dirty && (
                          <p className="stale-notice">
                            Inputs have changed. This report belongs to the
                            previous submission.
                          </p>
                        )}
                        <AnalysisReport key={report.id} report={report} />
                      </>
                    ) : (
                      <div className={`standby ${busy ? "is-busy" : ""}`}>
                        <div className="standby-art" aria-hidden="true">
                          <div className="radar-grid" />
                          <div className="radar-circle r1" />
                          <div className="radar-circle r2" />
                          <div className="radar-circle r3" />
                          <span className="radar-cross">+</span>
                          <div className="radar-dot d1" />
                          <div className="radar-dot d2" />
                          <div className="radar-dot d3" />
                          <div className="radar-sweep" />
                        </div>
                        <div className="standby-status">
                          <i />
                          {busy
                            ? live
                              ? "SIGNAL IN TRANSIT"
                              : "RETRIEVING ARCHIVED SIGNAL"
                            : "LISTENING FOR YOUR NEXT MOVE"}
                        </div>
                        <h2>
                          {busy
                            ? "Reading between the versions…"
                            : "A clearer view of what’s next."}
                        </h2>
                        <p>
                          {busy
                            ? live
                              ? "Fetching public release notes and extracting cited changes. Large upgrades can take a few minutes."
                              : "Dependency analysis requires an explicitly enabled server model."
                            : "Load a sample or bring your own code. The Oracle traces breaking changes back to the source."}
                        </p>
                        {busy ? (
                          <div
                            className="progress-track"
                            aria-label="Analysis in progress"
                          >
                            <span />
                          </div>
                        ) : (
                          <div className="pipeline">
                            <span>
                              <Radio size={17} />
                              FETCH NOTES
                            </span>
                            <ArrowRight size={13} />
                            <span>
                              <Cpu size={17} />
                              READ CHANGES
                            </span>
                            <ArrowRight size={13} />
                            <span>
                              <ReceiptTextIcon />
                              SHOW PROOF
                            </span>
                          </div>
                        )}
                        <div className="standby-note">
                          {busy
                            ? `${elapsed}s elapsed · ${live ? "No verdict until evidence is checked" : "No new upstream calls"}`
                            : "NO GUESSWORK. NO CLAIM WITHOUT A RECEIPT."}
                        </div>
                      </div>
                    )}
                  </section>
                </div>
                <div className="screen-footer">
                  <span>
                    <span className="status-led" /> SOURCE QUOTES · HUMAN REVIEW REQUIRED
                  </span>
                  <span>
                    FETCH → EXTRACT → VERIFY → MATCH <ArrowDown size={11} />
                  </span>
                </div>
              </div>
            </div>
            <div className="hardware-bottom">
              <div className="hardware-brand">
                <span className="ibm-stripes">ORACLE</span>
                <span>PERSONAL UPGRADE COMPUTER</span>
              </div>
              <div className="bottom-vents" aria-hidden="true" />
              <div className="power-switch" aria-hidden="true">
                <Power size={15} />
              </div>
            </div>
          </div>
          <div className="monitor-foot" aria-hidden="true" />
        </main>
        <footer className="site-footer">
          <span>BUILT FOR THE QUIET HOURS BEFORE A BIG RELEASE.</span>
          <span>
            BCH × DETERMINISTIC EVIDENCE <i>✦</i> KULRAJ SINGH / 2026
          </span>
        </footer>
      </div>
      <dialog
        ref={helpDialog}
        className="manual-dialog"
        aria-labelledby="manual-title"
        onCancel={() => setHelp(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) setHelp(false);
        }}
      >
        <div>
          <div className="drawer-top">
            <span>OPERATOR’S MANUAL / 01</span>
            <button
              aria-label="Close manual"
              className="icon-button"
              onClick={() => setHelp(false)}
              autoFocus
            >
              <X size={21} />
            </button>
          </div>
          <h2 id="manual-title">A little foresight.</h2>
          <ol>
            <li>
              <strong>Load your upgrade.</strong> Pick a live input preset,
              enter up to 6 bumps, compare two package manifests, or point to a
              public GitHub repo.
            </li>
            <li>
              <strong>Bring the code.</strong> Paste or upload 5 small source
              files. Repository mode samples up to 30 files from one commit.
            </li>
            <li>
              <strong>Consult the Oracle.</strong> npm resolves versions; GitHub
              provides notes; an optional model extracts API changes and migration guidance.
              Every quote must match its source exactly.
            </li>
            <li>
              <strong>Read the evidence.</strong> Exact API matches rank first,
              fuzzy matches second. Open a receipt for the quote and line
              numbers; open the trace for URLs, timings and bytes.
            </li>
          </ol>
          <p>
            “Will break” is a lexical match, not a runtime proof. “Safe in
            sample” means the API token was not found in the supplied code.
            Review partial coverage and run your project’s tests.
          </p>
          <p>
            {live
              ? "Live mode is connected. Only snippets for matched changes are sent to the model. Source files are not persisted."
              : "Dependency analysis is off by default. Configure a model and explicitly enable it on a local server. BCH presets are available only in live mode; no BCH dependency recordings are claimed."}
          </p>
          <button className="analyze-button" onClick={() => setHelp(false)}>
            RETURN TO TERMINAL <ArrowRight size={17} />
          </button>
        </div>
      </dialog>
    </>
  );
}

function ReceiptTextIcon() {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <path d="M5 3h14v19l-3-2-4 2-4-2-3 2V3Z" />
      <path d="M8 7h8M8 11h8M8 15h5" />
    </svg>
  );
}
