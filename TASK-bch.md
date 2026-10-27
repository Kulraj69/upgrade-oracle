# Codex task: Upgrade Oracle -> Bitcoin Cash edition (BCH BLAZE 2026)

Read PLAN.md and /workspace/devpost/bch/RULES.md first. Work in this repo. This is a real hackathon entry; judges are BCH wallet/contract devs. Quality over breadth.

## Hard rules
- NEVER print, log, or commit any secret/key/env value. No files under secrets/. Never echo env vars.
- Testnet only (chipnet). Never create, fund, or use a mainnet key. Mainnet is only a user-selectable network where the USER's wallet signs via WizardConnect.
- Never invent facts about BCH. Every claim shown in the UI about a CHIP must be an exact quote from a fetched, pinned source (reuse src/lib/citations.ts quote checker). Fetch CHIP/spec text now (curl) and store snapshots under src/sources/bch/ with URL + fetch date. Useful: https://upgradespecs.bitcoincashnode.org/2026-05-15-upgrade/ , the four Layla CHIPs (loops, functions, bitwise, P2S) and CHIP-2025-03 Faster Blocks, CHIP-2026-06 OP_SIGHASH, CashScript release notes (github.com/CashScript/cashscript releases / docs). If a source cannot be fetched, drop the rule rather than guess.
- Verify CashScript features from the installed package/docs before claiming e.g. loop/function syntax support.
- Small git commits with clear messages after each working step. Do NOT git push, do NOT deploy. Keep existing tests passing; `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` must pass at the end.
- Keep the night-scene / retro oracle look. Remove Z.AI/GLM bounty branding from the README & UI (keep LLM mode optional and off by default; no key on Vercel).

## Build
1. **Contract Doctor** (default home tab, works with no API key): paste a CashScript (.cash) contract. Server compiles with `cashc` (add `cashscript`/`cashc` deps, latest), shows bytecode size, opcount, and a ranked findings list. Rules engine (src/lib/bch/rules.ts), deterministic, each finding = {rule id, severity (opportunity / watch / risk), source lines matched (file:line), exact CHIP quote + URL, plain fix}. Rules at least:
   - P2S (Layla): contract checks/builds P2SH outputs (e.g. new LockingBytecodeP2SH32/20) -> P2S output saving, quoting the CHIP.
   - NFT commitment limit now 128 bytes (was 40) when contract touches tokenCategory/nftCommitment.
   - Repeated code blocks / unrolled repetition -> loops (OP_BEGIN/OP_UNTIL) / functions (OP_DEFINE/OP_INVOKE), only if CashScript supports them; otherwise say "at the bytecode level" honestly.
   - Unlocking bytecode standard limit 1,650 -> 10,000 bytes (if quoted).
   - 2027 watch: Faster Blocks (proposed, NOT locked in) when contract uses tx.age / tx.time / this.age / block heights; quote exactly what the CHIP says about timelocks; label status with date of snapshot.
   Three demo contracts in src/lib/bch/examples (e.g. a recurring payment covenant with tx.age, a P2SH32-building covenant, a token vault) with recorded expected reports, and vitest tests for each rule (positive + negative).
2. **Seal on chain** with WizardConnect: use `@wizardconnect/react` (or dapp+core) — read its README/types from node_modules. "Seal this report" button -> QR connect -> derive receive address from xpub -> fetch UTXOs + broadcast via `@electrum-cash/network` (chipnet default server e.g. chipnet.imaginary.cash:50004 wss or whatever works — test it) -> build with libauth (or cashscript TransactionBuilder) a tx: CashToken NFT genesis (immutable NFT; category = txid of input with outpoint index 0; if no vout-0 UTXO, explain and offer a prep self-send) to the user's address, commitment = sha256(canonical report JSON) || sha256(contract bytecode) || 1-byte ruleset version || 1-byte flags (<=128 bytes; document layout), optional fee output to NEXT_PUBLIC_SEAL_FEE_ADDRESS if set, change back. Send sign request (sighash ALL|FORKID|UTXOS per WizardConnect protocol), broadcast, show txid + explorer link. Network switch chipnet (default) / mainnet with a clear "your wallet, real BCH" warning on mainnet.
   - Unit-test the tx builder with fixed fake UTXOs + a test key (generated in-test, chipnet) and verify signature/commitment with libauth's VM or decoding.
   - If possible, end-to-end test with @wizardconnect/wallet as a fake wallet in a script (scripts/wizard-e2e.ts), using a throwaway chipnet key generated at runtime and stored only in /tmp. Try to get chipnet coins from a public faucet (e.g. https://tbch.googol.cash) via curl; if it needs captcha, skip broadcast and say so in NOTES-bch.md.
3. **Verify page** /seal/[txid]?net=chipnet : fetches tx, decodes commitment, shows fields; drop a report JSON to recompute and match.
4. Keep dependency mode (existing changelog engine) as a second tab, with BCH libs as examples (cashscript 0.11 -> 0.14, @bitauth/libauth, mainnet-js). Use existing recorded-demo mechanism only for real recorded runs; if you can't record a real run, don't fake one — hide that example.
5. README: rewrite for BCH BLAZE (what, how to run, how seal works, commitment layout, sources). Write NOTES-bch.md: what works, what's verified on chipnet (txids), what's not.

Moderate scope. Stop when the above works and passes checks.
