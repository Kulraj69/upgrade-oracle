import { chromium, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

async function main() {
  process.env.PLAYWRIGHT_BROWSERS_PATH ??= path.resolve(".playwright");
  process.env.TMPDIR = path.resolve("artifacts/browser-tmp");
  await mkdir(process.env.TMPDIR, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox"],
    env: {
      ...process.env,
      XDG_CACHE_HOME: path.resolve("artifacts/browser-cache"),
      XDG_CONFIG_HOME: path.resolve("artifacts/browser-config"),
    },
  });
  const base = process.env.BROWSER_BASE_URL || "http://127.0.0.1:3000";
  const errors: string[] = [];
  try {
    const desktop = await browser.newContext({
      viewport: { width: 1440, height: 1080 },
      reducedMotion: "reduce",
      extraHTTPHeaders: {
        "X-Forwarded-For": `198.51.100.${Math.floor(Math.random() * 200) + 1}`,
      },
    });
    const page = await desktop.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(base);
    await page.evaluate(() => document.fonts.ready);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(
      "Know what breaks",
    );
    await expect(
      page.getByText("Demo mode: recorded run", { exact: true }),
    ).toBeVisible();
    const accessibility = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      accessibility.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      })),
    ).toEqual([]);
    await page.screenshot({
      path: "artifacts/desktop-ready.png",
      fullPage: true,
    });
    await page.getByRole("button", { name: "Operator’s manual" }).click();
    await expect(
      page.getByRole("dialog", { name: "A little foresight." }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "CONSULT THE ORACLE" }).click();
    await expect(
      page.getByRole("heading", { name: "The future has a few warnings." }),
    ).toBeVisible();
    await expect(page.locator(".finding.will-break").first()).toBeVisible();
    await page.screenshot({
      path: "artifacts/desktop-report.png",
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "View evidence receipt" })
      .first()
      .click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByText("VERBATIM QUOTE VERIFIED")).toBeVisible();
    const receiptAccessibility = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(
      receiptAccessibility.violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      })),
    ).toEqual([]);
    await page.screenshot({ path: "artifacts/evidence-receipt.png" });
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await page.locator("#agent-trace > summary").click();
    await expect(page.locator(".trace-list")).toBeVisible();
    const downloadEvent = page.waitForEvent("download");
    await page.getByRole("button", { name: "JSON", exact: true }).click();
    await (await downloadEvent).saveAs("artifacts/downloaded-report.json");
    for (const title of ["React Router", "ESLint"]) {
      await page.getByRole("button", { name: new RegExp(title) }).click();
      await page.getByRole("button", { name: "CONSULT THE ORACLE" }).click();
      await expect(page.locator(".finding.will-break").first()).toBeVisible();
    }
    await page
      .getByRole("textbox", { name: "Source code", exact: true })
      .fill("// edited code");
    await expect(
      page.getByText("Inputs have changed.", { exact: false }),
    ).toBeVisible();
    await page.getByRole("button", { name: "CONSULT THE ORACLE" }).click();
    await expect(page.locator(".form-error[role=alert]")).toContainText(
      "Demo mode replays the original example inputs",
    );
    const mobile = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      deviceScaleFactor: 1,
      reducedMotion: "reduce",
      extraHTTPHeaders: {
        "X-Forwarded-For": `203.0.113.${Math.floor(Math.random() * 200) + 1}`,
      },
    });
    const phone = await mobile.newPage();
    phone.on("pageerror", (error) => errors.push(error.message));
    await phone.goto(base);
    await phone.evaluate(() => document.fonts.ready);
    await phone.screenshot({
      path: "artifacts/mobile-ready.png",
      fullPage: true,
    });
    expect(
      await phone.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await phone.getByRole("button", { name: "CONSULT THE ORACLE" }).click();
    await expect(phone.locator(".finding.will-break").first()).toBeVisible();
    await phone
      .getByRole("button", { name: "View evidence receipt" })
      .first()
      .click();
    await expect(phone.getByRole("dialog")).toBeVisible();
    await phone.screenshot({ path: "artifacts/mobile-receipt.png" });
    await phone.getByRole("button", { name: "Close receipt" }).click();
    expect(
      await phone.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    for (const width of [320, 768]) {
      await phone.setViewportSize({ width, height: 900 });
      expect(
        await phone.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth,
        ),
      ).toBe(true);
    }
    expect(errors).toEqual([]);
    console.log(
      "Browser checks passed: three recordings, receipt/Escape, trace, JSON download, edit rejection, 320/390/768/1440px layouts, WCAG AA axe checks, no runtime errors.",
    );
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Browser check failed.",
  );
  process.exitCode = 1;
});
