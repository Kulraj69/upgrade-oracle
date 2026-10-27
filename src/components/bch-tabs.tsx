import Link from "next/link";
export function BchTabs({
  active,
}: {
  active: "doctor" | "dependencies" | "verify";
}) {
  return (
    <nav className="bch-tabs" aria-label="Oracle tools">
      <Link href="/" aria-current={active === "doctor" ? "page" : undefined}>
        01 / Contract Doctor
      </Link>
      <Link
        href="/dependencies"
        aria-current={active === "dependencies" ? "page" : undefined}
      >
        02 / Dependencies
      </Link>
      <Link
        href="/seal"
        aria-current={active === "verify" ? "page" : undefined}
      >
        03 / Verify a seal
      </Link>
    </nav>
  );
}
