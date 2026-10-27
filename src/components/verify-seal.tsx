"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { binToHex } from "@bitauth/libauth";
import {
  commitmentForReport,
  explorerUrl,
  findSeals,
  transactionId,
  validateReport,
} from "@/lib/bch/seal";
import { chainRequest } from "@/lib/bch/client";
import type { BchNetwork } from "@/lib/bch/types";

export function VerifySeal({
  txid,
  network,
}: {
  txid: string;
  network: BchNetwork;
}) {
  const [seals, setSeals] = useState<ReturnType<typeof findSeals> | null>(null);
  const [height, setHeight] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [match, setMatch] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let live = true;
    chainRequest({ action: "transaction", txid, net: network })
      .then((data) => {
        if (!live) return;
        if (transactionId(data.hex) !== txid.toLowerCase())
          throw new Error("Transaction ID does not match the returned bytes.");
        setSeals(findSeals(data.hex));
        setHeight(data.height);
      })
      .catch(() => {
        if (live)
          setError(
            "Could not fetch this transaction from Electrum. Check the network and transaction ID, then retry.",
          );
      });
    return () => {
      live = false;
    };
  }, [txid, network, attempt]);
  async function compare(file?: File) {
    setMatch("");
    if (!file || !seals) return;
    if (file.size > 512 * 1024) {
      setMatch("Report must be 512 KB or smaller.");
      return;
    }
    try {
      const report: unknown = JSON.parse(await file.text());
      validateReport(report);
      const commitment = binToHex(commitmentForReport(report));
      const seal = seals.find((item) => item.commitment === commitment);
      setMatch(
        seal
          ? `Match · report hash, bytecode hash, ruleset and flags agree with output ${seal.outputIndex}.`
          : "Mismatch · this JSON does not match the complete sealed commitment.",
      );
    } catch {
      setMatch(
        "Cannot verify this file. Choose a supported Contract Doctor report JSON.",
      );
    }
  }
  return (
    <section className="verify-panel">
      <p className="terminal-kicker">
        PERMANENT RECEIPT / {network.toUpperCase()}
      </p>
      <h1>Read the seal.</h1>
      <dl>
        <dt>Transaction</dt>
        <dd>{txid}</dd>
        <dt>Network</dt>
        <dd>
          {network} {network === "mainnet" ? "· real BCH" : "· test BCH"}
        </dd>
        <dt>Chain status</dt>
        <dd>
          {seals
            ? height && height > 0
              ? `Reported in block ${height}`
              : "Unconfirmed or confirmation status unavailable"
            : "Awaiting Electrum"}
        </dd>
      </dl>
      <a href={explorerUrl(txid, network)} target="_blank" rel="noreferrer">
        Open transaction explorer ↗
      </a>
      <p className="bch-note">
        Transaction bytes are checked against the txid. Chain status comes from
        Electrum; this page does not verify an SPV inclusion proof. An NFT
        records a commitment, not an audit or the author’s identity.
      </p>
      {error ? (
        <>
          <p className="bch-error" role="alert">
            {error}
          </p>
          <button
            className="bch-button"
            onClick={() => {
              setError("");
              setAttempt((n) => n + 1);
            }}
          >
            Retry lookup
          </button>
        </>
      ) : seals === null ? (
        <p role="status">Looking up the transaction…</p>
      ) : !seals.length ? (
        <p className="bch-error">
          No supported immutable Oracle NFT genesis commitment was found in this
          transaction.
        </p>
      ) : (
        <>
          {seals.map((seal) => (
            <div key={seal.outputIndex}>
              <h2>Seal · output {seal.outputIndex}</h2>
              <dl>
                <dt>Token category</dt>
                <dd>{seal.category}</dd>
                <dt>Report SHA-256</dt>
                <dd>{seal.reportHash}</dd>
                <dt>Compiled bytecode SHA-256</dt>
                <dd>{seal.bytecodeHash}</dd>
                <dt>Ruleset version</dt>
                <dd>{seal.rulesetVersion}</dd>
                <dt>Finding flags</dt>
                <dd>
                  {seal.flags} ·{" "}
                  {[
                    [1, "opportunity"],
                    [2, "watch"],
                    [4, "risk"],
                  ]
                    .filter(([bit]) => seal.flags & Number(bit))
                    .map(([, name]) => name)
                    .join(", ") || "no matched findings"}
                </dd>
              </dl>
            </div>
          ))}
          <div
            className="verify-drop"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              void compare(e.dataTransfer.files[0]);
            }}
          >
            <label htmlFor="verify-report">
              Drop a report JSON here, or choose a file
            </label>
            <input
              id="verify-report"
              type="file"
              accept="application/json,.json"
              onChange={(e) => void compare(e.target.files?.[0])}
            />
            <p className="bch-note">
              Both hashes and all metadata are recomputed locally. The file is
              not uploaded.
            </p>
            <p className="match-status" role="status">
              {match}
            </p>
          </div>
        </>
      )}
      <p className="bch-note">
        <Link href="/">← Examine another contract</Link>
      </p>
    </section>
  );
}
