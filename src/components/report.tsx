"use client";

import { useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpRight,
  Check,
  ChevronDown,
  Copy,
  FileCode2,
  ReceiptText,
} from "lucide-react";
import type { Finding, Report, Verdict } from "@/lib/types";
import { ReceiptDrawer } from "./receipt-drawer";
import { TracePanel } from "./trace-panel";

const labels: Record<Verdict, string> = {
  "will-break": "WILL BREAK",
  "might-break": "MIGHT BREAK",
  safe: "SAFE IN SAMPLE",
};

export function AnalysisReport({ report }: { report: Report }) {
  const [filter, setFilter] = useState<"all" | Verdict>("all");
  const [receipt, setReceipt] = useState<Finding | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [copyError, setCopyError] = useState(false);
  const count = (verdict: Verdict) =>
    report.findings.filter((f) => f.verdict === verdict).length;
  const filtered = report.findings.filter(
    (f) => filter === "all" || f.verdict === filter,
  );
  function download() {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `upgrade-oracle-${report.id.slice(0, 8)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function copyFix(finding: Finding) {
    try {
      await navigator.clipboard.writeText(finding.fix ?? finding.migration);
      setCopied(finding.id);
      setCopyError(false);
    } catch {
      setCopyError(true);
    }
  }
  return (
    <div className="analysis-report">
      <div className="result-top">
        <span className="terminal-kicker">
          <span className="status-led" /> TRANSMISSION RECEIVED
        </span>
        <button
          className="text-button"
          onClick={download}
          title="Download complete report with notes and trace"
        >
          <ArrowDownToLine size={14} /> JSON
        </button>
      </div>
      <h2 className="report-heading">The future has a few warnings.</h2>
      <p className="report-description">
        {report.dependencies
          .map((d) => `${d.name} ${d.from} → ${d.to}`)
          .join(" · ")}
      </p>
      <div className="report-metrics">
        {(["will-break", "might-break", "safe"] as const).map((verdict) => (
          <button
            key={verdict}
            className={`metric ${verdict} ${filter === verdict ? "selected" : ""}`}
            onClick={() => setFilter(filter === verdict ? "all" : verdict)}
            aria-pressed={filter === verdict}
          >
            <strong>{String(count(verdict)).padStart(2, "0")}</strong>
            <span>{labels[verdict]}</span>
          </button>
        ))}
      </div>
      <p className="verdict-legend">
        Exact token → will break · Fuzzy token → might break · No token → safe
        in sample. Lexical evidence needs human review.
      </p>
      <div className="findings-header">
        <span>
          {filter === "all" ? "ALL FINDINGS" : labels[filter]} /{" "}
          {filtered.length}
        </span>
        {filter !== "all" && (
          <button className="text-button" onClick={() => setFilter("all")}>
            Show all
          </button>
        )}
        <span>{report.files.length} FILES SCANNED</span>
      </div>
      <div className="findings-list">
        {filtered.map((finding, index) => (
          <article
            className={`finding ${finding.verdict}`}
            key={finding.id}
            style={{ animationDelay: `${Math.min(index, 8) * 75}ms` }}
          >
            <div className="finding-top">
              <span className={`verdict ${finding.verdict}`}>
                <i /> {labels[finding.verdict]}
              </span>
              <span>v{finding.sourceVersion}</span>
            </div>
            <h3>
              {finding.api}
              <span>{finding.dependency}</span>
            </h3>
            <p>{finding.change}</p>
            {finding.hits.length > 0 && (
              <div className="code-hit">
                <div>
                  <FileCode2 size={12} />
                  <span>
                    {finding.hits[0].file}:{finding.hits[0].line}
                  </span>
                  <small>{finding.hits[0].match}</small>
                </div>
                <code>{finding.hits[0].snippet}</code>
                {finding.hits.length > 1 && (
                  <small>
                    + {finding.hits.length - 1} more matches in receipt
                  </small>
                )}
              </div>
            )}
            {finding.fix && (
              <div className="fix">
                <span>↳ SUGGESTED FIX</span>
                <p>{finding.fix}</p>
              </div>
            )}
            <div className="finding-actions">
              <button onClick={() => setReceipt(finding)}>
                <ReceiptText size={14} /> View evidence receipt{" "}
                <ArrowUpRight size={12} />
              </button>
              {finding.fix && (
                <button
                  title="Copy suggested fix"
                  aria-label={`Copy fix for ${finding.api}`}
                  onClick={() => copyFix(finding)}
                >
                  {copied === finding.id ? (
                    <Check size={14} />
                  ) : (
                    <Copy size={14} />
                  )}
                  {copied === finding.id ? "Copied" : "Copy fix"}
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
      {!filtered.length && (
        <p className="no-findings">
          {report.findings.length
            ? "No findings in this category."
            : "No cited breaking changes found. Check coverage below before drawing a compatibility conclusion."}
        </p>
      )}
      {copyError && (
        <p role="status">
          Clipboard unavailable. Select and copy the fix text above.
        </p>
      )}
      <details className="coverage-panel">
        <summary>
          <span>
            Coverage & limitations{" "}
            {report.warnings.length ? `(${report.warnings.length})` : ""}
          </span>
          <ChevronDown size={14} />
        </summary>
        <div>
          {report.coverage.map((c) => (
            <p key={c.dependency}>
              <strong>{c.dependency}</strong> · {c.versionsWithNotes}/
              {c.versionsResolved} release versions reviewed ·{" "}
              {c.complete ? "notes complete" : "partial coverage"}
            </p>
          ))}
          <ul>
            {report.warnings.map((warning, index) => (
              <li key={index}>{warning}</li>
            ))}
          </ul>
          <p>
            Aliases, dynamic properties, conditional execution, and files
            outside the sample may change the outcome. Quotes are mechanically
            verified; The model’s interpretation still needs review.
          </p>
        </div>
      </details>
      <TracePanel trace={report.trace} recorded={report.mode === "demo"} />
      <div className="report-footer">
        <span>
          {report.mode === "demo"
            ? `RECORDED ${new Date(report.createdAt).toISOString().slice(0, 10)}`
            : "LIVE ANALYSIS"}
        </span>
        <span>
          {(report.durationMs / 1000).toFixed(1)}s ORIGINAL RUN ·{" "}
          {report.droppedCitations} QUOTES DROPPED
        </span>
      </div>
      <ReceiptDrawer
        finding={receipt}
        recorded={report.mode === "demo"}
        onClose={() => setReceipt(null)}
      />
    </div>
  );
}
