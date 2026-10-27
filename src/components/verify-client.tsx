"use client";
import dynamic from "next/dynamic";
const VerifySeal = dynamic(
  () => import("./verify-seal").then((m) => m.VerifySeal),
  {
    ssr: false,
    loading: () => <p className="verify-panel">Loading verification tools…</p>,
  },
);
export { VerifySeal };
