# Upgrade Oracle · Bitcoin Cash edition

A contract desk for **BCH BLAZE 2026**. Paste CashScript, compile it, inspect deterministic findings backed by pinned specification quotes, then seal the report with your own wallet. The original night sky, mountain ruins, CRT terminal and paper receipts remain.

**Contract Doctor works without an API key.** No deployment, mainnet key, mainnet spending or hackathon submission is performed by this repository. See [NOTES-bch.md](NOTES-bch.md) for tested behavior and live-network limitations.

## Run

Requires Node.js 20.19+ and npm. Install development dependencies too: the install step applies the reviewed WizardConnect patches.

```sh
npm ci
npm run dev
```

Open http://localhost:3000. If the host has exhausted its file-watch quota, use `npm run build` followed by `npm start`.

1. **Contract Doctor** — choose Recurring payment, P2SH covenant or Token vault, or paste/upload a `.cash` file. Every consultation runs the installed compiler; samples are not canned responses.
2. **Dependencies** — the existing release-note analyzer, now with CashScript 0.11 → 0.14, libauth and mainnet-js input presets when explicitly enabled. There are no recorded BCH dependency runs, so their demo cartridges are hidden.
3. **Verify a seal** — enter a transaction ID and select its network. Drop the downloaded report JSON to compare the complete commitment locally.

The three demonstration contracts illustrate patterns, not production authorization or financial policies. They must not be deployed as audited vaults.

## Contract Doctor

`POST /api/doctor` accepts `{ "source": "…", "file": "example.cash" }`. It returns a reproducible `upgrade-oracle/bch-report-v1` JSON report with compiler information, bytecode, sizes, findings, matched source lines and source digests.

The installed **cashc/CashScript 0.14.0** packages are used. Compiler tests demonstrate native `for` loops and top-level `function … returns (…)` syntax; small functions may be inlined. The app does not claim every extracted function emits `OP_DEFINE`/`OP_INVOKE` or saves bytes.

Compilation accepts one source file up to 20 KB, runs in a worker with a 5-second deadline and a 128 MB heap cap, and uses CashScript's empty in-memory import resolver. Pasted code cannot resolve files from the server. Compiler output is not logged. At most two compilations run concurrently per process; operators should add infrastructure-level request limits for a public deployment.

**Measurements describe the compiled template.** Constructor argument pushes are excluded. Static opcount counts top-level non-push instructions, excluding pushed function bodies. It is not execution cost, consensus resource usage, or the size of a spending transaction.

Rules cover P2SH20/32 construction, token commitment bounds, unrolled repeated checks, reusable checks, unlocking-size assumptions and the Faster Blocks proposal's timelock semantics. Comment/string-only references are excluded. Findings are ordered risk → watch → opportunity. These are review prompts, not proof of a bug or a complete audit.

Every protocol claim is presented as an exact, contiguous quote from a fetched source. `src/lib/bch/sources.ts` checks the snapshot SHA-256 and reuses `src/lib/citations.ts`; a rule with unavailable or mismatching evidence is suppressed. The Faster Blocks finding says **proposed, not locked in**, with its snapshot date. It does not claim existing timelocks suddenly expire ten times sooner.

## Seal with WizardConnect

1. Download the report JSON and select **Seal this report**.
2. Select **chipnet** (default), connect a compatible WizardConnect wallet by QR, and use the same network in the wallet. Sessions are kept in memory, without localStorage persistence.
3. **Review seal transaction** derives a P2PKH receive address from the wallet's receive xpub and selected non-hardened address index. Fund that exact address. The app does not scan the whole wallet.
4. The server queries pinned Electrum WSS endpoints through `@electrum-cash/network` using protocol 1.5.0. Source transactions are fetched, hash-checked and decoded. Token-bearing and coinbase outputs are excluded.
5. Genesis requires a spendable plain BCH UTXO whose output index is **0**. If absent, **Prepare a vout-0 self-send** builds a separate transaction returning the funds to output 0 of the same address. Review and sign it, then refresh to build the seal.
6. Review the fees, sign in the wallet and broadcast. The app verifies unchanged inputs/outputs, `ALL | FORKID | UTXOS` (`0x61`) signatures, and the complete transaction using libauth's **BCH 2026 VM** before broadcasting.

The genesis output contains one immutable NFT (`capability: none`, fungible amount zero), with category equal to the display-order txid of the selected vout-0 input. It carries 1,000 satoshis. Remaining plain BCH returns to the same wallet address; no token inputs are consumed. Fees reserve 110 unlocking bytes per input at 2 sat/byte. There is no silent dust donation: insufficient change requires additional funding.

The mainnet switch requires an explicit **“your wallet, real BCH”** acknowledgement and reconnects the wallet. It uses the user's wallet for signing. The app does not generate or hold any blockchain private key.

If `NEXT_PUBLIC_SEAL_FEE_ADDRESS` is configured, a separate **1,000 satoshi** service-fee output is included in the seal, not the prep transaction. That public address must match the selected network. A malformed or wrong-network address stops preparation. The default has no service fee.

WizardConnect's documented wire serializers are required: the transaction travels as hex and source-output BigInts use the SDK's extended JSON format. The installed SDK types describe native values, but its transport uses `JSON.stringify` directly. `patches/` also disables protocol/key logging, removes raw session data from error logs, and makes QR cancellation local and bounded when no wallet has paired. The QR portal also has dialog semantics, Escape handling and a keyboard focus trap. Patches preserve upstream licenses and are reapplied by `npm ci`.

**Live status:** local encrypted wallet integration and VM verification pass. Public chipnet Electrum/faucet connectivity failed in this environment; no chipnet or mainnet broadcast is claimed. Wallet-specific interoperability and funded network flows still need an external live check.

## Commitment format

The application uses **66 bytes**, within the fetched specification's 128-byte limit:

| Offset | Length | Contents |
| --- | ---: | --- |
| 0 | 32 | SHA-256 of canonical report JSON, UTF-8 |
| 32 | 32 | SHA-256 of raw compiled template bytecode bytes |
| 64 | 1 | Ruleset version, currently `0x01` |
| 65 | 1 | Flags: bit 0 opportunity, bit 1 watch, bit 2 risk; other bits zero |

Canonical JSON sorts object keys lexicographically, preserves array order and strings, has no insignificant whitespace, and allows only null, booleans, strings and safe integer numbers. It rejects undefined, non-finite/fractional numbers and other non-JSON types. The report includes the supplied source, compiler version, findings and source pins; there is no nondeterministic analysis timestamp. Constructor arguments are not committed because they are not part of the compilation input.

`/seal/[txid]?net=chipnet` fetches and hash-checks the raw transaction, finds immutable NFT genesis outputs with the supported commitment layout, and shows each field. Uploaded/dropped report files remain in the browser. Matching requires both hashes, the ruleset and all flags. This proves agreement with an on-chain commitment; it does not authenticate an author, re-audit the contract or certify the report's conclusions. Confirmation status comes from Electrum, without an SPV inclusion proof.

## Sources and reproducibility

Fetched **2026-10-27** via curl. Raw text, fetch dates, content hashes and exact pinned URLs are in [`src/sources/bch/manifest.json`](src/sources/bch/manifest.json).

| Snapshot | Origin |
| --- | --- |
| May 2026 upgrade specification | https://upgradespecs.bitcoincashnode.org/2026-05-15-upgrade/ |
| P2S, loops, functions, bitwise | `bitjson/bch-p2s`, `bitjson/bch-loops`, `bitjson/bch-functions`, `bitjson/bch-bitwise`, pinned GitHub commits |
| Faster Blocks | `0353F40E/fablous`, pinned GitLab commit |
| OP_SIGHASH | `0353F40E/sighash`, pinned GitLab commit |
| CashScript 0.14.0 release notes | https://github.com/CashScript/cashscript/releases/tag/v0.14.0 |

Bitwise and OP_SIGHASH are retained as source snapshots; this release has no findings claiming their applicability. GitHub/GitLab CHIP links are commit-pinned. The upgrade website and release response are preserved by content hash; their live pages can change.

Full expected deterministic reports live alongside the three `.cash` examples. `npm run record:bch` recompiles and regenerates them; tests compare the full report. These are compiler/rule fixtures, not recorded model runs. Changing sources or report semantics requires a deliberate ruleset version/layout review before minting new seals.

`@bitauth/libauth` is pinned to **3.1.0-next.8**, the version used by CashScript 0.14.0, because it includes the BCH 2026 VM and 128-byte commitment validation. The older stable 3.0.0 VM does not provide that validation target.

## Optional dependency model

Copy `.env.example` to an ignored local environment file. Set the explicit opt-in, your HTTPS chat-completions endpoint, model name and key using the variable names documented there. Restart the local server. No specific inference vendor is required; no key is configured by this work. Model mode is forced off on Vercel.

The original release fetcher, exact quote checker, matching engine, request limits, traces and honest recording mechanism remain. Archived non-BCH recordings remain for regression tests, but are not displayed as BCH examples. No paid model run was performed and no fabricated BCH dependency report was added.

## Checks

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run test:wizard
```

`test:wizard` runs the real dapp, core and fake-wallet packages against an in-memory localhost Nostr relay. A runtime testnet HD seed is stored only in a mode-0600 file under `/tmp` and removed on completion. It verifies encrypted pairing, receive-key derivation, wire serialization, signing and the BCH 2026 VM. The fake-UTXO transaction is written only to ignored `artifacts/`, explicitly marked offline.

For an optional chipnet connectivity attempt: `npm run test:wizard -- --chipnet`. It has no mainnet branch and broadcasts only if its fresh runtime address has actual spendable chipnet funds. The faucet attempt and current limitations are documented in NOTES.

For UI checks, run `npm start` separately, then `npm run test:browser`. Install the matching Playwright Chromium first if necessary (`PLAYWRIGHT_BROWSERS_PATH=./.playwright npx playwright install chromium`). The command first creates its offline transaction fixture with the fake-wallet test, then checks all contracts against the real server, exact evidence, JSON download, invalid inputs, mainnet acknowledgement, QR cancellation, accessibility, responsive layouts and locally mocked verification match/mismatch. QR pairing material is never captured in screenshots or logs.

MIT application code. Upstream specifications and bundled fonts retain their own licenses. WizardConnect is LGPL-3.0-or-later; dependency modifications are distributed as patches. No push or deployment is part of these commands.
