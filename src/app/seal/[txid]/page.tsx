import Link from "next/link";
import { NightScene } from "@/components/night-scene";
import { BchTabs } from "@/components/bch-tabs";
import { VerifySeal } from "@/components/verify-client";
export default async function SealPage({
  params,
  searchParams,
}: {
  params: Promise<{ txid: string }>;
  searchParams: Promise<{ net?: string }>;
}) {
  const { txid } = await params;
  const { net = "chipnet" } = await searchParams;
  const valid =
    /^[a-f0-9]{64}$/i.test(txid) && (net === "chipnet" || net === "mainnet");
  return (
    <>
      <NightScene />
      <main className="app-shell bch-shell">
        <header className="site-header">
          <Link className="wordmark" href="/">
            UPGRADE ORACLE / BCH
          </Link>
        </header>
        <BchTabs active="verify" />
        {valid ? (
          <VerifySeal
            txid={txid.toLowerCase()}
            network={net as "chipnet" | "mainnet"}
          />
        ) : (
          <div className="verify-panel">
            <h1>Invalid seal link</h1>
            <p>
              Use a 64-character transaction ID and net=chipnet or net=mainnet.
            </p>
          </div>
        )}
      </main>
    </>
  );
}
