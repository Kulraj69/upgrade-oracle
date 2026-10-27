import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";

let stage = "startup";
async function main() {
  process.env.PLAYWRIGHT_BROWSERS_PATH ??= path.resolve(".playwright");
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox"],
  });
  await mkdir("artifacts", { recursive: true });
  const base = process.env.BROWSER_BASE_URL || "http://127.0.0.1:3000";
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1080 },
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.name));
  try {
    stage = "open home";
    await page.goto(base);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "A little foresight",
    );
    await page.screenshot({ path: "artifacts/bch-ready.png", fullPage: true });
    await page.getByRole("button", { name: "CONSULT THE ORACLE" }).click();
    await expect(
      page.getByRole("heading", { name: "RecurringPayment", exact: true }),
    ).toBeVisible();
    stage = "open receipt";
    await page.getByText("View exact source quote").click();
    await expect(page.locator("blockquote")).toContainText(
      "normalized to the 10-minute scale",
    );
    await expect(page.getByText(/Proposed · not locked in/)).toBeVisible();
    stage = "download report";
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "JSON", exact: true }).click();
    await (await download).saveAs("artifacts/browser-doctor-report.json");
    const report = JSON.parse(
      await readFile("artifacts/browser-doctor-report.json", "utf8"),
    );
    expect(report.schema).toBe("upgrade-oracle/bch-report-v1");
    stage = "open seal panel";
    await page
      .getByRole("button", { name: "Seal this report", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Connect wallet to seal" }),
    ).toBeVisible();
    await expect(page.getByLabel("Network", { exact: true })).toHaveValue(
      "chipnet",
    );
    stage = "select mainnet";
    await page.getByLabel("Network", { exact: true }).selectOption("mainnet");
    await expect(page.getByText("Your wallet, real BCH.")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Connect wallet to seal" }),
    ).toBeDisabled();
    await page.getByLabel("Network", { exact: true }).selectOption("chipnet");
    await page.screenshot({ path: "artifacts/bch-report.png", fullPage: true });
    stage = "connect qr";
    // Check the QR UI without persisting its private pairing URI in artifacts.
    await page.getByRole("button", { name: "Connect wallet to seal" }).click();
    await expect(
      page.getByText("Connect a chipnet wallet", { exact: true }),
    ).toBeVisible();
    stage = "close qr";
    await page.keyboard.press("Escape");
    await expect(
      page.getByText("Connect a chipnet wallet", { exact: true }),
    ).toHaveCount(0);
    stage = "p2sh example";
    await page.getByRole("button", { name: /P2SH covenant/ }).click();
    await page.getByRole("button", { name: "CONSULT THE ORACLE" }).click();
    await expect(page.locator(".doctor-finding")).toHaveCount(3);
    stage = "token example";
    await page.getByRole("button", { name: /Token vault/ }).click();
    await page.getByRole("button", { name: "CONSULT THE ORACLE" }).click();
    await expect(
      page.getByRole("heading", { name: "TokenVault", exact: true }),
    ).toBeVisible();
    stage = "edit invalid source";
    await page.getByLabel("CashScript source").fill("contract Invalid(");
    await expect(
      page.getByRole("button", { name: "Seal this report", exact: true }),
    ).toHaveCount(0);
    await page.getByRole("button", { name: "CONSULT THE ORACLE" }).click();
    await expect(page.getByRole("alert")).toBeVisible();
    await page.getByRole("button", { name: /Recurring payment/ }).click();
    await page.getByRole("button", { name: "CONSULT THE ORACLE" }).click();
    await expect(
      page.getByRole("heading", { name: "RecurringPayment", exact: true }),
    ).toBeVisible();
    stage = "accessibility";
    const accessibility = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    if (accessibility.violations.length)
      console.log(
        JSON.stringify(
          accessibility.violations.map((v) => ({
            id: v.id,
            nodes: v.nodes.map((n) => ({
              target: n.target,
              summary: n.failureSummary,
            })),
          })),
        ),
      );
    expect(
      accessibility.violations.map((v) => ({
        id: v.id,
        targets: v.nodes.map((n) => n.target),
      })),
    ).toEqual([]);
    stage = "responsive";
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 1080 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `artifacts/bch-${width}.png`,
        fullPage: true,
      });
    }
    stage = "dependencies";
    await page.goto(`${base}/dependencies`);
    await expect(
      page.getByText("Dependency model is off", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "CONSULT THE ORACLE" }),
    ).toBeDisabled();
    await expect(page.locator(".cartridge")).toHaveCount(0);
    // Offline verification fixture: explicitly mocked chain response, no live claim.
    stage = "verification fixture";
    const tx = JSON.parse(
      await readFile("artifacts/wizard-offline-transaction.json", "utf8"),
    );
    await page.route("**/api/chain", (route) =>
      route.fulfill({ json: { hex: tx.hex, height: 0 } }),
    );
    await page.goto(`${base}/seal/${tx.txid}?net=chipnet`);
    await expect(
      page.getByRole("heading", { name: "Seal · output 0" }),
    ).toBeVisible();
    await page
      .getByLabel(/Drop a report JSON/)
      .setInputFiles("src/lib/bch/examples/recurring-payment.report.json");
    await expect(page.getByRole("status")).toContainText("Match ·");
    await page
      .getByLabel(/Drop a report JSON/)
      .setInputFiles("src/lib/bch/examples/token-vault.report.json");
    await expect(page.getByRole("status")).toContainText("Mismatch ·");
    expect(errors).toEqual([]);
    console.log(
      "BCH browser checks passed: real compiler, evidence, downloads, network guard, QR, all examples, edited-input invalidation, accessibility, four widths, dependency-off state, and mocked verification match/mismatch.",
    );
  } finally {
    await browser.close();
  }
}
main().catch(() => {
  console.error(
    `BCH browser check failed at: ${stage}. No pairing data logged.`,
  );
  process.exitCode = 1;
});
