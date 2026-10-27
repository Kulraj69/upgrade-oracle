# BCH BLAZE demo walkthrough

Use the production server with optional dependency inference disabled. Never present the local fake-wallet test as an on-chain mint.

1. Open Contract Doctor. Load **Recurring payment** and consult. Explain the compiled-template size and static opcount. Open the Faster Blocks receipt: read the exact timelock quote and show “Proposed · not locked in” plus snapshot date. The rule does not claim existing delays expire ten times sooner.
2. Load **P2SH covenant**. Consult and open the P2S receipt. Show the three matched output checks and the separate loop/function review actions. CashScript 0.14 supports both; optimizer inlining means no automatic byte-saving promise.
3. Load **Token vault**. Open the exact source quote about commitment length. Download its JSON, then edit the contract to show that the prior report and seal controls are invalidated.
4. Recompile and choose **Seal this report**. Show chipnet as default, the commitment's two hashes and metadata, and the WizardConnect QR. Close with Escape. Switching to mainnet requires the user's own wallet and explicit real-BCH acknowledgement.
5. If a compatible wallet and funded chipnet address are available, connect, review the transaction, sign and broadcast. If no vout-0 UTXO exists, review the separate preparation self-send first. The fee preview and wallet remain the final approval points.
6. If public connectivity remains unavailable, state that plainly. Run `npm run test:wizard` to demonstrate the real encrypted handshake, xpub derivation and signature/VM validation using fake UTXOs. Do not call the resulting txid a live transaction.
7. Open **Verify a seal**. With a real transaction, show decoded fields and drop the exact report JSON. With no real transaction, explain the flow and refer to the automated browser test's explicitly mocked match/mismatch cases.
8. Open Dependencies. Explain that it is optional, off by default and has no fabricated BCH recordings. Finish with the source manifest, README and NOTES for exact verification boundaries.
