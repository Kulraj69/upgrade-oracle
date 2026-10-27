# Upgrade Oracle — DoraHacks Z.AI General Bounty (GLM agents)

Deadline: not found (DoraHacks page behind captcha). Kulraj must check in a browser. Do NOT submit.

## Idea
Paste your package.json (or a single dependency bump like `next 14 -> 16`) and a few of your source files. A GLM agent fetches the real release notes/changelogs (npm registry + GitHub releases), finds the breaking changes, greps your pasted code for each affected API, and returns a ranked "will break / might break / safe" list with the exact line and the fix. Every claim links to the changelog line it came from (receipts).

## Why it scores
Bounty asks for production-ready agents on GLM. This is a real chore every dev has, it is tool-using (fetch, search, grep, cite), and the demo is visual and short.

## Build
- Next.js 16 app, dreamcore UI copied from /workspace/devpost/qloo (night scene, receipts drawer, trace panel showing agent steps).
- Agent loop server-side: OpenAI-compatible client pointed at GLM (Nebius Token Factory `zai-org/GLM-5.3` on the box; env `GLM_BASE_URL`, `GLM_API_KEY`, `GLM_MODEL`). Tools: npm registry lookup, GitHub releases fetch, code grep over pasted files.
- Public Vercel deploy runs in demo mode with recorded real runs (no key on Vercel, so no surprise billing). Live mode when env key is present.
- Tests (vitest) for version-range diffing, changelog section extraction, grep matcher, citation checker. MIT LICENSE. README with "do X - see Y" steps.
- Demo video script (5–10 min required) in demo-script.md.

## Odds (estimate)
13 prizes on a $4K bounty; DoraHacks bounties tend to get few strong entries. Estimated 10–20% for any prize.
