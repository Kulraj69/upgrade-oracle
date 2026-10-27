import Link from "next/link";
import { NightScene } from "@/components/night-scene";
import { BchTabs } from "@/components/bch-tabs";
import { SealLookup } from "@/components/seal-lookup";
export default function LookupPage() {
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
        <SealLookup />
      </main>
    </>
  );
}
