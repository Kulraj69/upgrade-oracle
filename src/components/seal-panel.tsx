"use client";
import { useRef, useState, useEffect } from "react";
import Link from "next/link";
import { hexToBin } from "@bitauth/libauth";
import { useWizardConnect, WizardConnectQRDialog } from "@wizardconnect/react";
import {
  buildSealPlan,
  commitmentForReport,
  decodeCommitment,
  explorerUrl,
  NeedsGenesisUtxo,
  receiveAddress,
  validateSignedTransaction,
  wizardSignRequest,
  type SealPlan,
  type SealUtxo,
} from "@/lib/bch/seal";
import { chainRequest } from "@/lib/bch/client";
import type { BchNetwork, DoctorReport } from "@/lib/bch/types";

export function SealPanel({
  report,
  feeAddress,
}: {
  report: DoctorReport;
  feeAddress?: string;
}) {
  const [network, setNetwork] = useState<BchNetwork>("chipnet");
  const [acknowledged, setAcknowledged] = useState(false);
  const [index, setIndex] = useState(0);
  const [address, setAddress] = useState("");
  const [plan, setPlan] = useState<SealPlan | null>(null);
  const [needsPrep, setNeedsPrep] = useState(false);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState<{
    txid: string;
    kind: "seal" | "prepare";
    network: BchNetwork;
    broadcast: boolean;
  } | null>(null);
  const operation = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const wallet = useWizardConnect({
    dappName: "Upgrade Oracle · BCH",
    persistSession: false,
  });
  const commitment = decodeCommitment(commitmentForReport(report));
  const allowed = network === "chipnet" || acknowledged;
  useEffect(() => () => controller.current?.abort(), []);

  async function refresh(prepare = false) {
    if (
      !wallet.manager ||
      wallet.state !== "connected" ||
      operation.current ||
      !allowed
    )
      return;
    operation.current = true;
    setBusy(true);
    setError("");
    setPlan(null);
    setNeedsPrep(false);
    try {
      const pubkey = wallet.manager.getPubkey(0, BigInt(index));
      if (!pubkey)
        throw new Error(
          "This wallet did not share a receive xpub. Connect a compatible hdwalletv1 wallet.",
        );
      const receive = receiveAddress(pubkey, network);
      setAddress(receive);
      setPhase("Checking spendable outputs…");
      const data = await chainRequest({
        action: "utxos",
        net: network,
        address: receive,
      });
      const utxos: SealUtxo[] = data.utxos.map(
        (u: {
          txid: string;
          vout: number;
          valueSatoshis: string;
          lockingBytecode: string;
        }) => ({
          ...u,
          valueSatoshis: BigInt(u.valueSatoshis),
          lockingBytecode: hexToBin(u.lockingBytecode),
        }),
      );
      setPlan(
        buildSealPlan({
          utxos,
          address: receive,
          network,
          commitment: commitmentForReport(report),
          prepare,
          feeAddress,
          addressIndex: index,
        }),
      );
      setPhase("Ready for wallet review.");
    } catch (e) {
      if (e instanceof NeedsGenesisUtxo) setNeedsPrep(true);
      setError(e instanceof Error ? e.message : "Could not prepare the seal.");
      setPhase("");
    } finally {
      operation.current = false;
      setBusy(false);
    }
  }
  async function sign() {
    if (
      !plan ||
      !wallet.manager ||
      wallet.state !== "connected" ||
      !allowed ||
      operation.current ||
      plan.network !== network
    )
      return;
    operation.current = true;
    setBusy(true);
    setError("");
    setSent(null);
    const abort = new AbortController();
    controller.current = abort;
    const timeout = setTimeout(() => abort.abort(), 120_000);
    try {
      setPhase("Review and sign in your wallet…");
      const response = await wallet.manager.signTransaction(
        wizardSignRequest(plan),
        { signal: abort.signal },
      );
      clearTimeout(timeout);
      abort.signal.throwIfAborted();
      if (response.error)
        throw new Error(
          "The wallet declined or could not sign this transaction.",
        );
      const txid = validateSignedTransaction(plan, response.signedTransaction);
      setSent({ txid, kind: plan.kind, network, broadcast: false });
      setPhase("Signature checked. Broadcasting…");
      await chainRequest({
        action: "broadcast",
        net: network,
        hex: response.signedTransaction,
      });
      setSent({ txid, kind: plan.kind, network, broadcast: true });
      setPlan(null);
      setPhase(
        plan.kind === "prepare"
          ? "Self-send broadcast. Refresh outputs to create the seal."
          : "Seal broadcast. Save your report JSON to verify it later.",
      );
    } catch (e) {
      setError(
        abort.signal.aborted
          ? "Signing cancelled or timed out. Nothing was broadcast by this app."
          : e instanceof Error
            ? e.message
            : "Sealing failed.",
      );
      setPhase("");
    } finally {
      clearTimeout(timeout);
      controller.current = null;
      operation.current = false;
      setBusy(false);
    }
  }
  async function changeNetwork(value: BchNetwork) {
    if (busy) return;
    setNetwork(value);
    setAcknowledged(false);
    setAddress("");
    setPlan(null);
    setSent(null);
    setNeedsPrep(false);
    setError("");
    setPhase("");
    await wallet.disconnect();
  }
  return (
    <section className="seal-panel" aria-labelledby="seal-title">
      <div className="section-label">
        <span>03 / PERMANENT RECEIPT</span>
        <span>YOUR WALLET SIGNS</span>
      </div>
      <h3 id="seal-title">Seal this report</h3>
      <p>
        Mint an immutable NFT carrying the report and compiled bytecode hashes.
        Save the JSON: only hashes go on chain.
      </p>
      <div className="seal-controls">
        <label>
          Network
          <select
            aria-label="Network"
            value={network}
            disabled={busy}
            onChange={(e) => void changeNetwork(e.target.value as BchNetwork)}
          >
            <option value="chipnet">Chipnet · test BCH</option>
            <option value="mainnet">Mainnet · real BCH</option>
          </select>
        </label>
        <label>
          Receive index
          <input
            type="number"
            min="0"
            max="2147483647"
            value={index}
            disabled={busy}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (Number.isSafeInteger(n) && n >= 0 && n < 0x80000000) {
                setIndex(n);
                setPlan(null);
                setAddress("");
                setNeedsPrep(false);
              }
            }}
          />
        </label>
      </div>
      {network === "mainnet" && (
        <div className="mainnet-warning">
          <strong>Your wallet, real BCH.</strong> Select the same network in
          your wallet. Signing spends your BCH and creates a permanent
          transaction.
          <label>
            <input
              type="checkbox"
              checked={acknowledged}
              disabled={busy}
              onChange={(e) => setAcknowledged(e.target.checked)}
            />{" "}
            I intend to use mainnet with my own wallet.
          </label>
        </div>
      )}
      <details className="hash-details">
        <summary>View the 66-byte commitment</summary>
        <dl>
          <dt>Report SHA-256</dt>
          <dd>{commitment.reportHash}</dd>
          <dt>Bytecode SHA-256</dt>
          <dd>{commitment.bytecodeHash}</dd>
          <dt>Ruleset / flags</dt>
          <dd>
            {commitment.rulesetVersion} / {commitment.flags}
          </dd>
        </dl>
      </details>
      {wallet.state !== "connected" ? (
        <button
          className="bch-button"
          disabled={
            !allowed ||
            wallet.state === "connecting" ||
            wallet.state === "reconnecting"
          }
          onClick={() => {
            setError("");
            setPlan(null);
            setAddress("");
            setNeedsPrep(false);
            wallet.connect();
          }}
        >
          Connect wallet to seal
        </button>
      ) : (
        <>
          <p className="wallet-status">
            Connected: {wallet.walletName || "WizardConnect wallet"}
          </p>
          <button
            className="bch-button"
            disabled={busy || !allowed}
            onClick={() => void refresh()}
          >
            Review seal transaction
          </button>
          <button
            className="text-button"
            disabled={busy}
            onClick={() => {
              setPlan(null);
              setAddress("");
              void wallet.disconnect();
            }}
          >
            Disconnect
          </button>
        </>
      )}
      {address && (
        <p className="receive-address">
          Fund this {network} receive address:
          <br />
          <code>{address}</code>
          <br />
          <small>
            Only this receive index is used. Existing tokens are excluded.
          </small>
        </p>
      )}
      {needsPrep && (
        <button
          className="bch-button secondary"
          disabled={busy || !allowed}
          onClick={() => void refresh(true)}
        >
          Prepare a vout-0 self-send
        </button>
      )}
      {plan && (
        <div className="transaction-preview">
          <strong>
            {plan.kind === "seal"
              ? "Seal transaction"
              : "Preparation self-send"}{" "}
            · {network}
          </strong>
          <dl>
            <dt>Inputs</dt>
            <dd>{plan.transaction.inputs.length}</dd>
            <dt>Network fee</dt>
            <dd>{plan.feeSatoshis.toString()} sat</dd>
            <dt>Service fee</dt>
            <dd>{plan.serviceFeeSatoshis.toString()} sat</dd>
            <dt>{plan.kind === "seal" ? "NFT output" : "Self-send output"}</dt>
            <dd>{plan.transaction.outputs[0].valueSatoshis.toString()} sat</dd>
          </dl>
          <button
            className="bch-button"
            disabled={busy || !allowed || wallet.state !== "connected"}
            onClick={() => void sign()}
          >
            Sign &amp; broadcast {plan.kind === "seal" ? "seal" : "self-send"}
          </button>
        </div>
      )}
      {busy && phase === "Review and sign in your wallet…" && (
        <button
          className="text-button"
          onClick={() => controller.current?.abort()}
        >
          Cancel signing
        </button>
      )}
      <p role="status">{phase}</p>
      {(error || wallet.error) && (
        <p className="bch-error" role="alert">
          {error || "Wallet connection failed. Reconnect and try again."}
        </p>
      )}
      {sent && (
        <div className="seal-success">
          <strong>
            {sent.broadcast
              ? "Broadcast accepted"
              : "Broadcast status unknown · check before retrying"}
          </strong>
          <code>{sent.txid}</code>
          {sent.kind === "seal" && (
            <Link href={`/seal/${sent.txid}?net=${sent.network}`}>
              Open verification page →
            </Link>
          )}
          <a
            href={explorerUrl(sent.txid, sent.network)}
            target="_blank"
            rel="noreferrer"
          >
            View transaction ↗
          </a>
        </div>
      )}
      {wallet.uri && wallet.qrUri && (
        <WizardConnectQRDialog
          theme={{ qrSize: 220 }}
          show={
            wallet.state === "connecting" || wallet.state === "reconnecting"
          }
          onClose={() => void wallet.disconnect()}
          uri={wallet.uri}
          qrUri={wallet.qrUri}
          title={`Connect a ${network} wallet`}
          subtitle="Scan with a WizardConnect-compatible wallet"
        />
      )}
    </section>
  );
}
