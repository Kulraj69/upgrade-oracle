// Details disclosure and trace row structure adapted from qloo's trace panel.
import { Activity, ArrowUpRight, ChevronDown } from "lucide-react";
import type { TraceStep } from "@/lib/types";

export function TracePanel({
  trace,
  recorded = false,
  failed = false,
}: {
  trace: TraceStep[];
  recorded?: boolean;
  failed?: boolean;
}) {
  return (
    <details
      className="trace-panel"
      id={failed ? "failed-trace" : "agent-trace"}
    >
      <summary>
        <span>
          <Activity size={15} />{" "}
          {failed ? "Incomplete attempt trace" : "Open agent trace"}{" "}
          <b>{trace.length}</b>
        </span>
        <ChevronDown size={15} />
      </summary>
      <div className="trace-content">
        <p>
          {recorded
            ? "Original recorded calls. Replaying this report makes no upstream requests."
            : "Every source request, model call, citation check, and code search, including failures and cache hits."}{" "}
          Bytes are response payloads, cached payloads, or local input sizes.
        </p>
        <ol className="trace-list">
          {trace.map((step, index) => (
            <li key={step.id}>
              <details>
                <summary>
                  <span className={`trace-dot ${step.status}`} />
                  <span className="trace-name">
                    <small>
                      {String(index + 1).padStart(2, "0")} / {step.method}
                    </small>
                    {step.label}
                  </span>
                  <span className="trace-metrics">
                    {step.ms.toLocaleString()} ms
                    <small>
                      {step.bytes.toLocaleString()} B · {step.status}
                    </small>
                  </span>
                  <ChevronDown size={12} />
                </summary>
                <div className="trace-detail">
                  {step.url.startsWith("https://") ? (
                    <a href={step.url} target="_blank" rel="noreferrer">
                      {step.url}
                      <ArrowUpRight size={12} />
                    </a>
                  ) : (
                    <code>{step.url}</code>
                  )}
                  {step.detail && <p>{step.detail}</p>}
                </div>
              </details>
            </li>
          ))}
        </ol>
      </div>
    </details>
  );
}
