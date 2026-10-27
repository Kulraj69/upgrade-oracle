# Upgrade Oracle · Bitcoin Cash edition — BCH BLAZE 2026 plan

Rules digest: /workspace/devpost/bch/RULES.md. Submissions Nov 14 – Nov 22, 14:00 UTC (7:30 PM IST).

## Track
**Mainnet Track** ($3,500 / $1,500 / $750 + BLISS tickets). Auto-entered into **Community Choice** ($750) by listing a CashTokens address. Optional later: **Migrate to XO** bounty (1 BCH x 5) — needs ~500 words of feedback Sir writes himself, so not planned by default.

## The idea in one line
Paste a CashScript contract. The Oracle tells you what the May 2026 "Layla" upgrade lets you shrink, what the 2027 proposals (Faster Blocks, OP_SIGHASH, EC ops) could touch, every claim quoted from the CHIP text, and then you **seal** the report on chain: your own wallet (via WizardConnect) mints an NFT whose 128-byte commitment holds the report hash and the contract bytecode hash. Anyone can verify a seal from a link.

Why it's fun: an oracle that reads protocol upgrades the way devs read changelogs, and stamps a verdict onto the chain. Why it fits judges: uses BCH scripting (CashTokens NFT commitments, Layla's 128-byte commitments), shows contracts how to use loops/functions/P2S, and gives the Nov 15 2026 lock-in a tool the ecosystem needs. Business: pay-per-seal fee output in the same tx; wallets/explorers can show "checked against Layla" badges; audit firms can white-label.

## What exists (reuse)
Next.js 16 app, night-scene UI, changelog fetcher, quote checker (every LLM/claim quote must exactly match source), deterministic grep matcher, trace panel, recorded demo mode, vitest.

## Build (now = scaffolding; visible polish lands Nov 14–22)
1. **Contract Doctor** (deterministic, no API key): CashScript source in → compile with `cashc` (server), bytecode size/opcount → rule engine. Each rule cites exact text from pinned CHIP/spec sources (upgradespecs.bitcoincashnode.org, CHIP repos, CashScript release notes). Rules only claim what the sources say. Three demo contracts.
2. **Dependency mode** kept: cashscript / libauth / mainnet-js / electrum-cash version bumps through the existing changelog engine.
3. **Seal** via WizardConnect (`@wizardconnect/react`/`dapp`): connect wallet by QR, derive address, fetch UTXOs (electrum, chipnet default), build tx = NFT genesis (commitment = sha256(report) ‖ sha256(bytecode) ‖ ruleset version ‖ verdict flags, ≤128 B) to user + optional fee output + change; wallet signs; broadcast; explorer link.
4. **Verify** page `/seal/[txid]?net=chipnet`: fetch tx, decode commitment, recompute hash from report JSON.
5. Network switch: chipnet default; mainnet selectable (user's own wallet signs). We never hold keys or funds.
6. Stretch: `SealMinter.cash` covenant holding a minting baton (permissionless minting enforced by script).

## Before submit — Sir's part
- Attend Workshop 2 (Sat Oct 31) or 3 (Sat Nov 7), 19:30 IST, for roll call.
- Post in t.me/bchblaze that the project is real.
- Decide on one dust-sized mainnet seal from his own wallet (rule: a mainnet-transaction feature).
- Yes before DoraHacks submit. Widget Factory slide deck (I draft).

## Odds (estimate)
Small hackathon (2025 edition had a few dozen BUIDLs). Any Mainnet prize: ~15–25% if all eligibility boxes are ticked; Community Choice depends on BLISS Belle holders, low.
