"use client";
import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowRight, Check, Download, Terminal, Upload } from "lucide-react";
import type { DoctorReport } from "@/lib/bch/types";
import { downloadReport } from "@/lib/bch/client";
import { NightScene } from "./night-scene";
import { BchTabs } from "./bch-tabs";
const SealPanel = dynamic(
  () => import("./seal-panel").then((module) => module.SealPanel),
  {
    ssr: false,
    loading: () => <p className="bch-note">Loading wallet tools…</p>,
  },
);
type Example = {
  id: string;
  title: string;
  subtitle: string;
  file: string;
  source: string;
};

export function ContractDoctor({
  examples,
  feeAddress,
}: {
  examples: Example[];
  feeAddress?: string;
}) {
  const [source, setSource] = useState(examples[0].source);
  const [file, setFile] = useState(examples[0].file);
  const [sample, setSample] = useState(examples[0].id);
  const [report, setReport] = useState<DoctorReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [sealOpen, setSealOpen] = useState(false);
  const output = useRef<HTMLDivElement>(null);
  const lock = useRef(false);
  const upload = useRef<HTMLInputElement>(null);
  function edit(value: string) {
    setSource(value);
    setReport(null);
    setError("");
    setSample("");
    setSealOpen(false);
  }
  async function examine() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setReport(null);
    setError("");
    setFilter("all");
    setSealOpen(false);
    try {
      const response = await fetch("/api/doctor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, file }),
        signal: AbortSignal.timeout(15_000),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Compilation failed.");
      setReport(data);
      setTimeout(() => output.current?.focus({ preventScroll: true }), 50);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "The compiler could not finish.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function loadFile(incoming?: File) {
    if (!incoming) return;
    if (!incoming.name.endsWith(".cash") || incoming.size > 20 * 1024) {
      setError("Choose a .cash file, up to 20 KB.");
      return;
    }
    edit(await incoming.text());
    setFile(incoming.name.replace(/[^\w.-]/g, "_").slice(-105));
    if (upload.current) upload.current.value = "";
  }
  return (
    <>
      <NightScene />
      <div className="app-shell bch-shell">
        <header className="site-header">
          <Link href="/" className="wordmark">
            <Terminal size={29} />
            <span>
              UPGRADE ORACLE<small>BITCOIN CASH EDITION</small>
            </span>
          </Link>
          <span className="blaze-tag">BCH BLAZE / 2026</span>
        </header>
        <main>
          <BchTabs active="doctor" />
          <div className="above-terminal">
            <span>
              <i /> NIGHT SHIFT / CONTRACT DESK
            </span>
            <span>NO API KEY REQUIRED</span>
          </div>
          <div className="hardware">
            <div className="hardware-top">
              <span className="model-plate">
                UPGRADE ORACLE <b>BCH</b>
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
                    <Terminal size={13} /> ORACLE.OS <b>CONTRACT DOCTOR</b>
                  </span>
                  <span className="mode-badge live">
                    <i /> Deterministic · cashc 0.14
                  </span>
                </div>
                <section className="screen-intro">
                  <div>
                    <p className="terminal-kicker">
                      YOUR CONTRACT. THE SPECS. A PERMANENT RECEIPT.
                    </p>
                    <h1>
                      A little foresight.
                      <br />
                      Written on chain<span className="cursor">_</span>
                    </h1>
                    <p>
                      Compile a CashScript contract. Follow the evidence.
                      <br />
                      Seal the report with your own wallet.
                    </p>
                  </div>
                  <div className="doctor-orb" aria-hidden="true">
                    <span>₿</span>
                    <small>EXAMINE / VERIFY / SEAL</small>
                  </div>
                </section>
                <div className="cartridge-bar">
                  <span>
                    LOAD A CONTRACT <ArrowRight size={12} />
                  </span>
                  <div>
                    {examples.map((example, i) => (
                      <button
                        key={example.id}
                        className={`cartridge ${sample === example.id ? "active" : ""}`}
                        disabled={busy}
                        onClick={() => {
                          edit(example.source);
                          setFile(example.file);
                          setSample(example.id);
                        }}
                      >
                        <span className="cartridge-number">0{i + 1}</span>
                        <strong>{example.title}</strong>
                        <span>{example.subtitle}</span>
                        {sample === example.id && <Check size={12} />}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="doctor-grid">
                  <section
                    className="doctor-input"
                    aria-label="CashScript input"
                  >
                    <div className="section-label">
                      <span>01 / INPUT DECK</span>
                      <span>MAX. 20 KB</span>
                    </div>
                    <div className="doctor-file">
                      <label htmlFor="contract-file">Filename</label>
                      <input
                        id="contract-file"
                        value={file}
                        disabled={busy}
                        onChange={(e) => {
                          setFile(e.target.value);
                          setReport(null);
                          setSealOpen(false);
                        }}
                      />
                      <button
                        className="icon-button"
                        aria-label="Upload CashScript contract"
                        disabled={busy}
                        onClick={() => upload.current?.click()}
                      >
                        <Upload size={17} />
                      </button>
                      <input
                        ref={upload}
                        type="file"
                        accept=".cash"
                        hidden
                        onChange={(e) => void loadFile(e.target.files?.[0])}
                      />
                    </div>
                    <label htmlFor="contract-source" className="sr-only">
                      CashScript source
                    </label>
                    <textarea
                      id="contract-source"
                      className="cash-editor"
                      value={source}
                      spellCheck={false}
                      disabled={busy}
                      onChange={(e) => edit(e.target.value)}
                    />
                    <button
                      className="analyze-button"
                      disabled={busy || !source.trim()}
                      onClick={() => void examine()}
                    >
                      {busy ? "EXAMINING CONTRACT…" : "CONSULT THE ORACLE"}
                      <ArrowRight size={17} />
                    </button>
                    <p className="bch-note">
                      Deterministic rules. Exact source quotes. No model calls.
                      <br />
                      Examples demonstrate patterns; they are not audited
                      contracts.
                    </p>
                    {error && (
                      <p className="bch-error" role="alert">
                        {error}
                      </p>
                    )}
                  </section>
                  <section
                    className="doctor-output"
                    aria-label="Contract report"
                  >
                    <div className="section-label">
                      <span>02 / EVIDENCE RECEIPT</span>
                      <span>
                        {report
                          ? `${report.findings.length} FINDINGS`
                          : "AWAITING SOURCE"}
                      </span>
                    </div>
                    <div ref={output} tabIndex={-1} aria-live="polite">
                      {!report ? (
                        <div className="doctor-standby">
                          <div className="radar" aria-hidden="true">
                            <span />
                            <i />
                          </div>
                          <h2>
                            {busy
                              ? "Reading the bytecode…"
                              : "What does your contract reveal?"}
                          </h2>
                          <p>
                            Load a contract and consult the Oracle.
                            <br />
                            Every finding comes with source lines and a pinned
                            quote.
                          </p>
                          <span className="standby-note">
                            COMPILE → MATCH → CITE → SEAL
                          </span>
                        </div>
                      ) : (
                        <>
                          <div className="doctor-report-heading">
                            <h2>{report.contract.name}</h2>
                            <button
                              className="text-button"
                              onClick={() => downloadReport(report)}
                            >
                              <Download size={14} /> JSON
                            </button>
                          </div>
                          <div className="doctor-metrics">
                            <div>
                              <strong>{report.contract.bytecodeBytes}</strong>
                              <span>BYTECODE BYTES</span>
                            </div>
                            <div>
                              <strong>{report.contract.opcount}</strong>
                              <span>STATIC OPCOUNT</span>
                            </div>
                            <div>
                              <strong>
                                {report.contract.compiler.replace("cashc ", "")}
                              </strong>
                              <span>CASHC</span>
                            </div>
                          </div>
                          <p className="bch-note">
                            {report.contract.constructorInputs.length
                              ? "Compiled template; constructor arguments are not included. "
                              : "No constructor arguments. "}
                            Opcount counts top-level non-push operations, not
                            executed work or nested function bodies.
                          </p>
                          {report.contract.warnings.map((warning, i) => (
                            <p className="bch-note" key={i}>
                              Compiler: {warning}
                            </p>
                          ))}
                          <div
                            className="finding-filters"
                            aria-label="Filter findings"
                          >
                            {["all", "watch", "opportunity", "risk"].map(
                              (value) => (
                                <button
                                  key={value}
                                  aria-pressed={filter === value}
                                  onClick={() => setFilter(value)}
                                >
                                  {value}{" "}
                                  <span>
                                    {value === "all"
                                      ? report.findings.length
                                      : report.findings.filter(
                                          (f) => f.severity === value,
                                        ).length}
                                  </span>
                                </button>
                              ),
                            )}
                          </div>
                          {report.findings
                            .filter(
                              (f) => filter === "all" || f.severity === filter,
                            )
                            .map((finding) => (
                              <article
                                className={`doctor-finding ${finding.severity}`}
                                key={finding.id}
                              >
                                <div className="finding-tag">
                                  {finding.severity.toUpperCase()}{" "}
                                  <span>{finding.id}</span>
                                </div>
                                <h3>{finding.title}</h3>
                                <p className="source-status">
                                  {finding.status} · snapshot{" "}
                                  {finding.evidence.fetchedAt.slice(0, 10)}
                                </p>
                                <ul className="matched-lines">
                                  {finding.matches.map((match) => (
                                    <li key={match.line}>
                                      <code>
                                        {match.file}:{match.line}
                                      </code>
                                      <pre>{match.snippet}</pre>
                                    </li>
                                  ))}
                                </ul>
                                <details className="evidence-receipt">
                                  <summary>View exact source quote ↗</summary>
                                  <blockquote>
                                    {finding.evidence.quote}
                                  </blockquote>
                                  <a
                                    href={finding.evidence.url}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    Pinned specification ↗
                                  </a>
                                  <small>
                                    Source SHA-256: {finding.evidence.sha256}
                                  </small>
                                </details>
                                <p className="doctor-fix">
                                  <strong>Review action</strong>
                                  {finding.fix}
                                </p>
                              </article>
                            ))}
                          {!report.findings.length && (
                            <p className="bch-note">
                              No rules matched this sample. This does not
                              certify contract safety or completeness.
                            </p>
                          )}
                          {report.findings.length > 0 &&
                            !report.findings.some(
                              (f) => filter === "all" || f.severity === filter,
                            ) && (
                              <p className="bch-note">
                                No findings in this category.
                              </p>
                            )}
                          <p className="bch-note">
                            Pattern matches are review prompts, not an audit. A
                            seal proves a hash was committed; it does not
                            endorse the report.
                          </p>
                          {sealOpen ? (
                            <SealPanel
                              report={report}
                              feeAddress={feeAddress}
                            />
                          ) : (
                            <button
                              className="bch-button"
                              onClick={() => setSealOpen(true)}
                            >
                              Seal this report <ArrowRight size={15} />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </section>
                </div>
                <div className="screen-footer">
                  <span>
                    <span className="status-led" /> PINNED SOURCES / CHECKED
                    QUOTES
                  </span>
                  <span>CHIPNET BY DEFAULT</span>
                </div>
              </div>
            </div>
            <div className="hardware-bottom">
              <div className="hardware-brand">
                <span className="ibm-stripes">ORACLE</span>
                <span>PERSONAL CONTRACT COMPUTER</span>
              </div>
              <div className="bottom-vents" aria-hidden="true" />
            </div>
          </div>
          <div className="monitor-foot" aria-hidden="true" />
        </main>
        <footer className="site-footer">
          <span>BUILT FOR THE QUIET HOURS BEFORE AN UPGRADE.</span>
          <span>
            BCH BLAZE <i>✦</i> 2026
          </span>
        </footer>
      </div>
    </>
  );
}
