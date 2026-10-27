export async function chainRequest(body: Record<string, unknown>) {
  const response = await fetch("/api/chain", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(60_000) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Chain request failed.");
  return data;
}
export function downloadReport(report: unknown, filename = "oracle-report.json") {
  const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2) + "\n"], { type: "application/json" }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
