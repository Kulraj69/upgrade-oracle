import { describe, expect, it, vi } from "vitest";
import { POST as doctor } from "@/app/api/doctor/route";
import { POST as chain } from "@/app/api/chain/route";
import { handleAnalyzeRequest } from "@/lib/http";
import { AnalyzeLimiter } from "@/lib/rate-limit";
import { examples } from "@/lib/examples";

vi.mock("@/lib/bch/network", () => ({
  fetchTransaction: vi
    .fn()
    .mockRejectedValue(new Error("private upstream detail")),
  fetchUtxos: vi.fn(),
  broadcastTransaction: vi.fn(),
}));
const request = (body: unknown, type = "application/json") =>
  new Request("http://localhost/api/doctor", {
    method: "POST",
    headers: { "content-type": type },
    body: JSON.stringify(body),
  });
describe("BCH HTTP boundaries", () => {
  it("compiles without a key and responds no-store", async () => {
    const response = await doctor(
      request({
        source:
          "pragma cashscript ^0.14.0; contract Sample() { function spend() { require(true); } }",
      }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect((await response.json()).contract.bytecode).toBe("51");
  });
  it("rejects content types, oversized source, bad filenames and invalid syntax", async () => {
    expect((await doctor(request({}, "text/plain"))).status).toBe(415);
    expect((await doctor(request({ source: "x".repeat(21000) }))).status).toBe(
      413,
    );
    expect(
      (await doctor(request({ source: "contract", file: "../bad.cash" })))
        .status,
    ).toBe(400);
    expect(
      (await doctor(request({ source: "contract Invalid(" }))).status,
    ).toBe(422);
  });
  it("rejects unknown networks, malformed IDs, invalid addresses and invalid broadcasts", async () => {
    for (const input of [
      { action: "transaction", net: "testnet", txid: "ab".repeat(32) },
      { action: "transaction", net: "chipnet", txid: "no" },
      { action: "utxos", net: "chipnet", address: "not-an-address" },
      { action: "broadcast", net: "chipnet", hex: "0123" },
    ])
      expect((await chain(request(input))).status).toBe(400);
  });
  it("hides upstream errors and caches no chain responses", async () => {
    const response = await chain(
      request({ action: "transaction", net: "chipnet", txid: "ab".repeat(32) }),
    );
    expect(response.status).toBe(502);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.text()).not.toContain("private upstream detail");
  });
  it("keeps the optional model off without explicit opt-in", async () => {
    vi.stubEnv("ENABLE_LLM", "false");
    vi.stubEnv("GLM_API_KEY", "unit-test-placeholder");
    const network = vi
      .spyOn(globalThis, "fetch")
      .mockRejectedValue(new Error("No model calls expected"));
    try {
      const response = await handleAnalyzeRequest(request(examples[0].input), {
        limiter: new AnalyzeLimiter(),
      });
      expect(response.status).toBe(200);
      expect(network).not.toHaveBeenCalled();
    } finally {
      network.mockRestore();
      vi.unstubAllEnvs();
    }
  });
});
