"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export function SealLookup() {
  const [txid, setTxid] = useState("");
  const [net, setNet] = useState("chipnet");
  const router = useRouter();
  return (
    <form
      className="verify-panel"
      onSubmit={(e) => {
        e.preventDefault();
        if (/^[a-f0-9]{64}$/i.test(txid.trim()))
          router.push(`/seal/${txid.trim().toLowerCase()}?net=${net}`);
      }}
    >
      <p className="terminal-kicker">PERMANENT RECEIPTS / PUBLIC LOOKUP</p>
      <h1>Verify a report seal.</h1>
      <p>Enter the transaction ID, then compare the seal with a report JSON.</p>
      <label htmlFor="seal-txid">Transaction ID</label>
      <input
        className="verify-input"
        id="seal-txid"
        value={txid}
        onChange={(e) => setTxid(e.target.value)}
        pattern="[a-fA-F0-9]{64}"
        required
        maxLength={64}
        placeholder="64-character transaction ID"
      />
      <div className="seal-controls">
        <label>
          Network
          <select value={net} onChange={(e) => setNet(e.target.value)}>
            <option value="chipnet">Chipnet · test BCH</option>
            <option value="mainnet">Mainnet · read only</option>
          </select>
        </label>
      </div>
      <button className="bch-button">Look up seal →</button>
    </form>
  );
}
