# BCH BLAZE 2026 — Upgrade Oracle: CashScript Contract Doctor (DRAFT, not submitted)

Track: Mainnet Track (1st $3,500 / 2nd $1,500 / 3rd $750 PUSD). Also eligible: Community Choice ($750, needs CashTokens address), TokenHunt pool. Possible add-on: Migrate to XO bounty (1 BCH x5; feedback must be personally written by Sir).
Submissions: Nov 14 – Nov 22, 14:00 UTC (7:30 PM IST). Live: https://upgrade-oracle.vercel.app  Repo: https://github.com/Kulraj69/upgrade-oracle

## One-liner
Paste a CashScript contract; the Doctor compiles it with the real cashc 0.14, tells you what the 2026 BCH upgrade (loops, reusable functions, bigger NFT commitments, proposed Faster Blocks) changes for it, quoting the CHIP text line by line — then lets you seal the report on-chain as an immutable CashToken NFT from your own wallet via WizardConnect.

## Why it's fun
Every contract gets a "checkup". The proof that you checked is itself a BCH NFT anyone can verify at /seal/<txid>.

## BCH usage
- CashScript compiled in-browser-server worker (cashc 0.14.0), bytecode sizes, six CHIP-cited rules.
- WizardConnect wallet connection (required by rules); chipnet default, explicit mainnet opt-in, user signs, app holds no keys.
- Seal tx: immutable NFT genesis with 66-byte report commitment, validated against libauth's BCH 2026 VM.
- Public verifier page decodes the tx and compares report hashes locally.

## Honest limits
- No live chipnet txid yet (Electrum/faucet unreachable from build box). Must do before submit.
- Mainnet rule needs one real tx from the user's wallet — Sir's call.

## Before submitting (checklist)
- [ ] Live chipnet seal tx id
- [ ] Widget Factory slides deck
- [ ] Attend prep stream Oct 31 or Nov 7, 14:00 UTC (19:30 IST) — roll call
- [ ] Post in t.me/bchblaze confirming project
- [ ] CashTokens address for Community Choice
- [ ] Demo video
- [ ] Visible improvements landed Nov 14–22 ("significantly improved during hackathon")
