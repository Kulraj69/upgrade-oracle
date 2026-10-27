# CHIP-2025-03 Faster Blocks for Bitcoin Cash

        Title: CHIP-2025-03 Faster Blocks for Bitcoin Cash
        First Submission Date: 2025-03-01
        Owners: bitcoincashautist (ac-A60AB5450353F40E)
        Type: Technical
        Layers: Consensus, Mining, SPV
        Status: Proposed
        Last Edit Date: 2026-10-24

## Contents

## Summary

The CHIP proposes reducing Bitcoin Cash's block target time from 10 minutes to 1 minute to enhance transaction speed, reliability, and user experience.
It delivers faster confirmations, with 95% of single-confirmation transactions clearing in under 3 minutes, compared to 25% exceeding 14 minutes today.
By shortening confirmation times, it reduces risks for zero-confirmation (0-conf) transactions, promoting wider 0-conf adoption.
It improves multi-confirmation reliability, providing frequent progress updates and lower completion time variance, with a 60-minute target (60 x 1-minute confirmations) completing in under 73 minutes 95% of the time, versus a 20% chance of exceeding 79 minutes for a 60-minute target (6 x 10-minute confirmations) today.
Modern networking ensures orphan rates stay below a tolerable 2%, maintaining scalability, security, and decentralization.
The proposal introduces a "tick" system to measure block height with fine-grained units, enabling easy future target block time adjustments while ensuring forward compatibility with consensus rules, such as the original 21M halving schedule, transaction locktimes, difficulty adjustment algorithm, and adaptive blocksize limit algorithm.
This upgrade establishes Bitcoin Cash as a faster, more competitive blockchain for both cash and DeFi applications.

## Reader's Guide

This CHIP is long because it grew by answering every question and concern raised along the way.
This guide compresses it into the few claims that matter, and points to where each is supported.

**In one sentence.** Blocks arrive 10× more often; per-block reward, difficulty, and block-size limit each scale down to 1/10th, so coin issuance, throughput, ABLA, timelocks, and the DAA all keep their meaning.
It is fundamentally a change to block frequency, and not much else.

A 1-second "tick" unit re-expresses everything that is height-sensitive, so this cadence change — and any future one — is a schedule entry rather than a protocol rewrite.

**Who benefits.** The payoff does not rest on a prediction about adoption.
Current users benefit directly: wherever a 0-conf payment degrades to a 1-conf wait — risk-flagged transactions, mempool desyncs, exchanges, multi-coin wallets — the fallback drops from a high-variance ~10-minute wait to under 3 minutes in 95% of cases.
This is the baseline improvement; any new users attracted are upside on top of it.

**What changes**

- Block frequency rises 10×: a block about every minute instead of every 10.
- Block difficulty and reward drop to 1/10th per block; the per-hour rate is unchanged.
- The adaptive block size limit drops to 1/10th per block; throughput in bytes per minute is unchanged.
- Coinbase maturity, parking, and finalization are redefined in ticks so their security-budget (maturity), depth (finalization), and chainwork (parking) meaning and wall-clock thresholds are preserved exactly.
- Parking's penalty becomes a single continuous function of tick depth instead of count-keyed tiers, so its wall-clock lock-in stays at ~40 minutes while the escalation it guards now runs 40 lower-variance blocks rather than 4 higher-variance ones.
- Median-time-past span narrows from ~100 to ~10 minutes (11 blocks, 10 intervals), and consequently the lag behind current time reduces from ~50 to ~5 minutes.
- Header chain growth rises 10×, from ~4.2 to ~42 MB/year: trivial for nodes, and made fixed-size for wallets via SHV header-root pruning ([CHIP-2026-02](https://gitlab.com/0353F40E/mmr)).
- Orphan rate rises modestly: 0.41–1.94% across our modeled conditions, against a 2% tolerable threshold.

**What does not change**

- The 21M coin schedule and halving timing, by design — enforced by an activation grid-alignment guard; the only deviation is the integer-division shortfall (1–9 sats less per 10-minute block) documented in [Block Subsidy](#block-subsidy).
- No already-set `nLocktime` / `nSequence` lock releases early; height-mode values keep the old 10-minute scale (the field is redefined for future values — see [Why Normalize...](#why-normalize-height-mode-locktime-and-sequence-rather-than-preserve-raw-height)).
- ASERT's timewarp-resistance properties, which depend only on timestamps.
- Finalization still fires at ~120 minutes, and parking's 2× lock-in still lands at ~40 minutes.
- Attack threshold floors: ~33% to maintain a parked split, ~67% to execute a finalization split, both chainwork-scaled.
- The security model: Nakamoto consensus, hashpower economics, chainwork accumulation per unit time.

**What gets safer**

1. Minority double-spend attackers face prohibitive odds sooner in wall-clock time: at an equal wall-clock embargo, the end-to-end success curve sits strictly below today's across the sub-majority range.
2. Parking-split initiation gets harder: the even-odds hashpower threshold rises from ~51% to ~58%, and the 10%-success threshold from ~33% to ~46%.
3. Accidental escalation to parking becomes vanishingly unlikely (0.5¹² ≈ 0.02% versus 0.5³ = 12.5% at equal hashpower), because a one-block lead stops sufficing only at the 12th block rather than the 3rd.
4. Hashrate drops degrade gracefully: 10% of normal hashrate yields ~10-minute blocks instead of ~100-minute ones.

**The five questions people often ask**

*Will faster blocks centralize mining?* Orphan rates rise but stay below the 2% tolerable threshold across modeled conditions (0.41–1.94%), and the centralization spiral does not follow from the numbers: orphan-loss skew does penalize small pools, but Bitcoin already has the top-8 pools above 90% of hashrate at sub-0.05% orphan rates — consolidation is driven by hardware, energy, and capital access, not orphan rates.
The model is also empirically anchored: independent reorg tracking recorded Dogecoin (1-minute blocks) near 0.15% orphan rate ([Lovejoy, "An Empirical Analysis of Chain Reorganizations and Double-Spend Attacks on Proof-of-Work Cryptocurrencies", 2020](https://www.dci.mit.edu/projects/an-empirical-analysis-of-chain-reorganizations-and-double-spend-attacks-on-proof-of-work-cryptocurrencies)) — undershooting the model's typical-case estimate, with the 2% threshold covering the worst case with room to spare.
The full analysis is in [Mining Centralization Risk](#mining-centralization-risk).

*Can light wallets afford 10× more headers?* Headers grow from ~4.2 to ~42 MB/year, but storage is already mitigated by Electrum header merkle proofs, and header pruning via [CHIP-2026-02](https://gitlab.com/0353F40E/mmr) makes it fixed-size.
Dogecoin has run 1-minute blocks since 2013 with continuous indexer and wallet support.
See [Header Chain Growth](#header-chain-growth).

*Will it still be Bitcoin?* The fixed 21M supply, the peer-to-peer cash mission, and the no-trusted-third-party promise are all untouched — halving timing is exact by construction.
Block time was never one of those promises: it was a practical guess that appears once in the whitepaper as a memory estimate, and Satoshi's pre-release code used 15 minutes.
BCH has already replaced its "heartbeat" (the DAA) three times; what hurt in the past was poor execution, not change itself.
See [Bitcoin Cash Image Risks](#bitcoin-cash-image-risks).

*What about activation risk — the long tail of software that silently keeps running?* The risky failure is confirmation-based crediting (or any block-count timer) now weighting 1/10th the chainwork — a policy change, not a bug, which is why the change ships the `confirmations_ticks` field and a chipnet run ahead of mainnet.
The rest of the long tail is cosmetic drift costing support tickets, not losses.
Monero and Zcash both shipped block-time changes under a live third-party ecosystem without a confirmation-misread loss.
See [Silent Assumptions](#silent-assumptions).

*Do faster blocks make mining attacks easier?* No: the selfish-mining threshold is set by the attacker's connectivity (&gamma;), not by block time, so it is unchanged; reduced variance favors the favorite, and in sub-majority races the attacker is the underdog.
Rent-a-hash temporary-majority cost is likewise unchanged.
See [Security Analysis](./security.md).

**Where the receipts are**

| Claim | Section |
|---|---|
| Variance math and UX scenarios | [Benefits](#benefits), [Motivation: Detailed Analysis](./motivation.md) |
| Tick mechanics and the activation grid | [Blockchain Height Abstraction](#blockchain-height-abstraction), [Specification](#specification) |
| Subsidy, DAA, ABLA | respective [Technical Description](#technical-description) sections |
| Parking ramp and escalation thresholds | [Block Parking and Unparking](#block-parking-and-unparking), [Rationale: Block Unparking Penalty](./parking.md) |
| Orphan rates and mining centralization | [Mining Centralization Risk](#mining-centralization-risk) |
| Header chain growth and SPV mitigations | [Header Chain Growth](#header-chain-growth) |
| Image and "still Bitcoin?" | [Bitcoin Cash Image Risks](#bitcoin-cash-image-risks) |
| Security and attack scenarios | [Security Analysis](./security.md) |
| Why not Avalanche, NC-MAX, DAG, Sunlight, etc. | [Evaluation of Alternatives](#evaluation-of-alternatives) |

## Introduction

Bitcoin's 10 minute block time has been an ingrained and mostly unquestioned part of its design since inception.
In the Bitcoin whitepaper ([Section 7. Reclaiming Disk Space](https://github.com/ibz/bitcoin-whitepaper-markdown/blob/master/bitcoin-whitepaper.md#7-reclaiming-disk-space)), it was only mentioned once, when discussing node memory requirements:

>A block header with no transactions would be about 80 bytes. If we suppose blocks are generated every 10 minutes, 80 bytes * 6 * 24 * 365 = 4.2MB per year. With computer systems typically selling with 2GB of RAM as of 2008, and Moore's Law predicting current growth of 1.2GB per year, storage should not be a problem even if the block headers must be kept in memory.

When the paper was first revealed on Cryptography Mailing List, it was also mentioned only once, alongside an explanation of Bitcoin's difficulty adjustment algorithm (DAA):

>> Further, your description of events implies restrictions
>> on timing and coin generation - that the entire network
>> generates coins slowly compared to the time required for
>> news of a new coin to flood the network
>
>Sorry if I didn't make that clear. The target time between blocks will probably be 10 minutes.
>
>Every block includes its creation time. If the time is off by more than 36 hours, other nodes won't work on it. If the timespan over the last 6*24*30 blocks is less than 15 days, blocks are being generated too fast and the proof-of-work difficulty doubles. Everyone does the same calculation with the same chain data, so they all get the same result at the same link in the chain.

Only later, in [e-mail exchange with Mike Hearn](https://www.bitcoin.com/satoshi-archive/emails/mike-hearn/9/#selection-25.3372-25.4009), did Satoshi hint at his reasoning, to describe what we now call orphan races and selfish mining:

>>Another is the 10 minute block target. I understand this was chosen to
>>allow transactions to propagate through the network. However existing
>>large P2P networks like BGP can propagate new data worldwide in <1
>>minute.
>
>If propagation is 1 minute, then 10 minutes was a good guess.  Then nodes are only losing 10% of their work (1 minute/10 minutes).  If the CPU time wasted by latency was a more significant share, there may be weaknesses I haven't thought of.  An attacker would not be affected by latency, since he's chaining his own blocks, so he would have an advantage.  The chain would temporarily fork more often due to latency.

Since then, technology has progressed immensely and a thriving altcoin industry has emerged, with competitors near-universally preferring shorter block times and demonstrating their viability.
Bitcoin Cash can now follow suit, leveraging modern technology to rethink that 10-minute legacy.

We will lean on the same reasoning as Satoshi and use a more conservative orphan rate threshold (2%) to show that Bitcoin Cash can safely upgrade to a 1-minute target block time and reap a 10x improvement in confirmation speed.

## Deployment

Deployment of this specification is proposed for the May 2027 upgrade.

- Activation is proposed for `1794744000` MTP, (`2026-11-15T12:00:00.000Z`) on `chipnet`.
- Activation is proposed for `1810382400` MTP, (`2027-05-15T12:00:00.000Z`) on the BCH network (`mainnet`), `testnet3`, `testnet4`, and `scalenet`.
- `regtest` carries the same activation time as `mainnet`, following the existing convention that it inherits the network upgrade schedule rather than defining its own.

There are related actions that can be done at any time, ahead or after changing consensus rules:

- Implement use of `tick` instead of `height` in APIs, see [Blockchain Height Abstraction](#blockchain-height-abstraction) and [Recommended API Changes](#recommended-api-changes)
- Implement header pruning for SPV-verifying wallets, see:
    - [CHIP-2026-02: Simplified Header Verification for Bitcoin Cash, "Flexible Trust Models" section](https://gitlab.com/0353F40E/mmr#flexible-trust-models)
    - [Electron Cash SHV implementation](https://github.com/Electron-Cash/Electron-Cash/pulls?q=is%3Apr+author%3AA60AB5450353F40E+spv)
- Extend P2P network messages with header chain roots and merkle proofs, see:
    - [CHIP-2026-02: Simplified Header Verification for Bitcoin Cash](https://gitlab.com/0353F40E/mmr#p2p-protocol-extension-for-simplified-header-verification)
    - [BCHN MR !2045: Simplified Header Verification (SHV)](https://gitlab.com/bitcoin-cash-node/bitcoin-cash-node/-/merge_requests/2045)

## Motivation

With 0-conf transactions, the BCH user experience (UX) is instantaneous, so why does confirmation time even matter?
There are many situations where 0-conf transactions won't be accepted, such as:

- **Risky transactions.** Not all 0‑conf transactions are made equal. Transactions with non‑P2PKH inputs or those for which a double spend proof (DSP) has been emitted carry a greater risk of being reversed. Even an otherwise safe P2PKH payment can be downgraded if it spends from an unconfirmed DeFi transaction (non‑P2PKH ancestor): the parent’s risk cascades, dropping the DSP score to zero. In all these cases the receiver must fall back to 1‑conf even if they normally accept 0‑conf (e.g., [Bitgree](read.cash/@bitgree/bitgree-now-uses-bitcoin-cash-double-spend-proofs-b0f864ec)).
The fallback is not a rare corner; it is the designed response to the first risk signal. Bitgree, a BCH merchant that accepts 0‑conf by default, documents it explicitly: "If a double-spend attempt appears during the 4-second waiting period, Bitgree simply displays the 1 confirmation required message, just as it did before. The same applies if double-spend proofs are not applicable to a specific transaction due to technical criteria."
- **Mempool desync.** With public‑access covenants (DeFi), many users may be trying to interact with the same contract at nearly the same time.
These contracts normally depend on 0‑conf chains for a near‑instantaneous user experience.
When an [accidental mempool desync](https://t.me/cauldronDEX/1440) occurs, further user actions are blocked until the next block is mined and contract state resynced: instantly converting fast 0‑conf UX into a 1‑conf wait.
The race can be avoided with alternative dapp architectures, each with its own trade-offs; see [Motivation: DeFi UTXO Contention](./motivation.md#defi-utxo-contention).
- **Irreversible transactions.** Examples are cross-chain swaps such as [Thorswap](https://dev.thorchain.org/concepts/delays.html#swapper-clout-reduces-delay), [Sideshift](https://docs.sideshift.ai/faq/), and [BasicSwap DEX](https://docs.basicswapdex.com/docs/about/under-the-hood).
These are most sensitive to reversals because the other side of the trade will be irreversible.
- **Multi-coin payment gateways.** Payment providers like [BitPay](https://support.3dcart.com/Knowledgebase/Article/View/1048/2/bitpay-faq-guide-for-merchants#trx-unconfirmed) (merchant network of 130k businesses globally) and [Moonpay](https://dev.moonpay.com/widget/off-ramp-faq#how-many-block-confirmations-does-moonpay-require-before-processing/confirming-receipt-of-my-crypto-off-ramp) (35M verified accounts) won't complete checkout until at least 1-conf.
- **Multi-coin wallets and services.** These simply refuse to implement real-time mempool monitoring, because they simultaneously support hundreds of networks and it would be impractical for them to monitor all mempools.
Instead, their backend will poll all blockchains on regular intervals and update user interfaces only when a transaction gets at least 1 confirmation.
For example, Trust wallet (50M downloads on Android) won't show a receiving transaction until it has 1 confirmation, and Binance (100M downloads on Android) won't show a pending deposit until it has 2 confirmations.

Even the most advanced 0-conf hardening tools leave the same gap.
Double-spend proofs (DSPs) detect an attack but do not prevent it, while zero-confirmation forfeits (ZCF) and zero-confirmation escrows (ZCE) deter reversal by having the payer post locked collateral that is slashed only if they sign two conflicting versions of the same spend — a highly localized proof-of-stake (see [Evaluation of Alternatives: Zero-confirmation Transactions](#zero-confirmation-transactions)).
All three mechanisms require all-P2PKH inputs, so none covers a payment funded by a DeFi or smart-contract transaction: exactly the cases that already fall back to 1-conf today.

Importantly, everyone wants to be a 0‑conf user, but, once a payment has been made, the decision rests entirely with the receiver.
Even at places that usually accept 0‑conf, a single risk signal or a mempool desync event can downgrade the user to a 1‑conf wait without warning: suddenly the user is stuck with a 10‑minute wait.
Because these scenarios force a fallback to on‑chain confirmations, the 10‑minute block time becomes the user‑visible speed limit.
With 10-minute block time, the 1-conf UX is already slow enough to frustrate users when their user experience is downgraded from 0-conf to 1-conf.

To make matters worse, individual block wait times vary due to the random nature of proof-of-work (PoW) mining.
Even with steady hash power, about one in four transactions waits over 14 minutes, and one in seven waits over 20 minutes ([Poisson distribution](https://en.wikipedia.org/wiki/Poisson_distribution)), further aggravating the user who is expecting a 10-minute wait.

Real-world wait tolerance supports this: a 2014 American Express survey pegs 13 minutes as the maximum acceptable wait, while a 2017 Arise study says two-thirds of customers want two minutes or less ([source](https://www.icmi.com/resources/2017/what-do-customers-really-think-about-long-wait-times)).
These studies are from 2014 and 2017: as digital payment latency fell, consumer patience fell with it, so the figures above likely overstate users' wait tolerance.

For services where on‑chain confirmations are mandatory, the only available unit of time is the 10‑minute block.
There is no way to specify, for example, a 2‑minute or 5‑minute confirmation target because every wait must be a multiple of 10 minutes.
This forces a coarse trade‑off between speed and security, and the high variance of the exponential distribution means even a single confirmation risks turning into a 20‑minute wait.

A detailed quantitative breakdown and further scenarios (variance tables, hitchhiker's paradox, DeFi-commerce friction, MEV analysis, and an interactive block interval game) are available in [Motivation: Detailed Analysis](./motivation.md).

## Benefits

In this section, all 1-confirmation analyses are predicated on services that previously required 1 confirmation continuing to require 1 confirmation after a change to 1-minute target, with the assumption they only needed the smallest nonzero amount of PoW, rather than the specific 10-minute worth of PoW.

All the n-confirmation analyses are predicated on the worst-case situation where services increase their confirmation requirements 10x.

Note that even the worst-case reading still carries a benefit: a service that scales its confirmation requirement 10× gets the same probabilistic security, but the same wall-clock target completes with a fraction of the variance (see Table 4 below), and progress updates arrive ten times more often, so user-visible stalls and uncertainty shrink even though the expected wait is unchanged.

Faster blocks are best understood as a sliding scale rather than a single trade-off: they are sometimes a benefit to speed, sometimes a benefit to security, and essentially never a downgrade on either. A service may choose the same wall-clock confirmation policy and get the same security with less variance, or a finer-grained policy across transaction sizes, or keep the same count and accept that narrower window deliberately — in none of these cases is the network worse off at the service's chosen point than it is today.

### Instant Improvement in 1-Confirmation Experience

Services like payment processors and multi-coin wallets often require one confirmation, yet with 10-minute blocks, 37% of waits exceed 10 minutes and 27% surpass 13 minutes, beyond most users' tolerance.
A 1-minute target flips this: less than 0.1% of waits exceed 7 minutes, and 95% fall within 3 minutes, delivering an immediate UX upgrade without needing external cooperation.
Compare this to Litecoin's 2.5-minute blocks, where wait times still exceed 3 minutes 30% of the time: BCH would leap ahead, offering a snappier experience than a key competitor.
As users and merchants get used to faster confirmations, it could reinforce 0-conf adoption as a byproduct.

**Table 3: Updated Likelihood of 1-Conf Wait Time Exceeding Listed Durations**
<p align="center"><img src="img/1conf-wait.png"></img></p>

Take a practical example: A user swaps tokens on a BCH DeFi app for $1000 in BCH, then wants to buy a laptop from an online store requiring 1-conf.
Today, there is a 25% chance they get "lucky" and wait 20+ minutes for that confirmation, long enough to get annoyed and complain on social media.
With 1-minute blocks, wait times under 3 minutes become the norm, fast enough to keep the transaction seamless.
This fluidity between DeFi and cash not only retains users but also attracts merchants, who see BCH as both quick and reliable.

Main beneficiaries:

- Cash Users: Individuals paying for goods and services outside the BCH 0-conf ecosystem (e.g., via BitPay or Coinbase Commerce) enjoy faster transaction clearance.
- DeFi Users: Those transitioning from 0-conf DeFi trades to cash payments face reduced delays, smoothing cross-ecosystem interactions.
- New Users: First-time BCH buyers using services requiring 1-conf (e.g., multi-coin wallets or exchanges) experience a quicker, more positive onboarding.
- Reluctant Merchants: Small businesses or online stores hesitant about 0-conf can adopt BCH with faster 1-conf payments, boosting acceptance.
- Advocates: Educators and promoters gain a compelling narrative ("faster than Litecoin"), simplifying outreach to newcomers.

### Reduced Reliance on Centralized Exchanges

Beyond the user-experience improvements at CEX-affiliated payment gateways noted above, faster confirmations also strengthen self-custody as a practical alternative to leaving funds on CEXes.
Faster confirmations are sometimes mischaracterized as a concession to centralized exchanges (CEXes) and their confirmation requirements.
The opposite is true: this upgrade reduces BCH users' need for CEXes by making self-custody and DeFi a more practical alternative.

Why do users keep funds on CEXes in the first place?
Largely because they want to trade, and current confirmation times make it impractical to deposit, trade, and withdraw on every transaction.
Holding funds on a CEX is the path of least resistance, with the trade-off being loss of self-custody, exposure to platform risk, and dependence on third-party policies.

Faster confirmations weaken that trade-off in three complementary ways:

- **On-chain DEXes run smoother.**
Cauldron, Fex.cash, BCH Bull, and similar venues benefit from faster UTXO contention recovery (see [DeFi UTXO Contention](#defi-utxo-contention)) and lower DeFi-to-cash transition friction (see [DeFi-to-Commerce Transition Friction](#defi-to-commerce-transition-friction)).
A user trading on-chain experiences less variance, fewer stuck states, and faster recovery from mempool contention.
- **Cross-chain DEXes become more responsive.**
Protocols like Thorswap perform non-custodial cross-chain swaps but still require a number of source-chain confirmations before releasing destination-chain funds.
Reducing 1-conf wait from "14 minutes 25% of the time" to "under 3 minutes 95% of the time" cuts directly into the user-visible delay of every such swap, making BCH a more attractive leg of cross-chain trades.
- **Lightweight swap services become friendlier to BCH.**
Services like Sideshift, Fixedfloat, and similar instant-swap venues already accept 0-conf or 1-conf for small amounts, but their thresholds for skipping confirmations are tuned to each chain's expected confirmation time.
Faster BCH confirmations raise the amount range at which such services can safely accept BCH without waiting for more confirmations, smoothing the experience for users moving in and out of BCH for routine swap activity.

The cumulative effect is that users have less reason to leave funds parked on CEXes between trades, and CEXes themselves face stronger competition from non-custodial and minimally-custodial alternatives.
This is a structural improvement to BCH's self-custody story, not a concession to centralized intermediaries.
The CEX UX improvement (faster deposits and withdrawals when users do interact with them) is a side benefit, not the goal.

Main beneficiaries:

- Self-Custody Users: Those who currently park funds on CEXes for trading convenience gain a more viable DeFi alternative.
- DEX Operators: On-chain trading venues see smoother operation, attracting more volume.
- Cross-Chain Traders: Users of protocols like Thorswap experience less swap-completion delay on BCH legs.
- Swap Service Users: Those using Sideshift-style instant swap venues benefit from higher 0-conf and 1-conf thresholds.
- Privacy-Conscious Users: Reduced reliance on KYC-gated CEXes for routine trading activity.

### Enhanced Multi-Confirmation Experience

Exchanges targeting a 1-hour wait (e.g., 6 confirmations at 10 minutes, 60 at 1 minute) benefit from reduced variance and frequent updates with 1-minute blocks, improving perceived progress.

**Table 4: Updated Likelihood of 1-Hour Target Wait Time Exceeding Listed Durations**
<p align="center"><img src="img/Nconf-wait.png"></img></p>

Main beneficiaries:

- Exchange Users: Individuals moving funds to or between exchanges see more predictable wait times for multi-confirmation transfers.
- Cross-Chain Traders: Users performing atomic swaps or high-value cross-chain transfers benefit from faster, more reliable confirmation windows.
- Arbitrage Traders: Those capitalizing on price differences gain efficiency, enhancing liquidity for the broader BCH ecosystem.
- High-Value Buyers: Customers purchasing big-ticket items (e.g., electronics, real estate) with BCH enjoy quicker transaction finality.
- Payment Gateways: Services batching customer transactions into single withdrawals can process them more consistently within set timeframes.

### Potential 0-Conf Adoption Benefits

By reducing block times to 1 minute, BCH becomes more appealing to new users and services that currently shy away from 0-conf due to first confirmation delays.
A larger, more active user base creates a virtuous cycle: more merchants adopt BCH, increasing opportunities for instant 0-conf transactions.
Additionally, faster confirmations lower the perceived risk of accepting 0-conf payments, as merchants can fall back to 1-conf with minimal delay if needed.
This bridges the gap between 0-conf speed and confirmation security, making BCH an everyday cash and DeFi powerhouse.

Main beneficiaries:

- Hesitant Merchants: Businesses wary of 0-conf risks can rely on fast 1-conf as a fallback, gradually building trust in instant payments.
- DeFi Users: Participants in 0-conf DeFi transactions face fewer disruptions from UTXO contention and miner extractable value (MEV), thanks to faster block resolutions.
- App Developers: Creators of wallets and payment apps can more convincingly promote BCH as both fast and secure, appealing to a wider audience.
- Casual Users: Everyday spenders (e.g., buying coffee) benefit from an expanding 0-conf ecosystem as merchant adoption grows.

### Blockchain Time Granularity

BCH's "clock" only ticks when a block is mined, meaning clock precision is tied to target block time.
Shortening the target block time would improve granularity for smart contract applications that use locktime; for example, a smart contract locking funds for 1 hour shifts from approximately 6 blocks (10% chance of exceeding 90 minutes) to approximately 60 blocks (10% chance of exceeding 70 minutes), making timeouts more predictable.

A 1-minute block clock also matches the cadence BCH DeFi already runs on off-chain: the oracle services underpinning it (General Protocols' oracles, Moria, and Paryon) all publish time signals at 1-minute intervals by independent design choices. They could run faster or slower, but converged on 1 minute as a practical trade-off. Aligning the chain's clock with these feeds means MTP advances on the same 1-minute cadence as the oracle time feeds contracts already consume, making chain-native time a more practical alternative for contracts that would otherwise reach for an external oracle.

Similarly, block reward payouts would occur more often; small pools might see payout gaps shrink from hours to minutes, leveling the field with larger players and making smaller pools more viable.

Main beneficiaries:

- Smart Contract Developers: Able to specify lock times with more precision, as block height increments more often and median-time-past advances by fewer seconds with each block.
- DeFi Users: Contracts that use locktimes would behave more responsively.
- Miners: Smaller mining pools experience less reward variance over time, improving operational predictability.

### More Responsive Mempool Fee Decay

When mempool overflows, the lowest fee rate transactions are evicted and the minimum relay fee is temporarily raised.
This fee decays back to the floor value over time, but the decay algorithm only advances after a block is mined.
With 10-minute blocks, a 40-minute outlier block (which occurs ~5% of the time) can delay fee decay by 40 minutes.
With 1-minute blocks, such delays are capped at the occasional slow block of a few minutes, making fee recovery more consistent.
Additionally, occasional reorgs cause fewer disruptions: smaller blocks mean fewer transactions re-entering the mempool at once when a block is orphaned.

Main beneficiaries:

- Users: After a burst of activity, the minimum relay fee returns to normal more predictably.
- Merchants: More consistent fee behavior reduces uncertainty when estimating transaction costs.

### Improved Difficulty Adjustment Stability

Faster blocks improve the difficulty adjustment algorithm's behavior in two ways.

**Reduced volatility from natural variance.**

Block production follows a Poisson process with high per-block variance.
With 10-minute target, a single 40-minute block puts the network 30 minutes behind schedule, triggering a 0.72% difficulty reduction.
Such deviations are common: roughly 5% of blocks take longer than 3x the target time.
With 1-minute target, the same 30-minute lag requires an unlikely streak of 30 consecutive slow blocks.
Individual blocks still vary, but deviations partially cancel out over the same wall-clock period.
This reduces unnecessary difficulty oscillations caused by random fluctuations rather than actual hashrate changes.

**More graceful degradation during hashrate drops.**

When hashrate falls, blocks slow proportionally.
At 10% of normal hashrate, 10-minute target blocks arrive every ~100 minutes, rendering the network nearly unusable.
With 1-minute target, the same hashrate produces ~10-minute blocks: degraded but functional.
Recovery is also easier on the miners, as the lower absolute difficulty means fewer hashes are needed to produce the blocks that bring the network back to normal cadence.

These properties make Bitcoin Cash more robust against hashrate volatility, whether from competition with other SHA256d chains or from market downturns that reduce mining profitability across the industry.

**Improved perceived liveness.**

Users checking block explorers will consistently find recent blocks.
With 10-minute target, gaps of 30+ minutes are routine and can cause uncertainty about network health.
With 1-minute target, such gaps become rare, providing continuous visible evidence that the network is operating normally.
During periods of market volatility and heightened attention, this consistent block production reinforces confidence in network stability.

### Reduced Memory Requirements

Typically, nodes and other software will keep the whole block in memory while processing it or serving it.
Current block size limit of 32 MB seems negligible compared to the amount of RAM typically available in today's devices.
However, nodes may want to serve clients requesting whole blocks as JSON, which amplifies the memory footprint 3-4x.
Then, if multiple clients simultaneously request different blocks, the RAM requirement grows with the number of simultaneous requests.

With a reduced target block time of 1 minute, the current maximum block size limit would be reduced to 3.2 MB, making it easier to concurrently serve a greater number of clients with the same available RAM.

## Technical Description

(Derivation, rationale, and worked examples; the normative rule list lives in [Specification](#specification), which designates some subsections below as carrying normative detail.)

Changing the target block time to 1 minute touches several protocol mechanisms, each addressed in a dedicated section below; where the analysis lives elsewhere in the document, a cross-reference is given instead:

- **Consensus rules:**
    - [Tick schedule](#blockchain-height-abstraction) fixes the interval ceiling, the divisibility rule, and the grid alignment that keep halvings pinned to the original schedule.
    - [Block subsidy](#block-subsidy) is recast in ticks, preserving the 21M halving schedule.
    - [Difficulty adjustment (ASERT)](#difficulty-adjustment-algorithm-daa) is retargeted in ticks.
    - [Adaptive blocksize limit (ABLA)](#adaptive-blocksize-limit-algorithm-abla) is rescaled to preserve throughput.
    - [Coinbase maturity](#coinbase-maturity) is redefined to 60,000 ticks (1,000 one-minute blocks).
    - [Block parking and unparking](#block-parking-and-unparking) and [finalization](#block-finalization-rolling-checkpoints) are re-expressed in ticks.
- **Timekeeping:**
    - [Median-time-past (MTP)](#median-time-past-mtp) narrows from ~100 to ~10 minutes (11 blocks, 10 intervals).
    - [Transaction locktime and sequence](#transaction-locktime-and-input-sequence) are normalized to preserve legacy semantics.
- **Mining and validation mechanics:**
    - [Coinbase BIP-34 collision mitigation](#coinbase-transaction-block-height-commitment-bip-34) closes the earlier-arriving collision window.
    - [Signature check limits](#signature-check-limits) already scale with block size; no change needed.
- **Network, clients, and APIs:**
    - [Peer-to-peer layer](#peer-to-peer-layer-changes): NODE_NETWORK_LIMITED is re-expressed as 172,800 ticks.
    - [Recommended mempool size](#recommended-mempool-size): default residency redefined in terms of hours of full blocks rather than bytes.
    - [Recommended API changes](#recommended-api-changes): additive tick and target-time fields.
    - Orphan rates and pool centralization are assessed in [Mining Centralization Risk](#mining-centralization-risk) and [Increased Orphan Rate](#increased-orphan-rate).
    - SPV header growth and explorer/indexer impact are assessed in [Header Chain Growth](#header-chain-growth) and [Activation Costs](#activation-costs).
- **Future flexibility:**
    - The [tick abstraction](#blockchain-height-abstraction) makes future target-time adjustments a parameter change, and uncle-block merging or weak-work visibility remain possible future layers (see [Tailstorm](#tailstorm), [Sunlight](#sunlight)).

### Adjustable Target Block Time

Alongside changing the target block time from 10 minutes to 1 minute, this proposal makes future adjustments easier by re-specifying height-sensitive parts of the protocol to assume a changeable target block time.
This proposal does NOT implement an automatically adjustable target block time (in the manner of ABLA's blocksize limit adjustment or DAA's difficulty adjustment).
Rather, this change reduces the burden of a future adjustment through a future CHIP.

### Blockchain Height Abstraction

To support future block time adjustments, we introduce 1-second "ticks": a height-based unit tied to idealized target time (e.g., 600 ticks per 10-minute block), distinct from variable real-world time.
The new tick unit is paired with a "tick" height, similar to the usage of "blocks" as both a unit and a height.
This abstraction allows not only this upgrade but also potential future target block time changes to be simple, consistent, and backwards compatible with existing users of the related mechanics.
Initially (blocks `1..H_a`), each block contributes 600 ticks, representing a 10-minute target time:

    tick = height * 600

After activation height `H_a` (e.g., 1,003,670 for May 15th 2027), the network shifts to 60 ticks for the next block, representing a 1-minute target time.
`H_a` is the last block whose interval is 600 ticks; all blocks at heights `1..H_a` retain the 600-tick interval:

    tick = H_a * 600 + (height - H_a) * 60          for height > H_a.

Equivalently, if expressed as height offset from activation height:

    tick(H_a)        = H_a * 600
    tick(H_a + k)    = H_a * 600 + k * 60           for k > 0

The shift from 600 to 60 ticks per block is shown in the figure below.

**Figure: Block Height vs Tick Height (Example `H_a = 1'003'670`)**\
*Ticks represent idealized target time, shifting from 600 ticks (10 minutes) to 60 ticks (1 minute) at activation.*

        +-------+ height 1,003,672, tick 602,202,120
        |  +60  |
        +-------+ height 1,003,671, tick 602,202,060
        |  +60  |                                       <-- first post-activation block interval (H_a + 1, #1,003,671)
        +-------+ height 1,003,670, tick 602,202,000    <-- activation point
        |       |
        |       |
        |       |
        |       |
        | +600  |                                       <-- last pre-activation block interval (H_a, #1,003,670)
        |       |
        |       |
        |       |
        |       |
        |       |
        +-------+ height 1,003,669, tick 602,201,400
        |       |
            ...
        |       |
        +-------+ height 1, tick 600
        |       |
        |       |
        |       |
        |       |
        | +600  | block 1, adds 600 ticks to blockchain height
        |       |
        |       |
        |       |
        |       |
        |       |
    ----+-------+---- height 0, tick 0                  <-- height is the blockchain height after the block is added
        |       |                                       <-- genesis block: ends at tick 0, so its tick is 0;
        |       |                                           target_time = 600 (the default interval, since no
        |       |                                           schedule entry precedes it)
        +-------+                                       <-- genesis contributes no ticks to the cumulative tick
                                                            (T(0) = 0): as if it started at tick -600 (height -1)
                                                            and contributed 600 to reach tick 0.

Activation switching is expressed as a schedule of overrides to the base 600-tick interval.
Each entry `{H, tau}` in the schedule means: "the block at height after `H`, and all subsequent blocks, contribute `tau` ticks until the next override (if any)."
The initial activation is thus a single-entry schedule, for example:

    { {1'003'670, 60} }

A future change to a 30-second target time at activation height `H_b` would simply append another override:

    { {1'003'670, 60}, {H_b, 30} }

and tick height would continue to progress at the new target interval durations:

    tick(H_b + k) = tick(H_b) + k * 30               for k > 0

Alternatively, ticks could be implemented as per-block state, but that is not necessary: once the schedule is set, it is a fixed list of switching points, so a block's tick is a pure function of its height (see [Activation and schedule solidification](#activation-and-schedule-solidification)).

This tick-based system replaces raw height in consensus rules (e.g., DAA, nLocktime, ABLA), allowing future block time adjustments without breaking dependencies.
If exposed via external node APIs, it allows downstream consumers to become forward-compatible with future block time adjustments.
It is a one-time change for long-term adaptability, with ticks serving as a consistent measure of idealized time.

Height remains useful as the block's index in the chain — the array offset at which it sits — and nothing here removes that.
What the tick system decouples is *time and chainwork* from that index: height says "which block," while ticks say "how much idealized time and work it represents."
Over the long run, software that only needs an ordering can keep counting blocks; software that needs time or chainwork depth can migrate to ticks — where the `ticks`, `confirmations_ticks`, `target_time`, and `next_target_time` fields in the [Recommended API Changes](#recommended-api-changes) give that migration an explicit bridge.

#### Schedule constraints

The schedule is a normative part of consensus for the BCH networks defined in this proposal.
Its entries must satisfy:

- Entries are strictly ascending in height.
- Every entry satisfies `1 <= tau <= 600`.
- Every entry satisfies that `tau` divides `600`.
- Every entry satisfies `tick(H) % 600 == 0`, where `tick(H)` is the entry height's own tick, inclusive of its own contribution.

A conforming schedule is one that satisfies every constraint in this list.
A schedule that violates any constraint in this list is outside the scope of this specification: the guarantees stated for the mechanisms that depend on it do not hold, and an implementation is not required to detect the violation, since it can only arise from a configuration error rather than from chain data.

These constraints are restated normatively in [Specification: Activation and tick schedule](#activation-and-tick-schedule); the two lists are maintained together.

Together these constraints pin every halving to the original 600-tick grid and guarantee that a fixed threshold of `600 * n` ticks is always met by at least `n` real blocks.

Four accessor conventions follow from the definition and are normative (restated in [Specification: Activation and tick schedule](#activation-and-tick-schedule)).
`GetBlockIntervalTime(h)` returns the target interval of block `h` itself, not of block `h + 1`.
`GetNextBlockIntervalTime(h)` returns the interval that block `h + 1` will contribute.
`HeightToTick(h)` returns the cumulative ticks of block `h`, inclusive of its own interval, and `TickToHeight(t)` returns the greatest height whose cumulative ticks do not exceed `t`.
The genesis block ends at tick 0 and contributes no ticks to the cumulative tick (`HeightToTick(0)` returns 0); its own target interval is the default 600, since no schedule entry precedes it, so `GetBlockIntervalTime(0)` returns 600 by convention. `GetNextBlockIntervalTime(0)` is the target interval of block 1.

Throughout this document `tau(x)` shorthand denotes the target interval of block `x`, the interval used to mine `x`, so `tau(x)` is exactly what `GetBlockIntervalTime(x)` returns, and `tau(x + 1)` matches `GetNextBlockIntervalTime(x)`.
The shorthand `T(x)` denotes the tick at height `x`, inclusive of the block's own contribution and is exactly what `HeightToTick(x)` returns.

#### Activation and schedule solidification

The schedule's switching points are discovered from the chain, not hard-coded at the moment of activation.
Activation occurs at the first block satisfying both `MTP >= activation_time` and `tick(block) % 600 == 0`, and `H_a` is that block's height, per network.
On the activation networks pre-activation blocks each contribute 600 ticks, so grid-alignment is satisfied automatically and the two conditions select the same block the MTP condition alone would.
Subsequent schedule changes are derived the same way: the first block satisfying the new MTP threshold, snapped up to the nearest height whose tick is a multiple of 600.
`H_a` is a bootstrap value rather than a permanent consensus rule.

Once `H_a` is finalized and cannot be reorged, a later release solidifies it: the MTP predicate is dropped and `H_a` is hard-coded as the schedule entry.
This is sound because every block at height `<= H_a` contributes 600 ticks regardless of how `H_a` was found, so the solidified schedule is observationally identical to the discovery rule on any chain that contains the activation.
Until solidification, the discovery rule is the only way a node syncing from genesis can place `H_a`; afterwards, a block's tick is a pure function of its height.

The discovery rule makes `H_a` branch-local until solidification: a reorg across the activation boundary can produce two branches with different activation heights and different interval patterns after their common ancestor.
This is sound because no consensus rule compares tick values across branches.
Every tick-dependent rule is evaluated within a single branch — as a distance between two blocks of that branch (parking's divergence depth, finalization's depth gate, the `nSequence` funding-to-spend span), as a block's own tick against a fixed threshold (`nLocktime`, the subsidy chunk grid), as a branch-internal schedule lookup (ABLA's and ASERT's per-block intervals), or as a block's own height against the branch's activation height (the BIP-34 shape rule).

Chain selection itself never inspects absolute ticks: competing branches are compared on chainwork exactly as before, so a boundary reorg resolves through the same first-seen and parking mechanics as any other reorg, with each branch's tick-delta quantities computed under its own schedule.

Regtest sets its activation the same way the other networks do, by carrying the mainnet activation time, so a default-config regtest node moves to the shorter cadence once that time is reached like any other chain.

The normative conditions and constraints are in [Activation and tick schedule](#activation-and-tick-schedule).

#### Candidate block ticks

Every consensus rule that refers to a block that has not yet been mined MUST obtain that block's tick from the schedule, and MUST NOT extrapolate it by adding the tip's own interval to the tip's tick.
In particular, the not-yet-mined block at height `tip + 1` has tick `HeightToTick(tip) + GetNextBlockIntervalTime(tip)`.
This matters wherever the interval changes at the height in question, which is exactly the case the activation creates, and it is the invariant behind the mempool forms of the locktime and sequence predicates.

### Block Subsidy

Using the tick-based system, we maintain the block subsidy schedule in alignment with Satoshi Nakamoto's original 21M plan (e.g., 1/10th subsidy per block with 1-minute blocks).
The below example code shows how subsidy is calculated agnostic of block height and target block time.

    // Subsidy is cut in half every chunksPerEra chunks = 600 * chunksPerEra
    // ticks, which will occur approximately every 4 years. chunksPerEra is a
    // network parameter: 210,000 on the BCH networks (= 126,000,000 ticks),
    // 150 on regtest.
    int GetBlockSubsidy(int tick, int targetBlockTime, int chunksPerEra) {
        int chunk = (tick + 599) / 600;
        int halvings = chunk / chunksPerEra;
        if (halvings >= 64) {
            return 0;
        }
        // Base subsidy: 50 BCH = 5,000,000,000 satoshis
        Amount subsidy = 5'000'000'000 >> halvings;              // Halve the base subsidy
        return subsidy * targetBlockTime / 600;                  // Scale by target block time expressed in ticks
    }

Note: The pseudocode assumes a type wide enough for the full tick range, e.g. 64 bits; the normative specification is in tick arithmetic, not in this sketch.

The halving shift is applied before the interval scaling, matching the [reference implementation](./implementation-cpp/src/subsidy_ticks.h) and the deployed node.
The order is normative.
For every conforming `tau` the opposite order gives identical results, since `tau` divides 600 makes both reduce to `floor(50e8 / (k * 2^halvings))` with `k = 600 / tau`.
Stating it anyway fixes one answer rather than leaving each implementation to establish that equivalence, and it keeps the result identical across implementations for any interval a node may be handed, including one outside the schedule constraints, where the two orders can differ by one satoshi and the guarantees above do not apply.
It also keeps the sketch a plain halving of the 50 BCH base.

On the uniform 600-tick schedule every block ends exactly on a chunk boundary, so `chunk == height` and the halving count is `height / chunksPerEra` — on the BCH networks, `height / 210'000`, identical to the legacy height-based rule at every height, including across every halving boundary.

This is what makes the change a pure re-expression on the pre-activation chain.

Because 1 minute divides 10 minutes, and every later target time likewise divides 600, the alignment carries forward: the halving count is keyed to the 600-tick chunk, not to the raw end tick.
The distinction only matters once a block interval shorter than 600 ticks is in force.
A 600-tick chunk then holds several blocks — ten, at a 1-minute target — but only the last of them ends on the chunk boundary, so keying `halvings` to the raw end tick would assign the other nine blocks the previous era's (doubled) subsidy and mint more than the schedule allows.
Keying on the chunk gives every block in a chunk the same era, and the era's block count is exactly the ideal 210,000.
The [schedule constraints](#schedule-constraints) guarantee this is well defined: because `tau` divides 600 and every entry height sits on the 600-tick grid, each block's interval lies wholly within one chunk and every multiple of 600 is a block end tick.
No separate alignment rule is therefore needed, and future target time changes satisfy the requirement automatically as long as they satisfy the schedule constraints.

Together with the 600-tick chunk keying, the original halving cadence is preserved exactly: each era spans exactly 210,000 chunks, and the halving boundaries fall on the same ticks as the legacy schedule.
The 21M supply is preserved up to the integer-division shortfall documented in [Block Subsidy Shortfall](#block-subsidy-shortfall) below, which arises from truncating the per-block subsidy at short target times.

The values admitted by the `tau` divides 600 rule are the factors of the original 600-tick target time: 600, 300, 200, 150, 120, 100, 75, 60, 50, 40, 30, 25, 24, 20, 15, 12, 10, 8, 6, 5, 4, 3, 2, 1.
A future change from a 1-minute target to a 30-second target could for example happen at tick 855,564,000 — a multiple of 600, so the chunk grid is unbroken — and continue to match the original halving points exactly.

#### Block Subsidy Shortfall

With 1-minute blocks (60 ticks per block), integer division reduces the subsidy by 1 to 9 satoshis per original 10-minute period after the 9th halving, depending on the era.

These figures are pure per-block truncation, and they assume the chunk-keyed halving count specified in [Block Subsidy](#block-subsidy).
Keying the halving count to the raw block end tick instead would add a one-time excess at whichever era contains a mid-era target-time change — `(1 - tau_new / 600)` times that era's 600-tick subsidy, or 2.8125 BCH for the 1-minute proposal — pushing the minted total above 21M rather than below it.

Over all affected halvings — the 24 eras spanning 2044 to 2140, 96 years — this accumulates to a total shortfall of 0.2499 BCH (24,990,000 satoshis).
Of that total, 0.0336 BCH (3,360,000 satoshis) is the tail-end portion: the reward for the four final eras that the 60-tick schedule stops short of paying, because it reaches zero after the 29th halving (year 2124) instead of the 33rd (year 2140).
These differences are negligible relative to losses from miner burns ([unclaimed rewards](https://bitcoin.stackexchange.com/questions/38994/will-there-be-21-million-bitcoins-eventually/38998#38998)) and are documented for completeness.

Further block time reductions would increase the shortfall and end the block subsidy earlier, as shown below.

**Table: Block Subsidy Shortfall Due to Reducing Block Target Time**

Target Time (s) | First Affected Era<sup>1</sup> | First Affected Year | Total Minted (BCH) | Total Shortfall (BCH) | Subsidy End Year
-- | -- | -- | -- | -- | --
600 |  |  | 20,999,999.9769 | 0.0000 | 2140
300 | 10 | 2044 | 20,999,999.9538 | 0.0231 | 2136
200 | 1 | 2009 | 20,999,999.8971 | 0.0798 | 2132
150 | 9 | 2040 | 20,999,999.9076 | 0.0693 | 2132
120 | 11 | 2048 | 20,999,999.8635 | 0.1134 | 2128
100 | 1 | 2009 | 20,999,999.8026 | 0.1743 | 2128
75 | 8 | 2036 | 20,999,999.8152 | 0.1617 | 2128
60 | 10 | 2044 | 20,999,999.7270 | 0.2499 | 2124
50 | 1 | 2009 | 20,999,999.6136 | 0.3633 | 2124
40 | 1 | 2009 | 20,999,999.4750 | 0.5019 | 2124
30 | 9 | 2040 | 20,999,999.4540 | 0.5229 | 2120
25 | 1 | 2009 | 20,999,999.2608 | 0.7161 | 2120
24 | 11 | 2048 | 20,999,999.3700 | 0.6069 | 2120
20 | 1 | 2009 | 20,999,998.9710 | 1.0059 | 2120
15 | 8 | 2036 | 20,999,998.9080 | 1.0689 | 2116
12 | 10 | 2044 | 20,999,998.7400 | 1.2369 | 2116
10 | 1 | 2009 | 20,999,998.0260 | 1.9509 | 2116
8 | 1 | 2009 | 20,999,997.7425 | 2.2344 | 2112
6 | 9 | 2040 | 20,999,997.4800 | 2.4969 | 2112
5 | 1 | 2009 | 20,999,996.1360 | 3.8409 | 2112
4 | 1 | 2009 | 20,999,995.6950 | 4.2819 | 2108
3 | 8 | 2036 | 20,999,994.9600 | 5.0169 | 2108
2 | 1 | 2009 | 20,999,991.6000 | 8.3769 | 2104
1 | 1 | 2009 | 20,999,984.0400 | 15.9369 | 2100

<sup>1</sup> First Affected Era: Halving era where integer division first reduces the subsidy.
Era numbering is 1-based: era 1 is the genesis era (2009–2012).

This can be mitigated by introducing fractional satoshis before the year 2044, a [feasible future upgrade](https://bitcoincashresearch.org/t/chip-2025-01-txv5-transaction-version-5/1490).

A more precise alternative would distribute each period's fractional satoshis across its blocks — for example, paying 3, 4, 4, 3, 4, 4, 3, 4, 4, 4 satoshis across each ten blocks where the ten-minute schedule pays a flat 37.
That is rejected: it makes the per-block subsidy vary within a halving era, giving ecosystem software no constant to program against, and the amounts at stake are tiny — the first down-rounding falls in era 10 (2044), and the entire
shortfall is 0.2499 BCH.

### Difficulty Adjustment Algorithm (DAA)

Bitcoin Cash's ASERT DAA targets the block interval using the following formula, re-expressed in ticks so the height term tracks the schedule rather than a fixed 600-second interval ([reference](https://documentation.cash/protocol/forks/2020-11-15-asert.html#target-computation)):

    next_target = max(1, min(powLimit,
        anchor_target
            * 2**((time_delta - (tick_delta + anchor_ideal_block_time)) / halflife)
            * anchor_ideal_block_time / next_ideal_block_time
    ))

where:

- `anchor_target` is the unsigned 256 bit integer equivalent of the `nBits` value in the header of the anchor block, which is unchanged — the existing fixed anchor at the ASERT activation height.
- `time_delta` is the difference, in signed integer seconds, between the timestamp in the header of the current block and the timestamp in the parent of the anchor block.
- `anchor_ideal_block_time` and `next_ideal_block_time` are the target block times, in seconds, of the anchor block and of the block being computed; the latter is obtained from the tick schedule at that block's height.
- `tick_delta` is `T(current) - T(anchor)`, where `T` is the cumulative tick of a block including its own interval.
- `halflife` is a constant parameter with a value of 172800 (seconds) on mainnet.

Throughout this subsection, **`current` is the tip being extended — the parent of the block being computed — and never the block being computed itself.**
`T(current) = HeightToTick(height(current))` is the tip's already-known tick.
The block being computed has no tick until it is mined; if it were needed it would be `T(current) + next_ideal_block_time` (see [Candidate block ticks](#candidate-block-ticks)), but it is not an input here.
Every input to the formula above is therefore fixed before the block is attempted: `time_delta` and `tick_delta` read the current block's header and tick, and `next_ideal_block_time` is looked up at the height of the block being computed.

`tick_delta + anchor_ideal_block_time` replaces the original formula's `ideal_block_time * (height_delta + 1)` and equals it on a uniform 600-tick chain, because it measures the idealized elapsed time between the current block and the anchor's parent, with `anchor_ideal_block_time` supplying the `+ 1` offset.
The ratio `anchor_ideal_block_time / next_ideal_block_time` (e.g., 10 for 60-second blocks) rescales the anchor's target to the block's own interval, matching the 1/10th interval time, 1/10th difficulty and 1/10th subsidy of the post-activation steady state, so hash power remains stable across the transition rather than drifting until the DAA corrects it.
The tick schedule's divisor rule, together with an anchor interval of 600, keeps `anchor_ideal_block_time / next_ideal_block_time` an integer on every conforming schedule, so this step is an exact integer scale rather than a general rational rescale.
`time_delta` and `halflife` are unchanged, so responsiveness is intact: difficulty doubles if 2 days ahead and halves if 2 days behind, at any block time.

The integer procedure is inherited unchanged from the deployed ASERT implementation (16 fractional exponent bits, the existing cubic approximation of the fractional power).
With `next_ideal_block_time = 600` the ratio is 1, so the algorithm is bit-for-bit identical to the current BCHN implementation on a uniform 600-tick chain; the reference implementation is authoritative for the exact rounding.

The formula above is restated normatively in [Specification: Normative consensus rules](#normative-consensus-rules); the two are maintained together.

#### Testnet Minimum Difficulty

The minimum-difficulty rule used by the test networks is re-expressed on the same scale as everything else.
A block is eligible for the minimum difficulty when its timestamp exceeds its parent's by more than twice the interval in force for that block. Under the ASERT-era rule there is no additional restriction preventing a minimum-difficulty block from being followed by another; that walk-back existed only in the pre-DAA EDA path, which is unrelated to this timestamp-based rule.
The threshold must be derived from the schedule rather than held as a constant.
On a 600-tick schedule it is the current 1,200 seconds; at the 60-tick steady state it is 120 seconds.
A constant threshold would either leave the test networks trivially mineable across the boundary or stall them, depending on which value was carried over, and the two failure modes differ by network.
This applies to every network where the rule is currently active.
It is specified here rather than left to the implementation because a node that applies a different threshold produces a different difficulty for the same block, which is a consensus divergence on the test networks even though mainnet is unaffected.

### Adaptive Blocksize Limit Algorithm (ABLA)

Recall that the original ABLA algorithm assumes a fixed 10-minute target block time, with rate parameters (forget factor, decay rate) implicitly calibrated to one step per 10 minutes.
To support a changeable target block time, we re-specify the algorithm so that:

- the *output* (block size limit) scales with the target block time, so that throughput per unit time is preserved across target time changes;
- the *input* (mined block size) is normalized to the base target block time, so that the algorithm responds to throughput rather than raw per-block size;
- the *rate parameters* (forget factor &gamma;, decay rate &theta;) scale with the target block time, so that per-block adjustment magnitude shrinks proportionally and the algorithm's per-unit-time response is preserved.

We also make provisions for increasing the internal state precision by an `INTERNAL_SCALING_FACTOR`, to maintain sufficient granularity at smaller block sizes.

#### Algorithm

Let:

- t<sub>n</sub> stand for the target block time of block n, in seconds (e.g. 600 for 10-minute blocks, 60 for 1-minute blocks).
- t<sub>0</sub> = 600 stand for the base target block time used as the algorithm's reference (`BASE_BLOCK_INTERVAL_TIME`).
- &sigma; stand for `INTERNAL_SCALING_FACTOR` (1), used to expand internal-state precision.

Internal state for block n consists of:

- &epsilon;<sub>n</sub>: scaled control function value (units: bytes &times; &sigma;);
- &beta;<sub>n</sub>: scaled elastic buffer value (units: bytes &times; &sigma;);
- t<sub>n</sub>: target block time of block n (units: seconds).

The block size limit for block n is given by:

- y<sub>n</sub> = (&epsilon;<sub>n</sub> + &beta;<sub>n</sub>) &sdot; t<sub>n</sub> / (t<sub>0</sub> &sdot; &sigma;) ,

so the output scales linearly with the target block time, while internal state is expressed in base-time units.

State transitions are defined as follows.
Let x<sub>n-1</sub> be the size of mined block n-1, and let:

- x'<sub>n-1</sub> = x<sub>n-1</sub> &sdot; &sigma; &sdot; t<sub>0</sub> / t<sub>n-1</sub>

be the input normalized to the base target block time and scaled by &sigma;.
This is the "throughput-equivalent" size of block n-1 at the base target block time, in scaled units.
An implementation MAY drop the &sigma; factor, leaving x'<sub>n-1</sub> = x<sub>n-1</sub> &sdot; t<sub>0</sub> / t<sub>n-1</sub>.

Then:

- &epsilon;<sub>n</sub> = &epsilon;<sub>0</sub> , if n &leq; n<sub>0</sub> ;
- &epsilon;<sub>n</sub> = &epsilon;<sub>n-1</sub> + (&gamma; &sdot; t<sub>n-1</sub> / t<sub>0</sub>) &sdot; (&zeta; &sdot; x'<sub>n-1</sub> - &epsilon;<sub>n-1</sub> - &zeta; &sdot; &beta;<sub>n-1</sub> &sdot; (&zeta; &sdot; x'<sub>n-1</sub> - &epsilon;<sub>n-1</sub>) / (&zeta; &sdot; (&epsilon;<sub>n-1</sub> + &beta;<sub>n-1</sub>) - &epsilon;<sub>n-1</sub>)) , if n > n<sub>0</sub> and &zeta; &sdot; x'<sub>n-1</sub> > &epsilon;<sub>n-1</sub> ;
- &epsilon;<sub>n</sub> = max(&epsilon;<sub>n-1</sub> - (&gamma; &sdot; t<sub>n-1</sub> / t<sub>0</sub>) &sdot; (&epsilon;<sub>n-1</sub> - &zeta; &sdot; x'<sub>n-1</sub>), &epsilon;<sub>0</sub>) , if n > n<sub>0</sub> and &zeta; &sdot; x'<sub>n-1</sub> &leq; &epsilon;<sub>n-1</sub> ;
- &beta;<sub>n</sub> = &beta;<sub>0</sub> , if n &leq; n<sub>0</sub> ;
- &beta;<sub>n</sub> = max(&beta;<sub>n-1</sub> - (&theta; &sdot; t<sub>n-1</sub> / t<sub>0</sub>) &sdot; &beta;<sub>n-1</sub> + &delta; &sdot; (&epsilon;<sub>n</sub> - &epsilon;<sub>n-1</sub>), &beta;<sub>0</sub>) , if n > n<sub>0</sub> and &zeta; &sdot; x'<sub>n-1</sub> > &epsilon;<sub>n-1</sub> ;
- &beta;<sub>n</sub> = max(&beta;<sub>n-1</sub> - (&theta; &sdot; t<sub>n-1</sub> / t<sub>0</sub>) &sdot; &beta;<sub>n-1</sub>, &beta;<sub>0</sub>) , if n > n<sub>0</sub> and &zeta; &sdot; x'<sub>n-1</sub> &leq; &epsilon;<sub>n-1</sub> .

where:

- y stands for block size limit (in bytes);
- n stands for block height;
- t stands for target block time (in seconds);
- &epsilon; (epsilon) is the "control function" (scaled by &sigma;, expressed in base-time units);
- &beta; (beta) is the "elastic buffer function" (scaled by &sigma;, expressed in base-time units);
- n<sub>0</sub>, &epsilon;<sub>0</sub>, and &beta;<sub>0</sub> are initialization values, where n<sub>0</sub> is a block height and not a tick quantity, fixed like any other upgrade's activation height: block n<sub>0</sub> is the last block carrying the flat limit;
- x stands for mined block size (in bytes);
- x' is the input normalized to the base target block time and scaled by &sigma;;
- &gamma; (gamma) is the control function's "forget factor", calibrated to the base target block time t<sub>0</sub>.
The effective per-block forget factor at target time t<sub>n-1</sub> is &gamma; &sdot; t<sub>n-1</sub> / t<sub>0</sub>, so per-unit-time response is preserved.
- &zeta; (zeta) is the control function's "asymmetry factor", unitless and independent of target time;
- &theta; (theta) is the elastic buffer decay rate, calibrated to the base target block time t<sub>0</sub>.
The effective per-block decay rate at target time t<sub>n-1</sub> is &theta; &sdot; t<sub>n-1</sub> / t<sub>0</sub>, so per-unit-time decay is preserved.
- &delta; (delta) is the elastic buffer "gearing ratio", unitless and independent of target time;
- &sigma; is the `INTERNAL_SCALING_FACTOR` (1), optionally used to expand internal state precision.

In summary, the only structural change is that input, output, and rate parameters are all expressed relative to the base target block time t<sub>0</sub>, so that the algorithm's per-unit-time behavior is preserved across target time changes.
With t<sub>n</sub> = t<sub>n-1</sub> = t<sub>0</sub> and &sigma; = 1, the algorithm reduces exactly to the original ABLA formulation.
If INTERNAL_SCALING_FACTOR is maintained at default value of 1 (as proposed), then the parametrized algorithm will exactly match the non-parametrized algorithm when target block time is constant 600.

At the activation height the ABLA internal state (&epsilon;, &beta;) continues unchanged; only the block‑by‑block scaling of input, output, and rate parameters changes from that point forward.
The first block whose state is produced by a transition is therefore block n<sub>0</sub> + 1, and that transition reads the interval of block n<sub>0</sub> itself, exactly as the equations' t<sub>n-1</sub> term reads the interval of the block being responded to for every later transition.
The value is `GetBlockIntervalTime(n<sub>0</sub>)` from the schedule, which is 600 on every deployed network because ABLA activated long before any interval change, and an implementation MUST NOT assume 600 where that does not hold.

#### Per-Unit-Time Invariance

The intent of the scaling factors is that the algorithm's behavior over a fixed wall-clock period is unchanged across target time changes, modulo discretization granularity.

Consider two consecutive blocks at target time t<sub>n-1</sub> = 600 (the original 10-minute case), versus 10 consecutive blocks at target time t<sub>n-1</sub> = 60 (the new 1-minute case).
Both cover 10 minutes of wall-clock time.

If each of the 10 small blocks has the same throughput as one large block (i.e. each small block is 1/10th the size), then:

- normalized input x' is the same in both cases: a 1/10th-size block at 1/10th the target time normalizes to the same value;
- each small-block adjustment is 1/10th the magnitude of one large-block adjustment (since the effective &gamma; and &theta; are scaled by t<sub>n-1</sub> / t<sub>0</sub> = 0.1);
- after 10 small blocks, the cumulative adjustment closely matches one large-block adjustment, with second-order differences from the multiplicative nature of EWMA.

In practice, at the proposal's mainnet scale these second-order differences are well below the algorithm's natural per-block noise floor, so the per-unit-time response is preserved; at much smaller block limits per-step integer truncation can dominate the transient instead (see [Mathematical Characteristics](#mathematical-characteristics)).

#### Output Scaling

Because the block size limit scales linearly with t<sub>n</sub>, a target time reduction from 10 minutes to 1 minute reduces the per-block limit by 10x while preserving total per-unit-time throughput.
For example, with the current 32 MB limit at 10-minute blocks, the per-block limit at 1-minute blocks becomes 3.2 MB, but 10 such blocks per 10 minutes preserves the same total throughput.

This is the intended behavior: the algorithm targets a network throughput rate, and individual block sizes scale inversely with block frequency.

#### Internal Precision

With &gamma; = 1 / 37938, &zeta; = 1.5, and `INTERNAL_SCALING_FACTOR = 1` it takes a ~101 kB step above neutral block size to move the internal state by 1.
Below neutral the step is 4× finer (~25 kB, at the initial floor state), since only the growth direction is damped by the elastic buffer.

For reference, the minimum deviation from the neutral point (&zeta; &sdot; x' = &epsilon;) that moves the control function (&epsilon;) by one unit is (integer arithmetic lands within a byte or two of these closed forms):

- shrink direction (undamped): &Delta;x<sub>min,&darr;</sub> = 1 / (&sigma; &sdot; &gamma; &sdot; &zeta;) &asymp; 25,292 B (&sigma; = 1)
- grow direction (buffer-damped), at the floor state &beta; = &epsilon;: &Delta;x<sub>min,&uarr;</sub> = (2&zeta; &minus; 1) / (&sigma; &sdot; &gamma; &sdot; &zeta; &sdot; (&zeta; &minus; 1)) &asymp; 101,168 B (&sigma; = 1)

The grow-side figure assumes the resting floor (&beta; = &epsilon;); it decreases as the buffer drains relative to the control function and increases as the buffer charges, approaching ~278 kB at the design maximum &beta;/&epsilon; &asymp; 3.33.

This is invariant of target block time because internal state is specified in its own units and we just scale inputs/outputs accordingly, and the thresholds scale as 1/&sigma;.
E.g. with scale factor of 1, internal state will remain at 32,000,000 even though block size limit will have changed to 3,200,000 with 60s target block time.
The minimal ~101 kB step in a single 60s block will move internal state by 1 and block size limit by 0.1 bytes, so 10 faster blocks can still respond to a ~101 kB deviation in a way equivalent to a single 10-minute block.

However, with a 10x reduction in per-block floor limit, the ~101 kB minimum detectable deviation becomes a larger fraction of the floor limit: the algorithm can now only respond to ~3% changes in block fullness at the floor limit (101 kB / 3.2 MB), whereas before it could respond to ~0.3% changes (101 kB / 32 MB).
Sufficiently short intervals would put the limit below the deviation and freeze the algorithm: on a 2 MB per 10-minute floor at a 12-second target the limit would be 40 kB and the neutral block about 13 kB, so even a maximally full block falls far short of the ~101 kB the control function needs to move above that neutral point.
The `INTERNAL_SCALING_FACTOR` is fixed at 1 by this proposal, and a node may hardcode that value, or omit the factor entirely, rather than expose it as a configuration parameter, because the consensus rules of this proposal admit no other value.
It is nevertheless specified here, so that a future precision requirement is an implementation and configuration change with a stated activation point rather than a re-derivation of the arithmetic: raising the factor divides the minimum detectable deviation by the same factor, and about 4 would restore motion in that example.
The alternative remedy is a higher chain-level floor, which buys the same responsiveness by changing throughput rather than precision.
Should a future CHIP adopt a different `INTERNAL_SCALING_FACTOR`, older blocks must still be verified with the configuration they were originally mined under: due to integer rounding, results under different scaling factors won't match to the bit, even though the algorithm's mathematical parameters and properties are unaffected.

#### Configuration Constants

The proposed configuration constants are unchanged from the original ABLA mainnet configuration:

- &zeta; = 1.5 ,
- &gamma; = 1 / 37938 ,
- &delta; = 10 ,
- &theta; = 1 / 37938 .

The initialization values &epsilon;<sub>0</sub> and &beta;<sub>0</sub> remain expressed in base-time units (10-minute equivalents) and scaled by `INTERNAL_SCALING_FACTOR`:

- &epsilon;<sub>0</sub> = 16,000,000 &sdot; `INTERNAL_SCALING_FACTOR` ,
- &beta;<sub>0</sub> = 16,000,000 &sdot; `INTERNAL_SCALING_FACTOR` ,

so that (&epsilon;<sub>0</sub> + &beta;<sub>0</sub>) / `INTERNAL_SCALING_FACTOR` = 32,000,000 bytes per 10-minute equivalent, which corresponds to:

- 32 MB per block at the original 10-minute target time;
- 3.2 MB per block at the new 1-minute target time;
- proportionally scaled values at any future target time.

The algorithm is defined for any `INTERNAL_SCALING_FACTOR >= 1`, and the configuration proposed here uses 1.
Because a future CHIP may raise the factor to recover precision at shorter block times, the test vectors exercise the scaling arithmetic as well as the proposed configuration: the vectors with a factor of 1 are normative for this proposal, and the vectors with a factor greater than 1 are normative for the [reference implementation](./implementation-cpp/src/abla_ticks.h) only and informative for a node that hardcodes or omits the factor, so that a later precision change has a regression guard already in place without obliging any node to carry the parameter now.

Results are not required to agree across different factors.
A change of factor is a deliberate one-off event, not an automated schedule: a future CHIP that raises the factor must specify the activation point and an explicit ABLA state hand-over to the new configuration, and nodes evaluating a historical block use the factor that was in force at that block's height.

#### Mathematical Characteristics

All previously derived characteristics (maximum and minimum rates of change, half-life, extreme buffer-to-control ratio, etc.) remain unchanged because the rate parameters &gamma; and &theta; are scaled to preserve per-unit-time behavior.
For convenience, restated for the base target block time t<sub>0</sub>:

- r<sub>max</sub> = &gamma; &sdot; (&zeta; - 1) = 1 / 75876 per base interval;
- r<sub>min</sub> = -&gamma; = -1 / 37938 per base interval;
- year-over-year extremes: +100% / -75% (52,595 base intervals per year);
- (&beta;<sub>n</sub> / &epsilon;<sub>n</sub>)<sub>max</sub> = 3.33 ;
- buffer half-life = 26,296 base intervals = ~183 days.

At a 1-minute target time, individual per-block rates are 1/10th of the above values, but per-unit-time rates (and therefore per-year extremes and half-life in wall-clock terms) are near-identical, with some minor differences due to integer arithmetics.

One such difference is visible on chipnet (the 2 MB-floor network with a dynamic configuration): at its scale ten full 60-tick blocks grow the internal state about 25% slower than one full 600-tick block, because each per-block step truncates the ~1.3-internal-unit quotient to 1.
It is accepted as a low-throughput artifact — chipnet is a test surface, not a high-TPS chain — and `INTERNAL_SCALING_FACTOR` is the documented remedy should a future network need finer response.

#### Implementation Notes

The [reference implementation](./implementation-cpp/src/abla_ticks.h) specifies the exact method of calculating the above using integer arithmetic, and executes additional steps before and after the calculation:

- **Input clamping.** The mined block size input is first clamped to the current block size limit, so that out-of-bounds input cannot trigger out-of-bounds state transitions.
- **State clipping.** After each transition, &epsilon;<sub>n</sub> and &beta;<sub>n</sub> are clipped to configuration-specific maxima (&epsilon;<sub>max</sub>, &beta;<sub>max</sub>) chosen to guarantee that internal calculations cannot overflow uint64.
- **Auto-configuration of maxima.** Maxima are derived from the configuration constants (&zeta;, &gamma;, &theta;, &delta;) and the uint64 range, ensuring correctness across the full uint64 range.
- **Fixed-point arithmetic.** All multiplication-then-division operations use 128-bit intermediate values to avoid overflow, via the reference's `muldiv` helper, which computes `x * y / z` with a uint128 intermediate.
- **Scaling factor floor.** An implementation that exposes the factor MUST reject `INTERNAL_SCALING_FACTOR == 0`, since the block size limit computation divides by t<sub>0</sub> &sdot; &sigma; (600 &sdot; &sigma; at the base interval); the reference does this in `Config::IsValid()`, and an implementation that hardcodes 1, or omits the factor entirely, has no such value to reject.
- **Interval floor.** Every ABLA entry point requires a positive block interval, because the transition divides by it; a conforming schedule produces only intervals in `[1, 600]`, so the precondition holds by construction and an implementation need not check or assert it.
- **Intermediate range.** An implementation that exposes the factor MUST ensure that the product of the base target block time and `INTERNAL_SCALING_FACTOR` cannot overflow the intermediate width; at a hardcoded 1 the product is 600 and the constraint holds trivially.
- **State representability.** Implementations MUST ensure that &epsilon;<sub>max</sub> and &beta;<sub>max</sub> are representable in the width used to store the internal state, because a wrapped state value would trip every node's validity assertion simultaneously.

#### 32-bit Implementation Limitation

The 2 GB post-filter cap from the original ABLA proposal remains in effect:

- y<sub>temporary_max</sub> = 2,000,000,000 bytes ,
- y<sub>n</sub> = min(y<sub>n</sub>, y<sub>temporary_max</sub>) .

This cap is unaffected by the target time change, since the per-block limit at the new target time (3.2 MB initially) is well below the cap.
The cap should be removed on or before May 2028, as previously specified.

#### Chain-Level Floors

No additional floor is introduced: the chain-level minimum block size scales with the target time exactly as every other ABLA output quantity does.
On networks whose base floor is 2 MB per 10-minute block (testnet4, chipnet), the post-activation floor is 200 KB, preserving those networks' designed transaction throughput rather than increasing it.
testnet3 is a 32 MB fixed-size network, so its floor scales to 3.2 MB and it keeps its total throughput; it is not subject to the 199 KB consequence below.

Consequences, accepted: post-activation usable non-coinbase space on those networks is roughly 199 KB -- until ABLA grows it under sustained load, so at most one maximum-size standard (100 KB) transaction fits per block, and consensus-valid non-standard transactions larger than that — or, in principle, transactions at vm-limits' maximal structural sigcheck density — cannot be mined there.
This mirrors the situation on Bitcoin prior to 2013, where a consensus-valid maximum-size transaction likewise could not fit a maximum-size block.
The per-block signature-check budget (size/141) scales with block size, so CPU load per second is preserved on every network.
Networks that need higher throughput for testing should adjust ABLA configuration rather than overriding the floor.

#### Block Download

The download buffer is sized from a lookahead over the blocks ahead.
The contract is one function, which takes the number of blocks to look ahead and the interval those blocks will have:

    CalcLookaheadBlockSizeLimit(config, count, interval, disable2GBCap)

It returns an integer upper bound on the block size limit `count` full blocks ahead, read in `interval`'s units.
Nothing about a download window is specified here: a caller that thinks in ticks converts its own window to a count and supplies that.
At the base interval that conversion is `ceil(window / 600)`, and the window itself is a node-local choice.
The function is valid for every `count`, so no ceiling needs to be named.

An implementation need not step the drive block by block: computing the bound in closed form costs `O(1)` instead of `O(count)` and never returns less than the stepwise answer.
This is a node-local pre-check and does not affect consensus.

##### Integer procedure

All arithmetic below is unsigned integer.
All `/` is truncating integer division.
`min` clamps to the smaller operand.
`B7 = 128`.

The reference uses `muldiv(x, y, z)` for every multiply-then-divide; the pseudocode calls out where a 128-bit intermediate is required, and nowhere else is needed.

```cpp
// Upper bound on epsilon + beta after `k` more full blocks at `interval`.
// `s0` and `eps0` come from the one exact first transition the caller makes.
uint64_t BoundSumAfterFullBlocks(const Config& cfg, uint64_t interval,
                                 uint64_t s0, uint64_t eps0, uint64_t k)
{
    if (k == 0)
        return s0;

    const uint64_t G   = interval * (cfg.zeta_xB7 - 128);   // >= 1
    const uint64_t D   = 600 * 128 * cfg.gammaReciprocal;
    const uint64_t sat = cfg.epsilonMax + cfg.betaMax;       // fits uint64

    // Past the AM-GM radius the summation has no closed equivalent, so the
    // only safe answer is the trivial maximum: a clip only lowers a
    // component. Integer division, so k * G is never formed here. A limit of
    // the FORMULA, not of the drive, which keeps stepping and clipping.
    // At the mainnet rates and interval 600, D / G = 75,876.
    if (k >= D / G)
        return sat;

    const uint64_t kG = k * G;                              // < D here

    // 128-bit: (1+delta) * eps0 * kG can reach ~2^98 at the configured maxima.
    const __uint128_t inc =
        (__uint128_t)(1 + cfg.delta) * eps0 * kG / (D - kG);

    // 128-bit addition, clamp, then narrow. sat < 2^64 so the cast is safe.
    const __uint128_t sum = (__uint128_t)s0 + inc;
    return (uint64_t)(sum < sat ? sum : sat);
}

uint64_t CalcLookaheadBlockSizeLimit(const State& s, const Config& cfg,
                                     size_t count, uint64_t interval,
                                     bool disable2GBCap)
{
    if (count == 0)
        return s.GetBlockSizeLimit(cfg, disable2GBCap);

    // Exact first block: the upcoming one, driven at `interval` but responding
    // to s's own stored block size and stored interval.
    const uint64_t firstFull =
        s.NextBlockState(cfg, 0, interval)
            .GetBlockSizeLimit(cfg, disable2GBCap);
    const State t = s.NextBlockState(cfg, firstFull, interval);

    const uint64_t sum = BoundSumAfterFullBlocks(
        cfg, interval, t.epsilon + t.beta, t.epsilon, count - 1);

    // Read back in `interval`'s units, then apply the 2 GB cap if enabled.
    const uint64_t limit = (uint64_t)((__uint128_t)sum * interval
                                      / (600 * cfg.scalingFactor));
    return disable2GBCap ? limit : min(limit, 2'000'000'000);
}
```

The first transition is the only one that reads the tip's stored state, and it is exact.
Everything after it is a full block at `interval`, which is why `count == 1` is exact and `count == 0` degenerates to the state's own limit.
Because the first transition uses the state's stored interval while the remaining blocks use `interval`, a state whose stored interval is longer than `interval` yields a bound that over-estimates by at least the ratio of the two.
That is deliberate and fails open.

##### Arithmetic bounds

| quantity | at mainnet rates | over the valid rate range | type |
|---|---|---|---|
| `G` | 38,400 at interval 600, 3,840 at interval 60 | up to 76,800 | uint64_t |
| `D` | 2,913,638,400 | up to 11,653,939,200 | uint64_t |
| `sat` | 12,297,829,382,473,034,368 | at most `maxSafe` for the config | uint64_t |
| `eps0 + beta0` | at most `sat` | at most `sat` | uint64_t |
| `kG` | below `D`, by the guard | below `D`, by the guard | uint64_t |
| `(1 + delta) * eps0 * kG` | about 2^98 | about 2^98 | 128-bit |
| `sum * interval` | about 2^74 | about 2^74 | 128-bit |

Multiply before dividing and divide once.
Folding the floor into the multiplication gives a value below the true bound.

`G` is nonzero and `D / G` is well defined because the schedule constraints give `interval >= 1` and `Config::IsValid` requires `zeta_xB7 >= 129`.
A hand-built config that bypasses validation can divide by zero here.

##### Guarantees

- **Upper bound, unconditionally.** The returned value is `>=` what the exact per-block drive returns, for every state, every `count`, and every conforming config.
The comparison target is the deployed loop, which steps every block of the span with no stopping rule and no clip-aware short cut.
The download pre-check depends on this: a buffer sized from it can be too large, never too small, so it cannot reject a valid block.
- **Monotone in `count`.** A larger `count` never returns a smaller value, because the sum bound is non-decreasing in `k`.
- **Exact for `count == 1`.** With `k == 0` the bound returns the first step's `epsilon + beta` unchanged.
- **`count == 0` is the state's own limit.** A span holding no block is read at the state's stored interval.
- **Never above the internal maximum.** Every branch returns at most `epsilonMax + betaMax`.
- **At most 2 GB.** The output cap is applied last, as everywhere else in ABLA.

A caller comparing against an exact drive MUST use `>=`, never equality.

##### Tightness

While the closed form is available, it exceeds the exact drive only by the per-block decay it drops.
Over a two-hour window at the base interval (twelve blocks) the slack is 4,746 bytes on a 32 MB limit, about 0.015%.
At a one-day window (144 base blocks) it is under 0.2%.
Both figures are for the base interval; over the same tick span at a shorter interval the relative slack is the same, which is the per-unit-time invariance showing up in the bound rather than in the state.

Past the AM-GM radius the summation has no closed equivalent and the trivial maximum is returned.
That is a limit of the formula rather than a regime anything observes: from the floor state `epsilon` needs roughly 1,965,530 base blocks to reach `epsilonMax`, while the radius is 75,876, a factor of about 26.
A state that is already its own fixed point returns `epsilonMax + betaMax` from both the bound and the drive, because every further block leaves it pinned.

##### Why it is an upper bound

A full block has `x' = epsilon + beta`, so the amplified size equals the buffer-inclusive limit, `bytesToAdd == bytesMax`, and the buffer-dependent offset cancels.
The control step therefore reduces to `floor(epsilon * G / D)`, so `epsilon` grows geometrically by at most `(1 + G/D)` per block.
Only the growth branch touches `beta`, adding `delta` times that same increment; dropping the per-block decay can only enlarge the result.
With `s = epsilon + beta`, the two recurrences are

    s_{k+1} <= s_k + (1 + delta) * (G/D) * epsilon_k
    epsilon_{k+1} <= epsilon_k * (1 + G/D)

Summing the geometric series gives `s_k <= s_0 + (1 + delta) * epsilon_0 * k*G / (D - k*G)` whenever `k*G < D`, which is the expression in `BoundSumAfterFullBlocks`.

The `epsilonMax` and `betaMax` clips only lower a component, so neither recurrence is broken by them.
Bounding the sum rather than `epsilon` and `beta` separately is what keeps it valid once `epsilon` is pinned at `epsilonMax`, because the gear term charges `beta` from the unclipped control step and a bound on `epsilon` alone cannot capture that.

Every step of the drive truncates downward, so truncating the closed form and the final limit preserves the inequality.

##### Choosing the interval

`interval` is the interval of the blocks being bounded, and the bound is read back in that interval's units.
It is not required to be the base interval.
A caller that passes the interval the blocks ahead will actually have -- which the schedule supplies through `GetNextBlockIntervalTime`, as [Candidate block ticks](#candidate-block-ticks) already requires -- gets a tight bound on the per-block limit those blocks face.
From a 60-tick state at a 60-tick interval, ten full blocks give a bound 38 bytes above the exact drive on a 3.2 MB limit, about 0.001%.

Passing the base interval instead asks a different question: what the limit would be if the blocks ahead were 600 ticks long.
That is a legitimate worst case when the future interval is genuinely unknown, and it is what a schedule-agnostic caller is forced to assume.
On a chain running 60-tick blocks the answer over-estimates the in-force per-block limit, and the over-estimate has two sources that compound.
The first is the readback unit: the same internal sum expressed at 600 ticks per block is ten times the figure expressed at 60.
The second is growth: the control step is `floor(epsilon * G / D)` with `G` proportional to `interval`, so a 600-tick block adds roughly ten times as much to `epsilon` as a 60-tick one, and the same `count` therefore spans ten times the ticks and leaves the internal state further along.
At `count = 1` only the first source is present, because that single transition responds to the tip's stored block size and stored interval either way: the same 60-tick tip reads 32,000,189 bytes at 600 against 3,200,018 at 60, exactly the interval ratio.
For larger counts both sources apply, so the gap exceeds that ratio and widens with the count and with how far the state has already grown.
Reading back at the chain's own interval costs nothing and is strictly tighter, so the base-interval call is a deliberate choice rather than a requirement.

A shorter interval also keeps the closed form available over more blocks: the AM-GM radius is 75,876 base blocks but 758,760 at 60 ticks, so the same tick span stays within the summation's reach by a factor of ten in block count.

Both readings fail open.
Over-estimating only sizes a download buffer too large, which cannot reject a valid block.
The relative slack from the dropped decay is unaffected, because it is a per-unit-time quantity: the same tick span accumulates the same number of decay terms either way.

### Median Time Past (MTP)

The MTP definition is unchanged: it is the median timestamp of the past 11 blocks.
Consensus still requires that a block's own header timestamp be strictly greater than the MTP of its 11 predecessors, and a time-mode `nLocktime` is only binding when it is not below that MTP — a lock set strictly below the current MTP is already final and releases immediately (it is admissible to the mempool and may be mined in an upcoming block), while a lock equal to the current MTP is still non-final and releases once a later block's MTP exceeds it.

Because the 11-block (10 intervals) window covers less wall-clock time at a 1-minute target, MTP trails real time by about 5 minutes on average rather than about 50 minutes.

During the transition the MTP-to-wall-clock gap closes as 1-minute blocks replace 10-minute blocks in the window, in up to five steps of roughly 9 minutes each.
These are smaller than the jumps that already occur from natural block-time variance and are not expected to cause issues.

### Future Time Limit and Network-Adjusted Time

This proposal alters neither constant on the timestamp surface: the two-hour margin that turns network-adjusted time into the future-time limit (FTL), nor the 70-minute cap on the peer-derived offset applied to the local clock.
The mechanism behind those constants, and its weak subjectivity, are described in [Security Analysis: Future Time Limit and Network Adjusted Time](./security.md#future-time-limit-and-network-adjusted-time).

What changes is the distance between the two bounds.
MTP is the median of eleven timestamps, so when timestamps are pinned near FTL it settles five intervals below it: 50 minutes below at 600 ticks, 5 minutes below at 60 ticks.
The FTL itself does not move, so at a one-minute cadence the MTP-derived release ceiling sits roughly 115 minutes ahead of real time instead of roughly 70.

That widens the band of time-mode locks an adversary able to pin timestamps near FTL can make mature early, from "shorter than ~70 minutes" to "shorter than ~115 minutes".
The incentive structure and the hashpower required are unchanged: advancing the median takes six of every eleven timestamps in either regime, since five leave it unmoved.
Locks below ~70 minutes were already outside the security-bearing range, so the additional 45 minutes are the practical loss.

Tightening the margin, the offset cap, or both is deferred to a separate CHIP; see the closing note of [Security Analysis: Timewarp Attacks](./security.md#timewarp-attacks).

### UTXO Database

The UTXO database stores block height to evaluate checksequence and coinbase maturity consensus rules.
Switching to ticks is fully compatible, with two implementation options:

1. Update the database to store tick values instead of height.
2. Compute tick from height using the formulae above.

The second approach mirrors how nodes currently derive median time past (MTP) by looking up height in the block index rather than storing MTP directly.
It also supplies the funding coin's tick, which the height-mode `nSequence` predicate requires, so relative-lock evaluation needs no change to the database schema.

### Transaction Locktime and Input Sequence

Height-mode `nLocktime` and `nSequence` are normalized to the 10-minute scale: values are compared against ticks, not raw height.

Writing `L` for a height-mode `nLocktime` value and `T(b)` for the tick of block `b` inclusive of its own contribution, a transaction is final in block `b` if `T(b) > 600 * L`.
The comparison is exact and MUST NOT be floored or otherwise rounded, because the predicate is on the tick itself rather than on the tick's normalized quotient.
As today, `nLocktime = 0` is final at every block, and a transaction whose inputs all have `nSequence = 0xffffffff` (`SEQUENCE_FINAL`) is final regardless of its `nLocktime`; the absolute locktime binds only when at least one input opts in with a non-final sequence.
The mempool applies the same predicate to the upcoming block, using `T(tip + 1)` from the schedule rather than `T(tip) + tau(tip)`.
For both predicates the mempool gate is this same test applied to the block being assembled, never a looser or tighter variant, so the mempool view cannot diverge from block validation at the boundary.

Writing `n` for a height-mode `nSequence` value, `T(c)` for the tick of the block creating the spent coin, and `T(b)` for the validating block's tick, an input is mature in block `b` if `T(b) - T(c) >= 600 * n`.
The comparison is exact and MUST NOT be floored or otherwise rounded.
The mempool applies the same predicate to the upcoming block; an input spending an unconfirmed parent is treated as if the parent were mined in the upcoming block, so its `T(c)` is `T(tip + 1)`.

The two predicates are deliberately asymmetric, and the difference is not an inconsistency.
`nLocktime` is absolute and names the last block in which the transaction is non-final, so release is the block after it: a strict comparison.
`nSequence` is relative and names a wait counted from the funding block, so release is the funding block plus the wait: a weak comparison.
Both are ported verbatim from the height-based rules; using a strict comparison for `nSequence` would add one interval of delay to every deployed relative lock and would break the requirement that a 600-tick schedule reproduces existing vectors unmodified.

Affected script opcodes:

- OP_CHECKLOCKTIMEVERIFY and OP_CHECKSEQUENCEVERIFY compare their stack argument against the transaction's own fields, and the block reference enters only through the predicates above, so legacy contracts function as intended, with cutoffs `T(b) > 600 * S` and `T(b) - T(c) >= 600 * n`.
- OP_TXLOCKTIME and OP_INPUTSEQUENCENUMBER return the raw fields unaltered, and Script has no opcode returning a block index or normalized height, so a contract that writes a field, reads it back, and compares it against another field value is unaffected: both sides remain in the same units.

Because every interval is at least 1 tick and at most 600 ticks, a normalized `n`-unit relative lock (or maturity) is satisfied by at least `n` and at most `600n` real blocks, so it never collects fewer confirmations than a uniform 600-tick schedule would have given it.
This is the reason the 600-tick ceiling is normative rather than merely a safety margin on the tick machinery.

Time-mode locks are unchanged: median-time-past is already in seconds and is compared directly against the field value.
Height mode is the only encoding of a relative quantity of blockchain progression — time-mode `nSequence` meters in 512-second MTP steps, so a ~26-minute (three-step) window only imposes a one block floor: it can take a single block — if MTP jumps when the median flips past a timestamp cliff — or many blocks — if MTP is slowed with low mined timestamps.
An absolute height-mode lock names a position, not a delay, so the number of blocks between funding and release depends on when the funding transaction is mined — exactly as today; a coin funded at or after the named boundary is already released: the mempool accepts the spend at that tip and it is valid in the next block, because every block adds at least one tick, so `T(tip+1) > 600·L`.

With every interval equal to 600 both predicates reduce to the current height-mode rules (`b > L`, `b - c >= n`), so no already-deployed lock releases early: each still denominates 600 ticks per unit — a `600·L`-tick boundary for an absolute lock, a `600·n`-tick span for a relative one.
What moves is only the block count of the wait — an absolute lock naming a post-activation height releases at a higher block index, the first block whose tick exceeds the named `600·L` boundary (which a 60-tick chain reaches one 60-tick interval past it, versus one 600-tick interval on the old cadence) — and a relative lock's span becomes `n` to `600n` blocks, never fewer — the confirmation floor above.
The boundary semantics and the failure modes are argued in [Why Normalize...](#why-normalize-height-mode-locktime-and-sequence-rather-than-preserve-raw-height).

**Table:** Blockchain Progression Unit Conventions (example with faster blocks activation at height 1,000,000)

|Block index|Block "height" in 10 min. units|Block tick in 1 sec. units|
| --- | --- | --- |
|999,999|999,999.0|599,999,400|
|1,000,000|1,000,000.0|600,000,000|
||||
|1,000,001|1,000,000.1|600,000,060|
|1,000,002|1,000,000.2|600,000,120|
|…|…|…|
|1,000,010|1,000,001.0|600,000,600|
|1,000,011|1,000,001.1|600,000,660|

Someone reading height 1,000,010 and setting `nLocktime = 1,000,011` does not unlock after one block: the value names the 600,006,600-tick boundary, first crossed by block 1,000,111 — about 101 minutes after the tip.
The mistake fails loudly at broadcast, so the wallet must be fixed before the transaction mines.

App-layer software that sets new locks from the live tip height must convert to normalized units.
A [community survey](https://bitcoincashresearch.org/t/wallet-default-nlocktime-practices/1878) run for this CHIP found that most wallets already set `nLocktime = 0` and are unaffected, while Electron Cash and BCHN currently default to tip height and must change before activation.
The anti-fee-sniping rationale for that default was never analyzed against BCH's conditions, and setting the field to 0 is the simplest fix (see [Security Against Targeted Tip Rewrite](./security.md#security-against-targeted-tip-rewrite-sniping)).

A contract that works purely in field units keeps its meaning: a +1 offset is still one normalized 10-minute interval, enforced against the same scale, though the field gains no finer granularity.
Tick-based locks in new transaction or input fields are out of scope and would reopen fine-grained height-mode later.

#### Why Normalize Height-Mode Locktime and Sequence Rather Than Preserve Raw Height?

Height-mode locktime and sequence are where this CHIP changes semantics rather than merely re-expresses them: a deliberate redefinition.
No already-set lock releases early: value `L` names the 600·L-tick boundary, and the transaction is final in the first block whose tick exceeds it, the same idealized ten-minute instant on any schedule.
It becomes mempool-eligible one block before that, at the tip whose upcoming block is the release block, because the mempool gate is the same test applied to the block being assembled rather than to the tip: `T(tip + 1) > 600·L`.

What is dropped is the literal block-count reading of post-activation values, replaced by ten-minute (600-tick) units; every other meaning survives.
A post-activation value releases in the first block whose tick exceeds the boundary it names — exactly where a 600-tick continuation would place it.
The trade is broken software, intact money, stated here deliberately.

The alternative was to preserve raw height, whose failure mode is strictly worse:

- Raw height lets live locks release up to ten times early — ParyonUSD's twelve-block redemption delay becomes twelve minutes, FutureBCH's futures mature tenfold earlier and its rollout grid compresses tenfold, and cadence-keyed minters like the Popcorn! contract mint at a tenfold rate — silent and harmful to counterparties, and unrecoverable for immutable contracts.
- Normalization keeps every already-set lock's release — the unlock transaction becomes valid, and mempool-eligible, at the same idealized ten-minute instant as before — and moves the cost to software that builds new locks.

That software is fixable, and its mistakes usually fail loudly at broadcast: a far-future lock is simply rejected and never mines.
Only a contract that pre-commits a future absolute lock value derived from the live tip can fail silently, stretching the post-activation segment tenfold.
FutureBCH avoids it: each lock derives from the previous one (`prev_lock + offset`), so its semantics are unaffected — field units keep meaning as the contract evolves.
The silent failure is also catchable: it would surface in chipnet testing before mainnet — unless a contract is deployed directly to mainnet without that pass.

Normalization is the only option whose failure mode can be remedied after activation: software can be fixed; an immutable contract that released early could not.
Native tick-based locks in new fields remain out of scope; they would reopen fine-grained height-mode later.

### Coinbase Maturity

Currently, coinbase matures after 100 block confirmations.
To maintain the same nominal depth, we redefine this to 60,000 ticks (equivalent to 100 10-minute blocks or 1,000 1-minute blocks).
Writing `T(x)` for the tick of block `x` inclusive of its own contribution, an output created in block `c` is spendable in block `b` if and only if `T(b) - T(c) >= 60,000`.
With every interval equal to 600 this reduces to `b - c >= 100`, the current rule.

### Block Parking and Unparking

Parking resists a reorganization by requiring a competing chain to out-work the active tip rather than merely match it.
It is chain-selection policy, not block validity: a parked block is valid, retained, and may be connected later.
Two layers of subjectivity apply — competing tips can arrive in either order (first-seen), and each side uses the rules in force on its own branch — as is typical with MTP upgrade activation (branch-local until the upgrade solidifies).
This proposal replaces the pre-existing count-keyed tiers with a single continuous function of tick depth on a defending branch once its tip has connected `H_a + 1` (`height(def) >= H_a + 1`), rather than a simple re-scaling of the rule.
This approach is justified in [Rationale: Block Unparking Penalty](./parking.md).

Throughout, `def` is the active (defending) tip, `comp` is the tip of the competing branch under evaluation, `fork` their most recent common ancestor, and `T(x)` the cumulative tick of `x` on the defending branch.
Then `d = T(def) - T(fork)` is the divergence depth in ticks, and `D` and `E` are the defending and competing work since `fork`.
`W` is one block's work at the defending tip's difficulty, used only in the exposition below; the rule itself reads `D` and `d`.
The trigger and the penalty use deliberately different measures: the trigger is block-count, `d` is tick-depth.

#### Mechanism framework

The base rule is common to the old and new mechanisms; this proposal changes only the penalty, treated in the sections that follow.

Most work wins, and first-seen breaks a tie.
Two blocks sharing a parent also share the parent's required target (ASERT derives it from the parent's timestamp), so they carry identical work.
A depth-1 race is therefore an exact tie, always resolved by first-seen: a challenger needs a full block of extra work to usurp, never parity.
That is the one-block hysteresis.

Under Bitcoin's original DAA, difficulty was constant across the 2,016-block window, so the hysteresis was exact throughout.
Under a per-block DAA, the work varies: siblings still tie, but once a one-behind tip catches up, the two equal-height tips have different parents and may carry different work.
Height parity stops being a tie, and tips can flip-flop on subtle DAA changes alone.
The depth-2 trigger restores the hysteresis — conditionally, and only if the penalty exceeds reachable drift.

Three stages: parking flags a candidate; unparking is a gate applied within chain selection; and only if that gate passes does the same selection pass reorg to it.

#### Parking trigger

With `def` the active tip and `fork` their most recent common ancestor, depth is `height(def) - height(fork)`:

- `fork == def` — extends the tip, connected normally.
- `fork == def - 1` — depth-1 sibling tie, not parked; first-seen decides.
- `fork <= def - 2` — depth-2 or deeper; the received block is parked.

Only the received block is flagged; it is still validated and stored, and later descendants inherit a parked ancestor.
The trigger is block-count and unchanged by this proposal, and is gated by the deep-reorg policy flag.

#### Unparking criteria

Chain selection re-tests a parked chain whenever it is the highest-work candidate — in steady state, when it is extended.
It passes iff:

    E > D + P
    P = D * x^2 / 5,760,000
    x = clamp(d, 600, 2400)

with the quotient floored and `5,760,000 = 2400^2`.
The clamp makes this one expression with no separate arms: `D/16` below 600 ticks, rising quadratically to `D` at 2400.
Since `P <= D`, the requirement is never more than `E > 2D`, and the comparison is strict, so exact equality stays parked.

`P` is a 256-bit multiply by the 23-bit factor `x^2` followed by a divide.
Since `x^2 <= 5,760,000 < 2^23`, the product stays below `2^256` for `D < 2^233`, which is unreachable by an enormous margin — even if every SHA256d network hashed at today's combined rate until the end of the universe, the bound would still hold — so the direct multiply is the specified procedure, and no implementation needs to check, guard, or assert it.
Work beyond that bound is outside the scope of this specification rather than a case to handle, and a quotient-and-remainder formulation is permitted but not required.

#### After unparking

Unparking is the gate, not a preceding selection step: the candidate is already the highest-work entry, so clearing the flag lets the same selection pass reorg to it.
The displaced chain is not parked automatically — it becomes a parked candidate again only when next extended.

#### Properties

##### Branch locality

All quantities key on the defending branch, and the penalty is proportional to `D`, the whole work since the fork.

Branch-local MTP activation means the rule keys on the defending branch: while that branch has not yet connected `H_a + 1` (`height(def) <= H_a`) the legacy count-keyed penalty applies, and once `H_a + 1` is part of it (`height(def) >= H_a + 1`) the tick-depth ramp applies to every competing candidate.

##### Same height hysteresis

The shallowest parked depth is two blocks, and the two cadences land differently:

- 60-tick: `d = 120 < 600`, flat `D/16 = W/8`; clearing it with same-height tip takes a DAA deviation of 6.25%, or `halflife * log2(1.0625)`, about 4.2 hours timestamp deviation with ASERT.
- 600-tick: `d = 1200`, quadratic `D/4 = W/2`; clearing it takes 25%, about 15.5 hours.

A single extra block (`W`) clears either.
The deviation required is hours, against a median-time-past lag of minutes (roughly 5 at 60 ticks, and 50 at 600), and a shallow branch cannot drag MTP down enough without having manipulated the MTP-FTL window first, see [Security Analysis: Timewarp Attacks](./security.md#timewarp-attacks).
Drift practically cannot clear either penalty, so the depth-2 tie is settled by a whole work unit `W`.
The flat `D/16` is unreachable at a 600-tick cadence, since the depth-2 trigger puts the shallowest parked divergence at `d = 1200`.
A one-block lead stops clearing once `P >= W`, the crossing treated under [Deep reorg protection](#deep-reorg-protection).

##### Deep reorg protection

At a 60-tick cadence the penalty exceeds one whole block's work from `d = 702` (the 12th block), serving as an early but small deterrent; at 600 ticks the same crossing is `d = 1512`, inside the third block.
From `d = 2400` the penalty is the full `D`, so the challenge needs `E > 2D`.
That ratio carries the roughly 33% maintenance floor and the roughly 40-minute wall-clock milestone.
This end is unchanged; the CHIP's rewrite is about how the penalty reaches it.

##### Monotonicity

`(D + P) / D = 1 + (x/2400)^2` is non-decreasing in `d`, so there is no sawtooth and no mid-ramp dip — the property the count-keyed step lacked.

##### Shape anchors

The penalty is `P/D = (x/2400)^2`, saturated at its own `d = 600` value: the unique quadratic through `(0, 0)`, `(1200, 1/4)`, and `(2400, 1)`.
The derivation of those anchors and the comparison against the current rule can be found in [Rationale: Block Unparking Penalty](./parking.md).
Saturation is what supplies the shallow floor: the raw parabola vanishes at the origin, so a positive shallow penalty would otherwise need a free additive constant, whereas holding the curve at its own `d = 600` value gives it without one.

| d (ticks) | wall clock | P / D | minimum share per side |
|---|---|---|---|
| `< 600` | `< 10 min` | `1/16` | `~48.5%` |
| 1200 | 20 min | `1/4` | `~44.4%` |
| 1800 | 30 min | `9/16` | `~39.0%` |
| 2400 | 40 min | `1` | `~33.3%` |
| `> 2400` | `> 40 min` | `1` | `~33.3%` |

The share column is `1 / (2 + P/D)`: while the weaker side holds at least that fraction, neither side can unpark the other.
It falls monotonically, which is what makes the penalty favor the party already ahead.

### Block Finalization (Rolling Checkpoints)

Currently, the rolling checkpoints mechanism automatically finalizes blocks once they have 10 blocks mined on top of them AND the block to be finalized has locally aged for 2 hours.
Note that a freshly started or reindexed node does not finalize anything for the first 120 minutes of uptime (a startup grace period, not a per-block age reset); after that window, blocks loaded from disk have no recorded receive time and are treated as already aged, so finalization proceeds normally on the next connected block.
For the depth portion of the rule, to maintain the same amount of chainwork, we redefine that to finalize blocks once they have received 6,000 ticks (equivalent to 10 10-minute blocks or 100 1-minute blocks) on top of them.
Writing `T(x)` for the tick of block `x` inclusive of its own contribution, the depth gate is satisfied for a block `b` at tip `tip` if and only if `T(tip) - T(b) >= 6,000`.
With every interval equal to 600 this reduces to `tip - b >= 10`, the current rule.
The aging gate is evaluated in wall-clock seconds and is unchanged.

The check itself runs only when a new block connects, never on a timer: a block whose aging gate has expired is not finalized until the next block arrives and triggers the walk, so under normal cadence the ~120-minute threshold is late by at most one block interval.
Note that restarting the node enforces a 120-minute startup grace period during which nothing finalizes; after it expires, blocks loaded from disk carry no recorded receive time and are treated as already aged, so finalization resumes on the next connected block rather than re-aging every block from scratch.

The depth gate excludes the finalized block's own interval, so a service gating on `confirmations_ticks` must use `6000 + GetBlockIntervalTime(b)` — 6,600 at the 600-tick schedule and 6,060 at 60 ticks — rather than 6,000.
Counting the block itself, the gate corresponds to 11 confirmations at the 600-tick schedule and 101 at 60 ticks.
Finalization itself fires at `max(depth, age)`, so the effective threshold under normal cadence is the aging gate; see [Recommendation for Exchanges](./security.md#recommendation-for-exchanges), which gives 13 and 121 confirmations for services that release funds only on finalized transactions.

See also [Security Analysis: Block Finalization](./security.md#block-finalization).

### Coinbase Transaction Block Height Commitment (BIP-34)

[BIP-34](https://github.com/bitcoin/bips/blob/master/bip-0034.mediawiki) added a mandatory height commitment to coinbase transactions, starting at block #227,836, to prevent miners from recreating a historical coinbase transaction ID.
It fails to close the gap completely, because many pre-BIP-34 coinbases already encode a future height as their first push, and BIP-30's no-duplicate rule does not apply: those outputs are long spent.
That commitment is unchanged by this proposal: a coinbase continues to commit the block's raw index (its height), not its tick or its normalized height, so the BIP-34 rule and the collision census below remain keyed to the same quantity as before.

height | coinbase_script | height_push | total_sats_out | version | locktime
-- | -- | -- | -- | -- | --
164384 | 03d6441e014b0136 | 1983702 | 17001300000 | 1 | 0
169895 | 031395380280070136 | 3708179 | 5002000010 | 1 | 0
171896 | 03dea73802180e0107 | 3712990 | 5005370306 | 1 | 0
... | ... | ... | ... | ... | ...

A miner could, once the chain reaches such a height, intentionally craft a coinbase that collides with one of them.
There are 192,401 collidable coinbases under the loosest plausible reading, with 189,023 independently confirmed by [darosior](https://gist.githubusercontent.com/darosior/3a5ac0a8d935fa9d3e90310590ca6699/raw/69b87217e9053807d4b1365743ccb5efbb075dcb/cb_dup.md) ([forum post](https://delvingbitcoin.org/t/great-consensus-cleanup-revival/710/4)); the full audit is in [extras/bip-34/](./extras/bip-34/readme.md), with the data extracted by [aggi](https://gitlab.com/0353F40E/aggi).

Every collidable coinbase is version 1, locktime 0, and carries at least 25 BCH of outputs.
The rule is therefore:

- From the block built on the activation block `H_a`, a coinbase transaction is invalid if its version is 1 AND its locktime is 0 AND the sum of its outputs is at least 25 BCH.

This forbids the shared shape rather than a list of transaction IDs, so no consensus-critical table or lookup is needed; a miner avoiding the shape can never produce a duplicate.
That shape covers 227,834 of the 227,836 pre-BIP-34 coinbases; 192,401 of those 227,834 could collide, and the remaining 35,433 either commit no height or commit one below activation.
They are rejected by shape regardless, so the rule's reach is also a margin against census error: it never consults the committed height, and a coinbase misjudged non-collidable is still rejected by shape.
Coverage of the census, and the size of that margin, are measured by [extras/bip-34/census_sweep.sql](./extras/bip-34/census_sweep.sql).
The alternative suggested [by Bitcoin developers](https://delvingbitcoin.org/t/great-consensus-cleanup-revival/710#p-1996-bip30-verification-12) — enforcing `locktime == height` on coinbases — is equally simple but may interfere with existing miner templates, so this shape-based rule is preferred.
It is harmless in practice: no coinbase has carried 25 BCH since block 470,189, and a miner who does need one can set version 2, a non-zero locktime, or outputs below 25 BCH.
A coinbase that dodges the shape rule with a non-zero locktime must still be final, which for a coinbase with a non-final input sequence requires `600 * nLockTime < T(h)` for the block `h` containing it, because the height-mode lock is normalized like any other.
The locktime escape is therefore only free while the input sequence stays `SEQUENCE_FINAL`, and a template that sets `nLockTime` to the raw block height minus one, as Bitcoin Core's BIP-54 convention does, becomes invalid from the second block after `H_a`.
The activation block `H_a` itself is exempt, because it is still constructed under the pre-activation rules.

The first remaining collision opportunity is height 1,983,702 — January 2046 with 10-minute blocks, or early 2029 with 1-minute blocks — so the rule is active long before it matters.
One lower encoded height, 490,897, was already mined in 2017 without being exploited.

This rule can be retired in a future upgrade if a later change makes colliding coinbases structurally impossible — for example, a UTXO commitment that forces every coinbase into a shape historical transactions cannot reproduce — at which point the shape restriction can be dropped.

### Signature Check Limits

The per-block signature check limit is already specified to scale with block size limit, so it will adjust together with modified adaptive blocksize limit algorithm without needing any change in specification.

### Peer-to-peer Layer Changes

The NODE_NETWORK_LIMITED mode, in which a node serves only the most recent ~2 days of blocks, is re-expressed from its 288-block definition to a tick-based definition: 172,800 ticks (288 × 600), which is 2,880 one-minute blocks.
This preserves the same 48-hour serving window and remains correct across any future target block time change.

### Recommended Mempool Size

It's common to refer to mempool as "the mempool" but it is often forgotten that there are as many mempools as there are nodes.
Mempool is just another name for a node-local transaction cache.
On Bitcoin Cash, mempools typically get fully cleared with every mined block.
This is because inflow (transactions broadcast by users) is typically lower than outflow (transactions included in blocks), so the cache rarely grows beyond maximum blocksize limit.

Multiple scenarios can cause excess growth:

1. Mining variance: new transactions are created at a rate below network's current capacity but the next block is taking too long (~5% chance for the next block taking 40 minutes) so mempool accumulates enough transactions to fill 1 to 4 blocks.
2. Burst of activity: a sudden inflow of a great number of transactions creates a bigger backlog but inflow subsides and mempool is cleared after a number of blocks.
   This could be organic (popular token mint, large business batch operation) or adversarial (spam attack), or a side-effect of a re-org returning transactions from orphaned blocks.
3. Steady-state increase in inflow: network's usage pattern has changed, current capacity can't accommodate the inflow.

Nodes don't have infinite RAM so they have to limit their mempool size else they would crash on overflow.
Current limit hasn't been changed [since Bitcoin Core days](https://github.com/bitcoin/bitcoin/pull/6722), and is [set to 300 MB](https://github.com/bitcoin/bitcoin/pull/6722/changes#diff-910d89612d74e91ae70ed40289b3910b1c1a09b1f5a1bb0b15849f70760cbba2R55).
This doesn't map to 300 MB worth of blocks, because the in-memory data structures include some overheads, and [the relationship is ~3.2x](https://bitcoincashresearch.org/t/discussion-of-default-dynamic-size-limit-default-mempool-of-320mb-serialized-mempool-of-100mb/1284/2), which means the effective size is ~94 MB.

What happens if it overflows?
The lowest fee rate transactions are simply thrown away (evicted), and minimum relay fee is temporarily set to the fee rate of last evicted transaction.
If there are multiple candidates then the 1st seen is preferred and newest evicted, and if there's still a tie then TXID is used as tie-breaker ([source](https://github.com/TheBlueMatt/bitcoin/blob/58254aa3bc2e92840679183cc884eb76670af525/src/txmempool.h#L300)).
The fee rate increase is not permanent: the above Bitcoin Core pull request also [implemented a "rolling fee"](https://github.com/bitcoin/bitcoin/pull/6722/changes#diff-c065d4cd2398ad0dbcef393c5dfc53f465bf44723348892395fffd2fb3bac522R866) which decays the fee back to minimum relay fee.
The [base halflife](https://github.com/bitcoin/bitcoin/pull/6722/changes#diff-8a2230436880b65a205db9299ab2e4e4adb1d4069146791b5db566f3fb752adaR298) time is 12 hours, but as it gets cleared the decay accelerates:

| Mempool Usage | Halflife | Time to halve the fee |
|---------------|----------|----------------------|
| ≥ 50% full | Normal | 12 hours |
| 25–50% full | ÷ 2 | 6 hours |
| < 25% full | ÷ 4 | 3 hours |

For BCH, this means that, after an overflowing burst of transactions, the fee rate will be raised just the same as on BTC.
However, since the mempool can be cleared in ~30 min (3x 10-minute blocks of 32 MB or 30x 1-minute blocks of 3.2 MB), the minimum relay fee rate will quickly start decaying at the maximum rate (decay resumes after each mined block): halving every 3 hours until it reaches floor value.

If mempool size is kept at 300 MB, the mining variance scenario resulting in overflow and fee bumps will be mitigated.
Notably, the decay algorithm would be more responsive with 1-minute blocks.
Decay resumes after each mined block, so there won't be cases of 40-minute outliers delaying the algorithm.
However, 300 MB is absurdly small for 2026 hardware and can cause frustrating minimum fee increases even for smaller bursts of activity.
[There's an outstanding BCHN issue to raise the default mempool size](https://gitlab.com/bitcoin-cash-node/bitcoin-cash-node/-/issues/518).

With this in mind, we recommend defining and re-implementing it in terms of hours it would take to clear it if mining full blocks, and then set it to 2 hours worth of full blocks.
With the current block size limit (32 MB at 10-minute blocks, or 3.2 MB at 1-minute blocks) two hours of full blocks is 384 MB serialized, which the node holds at roughly 3.2x in-memory overhead, i.e. about 1229 MB of default mempool.
The recommendation is defined in units of hours-of-full-blocks so it grows automatically with ABLA.

### Recommended API Changes

To support a smooth transition and forward compatibility with any future target block time changes, we recommend extending existing height-based APIs with tick-based fields.
Existing query interfaces remain unchanged: clients continue to query by height.
The new fields are additive, allowing clients to gradually adopt tick-based reasoning where it provides forward compatibility.

Any response that returns `height` should additionally return:

- `"ticks": n                    (numeric) the returned block's height measured in ticks`

`ticks` is the block's own tick height, `HeightToTick(height)`, and follows `height` response by response: where `height` is the block's index — including for a block that is not on the main chain, where `height` remains the real index — `ticks` is that block's tick.

Any response that returns `confirmations` should additionally return:

- `"confirmations_ticks": n      (numeric) confirmations measured in ticks, with the same sentinel and the same sign as the confirmations field in the same response`

`confirmations_ticks` is the tick depth of the block containing the subject, inclusive of that block's own interval: `T(tip) - T(b) + GetBlockIntervalTime(b)`, which is `600 * confirmations` while the whole span shares the 600-tick interval and `60 * confirmations` while it shares the 60-tick interval.
It follows `confirmations` response by response rather than imposing a convention of its own: `0` where that field is `0`, `-1` where that field is `-1`, and the same sign and magnitude in ticks where that field is negative for a conflicted wallet transaction.
`0` is therefore overloaded in both fields exactly as `confirmations` already overloads it — a subject in the mempool and a subject whose block is off the main chain in an RPC that reports `0` there are indistinguishable.
For any query that aggregates over an address, label, or wallet, the field is the minimum over the subjects considered, the same direction as the `confirmations` field beside it.
A response that omits `confirmations` omits `confirmations_ticks` as well.

Any response that returns `difficulty` should additionally return:

- `"target_time": n              (numeric) target time in seconds for this block`
- `"next_target_time": n         (numeric) target time in seconds for the next block`

The `target_time` and `next_target_time` fields will be equal for almost all blocks, differing only at the boundary block of a target time change.
Exposing both allows clients to detect upcoming cadence changes one block in advance.

Using `getblockheader 912123` as an example:

    {
      "hash": "0000000000000000019f64605d353ae88d8928361d8bce51b43bf474d4520e2b",
      "confirmations": 38737,
      "confirmations_ticks": 23242200,
      "height": 912123,
      "ticks": 547273800,
      "version": 939524096,
      "versionHex": "38000000",
      "merkleroot": "a0e4df906b7a0f3942047cc69cfbb58c38ee3171ed219e9f3230db52e0f012cf",
      "time": 1755484753,
      "mediantime": 1755482263,
      "nonce": 1127818599,
      "bits": "1801c7e2",
      "difficulty": 617418937555.0542,
      "chainwork": "0000000000000000000000000000000000000000027983ef0d3b834a13656daf",
      "nTx": 290,
      "target_time": 600,
      "next_target_time": 600,
      "previousblockhash": "0000000000000000011c79cc931a38e909e0fe6a84d545c581d29de1a99907ad",
      "nextblockhash": "000000000000000000390e68745785af37b18f5667c7b27bce8563837dd3db55",
      "ablastate": {
        "epsilon": 16000000,
        "beta": 16000000,
        "blocksize": 165322,
        "blocksizelimit": 32000000,
        "nextblocksizelimit": 32000000
      }
    }

With this, using the genesis block timestamp (1231006505) and `ticks`, we can calculate the scheduled timestamp for the block without needing knowledge of past or future target block time changes:

- 1231006505 + 547273800 = 1778280305 (May 8th 2026, 22:45:05).

Note that the example block's mined timestamp corresponds to August 18th 2025, 02:39:13.
This is due to timestamp drift, a consequence of past and current DAA mechanics.

Services that target a specific confirmation duration could monitor the `confirmations_ticks` field and accept the deposit once it reaches the desired threshold (e.g. 7200 ticks for a 2-hour window, equivalent to today's 12-confirmation policy at 10-minute blocks).
This is forward-compatible with any future target time change: the threshold remains 7200 ticks regardless of how many actual blocks accumulate in that interval.
See [Confirmation Count vs Tick Thresholds](#confirmation-count-vs-tick-thresholds) for the caveat that a tick threshold preserves chainwork but not confirmation count, and the guidance to keep a confirmation-count floor alongside it.

### Confirmation Count vs Tick Thresholds

Ticks and confirmations measure different things:

- **Ticks measure idealized time and a reward-denominated security budget.**
  Because the block subsidy is keyed to 600-tick chunks, 600 ticks equals one legacy block reward, and with ABLA holding throughput constant this equalizes the coinbase per 600 ticks in steady state — difficulty-independent, at any conforming target time.
  A majority attacker's success probability does not decay with confirmations; what deters them is the coinbase value they forgo while racing, which grows linearly with the tick budget.
  Calibrating a tick threshold linearly on deposit value therefore keeps the economic break-even (`X/C`, protected value over block coinbase) constant.
  This is deliberately not a chainwork claim: a hashrate crash means the same tick span buries less work, but it still denominates the same number of block subsidies — and, in steady state, the same coinbases.
- **Confirmations measure block count.**
  A minority attacker's probability decays exponentially with each confirmation, independent of block time.
  A fixed tick threshold does not fix confirmation count, so the minority margin it provides depends on the target time.

Where the design leans on each:

- **Height-mode locktime and sequence** are normalized to 10-minute units, so a normalized `n`-unit relative lock is satisfied by at least `n` and at most `600n` real blocks — never fewer confirmations than a uniform 600-tick schedule would give.
  This holds while the target time stays at or below 600 seconds, which the [schedule constraints](#schedule-constraints) guarantee structurally.
- **Time-mode (MTP) locks** were already exposed to block-count variance, and that exposure is unchanged.

If the target time ever rises within the range below the 10-minute ceiling:

- Height-mode contracts keep their wall-clock meaning but are met by fewer blocks — a height lock is not a confirmation-count guarantee.
- Tick-gated services keep their security budget but see it met by fewer confirmations.
  A majority-calibrated threshold costs nothing here: at any fixed count the majority break-even is strictly below every minority break-even.
  Only a minority-calibrated threshold needs a confirmation-count floor alongside it.

This CHIP fixes the ceiling at 10 minutes and leaves the range below it open; it does not promise the target time will only ever decrease (see [Algorithmic Target Time](#algorithmic-target-time)).

## Specification

The Technical Description defines the consensus changes in detail; this section fixes the normative bindings between them.
Where this section, the Technical Description, or [Implementations](#implementations) disagree, this section is authoritative for implementation, with the reference implementation resolving any remaining ambiguity in integer arithmetic.
A rule may designate its linked subsection as carrying the normative detail; that subsection is then part of the rule.

### Activation and tick schedule

One tick is one second of idealized target time at the schedule's current interval.

For each network, activation occurs at the first block satisfying both conditions:

    MTP >= activation_time  AND  tick(block) % 600 == 0

where `tick(block)` is the block's tick height, inclusive of its own contribution, and MTP is the median of the 11-block span including the block's own timestamp.
That block, `H_a`, is still mined at the 600-tick interval; the tick schedule becomes `{ H_a, 60 }`, so the next block to be mined is the first at the new 60-tick target interval.

The second condition is a grid-alignment guard.
The 600-tick interval divides the tick timeline into a fixed grid, and the halving schedule — 126,000,000 ticks per halving, i.e. 210,000 ten-minute block-equivalents — is pinned to that grid.
Requiring every schedule change to land on a grid boundary guarantees halvings continue to fall exactly on the original `600 * N` schedule for any future target block time, matching the factor and alignment constraints in [Block Subsidy](#block-subsidy).

On every activation network, pre-activation blocks each contribute 600 ticks, so grid-alignment is satisfied automatically on all activation networks: each pre-activation block's tick count is a multiple of 600, and the condition selects the same block the MTP condition alone would.

For this upgrade the grid clause is therefore vacuous, and the predicate reduces to the MTP test alone — the activation predicate BCHN already implements for MTP upgrades (`IsUpgrade...Enabled` and its `isupgrade…enabled` fixture, which this activation reuses).
The grid clause is load-bearing only for *subsequent* schedule changes, which do not begin from a uniform 600-tick past and must therefore be snapped up to the nearest height whose tick is a multiple of 600.
The activation height itself is derived from the observed branch rather than read from consensus params, so `H_a` is per branch until it is solidified (see [Activation and schedule solidification](#activation-and-schedule-solidification)); only the lookup mechanism is the existing chain-walking activation check.

Regtest carries the same activation time as `mainnet`, and activates by the same MTP predicate once that time is reached.
Because regtest is a private test chain, an implementation MAY additionally allow the activation time to be overridden at start-up, and test harnesses use that both to force early activation and to suppress activation entirely.
An override does not change the discovery rule: the activation block is still the first block whose own MTP reaches the effective time, so `H_a` remains per branch and the schedule above follows from it unchanged.

| Network | Activation MTP |
|---------|----------------|
| chipnet | 1794744000 (2026-11-15T12:00:00Z) |
| mainnet | 1810382400 (2027-05-15T12:00:00Z) |
| testnet3 | 1810382400 (2027-05-15T12:00:00Z) |
| testnet4 | 1810382400 (2027-05-15T12:00:00Z) |
| scalenet | 1810382400 (2027-05-15T12:00:00Z) |
| regtest | 1810382400 (2027-05-15T12:00:00Z), same as `mainnet`, overridable at start-up |

Let `H_a` be the height of the activation block, the first block satisfying both conditions.
It is mined at the current 600-tick interval, and the next block is the first at the new interval.
The base interval is 600 ticks per block.
The activation is the single tick-schedule override `{ H_a, 60 }`, so every block at height `<= H_a` contributes 600 ticks and every block at height `> H_a` contributes 60 ticks.
`H_a` is derived from the observed chain and is per network; the value `1,003,670` used in [Blockchain Height Abstraction](#blockchain-height-abstraction) is an estimate for mainnet, not a hard-coded height.

The MTP predicate governs only the window between activation and solidification: it determines `H_a` for the release that introduces the tick schedule, and for any node syncing from genesis during that window.
Once `H_a` is finalized, a later release may replace the predicate with the fixed height, because every block at height `<= H_a` contributes 600 ticks and the two rules are therefore observationally identical.
Until solidification, `H_a` is a property of a chain branch, not a network-wide constant (see [Activation and schedule solidification](#activation-and-schedule-solidification)).

No special mempool handling is introduced at activation, but the ordinary mempool re-evaluation that nodes already perform on upgrades (as with script-flag changes) and reorgs applies here as well: it must run with the tick-normalized predicates and the branch's own tick schedule, and activations and/or reorgs across the activation boundary fall under it like any other TX-evaluation-changing upgrade would.

The genesis block ends at tick 0 and contributes no ticks to the cumulative tick (`HeightToTick(0)` returns 0); `GetBlockIntervalTime(0)` returns 600, the default interval, because no schedule entry precedes it. This is an accessor convention, not a schedule entry, and schedule entries remain subject to `1 <= tau <= 600`.

The schedule is subject to the following constraints, which are normative for the schedules defined by this proposal and are a forward commitment for the BCH networks and for any future BCH schedule whose entries divide 600:

- Entries are strictly ascending in height.
- Every entry satisfies `1 <= tau <= 600`.
- Every entry satisfies that `tau` divides 600.
- Every entry satisfies `tick(H) % 600 == 0`, inclusive of the entry block's own contribution.

A schedule that violates any of them is likewise outside the scope of this specification, and implementations are not required to reject it: the list bounds which schedules the mechanisms below are specified for, and a violation voids their guarantees rather than defining an error path.
The activation entry satisfies these constraints by construction and needs no separate validation.

The constraint list is a precondition for every schedule-dependent mechanism specified in this document, and each mechanism's stated guarantees hold only for schedules that satisfy it.
A schedule that relaxes the ceiling or the divisor rule voids those guarantees and requires each dependent mechanism to be re-derived; such a schedule is outside the scope of this specification and of any implementation that targets it.

`GetBlockIntervalTime(h)` returns the target interval of block `h` itself; `GetNextBlockIntervalTime(h)` returns the target interval of block `h + 1`; `GetBlockIntervalTime(0)` is 600 by convention.
Implementations MUST obtain the tick of a not-yet-mined block from the schedule, and MUST NOT extrapolate it by adding the tip's own interval to the tip's tick.

The grid-alignment guard exists for future schedule changes, which will not begin from a uniform 600-tick past.
Subsequent entries are derived the same way as the activation entry: the first block satisfying the MTP condition is snapped up to the nearest height whose tick is a multiple of 600, and that height becomes the new entry.

### Normative consensus rules

The following rules are normative.
Throughout this list, `T(x)` denotes the tick of block `x`, inclusive of its own contribution (e.g. `T(0) == 0`, `T(1) == 600`).
Each rule either states the complete rule or explicitly designates its linked subsection as carrying the normative detail; a subsection so designated is normative for that rule:

- **Tick schedule.**
  For the schedules defined by this proposal, entries are strictly ascending in height and every entry satisfies `1 <= tau <= 600`, `tau` divides 600, and `tick(H) % 600 == 0`.
  This is a forward commitment for the BCH networks rather than a rule the CHIP imposes on later CHIPs: a schedule that relaxes the constraint list is out of scope, its guarantees do not hold, and an implementation is not required to reject it.
  On `regtest` the activation time is the `mainnet` value and MAY be overridden at start-up for testing; the MTP predicate and the schedule it yields are otherwise unchanged.
  See [Blockchain Height Abstraction](#blockchain-height-abstraction).
- **Block subsidy.**
  Writing `chunk(tick) = (tick + 599) / 600` for the 600-tick chunk containing the block's interval, the halving count is `chunk(tick) / chunks_per_era`, where `chunks_per_era` is the network's halving interval expressed in 600-tick chunks — 210,000 on the BCH networks (126,000,000 ticks), 150 on `regtest` — and the per-block subsidy is `((50 * COIN) >> halvings) * tau / 600`, with `halvings` forced to zero output once it reaches 64 (the shift itself zeroes the result earlier for every conforming tau).
  The halving count is keyed to the chunk, never to the raw end tick; halving alignment follows from the schedule constraints.
  See [Block Subsidy](#block-subsidy).
- **Difficulty adjustment.**
  `next_target = max(1, min(powLimit, anchor_target * 2**((time_delta - (tick_delta + anchor_ideal_block_time)) / halflife) * anchor_ideal_block_time / next_ideal_block_time))`, with the halflife unchanged.
  The integer procedure guards the shift step and the interval-ratio multiply, and both reproduce what an exact-width computation of the same integer procedure would produce.
  The ratio guard is load-bearing rather than defensive: on a conforming schedule the ratio is a whole number `k` in `[1, 600]`, but `nextTarget * k` can still wrap modulo `2^256`, and a wrap landing below the proof-of-work limit would not be repaired by the final clamp.
  On networks with the minimum-difficulty rule, a block is eligible for minimum difficulty when its timestamp exceeds its parent's by more than `2 * next_ideal_block_time` — 1,200 s at the 600-tick schedule, 120 s at the 60-tick schedule — with the threshold derived from the schedule rather than held constant.
  See [Difficulty Adjustment Algorithm (DAA)](#difficulty-adjustment-algorithm-daa).
- **Adaptive blocksize limit.**
  The normative rule is the algorithm specified in [Adaptive Blocksize Limit Algorithm (ABLA)](#adaptive-blocksize-limit-algorithm-abla) — the state-transition equations, input/output/rate scaling, configuration constants, and Implementation Notes — applied with `INTERNAL_SCALING_FACTOR = 1`; integer arithmetic per [Arithmetic](#arithmetic).
- **Locktime and sequence.**
  Writing `T(x)` for the tick of block `x` inclusive of its own contribution, `L` for a height-mode `nLocktime` value, and `n` for a height-mode `nSequence` value on an input whose coin was created in block `c`: a transaction is final in block `b` if `T(b) > 600 * L`, and the input is mature in block `b` if `T(b) - T(c) >= 600 * n`.
  As today, `nLockTime = 0` is final at every block, and a transaction whose inputs all have `nSequence = SEQUENCE_FINAL` is final regardless of `nLockTime`; the absolute locktime binds only when at least one input has a non-final sequence.
  Coinbase transactions are not exempt, so a coinbase with a non-final input sequence has its locktime normalized too, and one with the usual `SEQUENCE_FINAL` input has an inert locktime that can name any value.
  The mempool applies each predicate to the upcoming block, at `T(tip + 1)` obtained from the schedule. MTP-mode semantics and the `LOCKTIME_THRESHOLD` split are unchanged.
  See [Transaction Locktime and Input Sequence](#transaction-locktime-and-input-sequence).
- **Coinbase maturity.**
  A coinbase output created in block `c` is spendable in block `b` if and only if `T(b) - T(c) >= 60,000` ticks (100 ten-minute block-equivalents; 1,000 one-minute blocks).
  See [Coinbase Maturity](#coinbase-maturity).
- **Block parking and unparking.**
  A newly received block that would reorganize more than one block of the active tip is parked; the trigger is unchanged and measured in block count, not ticks.
  With `D` the defending tip's work since the fork point, `E` the competing branch's work over that same span, and `d` the divergence depth in ticks (the defending tip's tick minus the fork point's tick, both on the defending branch's schedule), the parked chain is accepted only if `E > D + P`, where `P = D / 16` for `d < 600`, `P = D * d^2 / 5,760,000` for `600 <= d < 2,400`, and `P = D` for `d >= 2,400`.
  While the defending branch's tip is at or before `H_a` (`height(def) <= H_a`), the legacy count-keyed penalty applies unchanged; once the branch contains `H_a + 1` (`height(def) >= H_a + 1`), the penalty is the ramp above.
  The product `D * d^2` stays below 2^256 for `D < 2^233`, a bound that real chainwork cannot approach, so the direct multiply is used without a guard and no check is required; work beyond that bound is outside the scope of this specification.
  See [Block Parking and Unparking](#block-parking-and-unparking).
- **Block finalization.**
  The depth gate is satisfied for block `b` at `tip` if and only if `T(tip) - T(b) >= 6,000` ticks (100 one-minute blocks); the aging gate (120 minutes from local header-received time, disk-loaded blocks treated as already aged) and the `max(depth, age)` rule are unchanged.
  See [Block Finalization (Rolling Checkpoints)](#block-finalization-rolling-checkpoints).
- **Coinbase duplicate prevention (BIP-34).**
  From the block built on the activation block `H_a` onward, a coinbase transaction is invalid if its version is 1 and its locktime is 0 and the sum of its outputs is greater than or equal to 25 BCH.
  See [Coinbase Transaction Block Height Commitment (BIP-34)](#coinbase-transaction-block-height-commitment-bip-34).

Non-consensus normative parameter: the NODE_NETWORK_LIMITED serving window is re-expressed as 172,800 ticks — see [Technical Description: Peer-to-peer Layer Changes](#peer-to-peer-layer-changes).

[Recommended API Changes](#recommended-api-changes) and [Recommended Mempool Size](#recommended-mempool-size) are recommendations, not consensus rules.

### Arithmetic

All consensus arithmetic is integer-only and performed in the exact order of the reference implementation.
The DAA exponential and the ABLA transitions approximate their formulas with fixed-size integer operations; the reference implementation is authoritative for the exact procedure (see the implementation notes in the respective sections).
Tick comparisons, including the locktime and sequence predicates, are exact integer comparisons and are never floored, rounded, or converted to floating point.

## Security Analysis

Full analysis is [provided as a stand-alone document](./security.md), and an executive summary is provided below.

#### Executive Summary: Security Analysis

This proposal preserves Bitcoin Cash's fundamental security model while adjusting operational parameters to accommodate 1-minute blocks.

**What Remains Unchanged**

The core security properties of Nakamoto Consensus are preserved:

- Chainwork accumulation rate per unit time
- Hashpower scarcity dynamics and attacker cost calculations, attacker cost per unit of chainwork (including rent-a-hash temporary-majority attempts)
- Probabilistic security per confirmation
- Difficulty-to-coinbase ratio
- Security purchasing power (coinbase per hour)

**What Changes**

The granularity of work changes: the network adds transactions and purchases chainwork in smaller, more frequent increments.

- Block difficulty and reward reduce to 1/10th per block (same per hour).
- Parking lock-in remains at 2,400 ticks (4 ten-minute block-equivalents = 40 one-minute blocks), preserving the ~40-minute wall-clock threshold, though the penalty now ramps continuously in tick depth rather than stepping between count-keyed tiers.
- Finalization scales from 10 blocks to 100 blocks; the 120-minute aging gate is unchanged and continues to bind, so finalization still fires at ~120 minutes.
- MTP spans ~10 minutes instead of ~100 minutes (11 blocks, 10 intervals).
- Orphan rate increases modestly due to network latency becoming a larger fraction of the block interval.
This creates negligible asymmetry in attack scenarios (51:49 shifts to ~51.25:48.75 at 1% orphan rate, or ~51.5:48.5 at our 2% tolerable threshold).

**Attack Scenario Summary**

| Attack | Current Security | Impact of Faster Blocks |
|--------|------------------|-------------------------|
| 51% censorship | Defenders can sprint for parking with peak power | Same chainwork to parking (2,400 ticks); sprint duration unchanged (~40 min at target cadence); the lucky four-block sweep is priced out, and the continuous ramp favors the defender, whose even-money share falls monotonically toward the unchanged ~33% as the divergence deepens, so an attacker must command well beyond 51% to keep the embargo closed. |
| Finalization chain split | Requires ~67% hashpower, split-second timing | Unchanged; ~201 blocks required instead of ~21, same wall-clock cost |
| Parking chain split | Initiation possible for a lucky minority; requires ~33% hashpower to keep a parked fork alive to finalization | Parking and finalization thresholds unchanged (~40 min to parking; ~120 min to finalization, i.e. ~80 min response window); 10x finer progress granularity; harder to initiate with minority hash because a one-block lead stops sufficing at 12 blocks instead of 3, after which the even-money floor falls monotonically along the ramp from ~48.5% at the shallowest parked divergence through ~44.4% and ~39.0% to the unchanged ~33.3% at the 2,400-tick lock-in. End-to-end fork-matching is harder across the entire sub-majority range, with the even-odds hashpower threshold rising from ~51% to ~58% and the 10%-success threshold from ~33% to ~46%. |
| Sniping (tip rewrite) | Resolves by 4 confirmations (~40 minutes) due to parking | Same hashpower requirements; resolves at the first depth where the ramp's penalty exceeds a whole block, ~12 one-minute confirmations (~12 minutes); absolute fee threshold drops 10× because the coinbase shrinks while a fixed-value target does not — the one place the "reduced variance cuts both ways" objection has real force, and it is bounded by parking and the rarity of such anomalies. |
| Double-spend | Probabilistic security per confirmation; hard cutoff at finalization | Same probabilities per confirmation; against majority attackers, 10× more confirmations to finalization; minority attackers face prohibitive odds faster in wall-clock time. At an equal wall-clock embargo the end-to-end success curve sits strictly below current BCH across the sub-majority range with intercept at ~51% hash-power. |
| Selfish mining | Profitability threshold set by connectivity (&gamma;) and hashpower share, not block time, under uniform per-block reward | No change under the block-reward regime; the &gamma;-only result does not extend to the fee-dominant regime, where a value-based variant requires neither connectivity nor meaningful hashpower |
| Fee-dominant regime (undercutting, petty-compliant tie-breaking, mining gaps) | Not applicable today; coinbase is ~100% of revenue | Undercutting and tie-breaking surfaces invariant under rescaling, and ABLA's 2.2–2.3× headroom already keeps us below the paper's unconstrained worst case; mining gap shrinks with the interval while fixed curtailment latency does not, making the attack harder at 1 minute |
| Timewarp | ASERT eliminates classic vectors; manipulation bounded by MTP/FTL | MTP tightens slightly (+0.12% vs +1.21% lower bound); no new vectors |
| Network Partitions | Auto-healing for splits under finalization; ~80 min response window | Parking and finalization thresholds unchanged (~40 min to parking; ~120 min to finalization, i.e. ~80 min response window); shallow-split signs surface ~10× sooner: a 3-deep divergence appears in roughly 3 minutes instead of 30 (at target cadence), and a 30-minute sample of 1-minute blocks yields 10× more hashrate observations per competing tip, giving a much tighter estimate of which side has majority support |

**Key Findings**

1. **Economic security scales with chainwork, not block count.** For equivalent wall-clock time, faster blocks provide equivalent security against majority hashpower attacks.
2. **Security against minority attackers is reached faster.** Per the Bitcoin whitepaper, an attacker with less than 50% hashpower sees his success probability decrease exponentially with each additional confirmation. Since confirmation count (not wall-clock time) drives this exponential decay, 10x more confirmations per hour means minority attackers face prohibitive odds sooner in real time.
3. **Parking and finalization interact favorably with faster blocks.** Parking's threshold is preserved at 2,400 ticks (4 ten-minute block-equivalents = 40 one-minute blocks), keeping wall-clock lock-in at ~40 minutes; finalization's depth scales to 100 blocks while the unchanged 120-minute aging gate keeps binding. The response window is unchanged at ~80 minutes, and accidental escalation to parking becomes vanishingly unlikely: reaching the first structural lock now costs 12 deliberate refusals instead of 3 (0.5^12 ≈ 0.02% versus 0.5^3 = 12.5% at equal hashpower), with the full 2× lock-in at 40 blocks. The ramp also keeps the shallowest parked divergence settled by work rather than by difficulty drift: clearing the 1/16 floor takes ~6.25% more work across the span, which under ASERT needs about four hours of timestamp drift against a reachable window of just over two.
4. **Split-maintenance thresholds are unchanged; initiating a parking split gets much harder.** The ~33% hashpower floor for keeping an already-parked fork alive to finalization, and the ~67% floor for executing a finalization chain split, are independent of block time because both scale with chainwork. Initiation is the part that changes: the race to parking now runs along a continuous ramp whose even-money floor falls from ~48.5% at the shallowest parked divergence to the unchanged ~33.3% at the lock-in, so a minority miner who could occasionally luck through three rounds at 4 blocks can no longer ride a lucky streak through twelve blocks to the first depth where a one-block lead stops sufficing, let alone to the full 2× lock-in at 40 blocks. Reaching the parking-depth tie in the first place now requires near-majority hashpower; measured end-to-end, the fork-matching even-odds threshold rises from ~51% to ~58% of hashpower, and the 10%-success threshold from ~33% to ~46%.
5. **Rent-a-hash temporary-majority attacks are unchanged in cost and bounded by the same defenses as today.** On a ~0.3% SHA256d chain, an attacker can rent enough hash to temporarily become the favorite, and reduced variance makes such an attacker's win more predictable. But the defenses that matter in that regime — honest miners and exposed parties redirecting hash to defend (the 2018 hash-war precedent), chainwork-scaled parking and finalization, and the invariant per-hour cost of holding majority — are all untouched by block time.
6. **Selfish mining is not made easier.** The Eyal–Sirer profitability threshold depends on the attacker's connectivity (&gamma;) and hashpower share, not on block time; any claim that faster blocks lower the threshold is really a claim that they raise &gamma;, which must be shown, not assumed. Reduced variance transfers advantage from the underdog to the favorite — and in sub-majority races, the underdog is the attacker.
7. **Sniping becomes slightly more plausible but remains rare.** The absolute fee threshold drops to 1/10th, but such high-fee blocks remain exceptional. Historical data shows only 3 blocks above the 3.4 BCH fee threshold (break-even for a 40% attacker) since height 500,000.
8. **Orphan rate increases modestly but remains tolerable.** With sub-second propagation and 1-minute blocks, orphan rates below 2% are achievable. This affects mining variance but not consensus security.
9. **ASERT DAA timewarp-resistance properties are unchanged.** Its absolute scheduling approach is independent of block count; only timestamps matter.
10. **The fundamental defense remains economic.** Growing the network's value makes hashpower scarce relative to attack costs. Faster blocks do not change this dynamic.
11. **Network partitions heal automatically under normal conditions.** Partitions with hashpower splits more uneven than 33:67 resolve automatically before finalization. Faster blocks do not change the parking or finalization thresholds, but they reveal a partition earlier: a 3-deep divergence becomes visible in roughly 3 minutes instead of 30 (subject to natural block-time variance and the slowdown from hashpower being split across both tips), and the sharper per-tip hashrate estimate from 10× more block samples within any fixed window is itself an additional signal that something is wrong.

## Implementations

### Reference Implementation (C++)

#### Blockchain Height Abstraction (Ticks Mapper) Implementation

Please see:

- [block_ticks.h](implementation-cpp/src/block_ticks.h) and
- [block_ticks.cpp](implementation-cpp/src/block_ticks.cpp).

#### Adaptive Blocksize Limit Algorithm (ABLA) Implementation

Please see:

- [abla_ticks.h](implementation-cpp/src/abla_ticks.h) and
- [abla_ticks.cpp](implementation-cpp/src/abla_ticks.cpp).

Note that the implementation is bit-for-bit compatible with the fixed target-block-time implementation: with a 600-tick target time and scaling factor 1, all existing BCHN test vectors must pass unmodified.
The repository enforces this with the differential in [abla_ticks_test.cpp](implementation-cpp/src/abla_ticks_test.cpp), which drives the verbatim BCHN algorithm kept in [abla_legacy.cpp](implementation-cpp/src/abla_legacy.cpp) in lockstep and requires bit-for-bit equal `epsilon`, `beta`, and block size limit at every step.

When the target block time differs from 600 ticks, results are expected to differ from the 600-tick case, even at scaling factor 1.
This is intentional and has two sources:

- Different discretization granularity.
  A single 600-tick block is replaced by several finer blocks, so the algorithm performs several state transitions, each subject to its own integer rounding, instead of one.
  In addition, the block size limit is derived by dividing the internal state by the block-time ratio (for example, by 10 for 60-tick blocks), which is itself a further rounding step.
- Increased internal precision, when scaling factor is greater than 1.

The 600-tick, scaling-factor-1 case is therefore pinned to the existing BCHN implementation.
The shorter-block-time case, and any scaling factor greater than 1, are defined normatively by the reference implementation and the test vectors below.

#### Difficulty Adjustment Algorithm (ASERT) Implementation

Please see:

- [asert_ticks.h](implementation-cpp/src/asert_ticks.h) and
- [asert_ticks.cpp](implementation-cpp/src/asert_ticks.cpp).

The 256-bit arithmetic needed by ASERT lives in:

- [asert_common.h](implementation-cpp/src/asert_common.h).

For reference, the original BCHN ASERT code is kept verbatim (with only the
`CBlockIndex`/`CBlockHeader`/`Consensus::Params` plumbing replaced by plain
scalar arguments) in:

- [asert_legacy.h](implementation-cpp/src/asert_legacy.h) and
- [asert_legacy.cpp](implementation-cpp/src/asert_legacy.cpp).

The tick-aware implementation differs from the legacy one in exactly three places,
which are the three changes the [Difficulty Adjustment Algorithm (DAA)](#difficulty-adjustment-algorithm-daa)
section specifies:

- The exponent is computed from `tick_delta + anchor_ideal_block_time` instead of
  `nPowTargetSpacing * (nHeightDiff + 1)`.
- The result is multiplied by `anchor_ideal_block_time / next_ideal_block_time`
  before the final clamp (the ratio is skipped, and therefore bit-exact, when the
  two intervals are equal).
- The testnet minimum-difficulty threshold is `2 * next_ideal_block_time` instead
  of `2 * nPowTargetSpacing`.

On a uniform 600-tick schedule the three deltas reduce to the legacy formula, so
the 600-tick case is bit-for-bit identical to the deployed BCHN ASERT.

Like `abla_ticks`, the module is schedule-agnostic: the caller supplies the tip's
cumulative tick (`nPrevTick`), the next block's target interval
(`nextIdealBlockTime`), and an anchor struct carrying the anchor's own tick and
interval. The wrapper derives `tickDelta = nPrevTick - anchor.nTick` internally,
mirroring how the legacy wrapper derives `nHeightDiff` from the tip height.

An interactive harness for experimenting with schedules is provided in:

- [asert_cli.cpp](implementation-cpp/src/asert_cli.cpp).

#### Transaction Locktime, Sequence, and Coinbase Maturity Implementation

Please see:

- [timelock_ticks.h](implementation-cpp/src/timelock_ticks.h)

for the shared reference evaluators. They port the BCHN checks in
`consensus/tx_verify.cpp` — `IsFinalTx`, `CalculateSequenceLocks` /
`EvaluateSequenceLocks` (BIP 68), and the coinbase-maturity branch of
`Consensus::CheckTxInputs` — and apply tick normalization only to the
height-mode predicates (`T(b) > 600 * nLocktime`, `T(b) - T(funding) >=
600 * nSequence`, `T(b) - T(creation) >= 60,000`), leaving the time-mode
branches and the `LOCKTIME_THRESHOLD` split unchanged.

An interactive comparator for evaluating a single transaction and schedule
under both the legacy (BCHN height) and tick-normalized semantics is provided
in:

- [timelock_cli.cpp](implementation-cpp/src/timelock_cli.cpp).

The self-test and vector generator, which pin the shared evaluators against
hand-derived golden vectors, are in:

- [timelock_ticks_test.cpp](implementation-cpp/src/timelock_ticks_test.cpp).

#### Block Parking and Finalization Implementation

Please see:

- [parking_finalization_ticks.h](implementation-cpp/src/parking_finalization_ticks.h)

for the reference implementation of the tick-scaled parking penalty and the tick-scaled finalization depth gate.

The parking half mirrors the structure of `validation.cpp`'s `FindMostWorkChain` automatic unparking block so the tick-scaled logic slots in with minimal modification:

    ```cpp
    const arith_uint256 requiredWork = parking_ticks::RequiredWorkToUnpark(
        pindexTip->nChainWork,
        pindexFork->nChainWork,
        blockTicks.HeightToTick(pindexTip->nHeight) -
            blockTicks.HeightToTick(pindexFork->nHeight));
    if (pindexNew->nChainWork > requiredWork) {
        UnparkBlock(pindexTest);
    }
    ```

The divergence depth is measured in ticks rather than blocks — the difference of two cumulative ticks, both read on the defending branch's schedule — and the penalty is the saturated parabola `P = D * clamp(d, 600, 2400)^2 / 5,760,000`, with the quotient floored once after the multiply.
The strict `>` comparison is unchanged, so exact equality stays parked.

The rule therefore reads only two numbers: the defending branch's work since the fork point, and the divergence depth in ticks.
It needs no notion of a block's work and none of a block's interval, which is what makes a span that straddles a schedule entry — the activation boundary most of all — well defined.
The same property keeps the rule clear of the launch-day case, where a span straddles the activation boundary and neither a block's work nor a block's interval has a single value across it.

The penalty is exposed separately as `ParkingPenalty`, and the clamped ramp argument as `ParkingRampTicks`, so callers and vectors can pin the floor, the cap, and the penalty as distinct values rather than re-deriving them from the threshold.

The deep-reorg parking trigger (`AcceptBlock`'s `pindexFork->nHeight + 1 < m_chain.Height()`) remains block-count-based.

Activation is branch-local, and the handover is the caller's business: the ramp applies once `H_a + 1` is part of the defending branch (`height(def) >= H_a + 1`), and the legacy count-keyed penalty applies while the tip is at or below `H_a` (`height(def) <= H_a`).

Exactly one case is out of scope for the module: a defending branch that is still pre-activation.
Its tiers key on the work of the first block(s) after the fork point rather than on the span's total, so they need ancestry work the ramp's `(D, d)` signature cannot express — and they are deployed BCHN code, where upstream's own tests are more authoritative than a re-derivation.
A caller in that position applies `validation.cpp`'s own switch verbatim.

A span that straddles the activation boundary but whose tip is post-activation is in scope: the branch is on the ramp, and `d` simply sums 600-tick intervals below the seam and 60-tick intervals above it.

The finalization half mirrors `validation.cpp`'s `FindBlockToFinalize`:

    ```cpp
    uint64_t finalizedHeight = parking_ticks::NO_BLOCK;
    if (parking_ticks::FindBlockToFinalize(
            blockTicks, pindexNew->nHeight, headerReceivedTimes,
            GetTime(), finalizationDelay,
            pindexFinalized ? pindexFinalized->nHeight : parking_ticks::NO_BLOCK,
            finalizedHeight)) {
        FinalizeBlockInternal(config, state, ::ChainActive()[finalizedHeight]);
    }
    ```

The candidate is the shallowest block at least 6,000 ticks below the newly connected tip; if it is not aged enough, the walk proceeds to older blocks one at a time, exactly as the legacy code.
A block is aged iff `now >= headerReceivedTime + finalizationDelay`, with a receive time of zero (disk-loaded) meaning already aged.
As in the legacy implementation, the check runs only when a new block connects, never on a timer, and the node startup grace period is a caller precondition rather than part of the evaluator.

The self-test and vector generator, which pin the shared evaluators against hand-derived golden vectors, are in:

- [parking_finalization_ticks_test.cpp](implementation-cpp/src/parking_finalization_ticks_test.cpp).

#### Block Subsidy Implementation

Please see:

- [subsidy_ticks.h](implementation-cpp/src/subsidy_ticks.h)

for the reference implementation of the tick-scaled block subsidy. It mirrors
`validation.cpp`'s `GetBlockSubsidy`, re-expressed in ticks per the
[Block Subsidy](#block-subsidy) section, with the era length taken as the
network parameter `chunksPerEra` (210,000 on the BCH networks, 150 on regtest)
rather than as a constant:

```cpp
inline uint64_t GetBlockSubsidyTicks(const HalvingSchedule sched, uint64_t tick,
                                     uint64_t tau) {
    const uint64_t halvings = HalvingsOfTick(sched, tick); // chunk/chunksPerEra
    if (halvings >= MAX_HALVINGS) return 0;
    return ((BASE_SUBSIDY * COIN) >> halvings) * tau / 600;
}
```

where `chunk(tick) = (tick + 599) / 600` is the 600-tick chunk containing the
block's interval. On the uniform 600-tick schedule `chunk(h) == h`, so this is
identical to the legacy `height / chunksPerEra` form at every height. The chunk
keying — rather than a raw `tick / (600 * chunksPerEra)` — is what keeps each
era's total equal to the legacy ideal under shorter target times.

The self-test and vector generator are in:

- [subsidy_ticks_test.cpp](implementation-cpp/src/subsidy_ticks_test.cpp).

#### Coinbase Shape Rule (BIP-34) Implementation

Please see:

- [bip34.h](implementation-cpp/src/bip34.h)

for the reference implementation of the coinbase shape rule.
It reads four quantities and nothing else — the coinbase *transaction* `nVersion`, its `nLockTime`, the sum of its output values, and the block height's position relative to `H_a` — so it consults no coinbase script, no ticks, and no timestamps, and the header includes no other module.
The rule is therefore independent of the target block time and of the tick schedule.
Note that `version` here is the coinbase transaction version, not the block version: BIP-34 itself concerns block version 2, which is unrelated.

Only the invalid/valid verdict is consensus.
The reasons the header can report — `valid_exempt`, `valid_version`, `valid_locktime`, `valid_too_low` — exist for diagnostics and readable test output; a conforming implementation may test the conditions in a different order, or test the gate last as a short circuit, and reach the same verdict with a different reason.

The self-test and vector generator are in:

- [bip34_test.cpp](implementation-cpp/src/bip34_test.cpp).

## Test Cases

### Blockchain Height Abstraction (Ticks Mapper) Tests

Please see:

- [block_ticks_test.cpp](implementation-cpp/src/block_ticks_test.cpp)

and the JSON test vectors it generates:

- [tests/ticks/ticks.json](tests/ticks/ticks.json).

`block_ticks_test` verifies the tick mapper against hand-derived golden pins and
emits them as JSON. Every `expected` value in `ticks.json` is a hand-authored
pin, mirrored by the self-test's own assertions; the generator re-verifies the
reference implementation against the pins before writing, and refuses to emit
if any pin fails. All integer values are emitted as decimal strings to preserve
full 64-bit precision.

`ticks.json` contains:

- `constants`: the normative interval bounds (`MIN_BLOCK_INTERVAL_TIME`,
  `BASE_BLOCK_INTERVAL_TIME`, `MAX_BLOCK_INTERVAL_TIME`), `MAX_HEIGHT`, and
  `MAX_TICK`.
- `schedules`: one entry per named schedule — `empty` (default 600-tick),
  `chip_activation` (`{1,003,670, 60}`), `height_zero_entry` (`{0, 60}`), and
  `multi_entry` (300/600/60/600). Each entry lists `queries` over the four
  accessors (`GetBlockIntervalTime`, `GetNextBlockIntervalTime`,
  `HeightToTick`, `TickToHeight`) with hand-derived expected values, plus
  `roundTrips` asserting the `TickToHeight(HeightToTick(h)) == h` identity.
- `validation`: accept/reject cases covering malformed schedules — `tau` of 0
  or above the 600-tick ceiling, `tau` not dividing 600, duplicate or
  descending heights, grid misalignment, entry heights above `MAX_HEIGHT`
  (including `UINT64_MAX`), the height-0 entry, and a valid multi-entry
  schedule.
  With the exception of the height-0 entry, every `accept: true` row is a
  conforming schedule and remains meaningful for any implementation.
  The reject rows record the checks the reference performs at construction.
  The [schedule constraints](#schedule-constraints) bound which schedules the
  dependent mechanisms are specified for; checking them is encouraged, because
  the tests are cheap and fail fast, but an implementation is not required to
  detect a violation — one that accepts such a schedule voids the guarantees of
  the mechanisms depending on it rather than defining an invalid consensus
  state. A consumer SHOULD NOT therefore score a conformant implementation on
  the reject rows, although rejecting remains the expected result for this
  reference.

Running `./ticks_test` verifies the reference implementation against all of the
above; running `./ticks_test --generate` emits `tests/ticks/ticks.json` and
refuses to emit if any pin fails.

### Adaptive Blocksize Limit Algorithm (ABLA) Tests

ABLA is covered by two complementary vector sets and an independent cross-implementation check.

The **equivalence vectors** expand the existing [BCHN ABLA test vectors](https://gitlab.com/bitcoin-cash-node/bitcoin-cash-node/-/tree/master/src/test/data/abla_test_vectors?ref_type=heads) into faster-block schedules and pin statistical equivalence:

- [tests/abla/](tests/abla/)
- [abla_equiv.cpp](implementation-cpp/src/abla_equiv.cpp)

With this tool, we verified the mathematical equivalence of splitting a 600-tick block into a number of faster blocks.
Example report:

    === abla_equiv ===
    base: config1-test2-random8196.json
    schedule: [{"tick":60000000,"tau":60}]
    scalingFactor: 1
    chunks: 99 (raw fine blocks: 981)
    deviation (% vs 600s base):
      control: min=-0.00060193 max=-0.000597912 mean=-0.000599373 meanAbs=0.000599373 maxAtCn=2100099
      elastic: min=-0.00142584 max=-0.00138215 mean=-0.00140228 meanAbs=0.00140228 maxAtCn=2100099
      limit  : min=-0.00110817 max=-0.00107984 mean=-0.0010927 meanAbs=0.0010927 maxAtCn=2100099
      size   : min=0 max=0 mean=0 meanAbs=0 maxAtCn=2100001
    delta deviation (bytes vs 600s base):
      control: min=-9 max=10 mean=-1.26531 meanAbs=4.97959 maxAtCn=2100025
      elastic: min=-88 max=11 mean=-24.4796 meanAbs=30.2143 maxAtCn=2100036
      limit  : min=-97 max=20 mean=-25.7449 meanAbs=35.1939 maxAtCn=2100036
      size   : min=0 max=0 mean=0 meanAbs=0 maxAtCn=2100002
    delta deviation (% of base state):
      control: min=-2.59657e-07 max=2.88495e-07 mean=-3.65024e-08 meanAbs=1.43658e-07 maxAtCn=2100025
      elastic: min=-1.59292e-06 max=1.99129e-07 mean=-4.43166e-07 meanAbs=5.46985e-07 maxAtCn=2100036
      limit  : min=-1.07887e-06 max=2.22478e-07 mean=-2.86369e-07 meanAbs=3.91475e-07 maxAtCn=2100036
      size   : min=0 max=0 mean=0 meanAbs=0 maxAtCn=2100002
    wrote: config1-test2-random8196-eq.json
    [ABLA Ticks] Auto-configured epsilonMax: 2837960626724546304, betaMax: 9459868755748488064

The **identity and edge vectors** pin hand-derived golden values and are generated by:

- [abla_ticks_test.cpp](implementation-cpp/src/abla_ticks_test.cpp)

which emits `tests/abla/abla_ticks.json`.
Every `expected` value is a hand-derived pin; the generator re-verifies the reference against the pins before writing, and refuses to emit if any pin fails.
The vectors pin:

- output scaling: the floor-state limit across target times, including the `tau` divisors of 600 and the fixed-size clip path on testnet3 and testnet4;
- the per-unit-time invariance discretization epsilon: ten full 60-tick blocks and one full 600-tick block land identical `epsilon` with `beta` differing by exactly one internal unit (`10 * 42` of per-block decay versus one `421`), pinned as exact integers;
- the control-function rate identities: `r_min = -gamma` at an empty block, `r_max = gamma * (zeta - 1)` at a full block independent of the buffer state, and the 50%-defense level `epsilon * (2 - zeta) / zeta` where the downward rate equals `r_max`;
- the minimum detectable deviation in both directions (~101,166 B grow, ~25,292 B shrink), invariant in internal units across target times;
- the network matrix per `chainparams.cpp` (mainnet/regtest 32 MB dynamic, testnet3 32 MB fixed, testnet4 2 MB fixed, chipnet 2 MB dynamic, scalenet 256 MB dynamic);
- the 2 GB output cap boundary (below, at, and above) and the maxima / overflow edge — `epsilonMax = 2,837,960,626,724,546,304`, `betaMax = 9,459,868,755,748,488,064`, summing to the overflow-safe maximum `12,297,829,382,473,034,368` — where both saturation clips fire and are invariant across target times;
- the contrasting shrink regime at the maxima, where a real (2 GB-capped) block drains `epsilon` and `beta`, versus the grow regime of a full uncapped block;
- the activation boundary, where internal state is continuous and only the output limit rescales;
- input clamping, where a 2x-limit block is identical to an at-limit block;
- `INTERNAL_SCALING_FACTOR = 1000` arithmetic, documenting the deliberate cross-factor non-agreement;
- the lookahead forms: a constant-count form that bounds `count` full blocks at the state's own interval, and the tick-window download form — the first block driven out of the tip at its own size and interval, the rest full at the 600-tick base interval and bounded in closed form, read back in base units, ~10x conservative at a 60-tick target.
  Both return an integer upper bound, not the exact drive, and both are `O(1)`.
  Each vector carries the bound as `expected` (an equality pin) and the pre-change exact drive as `legacyExact` (a `>=` check), so an implementation may verify its closed form against both numbers without carrying a per-block loop.
  Two rows pin the saturation paths: the largest recommended window from the `(epsilonMax, betaMax)` fixed point, and the first window at `k = D / G` exactly.

The 600-tick, scaling-factor-1 state rows additionally cross-check the verbatim BCHN algorithm ([abla_legacy.cpp](implementation-cpp/src/abla_legacy.cpp)) in lockstep, requiring bit-for-bit equal `epsilon`, `beta`, and limit at every step.
Lookahead rows are not flagged `differential` -- a closed-form bound cannot equal the legacy drive -- and are instead checked against the in-repo exact drive, which this repository keeps as a non-normative oracle and a node does not need.

An independent pure-Python re-implementation, [abla_pins.py](implementation-cpp/src/abla_pins.py), written from the specification rather than translated from the C++ so that it fails loudly if the reference or its vectors ever drift, re-derives every vector and exits non-zero on any mismatch:

    python3 abla_pins.py --json tests/abla/abla_ticks.json

Running `./abla_ticks_test` verifies the reference implementation against all of the above; running `./abla_ticks_test --generate` emits `tests/abla/abla_ticks.json` and refuses to emit if any pin fails.

### Difficulty Adjustment Algorithm (ASERT) Tests

Please see:

- [asert_ticks_test.cpp](implementation-cpp/src/asert_ticks_test.cpp)

and the JSON test vectors it generates:

- [tests/asert/asert.json](tests/asert/asert.json).

`asert_ticks_test` reproduces the `CalculateASERT` golden vectors from BCHN's `pow_tests.cpp` (`calculate_asert_test::calculate_args`), re-expressed in tick form (`tickDelta = 600 * nHeightDiff`, `nTimeDiff = 600 + timeDiff`), and asserts them bit-for-bit.
On top of those 600-tick golden vectors it derives a 60-tick sibling for each, by feeding the identical inputs with `nextIdealBlockTime = 60` and requiring the target to equal the 600-tick target scaled by exactly 10 and clamped to `powLimit`.
Two golden vectors are exempt from this derivation: `calc_args[10]` and `calc_args[11]`, whose 600-tick pre-clamp target underflows to zero and is floored to 1, so the simple ×10 relationship does not apply (their 60-tick result is also 1, not 10).

It then verifies the tick-specific identities:

- Anchor steady state at the anchor's own interval (proves the `+1` term is the anchor block's own interval, not the base 600).
- The activation boundary: the first 60-tick block after a 600-tick anchor, on schedule, produces a target exactly 10 times the 600-tick target.
- Negative and positive solvetime produce exact halving and doubling.

It also runs an equivalence check at a hypothetical activation height of 1,000,000: two blocks arriving at the same timestamp and tick, one at 600-tick and one at 60-tick interval, must produce targets in an exact 10:1 ratio (difficulty 1/10th).
Finally, it emits three reference vectors at the testnet half-life of 3600 seconds, which carry no independent golden values but pin the half-life-dependent path for the test networks.

The `wrapper` vectors exercise the full `GetNextASERTWorkRequired` entry point.
The testnet minimum-difficulty branch is strict: a candidate timestamp exactly at `nPrevBlockTime + 2 * next_ideal_block_time` takes the ASERT path, while one second later returns `powLimit`.
The threshold is derived from the schedule rather than held as a constant, and it is twice the interval of the block being computed.
It is therefore 1,200 seconds for a 600-tick block and 120 seconds for a 60-tick block, including at the activation boundary where a 60-tick candidate follows a 600-tick tip and the threshold is still 120 seconds.
The `_off` rows pin the `fPowAllowMinDifficultyBlocks` gate by giving the same over-threshold timestamp the ASERT path and the ordinary schedule-derived target instead of `powLimit`.
The `wrapper_plumb_tickdelta60` and `wrapper_anchor_nonzero_tick` rows verify that `tickDelta` is derived from the caller-supplied prev tick minus the anchor's stored tick, including a non-zero anchor tick, and that the anchor-interval ratio applies through the full entry point.
The `nPrevTick >= anchor.nTick` precondition is documented rather than vectorized because the reference asserts it (a caller MUST NOT pass a prev tick before the anchor tick).

The generated `asert.json` contains:

- `calc_args[00]` through `calc_args[17]`: the 18 BCHN golden vectors (600-tick).
- `calc_args[*]_60s`: 16 siblings at `nextIdealBlockTime = 60`, one per golden vector except `calc_args[10]` and `calc_args[11]`.
  Each must equal `clamp(target(calc_args[*]) * 10, powLimit)` exactly.
- `anchor_steady_600`, `anchor_steady_60`, `activation_600_to_60`, `negative_solvetime_halve`, `positive_solvetime_double`: analytic identities.
- `equiv_1M_600s` / `equiv_1M_60s`: the activation-equivalence pair.
  They share every input except `nextIdealBlockTime`, and a consumer MUST additionally assert `target(equiv_1M_60s) == target(equiv_1M_600s) * 10` exactly, since that relationship is the normative equivalence claim rather than a per-vector field.
- `testnet_halflife_steady`, `testnet_halflife_fast`, `testnet_halflife_60tick`: reference output at the 3600-second half-life, with no independent golden values.
- A `wrapper` array pinning `GetNextASERTWorkRequired` end-to-end: the strict minimum-difficulty boundary at both the 600-tick (1,200 s) and 60-tick (120 s) threshold, the `fPowAllowMinDifficultyBlocks` gate via the `_off` rows, and `tickDelta` derivation from the prev tick via the `_plumb_` and `_anchor_` rows.
  All wrapper rows except `wrapper_testnet_halflife_fast` (reference output) carry hand-derived golden nBits.

Running `./asert_ticks_test` verifies the reference implementation against all of the above; running `./asert_ticks_test --generate` emits `tests/asert/asert.json` for BCHN to consume, and refuses to emit if any golden, identity, or wrapper vector fails.

### Transaction Locktime, Sequence, and Coinbase Maturity Tests

Please see:

- [timelock_ticks.h](implementation-cpp/src/timelock_ticks.h) (shared reference evaluators)
- [timelock_ticks_test.cpp](implementation-cpp/src/timelock_ticks_test.cpp) (self-test and generator)
- [timelock_cli.cpp](implementation-cpp/src/timelock_cli.cpp) (legacy-vs-ticks comparator)

and the JSON test vectors they generate:

- [tests/timelock/timelock.json](tests/timelock/timelock.json).

The tick-normalized height-mode predicates live in `timelock_ticks.h` and are
shared by both the test runner and the CLI, so the vectors below pin the exact
code the tools run:

- `nLocktime` is strict and absolute: a transaction is final in block `b` iff
  `T(b) > 600 * lockTime`.
- `nSequence` is weak and relative: an input is mature in block `b` iff
  `T(b) - T(fundingBlock) >= 600 * relativeLock`.
- Coinbase maturity is weak and absolute: a coinbase is spendable in block `b`
  iff `T(b) - T(creationBlock) >= 60,000`.

The mempool forms of all three evaluate at the upcoming block `tip + 1`, using
`T(tip + 1)` obtained from the schedule and never `T(tip) + tau(tip)`; the
`seq_post_fund_Ha_n1` vector pins this at the activation boundary, where the
two differ. The BCHN escape clauses are preserved and pinned by dedicated
vectors: `nLockTime == 0` is final everywhere, and a transaction whose inputs
are all `SEQUENCE_FINAL` is final regardless of `nLockTime` — the absolute
locktime only binds when at least one input opts in with a non-final sequence.
Time-mode `nLocktime`, time-mode BIP 68, and the `LOCKTIME_THRESHOLD` split are
unchanged and out of scope.

`timelock.json` contains:

- `constants`: the interval bounds, `LOCK_UNIT_TICKS` (600), and
  `COINBASE_MATURITY_TICKS` (60,000).
- `schedules`: the default 600-tick schedule, the activation schedule
  `{1,000,000, 60}`, and a multi-entry 300/600/60/600 schedule for off-grid
  ticks.
- `vectors`: one entry per scenario, keyed by `kind` (`locktime`, `sequence`,
  or `maturity`), with its arguments, the hand-derived `releaseBlock`, and
  block/mempool spot checks. Coverage spans legacy equivalence (600-tick
  release at `L+1`, `c+n`, `c+100`), the activation boundary (including the
  CHIP's worked example of `nLocktime = 1,000,011` releasing at block
  1,000,111), straddling cases funded before activation and released at it,
  and off-grid thresholds inside 300-tick segments.

Running `./timelock_ticks_test` verifies the shared evaluators against all of
the above; running `./timelock_ticks_test --generate` emits
`tests/timelock/timelock.json` and refuses to emit if any pin fails.
`./timelock_cli` compares the legacy (BCHN height) and tick-normalized results
for a single transaction and schedule, and is intended for exploration rather
than as a normative source.

### Block Parking and Finalization Tests

Please see:

- [parking_finalization_ticks_test.cpp](implementation-cpp/src/parking_finalization_ticks_test.cpp)

and the JSON test vectors it generates:

- [tests/parking_finalization/parking_finalization.json](tests/parking_finalization/parking_finalization.json).

`parking_finalization_ticks_test` verifies the tick-scaled parking penalty and the tick-scaled finalization depth gate against hand-derived golden pins and emits them as JSON.
Every `expected` value in `parking_finalization.json` is a hand-authored pin, mirrored by the self-test's own assertions; the generator re-verifies the reference implementation against the pins before writing, and refuses to emit if any pin fails.
All chainwork values are emitted as 64-character hex strings (`arith_uint256`), heights and ticks as decimal strings, and the reject/accept outcome as a boolean.

The parking vectors carry the rule's own inputs directly — the fork's chainwork, the defender's span work, the competitor's span work, and a height pair that derives the divergence depth through a schedule — so no block's work is computed and no `nBits` value is used.
The fork's chainwork cancels in the comparison, and it is carried and varied only to prove that it cancels.
Because the depth is derived from the height pair rather than supplied, a vector cannot silently disagree with its own schedule.

`parking_finalization.json` contains:

- `constants`: the base block interval (600 ticks), the parking floor and lock-in (600 and 2,400 ticks), the ramp denominator (5,760,000), the finalization depth (6,000 ticks), the 120-minute finalization delay, and the span-work unit the vectors are denominated in.
- `schedules`: four named schedules — the default 600-tick schedule (`empty`), the activation schedule `{1,000, 60}` (`activation_1K`), a 300-tick segment (`mixed300`), and a one-tick schedule (`fine1`) that makes the divergence depth exact for the knee probes.
  Each entry `{height, tau}` sets the interval of the blocks strictly above that height.
- `parking`: one entry per scenario, keyed by `fork` and `defenderTip`, with the derived `tickDepth` and `rampTicks`, the `forkChainWork`, `tipChainWork` and `competingChainWork` totals, the two span works (`workSinceFork`, `competingWorkSinceFork`), the `penalty` and `requiredWork`, the penalty as the exact rational `penaltyNum`/`penaltyDen`, `slackVsThreshold` (the competitor's span work minus the threshold), and the `accept`/reject outcome.
  Most vectors sit exactly on the threshold, `slackVsThreshold` of 0 rejecting and 1 accepting, which is what pins the strict `>` comparison; two deliberately sit off it and pin their margin instead.
  Spans are denominated in units of the ramp denominator so that every anchor penalty is integral, with a non-integral span included on purpose to pin the single floor after the multiply, and a span past 64 bits to exercise the 256-bit path.
  Coverage spans the penalty function at depths 1–4 on a uniform 600-tick schedule, reproducing the legacy half-block at depth 2 and the 2× rule from depth 4 on, and deliberately stronger at depth 3, where the legacy tier sat flush on a whole-block boundary; those four depths use a never-activated schedule and pin the penalty function rather than a chain-level verdict.
  Coverage continues through the 60-tick steady state at the shallowest parked depth and at every interior anchor (d = 660, 720, 900, 1,200), plus the cap at depth 40.
  It also covers divergence straddling the activation boundary, a same-block-count competitor carrying more per-block work, a shorter-but-heavier competitor, knee probes at 599/600/601 and 2,399/2,400/2,401 ticks, a cross-schedule identity at the same tick depth, and fork-base invariance including a base with its low bit set.
- `finalization`: one entry per scenario, keyed by `tip` (the block whose connection triggered the check), `alreadyFinalized`, `now`, `finalizationDelay`, and a sparse `received` map of header receive times (unlisted blocks are disk-loaded and treated as aged), with the derived `candidate` and `finalizedBlock`.
  Coverage pins the legacy depth-10 equivalence, the walk-back-when-not-aged behavior, the inclusive age boundary from both sides, the already-finalized skip, the none-aged walk to genesis, and the 100-block 60-tick depth.
  It also covers candidates landing on the activation block and just below it, a walk-back crossing the activation boundary, the 300-tick segment at two points, and a chain shorter than the depth gate producing no candidate at all.

A property block re-derives, as arithmetic on the span work alone, the identities the rationale leans on.
It pins that the clamped expression floors to `floor(D / 16)` below the floor and to exactly `D` at the cap, and that the clamp is continuous at both knees and saturates above the cap.
It pins that the penalty is monotone in depth and never exceeds `D`, that the two interior fractions the vectors quote are exact, and that a one-block lead stops sufficing at the 12th 60-tick block — stated without reference to any per-block work, and pinned on both sides of the crossing.
Three further checks are invariance rather than arithmetic: a given tick depth yields the same penalty whether it was reached on a 600-, 300- or 60-tick schedule, the fork's chainwork affects neither the penalty nor the verdict, and scaling both span works does not move a verdict away from the boundary.
One guards the straddle arithmetic itself, so the seam vectors' notes cannot drift if schedule semantics change.

Running `./parking_finalization_ticks_test` verifies the reference implementation against all of the above; running `./parking_finalization_ticks_test --generate` emits `tests/parking_finalization/parking_finalization.json` and refuses to emit if any pin fails.

### Block Subsidy Tests

Please see:

- [subsidy_ticks_test.cpp](implementation-cpp/src/subsidy_ticks_test.cpp)

and the JSON test vectors it generates:

- [tests/subsidy/subsidy.json](tests/subsidy/subsidy.json).

`subsidy_ticks_test` verifies the tick-scaled subsidy against hand-derived
golden pins and the proposal's own shortfall table, and emits them as JSON.
Every `expected` value in `subsidy.json` is a hand-authored pin, mirrored by the
self-test's assertions; the generator re-verifies the reference implementation
before writing, and refuses to emit if any pin fails. Subsidy amounts are
emitted as decimal satoshi strings.

`subsidy.json` contains:

- `constants`: the chunk counts per era for the BCH networks (210,000) and
  regtest (150), the corresponding era lengths in ticks (126,000,000 and
  90,000), the base subsidy, and the last nonzero era for each interval tested.
- `schedules`: the default 600-tick schedule, the activation schedule
  `{1,000,000, 60}`, a 3-second change at block 123,456, and a 1-second
  schedule from block 1.
- `halvingsLegacy` / `halvingsActivation`: for each halving 1–33, the boundary
  chunk and tick, the boundary height, and the subsidy and halving count either
  side of the transition. The halving *tick* is schedule-independent; the
  halving *height* is not.
- `erasLegacy` / `erasActivation`: per era, the first and last height, block
  count, boundary subsidies, and era total. The activation era containing the
  target-time change has a block count that differs from the legacy era while
  its total is unchanged.
- `halvingSpotChecks`: for the short-interval schedules, the first, last
  nonzero, and first zero halving.
- `cumulativeLegacy` / `cumulativeActivation`: the running total after each
  era, so the minted supply curve is checkable era by era.
- `totals`: the grand total for each schedule.

The pins span five properties: tau-600 equivalence with the legacy height
formula at every height up to four halvings; the truncated range-`/10`
identity `GetBlockSubsidyTicks(tick, 60) == GetBlockSubsidyTicks(tick, 600) / 10`
(exact for every halving, because
`floor(floor(5e9/2^k)/10) == floor(5e8/2^k)`); the halving-boundary and era
structure for every schedule, including that each era spans exactly
126,000,000 end ticks; and the grand totals, three of which match the
[Block Subsidy Shortfall](#block-subsidy-shortfall) table's rows directly
(legacy, 60 s, and 3 s) and one of which matches its 1 s row plus a documented
200-satoshi genesis term; and regtest's 150-chunk era, which is the only place
the chunk count is exercised at a value other than 210,000, pinning an era
length of 90,000 ticks, its halving boundary, and its per-era totals.

Running `./subsidy_ticks_test` verifies the reference implementation against
all of the above; running `./subsidy_ticks_test --generate` emits
`tests/subsidy/subsidy.json` and refuses to emit if any pin fails.

### Coinbase Shape Rule (BIP-34) Tests

Please see:

- [bip34_test.cpp](implementation-cpp/src/bip34_test.cpp)

and the JSON test vectors it generates:

- [tests/bip34/bip34.json](tests/bip34/bip34.json).

`bip34_test` pins the rule against hand-derived vectors in two families.
The `grid` family is exhaustive over the rule's own domain — `nVersion` in {1, 2}, `nLockTime` in {0, 1}, output sum in {25 BCH − 1 sat, 25 BCH}, height in {`H_a`, `H_a` + 1} — and nothing outside those four quantities can change a verdict, so sixteen vectors are complete coverage of the rule rather than a sample.
The `census` family evaluates three real pre-BIP-34 coinbases at the first height at which a duplicate of each becomes possible, with field flips that must pass, which ties the rule to the dataset in [extras/bip-34/](./extras/bip-34/readme.md).

Only `expected.invalid` is normative.
A rejection reason is node-local diagnostic text: a conforming implementation may order its tests differently, and a coinbase can violate this rule and the locktime predicate at once, so no single reason is required.
Vectors whose escape is a non-zero `nLockTime` carry `expected.locktimeEscape` to record that a second, independent predicate must also pass, and that whether their block is valid is asserted by the timelock vectors rather than here.

Exhaustive coverage of the collidable census is deliberately not a vector set.
The rule never reads the coinbase script, so one vector per census row would assert the same boolean 192,401 times while varying a field the rule ignores.
That coverage is [census_sweep.sql](./extras/bip-34/census_sweep.sql) instead: a single pass over the audit database, which also measures the rule's deliberate over-coverage and pins the identity of the two pre-BIP-34 coinbases that fall outside the shape.

Running `./bip34_test` verifies the reference implementation against all of the above; running `./bip34_test --generate` emits `tests/bip34/bip34.json` and refuses to emit if any pin fails.

## Activation Costs

We define activation cost as any cost that would arise ex-ante, in anticipation of the activation by affected stakeholders, to ensure that their services will continue to function without interruption once the activation block has been mined.

While the consensus change itself is contained to node software, this proposal cannot be fully isolated to nodes, because downstream software often has assumptions about target block time baked in.
For each stakeholder category below, we describe what is affected, what the minimum activation-time work is, and what additional work is recommended to fully benefit from the upgrade.

### Non-Costs

A number of components are explicitly unaffected by this proposal and require no changes:

- Address formats (CashAddr, legacy).
- Transaction serialization format.
- Script VM semantics (only the evaluation context of locktime and sequence fields changes).
- P2P network message formats (with the optional exception of SHV extensions, which are independent of this proposal).
- Wallet seed formats and derivation paths.
- Token (CashTokens) semantics.

### Node Operators and Developers

The core consensus change is implemented here.
Costs include:

- **Node developer effort** to implement and test the tick abstraction, updated DAA, parking and finalization thresholds, ABLA scaling, BIP-34 collision mitigation, and related changes.
- **Review and testing effort** across node implementations.
- **Operator effort** to upgrade running nodes before the activation block.
- **Reorg handling code paths** across the ecosystem (nodes, indexers, wallets, explorers) will be exercised more frequently due to the modestly higher orphan rate.
This may force latent bugs to surface; pre-activation testing on testnet should specifically exercise reorg scenarios.

This is the typical cost profile of any network upgrade.

### Mining Infrastructure

Miners and mining pools bear significant operational costs because block production cadence directly affects their internal systems:

- **Stratum / work distribution.**
Work updates are pushed ~10x more frequently.
Pools should verify that their stratum servers and miner-side connections have headroom for the increased message rate, and that any rate-limiting or batching logic does not throttle legitimate updates.
- **Share accounting and payouts.**
Many pools settle on block boundaries, so 10x more frequent settlement events may stress accounting systems.
- **Coinbase maturity tracking.**
Consensus redefines coinbase maturity as 60,000 ticks (equivalent to 1,000 blocks at the new target time).
Pool software tracking maturity by block count must update its threshold from 100 to 1,000 blocks, or adopt tick-based tracking for forward compatibility with any future target time changes.
- **Coinbase construction.**
Coinbase templates must respect the new collision mitigation rule (see [Coinbase Transaction Block Height Commitment](#coinbase-transaction-block-height-commitment-bip-34)).
In practice no action is required, since pools already satisfy it by default and current coinbase fees are far below the 25 BCH threshold; miners only need to be aware of the rule if fees ever approach that level, in which case they can set version=2 (which carries no conditions) or use the locktime escape to be sure they don't trigger the rule.
- **Orphan handling.**
Orphan rates rise modestly post-activation: targeted below 2% under sustained full blocks, and expected below 0.5% under typical light-block conditions.
Pool monitoring dashboards and any orphan-rate-based alerting should be recalibrated to the new baseline.
- **Hashrate monitoring dashboards.**
Averaging windows and variance-based alerts should be recalibrated for the new cadence.
Dashboards that infer hashrate from "blocks in the last hour" will see 10x the sample count and may need their thresholds adjusted accordingly.

### Custodial and Merchant Services

#### Exchanges

If an exchange upgrades its node and does nothing else, its systems will likely continue to function without interruption.
Many exchanges rely on the node and its built-in wallet as the only backend, so most of the engineering cost falls on node developers rather than on the exchange.
Likely needed changes:

- **Required number of confirmations** for deposit crediting should be revised.
The rule-of-thumb scaling (10x current count) preserves wall-clock security.
- **User-facing confirmation displays** and estimated wait times should be updated.
- **Polling intervals** for deposit detection and confirmation tracking should be reduced to match the new block cadence, so that users see more lively progress updates (e.g., 3/120 rather than long stretches with no visible change).

#### Payment Processors and Merchant Gateways

Services like BitPay, payment buttons, and PoS systems:

- **Invoice expiration windows** tied to block intervals should be reviewed; "expires in 3 blocks" means 3 minutes rather than 30.
- **Confirmation-based payment finality policies** should be revised, although we expect 1-conf policies to remain at 1-conf in order to maximize the UX benefit of the upgrade.
- **Customer-facing wait time displays** should be updated to reflect the new cadence.

### Light Wallet Architectures

#### BIP-37 Bloom Filters

Activation-time work focuses on request batching to avoid sync degradation.
Wallets using BIP-37 issue two kinds of batched requests to peers: `getheaders` for header chain sync, and `getdata` for `merkleblock` items.
Both already support batching (up to 2,000 headers per `getheaders`; many thousands of items per `getdata`), but some wallets ship with small batch sizes tuned for 10-minute blocks.

The key activation-time change is to verify and, if needed, increase these batch sizes so that the number of round-trips required to sync remains comparable to today.
For example, Flowee Pay currently uses a batch size of 10 for `merkleblock` requests ([reference](https://codeberg.org/Flowee/thehub/src/branch/master/libs/p2p/Peer.cpp#L373)).
At today's cadence, a 2-day catch-up (~288 blocks) costs ~29 round trips.
Post-activation the same wall-clock window is ~2,880 blocks; raising the batch size to 100 keeps the round-trip count roughly unchanged.

Other concerns are not activation-blocking:

- **Merkle proof verification logic** is unchanged.
- **Header chain growth** is gradual and does not affect existing wallets at activation time.

Ongoing bandwidth, storage, and round-trip implications, along with mitigation strategies (header merkle proofs, static header bundles), are discussed in the [Ongoing Costs](#ongoing-costs) section.

#### Compact Block Filters

Classic BIP-157/158 ("Neutrino") deployment on Bitcoin Cash is limited, but the Open Bitcoin Privacy Project's enhanced selectivity filters ([OBPP-04](https://github.com/OpenBitcoinPrivacyProject/rfc/blob/master/obpp-04.mediawiki)) are deployed via Open-Transactions and used for payment code wallets that need data-push-level matching granularity (e.g., BIP-47 and version 3 payment codes).

Activation-time work is minimal.
Filter computation is per-block and independent of block cadence; the filter format, encoding, and distribution mechanisms are unaffected by this proposal.
Operators of filter-serving infrastructure should verify before activation that their indexing throughput has sufficient headroom for the higher block rate, but no protocol-level changes are required.

Ongoing operational implications (10x more filters generated, served, and downloaded by clients) are discussed in the [Ongoing Costs](#ongoing-costs) section.

#### Electrum-Style Indexing Servers

Activation-time work is minimal.
Fulcrum, Rostrum, and related servers do not validate consensus themselves; they rely on the connected node for that.
The Electrum wire protocol is unaffected by the change, and header serving, subscription mechanics, and indexing logic continue to function unchanged.

Operators should verify before activation that:

- **Reorg-handling code paths** function correctly.
These are exercised more frequently post-activation due to the higher block cadence, so any latent bugs are more likely to surface in production.
- **Hardware headroom** is sufficient for the increased rate of `blockchain.headers.subscribe` notifications and other per-block work.

Ongoing operational implications (notification throughput, reorg frequency, indexing throughput) are discussed in the [Ongoing Costs](#ongoing-costs) section.

#### Hardware Wallets

Signing logic is unaffected.
Any firmware UI that displays "approximate confirmation time" or hardcodes "blocks per day" assumptions may need updates, though in practice such displays usually live in companion apps rather than on-device firmware.

#### Light Wallet Libraries

Libraries such as libauth, mainnet-js, and others embedded in mobile and web wallets may have hardcoded assumptions about confirmation timing, "blocks per day" conventions, or block-counting heuristics.
Review and update such constants ahead of activation.
Adopting the tick abstraction (where applicable) is recommended for forward compatibility with any future target time changes.

#### Light Wallets

Activation-time concerns are minimal.
Most light wallets do not verify SPV proofs and instead rely on Electrum-style address subscriptions, polling, and history requests; for these, the only likely change is reducing polling intervals to match the new block cadence.

For wallets that do verify SPV proofs, the main concern is correct estimation of chain progression and time-based displays (e.g., "estimated confirmation in N minutes").
Header chain growth is secondary; the volume does not change overnight, so wallets continue to function correctly without changes.
That said, implementing MMR-based header pruning ahead of activation (see [CHIP-2026-02: Simplified Header Verification](https://gitlab.com/0353F40E/mmr)) is a nice-to-have that reduces long-term storage and sync costs.

Ongoing bandwidth and storage implications of 10x more headers are discussed in the [Ongoing Costs](#ongoing-costs) section.

### Block Explorers and Analytics

#### Block Explorers

Most block explorer functionality is unaffected at the data layer; the main concerns are display conventions and user-facing time estimates.
Not upgrading typically results in either no issue or a UX/display issue where metrics tied to the old target block time become misleading.

- **Pagination defaults** (e.g., "blocks per page", "blocks per day" widgets) may need recalibration, as 144 blocks per day becomes 1,440 blocks per day post-activation.
- **Average block time displays** continue to work, but should be labeled to clarify the new 1-minute target.
- **Halving countdown timers** should switch to a tick-based calculation, which is forward-compatible with any future target time changes.
- **Next difficulty adjustment estimators** continue to work with ASERT (which is already time-based), but any UI that expresses the estimate in "blocks remaining" should reflect the new cadence.
- **Confirmation count displays** continue to work; consider showing tick-equivalent confirmations alongside for users coordinating across services with different confirmation policies.
- **API endpoints exposing height** should additionally expose tick (see [Recommended API Changes](#recommended-api-changes)) to give downstream consumers a forward-compatible reference.
- **Activation block marker.**
A clear marker on the block list or chain visualization helps users understand the cadence change at a glance.

#### Analytics Pages

Most analytics are time-based and unaffected.
The main concerns are display conventions and chart continuity across the activation boundary.

- **Hashrate calculations** are time-based and remain correct.
- **Difficulty charts** will show a 10x drop at activation; annotation is recommended to prevent reader confusion.
- **Block reward charts** similarly need annotation, as per-block subsidy drops to 1/10th.
- **Block-count aggregations** that approximate a day as 144 blocks (or a week as 1,008 blocks) will need to be revised to 1,440 blocks per day post-activation.
Tick-based aggregation (e.g., 86,400 ticks per day) is a forward-compatible alternative that remains correct across any future target time changes.
- **Per-block vs. per-day chart aggregations** will look very different post-activation; switching to fixed time windows or tick-based windows preserves visual continuity.
- **Activation block marker.**
A clear marker on charts spanning the activation point is recommended.

### Application Layer

#### DeFi Platforms and Smart Contracts

Platforms like Cauldron, Badgers Cash, BCH Pump, BasicSwap DEX, and other DeFi and smart contract applications are affected in several areas:

- **On-chain time-locked contracts** using `nLocktime`, `nSequence`, `OP_CHECKLOCKTIMEVERIFY`, or `OP_CHECKSEQUENCEVERIFY`: legacy contracts continue to behave identically in wall-clock terms due to height-mode normalization.
No changes required for existing contracts.
- **Height-mode semantics for new contracts.** Smart contract developers must be aware that one unit of height-mode locktime or sequence now corresponds to 10 real blocks post-activation, not 1.
A contract locking funds for "100 blocks" in height mode will unlock after 1,000 real blocks (still ~1,000 minutes in wall-clock terms), so any application logic that compares contract-level height against the chain's real block count must account for the 10x factor.
- **New contracts** can take advantage of finer MTP granularity for more precise time-based locks.
- **Application-level block-counting heuristics** (e.g., watchtower alarms, off-chain protocol state machines, "wait N blocks before retrying") will fire 10x faster post-activation and should be migrated to time-based or tick-based measurements.
- **UTXO contention recovery logic** benefits from faster blocks (see the [DeFi UTXO Contention](#defi-utxo-contention) section in Motivation), but should be tested at the new cadence.

#### Application Developers Generally

Any application that polls "is the chain tip new?" at intervals tuned to 10-minute blocks may want to revise polling intervals or switch to event-driven subscriptions.

Any application that gates fund release or other behavior on block finalization will need updating: the depth threshold moves from 10 to 100 blocks, but the 2-hour aging gate is unchanged. Under normal cadence the aging gate binds, so finalization fires at roughly 120 minutes (~121 confirmations), not 100. Services that release funds only on finalized transactions should consume the node's finalization state or evaluate both gates (6,000-tick depth and ~120 minutes of age), and must not treat 100 confirmations as finalized.

### Documentation and Education

- **Existing tutorials, wikis, books, and courses** that quote the "10-minute block time" need revision.
- **BCH advocacy materials** comparing to other chains can be updated to reflect the new positioning.
- **Developer documentation** for time-locked contracts requires updates describing tick semantics and the height-mode normalization.

### Testing Infrastructure

- **Testnet operators** must coordinate activation on test networks ahead of mainnet.
- **Regtest harnesses** that mine blocks on tight schedules generally remain compatible (regtest difficulty is fixed), but they inherit the activation and therefore the cadence change.
  The established practice is to pin the override: to a recent past time when a test wants the upgrade active, and to a far-future sentinel when it needs the legacy rules, which is also what a harness must do if it depends on 100-block coinbase maturity.
  A far-future sentinel should be a concrete date comfortably inside the range the implementation's arithmetic handles, such as `2100-01-01T00:00:00Z` (`4102444800`), rather than the extreme value of the integer type, so that any conversion of the remaining time (in BCHN, to milliseconds) cannot overflow.
  The following details are properties of BCHN's start-up override, not of this CHIP:
    - In BCHN the remaining time is converted to milliseconds, so the sentinel must sit inside the range that conversion handles rather than at the integer maximum.
    - In BCHN, on networks with a fixed ASERT anchor, the override must also be at or above that network's anchor *parent* timestamp or start-up rejects it; regtest has no anchor, so no such floor applies there, which is why the sentinel is only constrained by the conversion on the network this bullet is about.
    - On the anchored networks the figure is a per-network `chainparams` value, so a harness should read it from the chainparams of the network it targets rather than restate it here.
- **CI systems and integration test suites** that simulate block intervals for time-locked contract testing will need updates.

### Coordination Costs

Beyond per-stakeholder costs, the upgrade incurs coordination cost:

- **Cross-implementation communication** and consensus on the specification.
- **Public testnet activation** ahead of mainnet to flush out integration issues.
- **Outreach to downstream software maintainers** (light wallets, exchanges, explorers) sufficiently ahead of activation.
- **Synchronized release timing** so that downstream software ships updated versions before activation.

This is the same coordination overhead that any network upgrade incurs, and existing BCH coordination channels (BCH Workgroups, upgrade calls, etc.) are well suited to absorb it.

### Summary

The activation costs of this proposal are real but bounded.
The bulk of engineering effort falls on node implementers, mining infrastructure operators, and indexing services.
Other stakeholders face mostly UX-level and configuration adjustments, distributed across many small surfaces (wallets, explorers, documentation) rather than concentrated in any one place.
The tick abstraction is specifically designed to give downstream software a forward-compatible migration path, so that this upgrade and any future block time adjustments share the same well-defined integration points.

## Ongoing Costs

### Increased Orphan Rate

As shown in [Tolerable Orphan Rate](#tolerable-orphan-rate), orphan rates are akin to a price drop: both reduce network hash rate by making low-margin hardware unprofitable, prompting miners to shut it down.
In [Impact Assessment](#impact-assessment), we estimate that orphan rates will increase to between 0.41% and 1.94% with 1-minute blocks.
From the network's perspective, this translates to purchasing 0.41% to 1.94% fewer hashes for the offered block reward, assuming constant transaction fee volume and price.
Long-term network security depends on block reward value growing over time through price increases and higher transaction volume, even as the block subsidy decreases with each halving.
Even a small increase in price would offset this modest orphan rate impact.
For example, if the orphan rate increases from approximately 0.1% to approximately 1% and the BCH price is 40,000 USD, a 1% price increase (to 40,400 USD) would offset the impact: the higher price attracts proportionally more mining, but the network receives proportionally less due to orphaning, yielding similar chainwork either way.

This price-drop view bounds the aggregate, but the security-relevant effect is the asymmetry: orphan losses fall unevenly across miners, penalizing smaller pools more than large, and mildly favoring attackers with superior network position.
That incentive skew — who loses, and whether it nudges hashrate toward consolidation or shifts selfish-mining profitability — is analyzed in [Mining Centralization Risk](#mining-centralization-risk) and [Security Analysis: Selfish Mining](./security.md#selfish-mining).

Given these dynamics, the orphan rate increase is unlikely to meaningfully affect network security.

### P2P Network Layer

With 1-minute blocks, the peer-to-peer network sees 10x more block-related messages.

**Block Announcements**

Each new block triggers a cascade of messages.
Using 8 peers as an example (long-running nodes with open inbound ports typically have many more):

- A node receives up to 8 `inv` per block but only requests headers once
- When announcing a block, the node sends `inv` to all 8 peers and may respond to `getheaders` from each

In total, block announcements scale to approximately 11,520 inbound `inv` messages per day (vs 1,152 with 10-minute blocks), with header requests scaling to approximately 1,440/day (vs 144).

This chatter occurs in bursts around block discovery, and the per-block burst amplitude is identical for 10-minute and 1-minute blocks.
However, with faster blocks there is increased chance of overlap: a new block arriving before the previous block's message cascade has subsided.
The probability of a very fast block (under 10 seconds) increases almost 10-fold, though such overlapping bursts remain infrequent in absolute terms.

**Bandwidth Impact**

The messages themselves are small:

- `inv` for one block: ~37 bytes
- `getheaders` request: ~69 bytes
- `headers` response (1 header): ~84 bytes

Daily overhead for an 8-peer node (worst case):

| Component | 10-min blocks | 1-min blocks |
|-----------|---------------|--------------|
|`inv` (send + receive) | ~86 KB | ~852 KB |
|`getheaders` (send + receive) | ~90 KB | ~895 KB |
|`headers` (send + receive) | ~109 KB | ~1.1 MB |
| **Total** | ~285 KB/day | ~2.8 MB/day |

This is negligible for full nodes but contributes to the baseline chatter increase that all participants experience.

**Block Propagation**

Block propagation time is largely unaffected:

- Compact blocks (BIP-152) efficiency is unchanged; reconstruction works the same regardless of block size
- 1/10th block size means faster transmission when full blocks are needed
- 10x more frequent propagation events, but each completes faster

The net effect on network health is neutral to slightly positive: more frequent but smaller propagation bursts are easier on network buffers than infrequent large ones.

### Header Chain Growth

The header chain is currently ~72 MB, growing at ~4.2 MB per year.
Post-activation with 1-minute blocks, the growth rate will increase to ~42 MB per year.
If this CHIP activates in 2026, headers will reach ~244 MB by 2030 and ~412 MB by 2034.

#### Impact on Nodes

In 2009, Satoshi compared header storage to 2 GB of RAM and projected a 1.2 GB per year growth in typical system RAM capacities.
His predictions held up: modern systems commonly have 16 GB or more.
With 1-minute blocks and RAM growth continuing at ~1.2 GB per year, header storage will remain trivial for nodes, even if stored entirely in RAM.

#### Impact on Indexers

This category covers block explorers, analytics sites, wallet and dapp backends, and similar services.
Typically these maintain a height-indexed table of block hashes, and may also store headers and per-block aggregates (e.g., transaction counts, cumulative fees, mining pool tags) keyed by height.
Faster blocks change the growth rate of such tables by 10x.
This does not change fundamental scaling, which remains linear in wall-clock time; only the slope of the time-vs-size curve changes.

For most indexers, the bulk of storage is in transaction-level data rather than per-block metadata, so the increase in height-indexed storage is small relative to the total footprint.
Operators should factor this into long-term capacity planning, alongside the existing growth driven by transaction volume.

For perspective, Dogecoin launched in December 2013 with a 1-minute target block time and has since accumulated ~6M blocks, versus ~1M blocks on BCH.
Dogecoin has been continuously supported by indexers and block explorers throughout that period, with infrastructure that originally ran on 2014-era hardware and has scaled smoothly to today's volumes.
If indexer infrastructure could handle 1-minute blocks more than a decade ago, we do not expect any fundamental issues with the increased per-block rate on modern hardware.

#### Impact on Simplified Payment Verification (SPV) Clients

Bitcoin's architecture supports trustless transaction verification via simplified payment verification (SPV), as described in the whitepaper:

>It is possible to verify payments without running a full network node. A user only needs to keep a copy of the block headers of the longest proof-of-work chain, which he can get by querying network nodes until he's convinced he has the longest chain, and obtain the Merkle branch linking the transaction to the block it's timestamped in. He can't check the transaction for himself, but by linking it to a place in the chain, he can see that a network node has accepted it, and blocks added after it further confirm the network has accepted it.

SPV clients verifying transaction Merkle proofs must download, verify, and store at least the tip header segment from the oldest transaction they need to verify.

##### SPV Client Storage Requirements

Header storage (~72 MB today) is significant for mobile apps, where storage is typically measured in hundreds of megabytes.
To mitigate this, solutions already exist:

- Electrum servers [provide header Merkle proofs](https://electrum-cash-protocol.readthedocs.io/en/latest/protocol-methods.html#blockchain-block-header) against a Merkle root of all headers up to a desired height.
- Clients can [store and maintain an up-to-date root](https://bitcoincashresearch.org/t/chip-2026-02-simplified-header-verification-for-bitcoin-cash/1750) instead of the full header chain, making storage requirements fixed-size.

This approach eliminates the storage burden but relies on Electrum server availability.
Fortunately, many public Electrum servers exist, as much of the BCH wallet ecosystem already depends on and maintains this infrastructure.

For clients aiming to avoid middleware and rely solely on the [node network protocol](https://documentation.cash/protocol/network/messages.html), [adding header Merkle proofs to the protocol](https://bitcoincashresearch.org/t/chip-2026-02-simplified-header-verification-for-bitcoin-cash/1750/4) could eliminate storage needs entirely.

##### SPV Client Bandwidth Requirements

Even with storage mitigation, clients must download the full header chain once to compute the headers Merkle root independently.
This requires:

- ~72 MB in 2025
- ~244 MB in 2030
- ~412 MB in 2034

Per the GSMA's ["The State of Mobile Internet Connectivity Report 2024"](https://www.gsma.com/r/somic/), Sub-Saharan Africa, the region with the lowest bandwidth, averages 15 Mbit/s mobile broadband download speeds, with global trends showing further increases.
At 15 Mbit/s, downloading 72 MB takes approximately 40 seconds, and downloading 412 MB of headers (by 2034) would take approximately 4 minutes.
This means that during initial sync, apps must process headers in the background to avoid blocking user activity.

To enable this, apps can temporarily trust a Merkle root from third parties.
Electrum servers [offer this](https://electrum-cash-protocol.readthedocs.io/en/latest/protocol-methods.html#blockchain-block-headers), allowing clients to query multiple servers for a root with minimal bandwidth and delay.
Once background header verification completes, trust becomes fully independent.
Extending the node network protocol to serve header roots could remove Electrum dependency entirely.

After initial sync, clients only download new headers since the last root to update it.
The table below shows update times at 15 Mbit/s with 1-minute blocks:

**Table: Headers Root Updating (1-minute block time, 15 Mbit/s download speed)**

Usage Frequency | Download Duration per Startup (seconds)
----------------|----------------------------------------
Once a year     | 22.40
Once a month    |  1.87
Once a week     |  0.43
Once a day      |  0.06

After initial sync, clients can easily maintain an up-to-date root on each startup.

##### SPV Client CPU Requirements

Initial header sync must complete in reasonable time without CPU bottlenecks.
Even low-power 32-bit embedded CPUs handle SHA256 efficiently.
Per Cuellar's ["Performance Analysis of Cryptographic Hash Function on 32-Bits Embedded Systems" (2023)](https://www.ripublication.com/ijde23/v18n1p07.pdf), 100,000 SHA256 iterations take 19 seconds on a 48 MHz, 128 KB RAM chip.
For approximately 1 million headers (by 2030), that is approximately 2 million SHA256 operations.
At 100,000 per 19 seconds, this would take approximately 380 seconds (~6 minutes) on the referenced 48 MHz chip.
This confirms that even resource-constrained devices can trustlessly verify header roots in the background.

### Light Wallet Architectures

Light wallets use various mechanisms to identify relevant transactions without running a full node.
This section examines how faster blocks affect the three main approaches: BIP-37 bloom filters, BIP-157/158 compact block filters (Neutrino), and Electrum-style indexing servers.

All three architectures share a common cost: clients must track the block header chain, which grows 10x faster with 1-minute blocks (approximately 42 MB/year vs 4.2 MB/year).
This was discussed above in [Impact on Simplified Payment Verification (SPV) Clients](#impact-on-simplified-payment-verification-spv-clients) where we have shown it remains manageable (background process for initial sync), with incremental updates trivial for regular users, and mitigations possible (BIP-37, Neutrino) or already available (Electrum).

#### BIP-37 Bloom Filters

With [BIP-37](https://github.com/bitcoin/bips/blob/master/bip-0037.mediawiki), the client provides a bloom filter to the serving node, which tests each transaction against it.
With 1-minute blocks:

- The client's filter size stays constant (determined by wallet addresses, not block content).
- Nodes send 10x more block-related messages, but each block contains 1/10th the transactions.
- Total transaction testing work remains roughly equivalent.
- Per-block overhead increases: 10x more `merkleblock` messages, partially offset by smaller merkle proofs (~33% shorter due to shallower trees).
- Header chain: clients must sync and store 10x more block headers (approximately 42 MB/year).

The net result is approximately 10x increase in small control messages with near-zero change in heavy payload traffic.
For continuously connected clients, this adds modest protocol overhead (approximately 200 KB/day in headers and control messages).
For mobile wallets that sync periodically, the P2P protocol already supports efficient batch requests: a single `getdata` message can request thousands of `merkleblock` items, with the server streaming responses as fast as disk I/O allows.
A wallet offline for 2 days requests 2880 blocks instead of 288, but these can be batched (e.g. 10 or 100 per `getdata` message) to reduce number of requests; the bottleneck is server disk read speed, not network latency.
Notably, Flowee Pay [uses batch size of 10](https://codeberg.org/Flowee/thehub/src/branch/master/libs/p2p/Peer.cpp#L373) for its merkleblock queries, and changing this to 100 would prevent doing more round-trips than before.
This was tested during this CHIP's development and resulted in lifting the measured sync rate from about 5 blocks per second to about 50 blocks per second.

Header synchronization is similarly efficient: the P2P `getheaders` message returns up to 2000 headers per request.
A wallet catching up on 2 days of 1-minute blocks needs 2 round-trips instead of 1, a negligible difference.

Similar to Electrum, to mitigate block header storage, [node P2P services could be extended with header merkle roots](https://gitlab.com/0353F40E/mmr#p2p-protocol-extension-for-simplified-header-verification).

##### Flowee Pay

Among popular Bitcoin Cash wallets, only Flowee Pay is built with this architecture.
It already mitigates the size of the headers dataset by:

- Shipping a static headers file with some releases (e.g. Ubuntu packages, or via HTTP download for AUR and manual builds)
- Offering partial HTTP download of historical headers at runtime (for wallet imports), with verification against hard-coded checkpoints
- Using P2P network only for syncing from the static headers to the current tip

The system prioritizes fast user experience for imports while maintaining security through checkpoint verification.
A wallet importing keys from 2020 does not need to wait for P2P sync of 200,000+ headers; it downloads them in seconds via HTTP.

For example, the [February 2026 Ubuntu release](https://launchpad.net/~flowee/+archive/ubuntu/ppa/+sourcepub/18114803/+listing-archive-extra) ships with 850,000 headers bundled in the package (a 68 MB `blockheaders` file).
At the time of this writing the height is 939,296, so the wallet syncs an additional 89,296 headers (~7.14 MB, ~620 blockchain days) from P2P network.
If Bitcoin Cash had 1-minute blocks from the start, that would be a 680 MB file shipping with the release, and an additional P2P sync of 71.4 MB.
Note that the Android app ships with only 2,000 headers (February 2026 release shipped with headers 850,000 through 851,999), and downloads earlier headers as needed via HTTP based on wallet start height, while syncing new headers via P2P network.

This CHIP would increase storage requirements for this wallet, with the impact compounding over time.

Storage could be mitigated by implementing header merkle proofs, allowing wallets to prune headers after computing the tip root.
The wallet would ship with a checkpoint (header + merkle proof to root) instead of full headers, then compute new roots as headers arrive and prune old ones.
This would not reduce the need to download and process all headers, but would remove the storage burden.

Electrum servers already support a [`blockchain.block.headers`](https://electrum-cash-protocol.readthedocs.io/en/latest/protocol-methods.html#blockchain-block-headers) endpoint that returns headers with optional merkle proofs.
Flowee Pay already connects to Electrum servers for specific operations during wallet import and sweep:

| Source File | Method | Purpose |
| --- | --- | --- |
| [IndexerServices.cpp](https://codeberg.org/Flowee/pay/src/branch/master/src/IndexerServices.cpp) | `server.peers.subscribe` | Discover more Electrum servers |
| [ElectronXClient.cpp](https://codeberg.org/Flowee/pay/src/branch/master/src/ElectronXClient.cpp) | `server.version` | Connection handshake |
| [ImportHandler.cpp](https://codeberg.org/Flowee/pay/src/branch/master/src/ImportHandler.cpp) | `blockchain.scripthash.get_first_use` | Find when address was first used (for import start height) |
| [TransactionsFetcher.cpp](https://codeberg.org/Flowee/pay/src/branch/master/modules/send-sweep/TransactionsFetcher.cpp) | `blockchain.scripthash.listunspent` | Get UTXOs for sweep |
| [TransactionsFetcher.cpp](https://codeberg.org/Flowee/pay/src/branch/master/modules/send-sweep/TransactionsFetcher.cpp) | `blockchain.transaction.get` | Fetch full transaction data for sweep |

Ongoing wallet operations (balance tracking, receiving, sending) use only P2P with bloom filters.
The architecture could be extended to fetch header merkle proofs from Electrum servers, reducing storage requirements.
This would introduce an ongoing reliance on Electrum (vs one-time, only for imports and sweeps), so it is not ideal for a P2P-focused wallet.
Later, should the node P2P protocol be extended with header merkle proof messages, the wallet could switch to P2P as the source.

Note that implementing header merkle proofs at the node P2P layer would be beneficial even with 10-minute blocks, as it would relieve wallets of having to store headers unrelated to their transactions.

#### BIP-157/158 Compact Block Filters (Neutrino)

With Neutrino ([BIP-157](https://github.com/bitcoin/bips/blob/master/bip-0157.mediawiki) and [BIP-158](https://github.com/bitcoin/bips/blob/master/bip-0158.mediawiki)), nodes generate per-block filters that clients download and test locally.
With 1-minute blocks:

- Clients download 10x more filters, each approximately 1/10th the size (filter size scales with the number of addresses encoded, plus small fixed overhead per filter for Golomb-Rice parameters).
- Total filter data remains roughly equivalent, with minor additional overhead from per-filter metadata (CompactSize prefix, per-block SipHash key derivation).
- Filter header overhead increases by approximately 16 MB/year (10x more 32-byte headers).
- Header chain: clients must sync and store 10x more block headers (approximately 42 MB/year); mitigation with header merkle roots possible.
- Block downloads on filter match are 1/10th the size.

The last point is significant.
When a filter matches, the client downloads the full block to find their transaction.
A user's transaction frequency in real time is unchanged by block time, so the number of filter matches remains constant.
But each matched block is approximately 1/10th the size, reducing block download bandwidth by approximately 90%.

This is a net benefit for Neutrino clients: modest overhead increase from filter and block headers, substantial bandwidth savings on block downloads.

#### Electrum-Style Indexing Servers

[Electrum architecture](https://electrum-cash-protocol.readthedocs.io/en/latest/index.html) uses dedicated indexing servers that maintain a full address-to-transaction index.
Clients query the server for transactions matching their addresses, and the server returns transaction data along with merkle proofs for verification.

With 1-minute blocks:

- Server-side indexing: Transaction volume is unchanged, so indexing work remains equivalent.
- Query responses: Identical; the server returns the same transactions regardless of block time.
- Merkle proofs: Slightly smaller due to fewer transactions per block (log(n) scaling).
- Subscription notifications: Clients subscribe to address activity and receive notifications when relevant transactions appear; the rate of new-activity notifications is unchanged (tied to user transaction volume, not block time). However, an address's scripthash status changes once per new block during the first N confirmations, so wallets that render per-confirmation progress (e.g., Electron Cash's progress bar and final checkmark) will receive those status updates ~10x faster in wall-clock time — the per-transaction update count is unchanged, only the cadence.
- Header updates: Clients receiving header notifications will receive 10x more messages, but they can reduce chatter by polling the server at an interval suited to their needs (e.g. every few minutes) rather than subscribing to every header.
- Header chain: Clients must sync 10x more headers (approximately 42 MB/year vs 4.2 MB/year).

The primary impact is increased header chain growth.
Electrum servers already provide [header merkle proofs](https://electrum-cash-protocol.readthedocs.io/en/latest/protocol-methods.html#blockchain-block-header), allowing clients to verify headers against a known root without storing the full header chain, making header growth a minor concern for most users.

#### Summary

| Architecture | Filter/Index Work | Client Bandwidth | Per-Block Overhead |
|--------------|-------------------|------------------|--------------------|
| BIP-37 | Equivalent | Equivalent | 10x more control messages; ~42 MB/year headers; mitigation possible |
| Neutrino | Equivalent | Improved (~90% less on matches) | ~16 MB/year filter headers; ~42 MB/year block headers; mitigation possible |
| Electrum | Equivalent | Equivalent | ~42 MB/year headers; already mitigated by header merkle proofs |

None of the light wallet architectures are adversely affected by faster blocks.
All share the common cost of header chain growth (approximately 42 MB/year), with mitigations possible or available.
Beyond headers, BIP-37 sees increased control message chatter but equivalent payload traffic, Neutrino sees net improvement from smaller block downloads, and Electrum is essentially unaffected.

#### The Common Thread: Hash-Keyed Routing

Stepping back, every light-wallet architecture reduces to one of two categories: either the client takes the block (or a compact summary of it) and looks for its own transactions, or the client tells a server what it is looking for and the server scans on the client's behalf.
BIP-37 and Electrum take the second path; Neutrino takes the first.
What is less obvious is that both paths rest on the same substrate — a set of element hashes and a membership lookup against it — and each architecture is just a different choice of who holds that set, and how compactly it is encoded.

The substrate made explicit is what this section's research arrived at: the client sends 64-bit hashes of the addresses it watches, and the server keeps a reverse index from hash to the set of subscribed clients, so every block element is matched by a single lookup whose cost is independent of client count.
Optionally the server can publish per-block hash lists, letting clients verify routing completeness or operate in pull mode.

With 1-minute blocks:

- Per-block work: 10x more blocks with 1/10th the transactions each; net work equivalent.
- Index size: unchanged (depends on subscribed addresses, not block structure).
- Client bandwidth: unchanged (receives same transactions regardless of block time).
- Merkle proofs: ~33% shorter due to shallower trees.
- Header chain: clients must sync 10x more headers (~42 MB/year); mitigation with header merkle proofs possible.

BIP-37 is this same model with extra machinery.
With a shared tweak and a standardized number of hash functions, a server can precompute each element's bit positions once and keep a bit-to-clients index, making per-block work independent of client count too — at the cost of seven 32-bit index entries per address instead of one 64-bit hash.
The per-client tweak was the only thing preventing that cross-client sharing, and it bought little, since a server that scans for you sees your matches regardless.

Neutrino uses the same substrate from the client side: each element is SipHash'd to a 64-bit value, the values are sorted, and the gaps between them are delta-coded with Golomb-Rice for transmission ([BIP 158](https://github.com/bitcoin/bips/blob/master/bip-0158.mediawiki)).
Its only difference from the explicit form is that the 64-bit values are first folded into a smaller range `[0, N·M)` — accepting a `1/M` false-positive rate — to shrink them further, where the position list keeps the full 64-bit range and is exact to ~2⁻⁶⁴ at the cost of more bytes per element.
The encoding is direction-agnostic: the same sorted-hash, delta-coded list could carry a client's watch set to a server in a BIP-37-style protocol just as it carries a block's contents to a client, the only difference being the fold factor that trades false positives against size.

Electrum is the model already deployed without the hashing: its servers keep a reverse index from scripthash to the set of subscribed clients, recompute a scripthash's status whenever the chain or mempool touches it, and push the change to every affected wallet — batched and deduplicated, with newly connected clients handed the current status immediately ([Fulcrum SubsMgr.cpp](https://github.com/cculianu/Fulcrum/blob/master/src/SubsMgr.cpp)); a reconnecting client then drains the mailbox via `get_history`-style queries for whatever it missed while offline.

The routing model is the same shape as e-mail, which has always delivered messages by lookup to a per-address mailbox, then pushed them while the client stays connected or drained the mailbox on reconnect.
It has served e-mail and message queues at far greater scale for decades, so the concern that 1-minute blocks would overwhelm it does not arise.

This section originated from [research into BIP-37 and BIP-157/158](https://bitcoincashresearch.org/t/research-hash-keyed-pub-sub/1749) prompted by this CHIP, which reached the same routing model by a more roundabout route.

## Risk Assessment

### Bitcoin Cash Image Risks

Bitcoin Cash, a direct fork of Bitcoin (blocks 0 through 478,558), draws much of its image from its link to the original Bitcoin genesis block.
Would changing the target block time weaken its claim to the Bitcoin title?
Would it harm Bitcoin Cash's reputation?
Here, we address these community concerns.

Discussions have shown some view the 10-minute target time as central to Bitcoin Cash’s identity, concern illustrated by one commenter [linking](https://bitcoincashresearch.org/t/chip-2025-03-faster-blocks-for-bitcoin-cash/1513/14) the 10-minute target to Bitcoin Cash's soul: "If BCH goes to 2-minute blocks, it might win some short-term attention but lose its 'soul' in the process."
The CHIP author [challenged](https://bitcoincashresearch.org/t/chip-2025-03-faster-blocks-for-bitcoin-cash/1513/15) this by highlighting block time variance:

>20% of BCH blocks had durations shorter or equal than 2 minutes, are they soulless blocks? Nobody seems to complain about those when their TX happens to be in them.
>20% of BCH blocks had durations longer or equal to 16 minutes, do those have more soul?
>
>Only about 8% of the blocks had durations of 10±1 minutes, do those have just the right amount of soul?

These concerns are not rooted in technical issues with block time, so technical arguments alone will not resolve them.
Instead, we examine the social impact of protocol upgrades, particularly to the blockchain’s heartbeat: the difficulty adjustment algorithm (DAA).

The DAA sits at the heart of Bitcoin Cash, governing block time and thus the protocol's rhythm.
Its history offers lessons.
The original DAA, specified in the whitepaper, seems more deliberately designed than the 10-minute block time we propose to change:

>To compensate for increasing hardware speed and varying interest in running nodes over time, the proof-of-work difficulty is determined by a moving average targeting an average number of blocks per hour. If they're generated too fast, the difficulty increases.

Circumstantial evidence suggests Satoshi designed the DAA to adjust slowly to hinder minority forks:

- "There is only one global chain." -- [source](https://www.bitcoin.com/satoshi-archive/emails/mike-hearn/1/#selection-25.161-25.192)
- "The nature of Bitcoin is such that once version 0.1 was released, the core design was set in stone for the rest of its lifetime." -- [source](https://satoshi.nakamotoinstitute.org/posts/bitcointalk/126/)
- "This is a design where the majority version wins if there's any disagreement, and that can be pretty ugly for the minority version and I'd rather not go into it, and I don't have to as long as there's only one version." -- [source](https://satoshi.nakamotoinstitute.org/posts/bitcointalk/127/)
- "There is no way for the software to automatically know if one chain is better than another except by the greatest proof-of-work.  In the design it was necessary for it to switch to a longer chain no matter how far back it has to go." -- [source](https://bitcointalk.org/index.php?topic=834)

Yet, Bitcoin Cash has modified its DAA to survive as a minority fork and refined it twice more.
Poor changes in DAA damaged BCH's image in the past:

- The Emergency DAA (2017) caused days of fast blocks (~2-minute daily averages) but also days of slow blocks (~30-minute averages) and accelerated emission (~131k BCH released ahead of schedule).
It is still being used today as an example of a poor design ([OPNEXT 2025 presentation](https://x.com/blockspacepod/status/1911050474293166286?t=2465s)).
- The CW-144 DAA (2017-2020) was less disruptive but still triggered hash-rate swings, causing periods of faster and slower blocks.
Some still mistakenly attribute slow blocks to these swings rather than PoW’s natural variance.

By contrast, the ASERT DAA (2020 onwards) earned praise, becoming a point of pride for the community.

The lesson is clear: **core protocol changes do not harm BCH's image because they are core changes, but because they are poorly executed.**

How do we avoid bad changes?
Through a [rigorous evidence-based process](https://read.cash/@mtrycz/how-i-envision-decentralized-cooperation-on-bitcoin-cash-9876b9e9), as championed by [ASERT DAA](https://read.cash/@jtoomim/bch-upgrade-proposal-use-asert-as-the-new-daa-1d875696) and formalized in the [CHIP framework](https://gitlab.com/im_uname/cash-improvement-proposals/-/blob/master/CHIPs.md).

This process has since delivered successes.
Native tokens ("CashTokens," 2023) faced heated debates in lead-up to the proposal but activated smoothly, becoming a celebrated feature.
The adaptive blocksize limit algorithm (“ABLA,” 2024) also overcame initial debates, activated cleanly, and boosted BCH's reputation.

Why should this upgrade be any different?

#### What Will Bitcoin Cash Haters Say?

Some worry that this change would give outsider haters fresh ammunition to attack BCH's image with.
One commenter [wrote](https://t.me/bchchannel/394496):

>Yes, but they use whatever they get as an argument. Once you change blocktime to 2min they say: "See BCH is not bitcoin anymore they changed blocktimes which is fundamental to bitcoin"
>
>Their assumption is:" BCH is a fraud and needs to die" and they will say anything that makes that happen. And the only way to convince them otherwise is success. So we should do what makes the coin succeed.  And I'm not sure if interCEX transfer is where BCH will succeed.
>But maybe it is safe to do or even an improvement with todays hardware, idk.

But how could an objective improvement damage BCH with any success?
Would claiming "BCH now has better user experience due to faster blocks, but it is not Bitcoin, so it is bad despite being better!" really deter new users or drive away existing ones?
Haters have never considered BCH legitimate Bitcoin anyway; why should we give any credence to their criteria on what makes Bitcoin Cash Bitcoin?
In fact, some haters [used the 10-minute block time](https://x.com/TheSurvivalPodc/status/1768755881972322538) to dismiss BCH's claim of fast zero-confirmation (0-conf) transactions.
One-minute blocks would position BCH to win public debates over speed among Bitcoin-tech coins (BTC, LTC, BCH).
If BCH proponents need to defend the 1-minute target in public, this CHIP arms them with arguments to prevail.

Besides, haters are now a disgruntled minority, remnants of battles from past forks (BTC in '17, BSV in '18, XEC in '20).
Should their opinions dictate BCH's progress?
Wouldn't it be absurd to let BCH's critics steer its upgrades?

Meanwhile, relations between the BTC and BCH communities have warmed recently.
For example, BCH community members attended a BTC developer conference (OPNEXT 2025), [live-streaming with BTC guests](https://x.com/TheBCHPodcast/status/1910798157187096782), enjoying a positive exchange.
This shift stems from BCH’s evolution, both technical and cultural:

- Smart contract and native token upgrades, attracting interest from BTC developers seeking covenants.
- Renewed BTC interest in blocksize limits, with neutral mention of BCH's algorithm in a recent [presentation](https://www.youtube.com/watch?v=REmsKPYyV_M&t=967s).
- BCH's focus on growing its distinct Bitcoin Cash brand, pivoting to growth and competition in the crypto space rather than zero-sum fights with BTC.

Ultimately, the 1-minute block time strengthens BCH's position, aligning with its evolution and rendering haters' objections inconsequential.

#### But Bitcoin Cash Always Had 10-minute Blocks, Will It Still be Bitcoin?

Of course it will.
Why should one parameter, like the target block time, be the demarcation line between Bitcoin and not-Bitcoin?
Which promise would faster block times break?
Bitcoin's core promises are a peer-to-peer electronic cash system, a fixed 21M supply, and liberation from centralized fiat control, as captured in the genesis block:

>The Times 03/Jan/2009 Chancellor on brink of second bailout for banks

The whitepaper further defines Bitcoin's mission:

>What is needed is an electronic payment system based on cryptographic proof instead of trust, allowing any two willing parties to transact directly with each other without the need for a trusted third party. Transactions that are computationally impractical to reverse would protect sellers from fraud, and routine escrow mechanisms could easily be implemented to protect buyers. In this paper, we propose a solution to the double-spending problem using a peer-to-peer distributed timestamp server to generate computational proof of the chronological order of transactions. The system is secure as long as honest nodes collectively control more CPU power than any cooperating group of attacker nodes.

Did Bitcoin promise to be slow forever?
How would that serve its mission?
As [shown earlier](#Introduction), Satoshi considered block time a practical matter, focused on header chain size and orphan rates, not a fundamental property.
Interestingly, his 2008 pre-release code used 15 minutes as the target time ([source](https://x.com/raw_avocado/status/1916909449563811906), [source](https://github.com/0xMagnuz/Bitcoin-v0.1/blob/2c7a4c9bbb793c5029fc9363d504944b62f1ec4d/nov08/main.cpp#L663)).
We've also shown that the existence of a minority fork contradicts his "one global chain" vision, yet Bitcoin Cash persists and thrives.
Perhaps one day it could dominate, but it would still not be "one."

Like the [Ship of Theseus](https://en.wikipedia.org/wiki/Ship_of_Theseus), Bitcoin Cash has evolved since the 2017 fork, making changes needed to advance its mission while staying true to its course.
This perspective is shared by many in the community.
One [comment](https://t.me/thebitcoincashpodcast_discussion/127569) by a long-standing developer captures this attitude: "uhm.. where I came from, in 2013 or so, we said that there will be multiple chains and bitcoin will learn from what works and implement it if that makes it better. changing names today because we're doing what we said we would do, doesn't sit right with me."

Why should this change be any different from past successful changes?

### Explorer, Exchange, and Mining Pool Support

Some worry that neutral players like block explorers, exchanges, and mining pools who include Bitcoin Cash in their operations might face disruptions from a block time change, potentially leading them to drop support for BCH.
However, several networks have shown that such changes can occur without these issues:

1. In early 2016, Monero increased its block time from 1 minute to 2 minutes due to concerns about network stability in the context of unoptimized node software and the absence of compact block relay.
    - https://bitinfocharts.com/comparison/monero-confirmationtime.html#alltime
    - https://monero.stackexchange.com/questions/5/why-was-the-block-time-changed-from-1-to-2-minutes
    - https://forum.getmonero.org/20/general-discussion/2401/increasing-the-block-time
2. In late 2019, Zcash reduced its block time from 2.5 minutes to 75 seconds.
It continued to be supported by [major exchanges](https://coinmarketcap.com/currencies/zcash/#Markets) and [mining pools](https://miningpoolstats.stream/zcash).
    - https://bitinfocharts.com/comparison/zcash-confirmationtime.html#alltime
    - https://zips.z.cash/zip-0208
    - https://z.cash/upgrade/blossom/
3. Now in 2026, Zcash is proposing to again change its block time, now from 75s to 25s:
    - https://forum.zcashcommunity.com/t/proposal-lower-zcash-block-target-spacing-to-25s/54577
    - https://forum.zcashcommunity.com/t/zcash-block-time-reduction-appears-safe-for-nu7-w-zebra-only-devnet/55586
4. Nervos uses a [variable target block time](https://explorer.nervos.org/charts/average-block-time) targeting a [2.5% average network orphan rate](https://explorer.nervos.org/charts/uncle-rate) and is supported by [major exchanges](https://coinmarketcap.com/currencies/nervos-network/#Markets) and [mining pools](https://miningpoolstats.stream/nervos).
5. Kaspa, a blockDAG with variable block times that can be as low as 1 second, is supported by [exchanges](https://coinmarketcap.com/currencies/kaspa/#Markets) and [miners](https://miningpoolstats.stream/kaspa).

These examples demonstrate there is no cause for concern in this regard.
Zcash changing the block time a 2nd time and calling it a “small upgrade” is reassuring.
It can be seen as a signal that there were no big issues with the first one in 2019.

### Silent Assumptions

A consensus change of this size can be framed as "services can crash visibly or silently misread the chain." Crashes are loud and immediately fixed; silent misreads are the concern. Breaking the class down by consequence × likelihood is more informative than treating "silent breakage" as one homogeneous risk.

The binding assumption downstream services make is **confirmation semantics** — how much work N confirmations represent — and it is the one place where a silent misunderstanding has a financial consequence: crediting a deposit, or releasing funds, on the strength of a confirmation count that no longer means what it did under 10-minute blocks.

There are three ways a service can be wrong about this, and only one has real consequence:

- **The service consumes the node's RPC and scales its counts.** This is the common case the [Exchanges](#exchanges) section assumes, and it is the one with genuine consequence: an exchange that continues to credit at 1 confirmation is now crediting at 1/10th the previous chainwork, and every block-count timer — watchtowers, escrow-release "after N blocks" logic, covenant meters — fires 10× sooner for the same reason. This is not a bug — the RPC and the node keep working — but it is a policy change imposed on a service that did not make it. Likelihood is high for a service that does nothing at all; consequence is bounded by the per-deposit exposure, not by the network. This is precisely why the upgrade is announced, why the tick fields exist, and why the `confirmations_ticks` field gives a forward-compatible way to express the policy the service actually intended.
- **The service tracks height as a proxy for time.** It is wrong by construction post-activation, but the consequences are cosmetic — estimated wait times, "blocks per day" widgets, halving-countdown displays. The wrong number is visible, and its cost is a support ticket, not a loss.
- **The service runs in height-locktime mode and already-normalized contracts continue to function.** The CHIP deliberately preserves this. A service that never touched the chain's newer APIs keeps working, because the normalization is the compatibility layer.

The precedents above bound the likelihood from the empirical side: Monero and Zcash each shipped block-time changes under a live third-party ecosystem — exchanges, pools, explorers, wallets — and continued to be supported, with no reported funding loss from confirmation misreads. To be precise, those prior changes were smaller in magnitude (a factor of two, not ten), so they bound rather than fully transfer; they show the ecosystem-wide silent-misread failure did not materialize at the smaller magnitudes, not that a 10× change is identical.

So the "long tail of silent breakage" is largely the long tail of cosmetic drift, plus a well-identified policy question around confirmation counting, which is a protocol-visible question the ecosystem has answered on every previous upgrade — by announcing the change, scaling policy, and letting stakeholders confirm readiness through the same coordination the upgrade already uses.

### Risk of Hampering 0-conf Adoption

The proposal does NOT intend to replace zero-confirmation (0-conf) transactions, which, being nearly instantaneous, will always offer a superior user experience.
However, the concern is that in cases where 1-minute blocks are deemed sufficient, users might opt to require 1-conf transactions rather than accept 0-conf's minimal risk.

However, Litecoin provides a counterexample: despite its faster 2.5-minute target block time, Litecoin supporters advocate for 0-conf to further enhance user experience, as seen in discussions by [seaoflite](https://x.com/seaoflite/status/1836913874924093488) and [jonnylitecoin](https://x.com/jonnylitecoin/status/1837273042529177646).
This underscores 0-conf's value even with quicker confirmations.

Moreover, for many use cases, even a lower target block time would worsen the experience if payment delays the user.
For example, paying at a taxi, supermarket cashier, self-service checkout, vending machine, drive-through, and similar scenarios.
Thus, 0-conf remains essential for seamless transactions, ensuring its adoption will persist alongside faster confirmations.

### Mining Centralization Risk

Reducing a blockchain’s target block time increases its orphan rate, where normal network delays cause competing blocks to be mined and one is discarded ("orphaned").
This impact varies across mining pools, creating uneven consequences.
Larger pools experience fewer orphan losses, enhancing their profitability relative to smaller pools.
This advantage can attract a disproportionate hash rate, risking a centralization spiral that concentrates mining power and creates a larger moat against new entrants.

This analysis will explore the technical mechanism, determine the impact of orphan rates on miner profitability, and establish a tolerable orphan rate.
Then, we will analyze the current state of networking to determine limit conditions under which the tolerable orphan rate must not be exceeded.
Finally, we will show how reducing block time influences orphan rates under those conditions and verify that our proposed block time reduction remains within safe operational limits.

#### Orphan Rate Calculation Method

The likelihood that the network mines a competing block before our observed pool's block propagates fully is given by:

    p_orphan = 1 - e^(-block_propagation_time / block_interval)

The formula assumes an edge case with the following conditions:

- Our pool has negligible hash rate (~0% chance of mining the next block).
- The network's hash rate matches the difficulty and target time.
- The network's hash rate remains constant during the propagation window.
- All other pools receive our pool's block simultaneously and immediately switch to mining on top of it.
- All other pools have zero propagation time when announcing blocks to each other.

In practice, an observed pool's orphan rate will be lower than this formula predicts because:

- If the pool has non-negligible hash rate, the probability is reduced because only the remaining hash power could mine a competing block.
- The pool favors its own block and can win the orphan race if it finds the next block before the rest of the network.
- Other block producers receive the pool's block at different times; those receiving it sooner may mine on top of it, improving our pool's chances of winning the race.
- Competing blocks face their own propagation delays, affecting race outcomes and improving our pool's chances.

Thus, this formula provides a conservative upper bound for a minority pool's expected orphan rate.

We can account for a pool having non-negligible hash rate to get a tighter approximation:

    p_orphan_race = 1 - e^((1 - pool_relative_hash_rate) * (-block_propagation_time / block_interval))

This gives us the probability that an orphan race will occur against our pool's block.

**Network Orphan Rate**

Note that the above formula gives us the probability of a single pool entering an orphan race, not the network's overall orphan rate.
The network's orphan rate depends on the number of pools and the hash rate distribution.
A single pool with 100% hash rate would produce zero orphans, since there are no competitors to race against.
Conversely, many pools with equal hash power would maximize the network's orphan rate, since every block faces maximum competition during propagation.
The takeaway is counterintuitive: a more centralized network will exhibit a lower orphan rate.
However, this should not be mistaken for an argument in favor of centralization; the security and censorship-resistance benefits of decentralization far outweigh the cost of a modest orphan rate.
At the same time, an excessively high orphan rate in a decentralized network creates incentive to centralize.

To calculate the network's expected orphan race rate, we consider that each pool's contribution is weighted by its probability of mining a block.
If pool `i` has hash rate share `pool_hash_rate[i]`, it mines a block with probability `pool_hash_rate[i]`, and faces orphan race probability `(1 - e^(-(1 - pool_hash_rate[i]) * block_propagation_time / block_interval))`.
The network's expected orphan race rate is therefore:

    network_orphan_race_rate = sum(pool_hash_rate[i] * (1 - e^(-(1 - pool_hash_rate[i]) * block_propagation_time / block_interval)), for all i)

We can verify the edge cases:

- A single pool with 100% hash rate yields `network_orphan_race_rate = 1 * (1 - e^0) = 0`, as expected.
- As the number of equal-sized pools approaches infinity, the formula converges to `network_orphan_race_rate = 1 - e^(-block_propagation_time / block_interval)`, matching the original formula for negligible hash rate.

This confirms that hash rate centralization reduces the network's orphan rate, while a highly distributed hash rate maximizes it.

**Pool's Orphan Loss Rate**

If our pool had negligible hash rate, then our orphan race rate would match the probability of also losing the race.
Even if the rest of the network finds a competing block and starts an orphan race, our pool will favor its own block until the next block is mined, and with negligible hashpower the chance of winning it is ~0%.
But if our pool has some meaningful share of hashpower, then it has a chance of helping its block win the race by mining another one before the rest of the network.
We can refine the expression further to include the probability of an orphan race occurring AND our pool losing it because the rest of the network finds the next block first:

    p_orphan_loss = (1 - pool_relative_hash_rate) * (1 - e^((1 - pool_relative_hash_rate) * (-block_propagation_time / block_interval)))

This further skews things in favor of larger pools, who will not only have a lower chance of their blocks entering a race, but will have a lower chance of losing any such race.

**Table: Impact of Hash Rate on Orphan Loss Rate**

<p align="center"><img src="img/fig-orphan-skew.png"></img></p>

The table above holds the current Bitcoin pool distribution, block size, and propagation time constant while shortening the block interval, so only the `block_propagation_time / block_interval` ratio changes: 600s is the observed baseline, 60s the proposed target, 6s the next 10× step for continuity, and 2s an extreme to illustrate the centralization pressure of skewed orphan loss rates.

The table's estimates are still conservative because they assume competing blocks propagate instantly to the entire network.
In practice, our pool's block will reach some mining nodes faster than others.
Suppose our pool has 20% hash rate, and our block reaches half the remaining hash power in 50ms, and the other half in 250ms.
During the first 50ms, 80% of hash power could start a race against us.
During the next 200ms, only 40% could, since the closer half is already mining on our block.
The odds of losing a race are even better than this suggests: if a competitor finds a block in the first 50ms, he is likely close to us in network topology, meaning he is also far from the more distant half of the hash power.
Both blocks will race to be first-seen by the remaining 40%, with some joining us and some joining our competitor.
The actual orphan loss rate will therefore be lower than the formula predicts, especially for pools with good network connectivity.

At Bitcoin's small block size the effect of bandwidth is minimized and network latency dominates.
For the same conditions, the 60s column shows our proposed target holding the network orphan race rate to 0.38% and the largest-to-smallest gap to 0.19%.
Because the block size is held at BTC's small baseline, shortening the interval also raises throughput — 10×, 10×, then 3× from 6s to 2s — so this progression doubles as an illustration of the alternative growth path (shrink time at fixed size), which runs into the speed-of-light floor rather than the constant-throughput rescaling this CHIP takes.
BCH plans to scale, so we will need to examine the impact of bigger blocks as well — the 60s column is a latency-heavy reading, distinct from the Impact Assessment's larger-block rows that add the network bandwidth component back in.

Before examining the impact of bigger blocks, we must first answer the question: how much of a gap is tolerable?

#### Tolerable Orphan Rate

We model the effect of orphan rates on mining profit margins.
Assume a base block profit and margin at 0% orphan rate:

    base_block_profit = base_block_revenue - block_cost
    base_block_margin = 1 - block_cost / base_block_revenue

Orphaned blocks incur the same `block_cost` but yield zero revenue.
Adjusted revenue becomes:

    block_revenue = base_block_revenue * (1 - orphan_rate)

When changing block time, the reward per block is proportionally adjusted so block reward per unit time remains constant, meaning expected revenue over time is unchanged.
Block processing costs (e.g., assembling transactions in a block template) are negligible compared to hashing.
Thus, profitability shifts will depend solely on orphan rate variance.

From this, we derive:

    block_profit = block_revenue - block_cost
    block_margin = 1 - block_cost / block_revenue
                 = 1 - block_cost / (base_block_revenue * (1 - orphan_rate))

Substituting `block_cost / base_block_revenue = 1 - base_block_margin`, we get:

    block_margin = 1 - (1 - base_block_margin) / (1 - orphan_rate)

This quantifies margin impacts for various base margins and orphan rates.
For example:

- A 4% base margin miner with a 2% orphan rate loses 1.96 percentage points (51% relative drop).
- A 40% base margin miner loses 1.22 percentage points (3% relative drop).

**Table: Adjusted Gross Margin as Function of Orphan Rate**

<p align="center"><img src="img/tab-margins.png"></img></p>

**Table: Relative Change in Gross Margin as Function of Orphan Rate**

<p align="center"><img src="img/tab-margins-rel.png"></img></p>

Orphan rates hit low-profit miners hardest, akin to a uniform price drop.
Unlike market price, however, orphan rates vary by miner, further exacerbating the difference.
Equal orphan rates across all miners would balance out and not create any centralization pressure.
The risk lies in asymmetry: one miner’s orphan is another’s gain.

We analyze this via an edge case: some miners face orphans while others optimize to avoid them.
Impact on real-world margins from the [CoinShares Q2 Mining Report (2024)](https://blog.coinshares.com/coinshares-q3-mining-report-23a06177291a) provides insight:

**Table: Impact of Orphan Rate on Real Miner's Margins**

Company | Share of Production | Cost of Production / Bitcoin | Current Bitcoin Price | Base Margin | Adjusted Margin | Difference | Adjusted Margin | Difference | Adjusted Margin | Difference
-- | -- | -- | -- | -- | -- | -- | -- | -- | -- | --
||  |  |  |  | (2% orphan rate) |  | (5% orphan rate) |  | (10% orphan rate) |
CleanSpark | 12.40% | 33,925 | 68000 | 50.11% | 49.09% | -1.02% | 47.48% | -2.63% | 44.57% | -5.54%
Comint | 0.90% | 37,975 | 68000 | 44.15% | 43.01% | -1.14% | 41.22% | -2.94% | 37.95% | -6.21%
Cipher | 5.50% | 38,622 | 68000 | 43.20% | 42.04% | -1.16% | 40.21% | -2.99% | 36.89% | -6.31%
Marathon | 20.60% | 46,364 | 68000 | 31.82% | 30.43% | -1.39% | 28.23% | -3.59% | 24.24% | -7.58%
TerraWulf | 5.30% | 47,573 | 68000 | 30.04% | 28.61% | -1.43% | 26.36% | -3.68% | 22.27% | -7.77%
Riot | 11.30% | 50,101 | 68000 | 26.32% | 24.82% | -1.50% | 22.44% | -3.88% | 18.14% | -8.19%
Core Scientific | 14.00% | 50,572 | 68000 | 25.63% | 24.11% | -1.52% | 21.72% | -3.91% | 17.37% | -8.26%
Bitfarms | 5.60% | 50,697 | 68000 | 25.45% | 23.92% | -1.52% | 21.52% | -3.92% | 17.16% | -8.28%
Hive | 3.40% | 51,173 | 68000 | 24.75% | 23.21% | -1.54% | 20.78% | -3.96% | 16.38% | -8.36%
IREN | 6.10% | 53,724 | 68000 | 20.99% | 19.38% | -1.61% | 16.84% | -4.16% | 12.22% | -8.78%
Stronghold | 2.70% | 60,823 | 68000 | 10.55% | 8.73% | -1.83% | 5.85% | -4.71% | 0.62% | -9.94%
BitDigital | 2.00% | 61,617 | 68000 | 9.39% | 7.54% | -1.85% | 4.62% | -4.77% | -0.68% | -10.07%
Argo | 1.80% | 63,649 | 68000 | 6.40% | 4.49% | -1.91% | 1.47% | -4.93% | -4.00% | -10.40%
HutB | 3.60% | 65,012 | 68000 | 4.39% | 2.44% | -1.95% | -0.64% | -5.03% | -6.23% | -10.62%
Bitdeer | 4.80% | 81,014 | 68000 | -19.14% | -21.57% | -2.43% | -25.41% | -6.27% | -32.38% | -13.24%
| |  |  |  |  |  |  |  |  |  |
| |  |  | (Max - min) gap: | 69.25% | 70.66% |  | 72.89% |  | 76.94% |
| |  |  | Gap change: |  | 1.41% |  | 3.64% |  | 7.69% |

Base case observations:

- 85% of production (CleanSpark to IREN) had margins above 20%.
- Margins varied widely, with a max-min gap of 69.25 percentage points.
- The highest-margin producer (CleanSpark, 50.11% margin and 12.40% market share) was not the largest producer (Marathon, 31.82% margin and 20.60% market share).
- All but Bitdeer were profitable.

Assume the top 50% by production (CleanSpark to Riot, 56% share) cluster for mutual benefit, achieving near-0% orphans.
Others face orphans, widening Bitdeer's gap by 2.43%, 6.27%, or 13.24% instead of 1.41%, 3.64%, or 7.69%.

What is tolerable?

A 2% orphan rate on a 20.99% base margin reduces it by 1.61 percentage points (8% relative drop).
The top 85% see ≤1.61% hits; the next 10% take up to 1.95% (44% relative drop) but stay positive; Bitdeer’s -19.14% worsens to -21.57%.
Bitcoin’s [>2% daily volatility](https://bitbo.io/volatility/) routinely exceeds this, with miners adapting to swings that dwarf a 2% revenue hit.
We conclude that 2% is a tolerable threshold, as it is within operational norms and unlikely to have meaningful impact on centralization.

Bitcoin's orphan rates are typically below 0.05%, well under our 2% tolerable threshold.
Yet mining pool market shares remain uneven, with the top 8 pools controlling over 90% of hash rate ([Mempool](https://mempool.space/graphs/mining/pools), 2025-04-01).
This suggests that factors beyond orphan rates drive mining consolidation.
Other factors, such as ASIC hardware accessibility, logistics, energy prices, workforce, regulatory environment, and legacy money friction (costs are still paid in local currencies), must play a much larger role in miners' profitability, as evidenced by current margin differences.

Further analysis will use 2% as the threshold value, and specify limiting conditions under which it must not be exceeded.

#### Block Propagation Time

Propagation time depends on the propagation method used, network characteristics (network ping, speed, topology, routing), and any relay delays or overlap between receiving a block and sending it to other peers.

Bitcoin Cash nodes currently support two types of block announcements:

- Legacy ([`block`](https://documentation.cash/protocol/network/messages/block.html)) method.
- Compact Block Relay ([`cmpctblock`](https://documentation.cash/protocol/network/messages/cmpctblock.html), [BIP-152](https://github.com/bitcoin/bips/blob/master/bip-0152.mediawiki)) method.

The `block` method simply transmits the whole block.
The `cmpctblock` method is more involved and consists of the following steps:

1. Transmits the block header, a list of shortened transaction identifiers (6 bytes each), and a few full transactions ([`prefilled_transactions`](https://documentation.cash/protocol/network/messages/cmpctblock.html#prefilled-transactions), typically just the coinbase transaction).
2. The receiving peer requests missing transactions using [`getblocktxn`](https://documentation.cash/protocol/network/messages/getblocktxn.html).
3. The missing transactions are sent in a single batch using [`blocktxn`](https://documentation.cash/protocol/network/messages/blocktxn.html).

If the receiver already has all the transactions, the announcement completes in step 1.
If not, the receiver must request missing transactions in step 2 and receive them in step 3.
In the worst case, where the receiver must request *all* transactions in a block, the `cmpctblock` method is slightly slower than the `block` method.
This scenario is rare, occurring, for example, when a node is in a synced state but has cleared its mempool and receives a `cmpctblock` shortly after.

For the `block` message, the time to transmit the block to a peer can be estimated as:

    0.5 * round_trip_time + block_size / peer_bandwidth

For the `cmpctblock` best case (receiver already has all transactions), the time can be estimated as:

    0.5 * round_trip_time + (block_transaction_count * 6) / peer_bandwidth

For the `cmpctblock` general case, the time can be estimated as:

    (0.5 + isMissingTXs) * round_trip_time + (block_transaction_count * 6  + missing_transactions_count * 4 + missing_transactions_size) / peer_bandwidth

In the worst case for `cmpctblock`, where all transactions are missing, `missing_transactions_size = block_size` and `missing_transactions_count = block_transaction_count`, so the time is:

    (0.5 + isMissingTXs) * round_trip_time + (block_transaction_count * 10 + block_size) / peer_bandwidth

To simplify calculations, we assume a typical transaction size of 219 bytes (Schnorr P2PKH 1-in-2-out), so `block_transaction_count = block_size / 219` and `missing_transactions_count = missing_transactions_size / 219`.
The `block_transaction_count * 6` term accounts for the 6-byte shortened transaction IDs, which add approximately `6 / 219 = 0.03` (3%) overhead on top of block size.
The `missing_transactions_count * 4` accounts for the list of missing transaction indices, which add approximately `4 / 219 = 0.02` (2%) overhead on top of missing transactions size.
The mempool sync state is expressed as a factor (`missing_transactions_factor`, 0 to 1, where 0 means all transactions are present and 1 means all are missing), yielding:

    (0.5 + isMissingTXs) * round_trip_time + block_size * (0.03 + missing_transactions_factor * 1.02) / peer_bandwidth

The above expressions give us estimated time to transfer to direct peers.
Normally, reaching other mining nodes will take more than one hop.
When considering propagation beyond direct peers, we can simply sum individual hop times, and add delays between to account for node relay delays between receiving from one peer and sending to other peers:

    (0.5 + isMissingTXs_0) * round_trip_time_0 + block_size * (0.03 + missing_transactions_factor_0 * 1.02) / peer_bandwidth_0 +
    relay_delay_0 +
    (0.5 + isMissingTXs_1) * round_trip_time_1 + block_size * (0.03 + missing_transactions_factor_1 * 1.02) / peer_bandwidth_1 +
    relay_delay_1 +
    (0.5 + isMissingTXs_2) * round_trip_time_2 + block_size * (0.03 + missing_transactions_factor_2 * 1.02) / peer_bandwidth_2 +
    ...

If we assume the same `isMissingTXs`, `missing_transactions_factor`, and `relay_delay` for all peers on the path, we can simplify the expression:

    (0.5 + isMissingTXs) * path_round_trip_time + n * block_size * (0.03 + missing_transactions_factor * 1.02) / effective_bandwidth +
    (n - 1) * relay_delay

where `path_round_trip_time = round_trip_time_0 + round_trip_time_1 + ...`, and
`effective_bandwidth = 1 / (1 / peer_bandwidth_0 + 1 / peer_bandwidth_1 + ...)`.

Note the above is assuming unsolicited `block` or `cmpctblock` pushes.
If the block has to be first requested by peers, then that adds an additional round-trip time (send `header` or `inv` first, receive `getdata`, and then send `block` or `cmctblock`).
BIP-152 requires peers to opt in to receiving unsolicited `cmpctblock` messages, by sending `sendcmpct(1)` first.
Also, BIP-152 suggests to send unsolicited `cmpctblock` messages to maximum 3 peers, and only send `header` or `inv` to others.

To actually estimate propagation time and orphan rates, and estimate impact of changing the target block time, we must first determine all the unknowns in above expressions, which we will do in following sections.

##### Graphene

Graphene (A. Pinar Ozisik, Gavin Andresen, Brian N. Levine, Darren Tapp, George Bissias, and Sunny Katkuri. 2019. ["Graphene: Efficient Interactive Set Reconciliation Applied to Blockchain Propagation"](https://people.cs.umass.edu/~gbiss/graphene.pdf)) is a third block-announcement approach, noted here for completeness rather than as a current option.
It reconciles the sender's block against the receiver's mempool using a Bloom filter paired with an Invertible Bloom Lookup Table (IBLT), with a second protocol that repairs missing transactions when the receiver's mempool does not fully contain the block.
It was the default block-propagation path in Bitcoin Unlimited from late 2018 and has mainnet deployment results on Bitcoin Cash, but since Bitcoin Unlimited left the ecosystem it is no longer deployed, and this CHIP does not analyze it in depth.

Two properties decide its relevance to faster blocks.
Its bandwidth advantage over compact blocks is proportional to the number of transactions per block, because it saves on per-transaction short-ID overhead, and 1-minute blocks carry one tenth the transactions, so the per-block advantage shrinks by the same factor.
It is also probabilistic, with a tunable decode-failure rate and a possible extra roundtrip for missing transactions, where compact blocks are deterministic and always succeed.
Compact blocks are expected to remain sufficient for the 3.2 MB blocks this proposal implies, well into the future.

The one place Graphene's machinery is likely to return is Sunlight-style visibility layers (see [Evaluation of Alternatives: Sunlight](#sunlight)).
Sunlight's bandwidth-heavy component is template broadcasting, which is exactly the set-reconciliation problem Graphene solves, and its announcement layer could adopt Graphene-style reconciliation.

The coupling is an engineering choice rather than a hard dependency.
Sunlight must pick a share interval, and shorter intervals consume the same per-share announcement bandwidth at a higher rate.
Because outstanding share state scales with block time (through both the share count and the template size), faster blocks free headroom in that state budget, which a Sunlight deployment could spend on more frequent share announcements rather than leave unused.
Graphene then compresses precisely the announcement traffic a faster interval generates, so faster blocks and Graphene each allow a smaller share interval than either would alone.

It is a natural but explicitly future pairing, outside the scope of this proposal.

#### Current State of Networking and Block Propagation

To support the proposal for reducing block times to 1 minute while keeping orphan rates below 2%, we must establish the network connectivity required for efficient block propagation.
A mining pool's orphan rate depends on its connectivity to other pools, not solely on block size or target time.
Better connectivity, such as well-connected VPS nodes, can be purchased as part of mining costs, far outperforming a solo miner's home broadband announcing blocks to random peers.
To determine the connectivity baseline for our analysis, this section examines Bitcoin's network performance through key factors: latency, bandwidth, topology, and block propagation methods.
These ground truths will help us assess whether the Bitcoin Cash network can support 1-minute blocks while still having a low enough barrier to entry for new miners.

**Modeling Target**

Block propagation matters primarily for mining nodes (pools), because orphan rates depend on how quickly a newly-mined block reaches other miners.
Pools have a direct economic incentive to invest in well-provisioned infrastructure: high-end CPUs, NVMe storage, ample RAM for dbcache, and well-peered VPS connectivity.
A pool with a large dbcache (e.g. `-dbcache=4096`) can hold most or all of the BCH UTXO set in memory, eliminating cold-cache UTXO reads from the validation path in steady state.

Despite this, the constants used in the following analysis are chosen to reflect mid-tier hardware, not the well-provisioned pool case.
This is deliberate: the goal is to demonstrate that even a new entrant (a small pool, a hobbyist miner, or a node running on a budget VPS) is not excessively penalized by the proposed parameters.
If mid-tier hardware orphan rates are acceptable, the well-resourced case is comfortably better.
This framing also leaves headroom for future blocksize growth without re-derivation.

##### Network Latency

Global ping times ([WonderNetwork, 2025-05-31](https://wondernetwork.com/pings)) remain under 320 ms for ~20,000 km antipodal routes (e.g., Spain to New Zealand), dropping below 160 ms for ~10,000 km routes (e.g., Spain to Singapore), 80 ms for ~5,000 km routes (e.g., Spain to Saudi Arabia), and 60 ms for ~2,500 km routes (e.g., Spain to Finland).

Ping data on Bitcoin nodes is available from [KIT Institute](https://www.kit.edu/english/index.php), which has been gathering and analyzing Bitcoin network data since 2015 (["Characterization of the Bitcoin Peer-to-Peer Network (2015-2018)", KIT](https://publikationen.bibliothek.kit.edu/1000091933)).
Page 18 Fig. 10. features an interesting plot showing both ping and geographical distance (data from 2017-07-01), reproduced below.

<p align="center"><img src="img/fig-geoping.png"></img></p>

**Figure:** "Fig. 10. Average measured latency per remote peer w.r.t. distance to remote peer. Data from 1st July 2017. Furthermore, the speed of light in fiber (200.000 km/s) is displayed."

Interestingly, it reveals clusters of nodes with better pings than our more recent WonderNetwork sampling suggests.

Up-to-date data is provided on the KIT Institute [live stats page](https://www.dsn.kastel.kit.edu/bitcoin/index.html#latency).

<p align="center"><img src="img/fig-curlatency.png"></img></p>

**Figure:** Current Latency Distribution (Retrieved on 2026-05-25).

From the data, we find that 50% of their peers have pings better than 42 ms, 95% of peers better than 134 ms, 98% of peers better than 166 ms, and 99% of peers better than 368 ms, with an average of 49 ms for all peers.
This suggests most of their peers are within a ~5,000 km geographical distance.

##### Network Speed

According to [VPS Benchmarks (2025-05-29)](https://www.vpsbenchmarks.com/plan_grades/all_values/upload_speed), 80% of VPS plans provide upload speeds of 450 Mbps or greater, 50% provide 1,013 Mbps or greater, and 20% provide 1,824 Mbps or greater.

According to [Bitnodes](https://bitnodes.io/nodes/#network-snapshot), the greatest number of Bitcoin nodes is hidden behind the Tor network, while cloud providers dominate among clearnet nodes.

<p align="center"><img src="img/prop-2025-03-22_bitnodes.io.png"></img></p>

**Figure:** Bitcoin Block Propagation Times (Retrieved on 2025-03-22)

Bitnodes performs daily sampling of their peers' upload speeds ([Bitnodes, 2025-05-31](https://bitnodes.io/dashboard/1y/#speed)).
The average and median speeds are very low (about 20 Mbps and 10 Mbps, respectively), likely skewed by the large number of Tor nodes (63.48% of peers are Tor nodes, meaning the median node is a Tor node).
The top 1% have speeds often exceeding 150 Mbps, more in line with expectations for VPS nodes.

##### Network Topology

Not all nodes are equal.
[Miller A., et al., "Discovering Bitcoin’s Public Topology and Influential Nodes", 2015](https://www.cs.umd.edu/projects/coinscope/coinscope.pdf), found a subset of nodes closely tied to hash power:

>Interestingly, the set of influential nodes have entirely benign topological and protocol features: they don't have exceptionally high degree, don't form an exclusive community, don’t have a unique version string, or are even particularly long lived in the network, making it difficult to find and track these nodes.
>However, these nodes provide an exceptional network advantage for broadcast: as long as a transaction (block) reaches these nodes, it is far more likely to be included in a block (extended in the block chain).

At the time, they found ~100 influential nodes accounted for over 75% of the network’s hash power.

This finding has been recently replicated.
[Crypt-iQ, "Mempool Partitioning and Identifying Mining Nodes", 2025](https://github.com/Crypt-iQ/crypt-iq.github.io/blob/master/coinscope-post.md#mempool-partitioning-and-identifying-mining-nodes) used the same method (albeit with fewer trials) and identified a set of ~200 influential nodes accounting for about 50% of the network’s hash power.

This means that a new miner should optimize his connections to have fastest reach to a subset of network nodes closest to hash power, rather than blindly broadcast to all peers.

##### Relay Delay

Typically, nodes first finish downloading the block and perform some verification, and only then send it to other peers.
As a minimum, to prevent DoS and wasting bandwidth on relaying corrupt data, they should at least verify PoW (block header), integrity of received transactions (TXIDs), and integrity of the assembled block (Merkle root).
Assuming transactions in mempool were previously verified, integrity checking between block receiving and sending will require at least:

- Verifying TXIDs when receiving any missing transactions, taking ~O(n) time, where n is total size of missing transactions
- Computing the Merkle root over all block's TXIDs, taking ~O(m) time, where m is the count of transactions in a block

Relay delay can therefore be estimated with:

    relay_delay = internal_constant +
                  (missing_transactions_size + missing_transactions_count * 64) / hashing_speed +       // TXIDs
                  (block_transaction_count * 192) / hashing_speed                                       // Merkle tree nodes

Assuming average transaction size of 219 bytes and expressing missing transactions using the `missing_transactions_factor` we get a simpler estimate:

    relay_delay_fast = internal_constant
                     + block_size * (missing_transactions_factor * 1.29 + 0.88) / hashing_speed

If the node does full validation before relaying the block, then we must account for that as well:

    relay_delay_validation_blocked = relay_delay_fast
                                   + (block_size * missing_transactions_factor * 0.005) / input_validation_speed
                                   + (block_size * 0.005) / utxo_validation_speed

where `input_validation_speed` accounts for input Script validation (cacheable, parallelizable and CPU-bound), and `utxo_validation_speed` accounts for double-spend checks (UTXO database reads).
The `0.005` factor assumes approximately one input per typical Schnorr P2PKH 1-in-2-out transaction, consistent with the 219-byte tx size assumption above.
UTXO lookups count one per input.
UTXO writes (new outputs) are buffered in the coins cache and flushed asynchronously, so they do not contribute to relay-critical-path delay.

To estimate relay delays, we need to determine the `internal_constant`, `hashing_speed`, `input_validation_speed` and `utxo_validation_speed` constants.
Both [Bitcoin Core](https://github.com/bitcoin/bitcoin/blob/a5e98dc3ae63fe8ee689917db440954206893a9f/src/net.cpp#L105) and [Bitcoin Cash Node](https://gitlab.com/bitcoin-cash-node/bitcoin-cash-node/-/blob/840173c825f6618d720d39f35bb83d76b1deae38/src/net.cpp#L81) (BCHN) implementations have a 50 ms [sleep in their message send queue loop](https://gitlab.com/bitcoin-cash-node/bitcoin-cash-node/-/blob/840173c825f6618d720d39f35bb83d76b1deae38/src/net.cpp#L1334), meaning it will on average take at least 25 ms between the time a network message is added to the queue and the time it is sent to peers, so we can set `internal_constant = 25`.

Available [benchmarks](https://pve.proxmox.com/wiki/PBS_Client_CPU_Benchmark#PBS_Client_Benchmark) show even older 2020 hardware (Ryzen 7 5800X) can run sha256 with at least 2,300 MB/s, so we can set `hashing_speed = 2'300`, which we will see is comfortable even if TXID and Merkle root hashing is done single-threaded.

As part of ["CHIP-2021-05 VM Limits: Targeted Virtual Machine Limits"](https://github.com/bitjson/bch-vm-limits), Jason Dreyzehner [benchmarked](https://github.com/bitjson/bch-vm-limits/blob/master/tests-and-benchmarks.md) Script execution across various Scripts and computer systems.
Based on his results, we will use `input_validation_speed = 192'000`.
This assumes 8 parallel script-check threads on 2020-era hardware (Intel i9-10980HK).
Pools running on current Xeon or EPYC server CPUs with 16–32+ cores will see substantially higher throughput.
Single-threaded older hardware will see proportionally less, but mining nodes invariably run multi-core hardware, so single-threaded execution is not a realistic baseline.

For UTXO database lookups, assuming modern NVMe with well-tuned dbcache we can estimate 1M lookups/s so `utxo_validation_speed = 1'000'000`.
NVMe has fallen to the budget tier — an example shows a $8.50/month VPS shipping a 75 GB NVMe SSD ([OVH](https://www.ovhcloud.com/en/vps/vps-ssd/), accessed 2026-09-05) — so treating NVMe as the baseline is realistic even for a new entrant.

Currently, both Bitcoin Core (BTC) and BCHN (BCH) implementations cache the latest block as soon as PoW and Merkle root checks are completed.
Then, they can use the cached block to efficiently send `cmpctblock` and `blocktxn` to peers.
However, relaying is still blocked by validation.
The problem is that a [single thread processes all network messages](https://gitlab.com/bitcoin-cash-node/bitcoin-cash-node/-/blob/840173c825f6618d720d39f35bb83d76b1deae38/src/net.cpp#L1999), and block validation will block that thread.
The high bandwidth compact block relaying (`cmpctblock`) can still go through because that is [relayed as part of received block processing](https://gitlab.com/bitcoin-cash-node/bitcoin-cash-node/-/blob/master/src/validation.cpp?ref_type=heads#L4114), just before starting validation.
But if peers have to request even just 1 transaction (`getblocktxns`), or have to request the block first (`getdata` after seeing an `inv`), then propagation will be slowed down by validation, and the fast relay path can be used only for the case of 0 transactions missing.

This has significant impact on block propagation, because the worst case of validating all transactions in a 32 MB BCH block would add ~1 second to every hop.
We can estimate node relay delay when propagating a new block in both cases.

**Table:** Block Propagation Relay Delay (1 MB Block Size)

Missing Transactions Factor | Internal Delay (Current), ms | Internal Delay (Optimized), ms
-- | -- | --
0% | 25.4 | 25.4
1% | 30.6 | 25.4
10% | 33.0 | 25.4
20% | 35.7 | 25.5
30% | 38.4 | 25.6
40% | 41.0 | 25.6
50% | 43.7 | 25.7
60% | 46.3 | 25.7
70% | 49.0 | 25.8
80% | 51.7 | 25.8
90% | 54.3 | 25.9
100% | 57.0 | 25.9

**Table:** Block Propagation Relay Delay (3.2 MB Block Size)

Missing Transactions Factor | Internal Delay (Current), ms | Internal Delay (Optimized), ms
-- | -- | --
0% | 26.2 | 26.2
1% | 43.1 | 26.2
10% | 50.7 | 26.4
20% | 59.2 | 26.6
30% | 67.8 | 26.8
40% | 76.3 | 26.9
50% | 84.8 | 27.1
60% | 93.3 | 27.3
70% | 101.8 | 27.5
80% | 110.3 | 27.7
90% | 118.8 | 27.8
100% | 127.4 | 28.0

**Table:** Block Propagation Relay Delay (32 MB Block Size)

Missing Transactions Factor | Internal Delay (Current), ms | Internal Delay (Optimized), ms
-- | -- | --
0% | 37.2 | 37.2
1% | 205.8 | 37.4
10% | 282.4 | 39.0
20% | 367.5 | 40.8
30% | 452.6 | 42.6
40% | 537.8 | 44.4
50% | 622.9 | 46.2
60% | 708.0 | 48.0
70% | 793.1 | 49.8
80% | 878.3 | 51.6
90% | 963.4 | 53.4
100% | 1048.5 | 55.2

Above we can see the significance of removing this bottleneck, especially at higher block sizes where UTXO lookups dominate even with good mempool sync.
The jump from 0% to 1% missing transactions reflects relaying via two different code paths: a non-blocking fast path when nothing is missing, and a validation-blocking path when any transaction must be requested.
There is an [open issue with BCHN](https://gitlab.com/bitcoin-cash-node/bitcoin-cash-node/-/issues/161) about this.
While this CHIP would benefit from it being resolved, we will see that 1-minute target time is still manageable without resolving it.

##### Block Propagation

Compact Block Relay (CBR) ([BIP-152](https://github.com/bitcoin/bips/blob/master/bip-0152.mediawiki)) technology was released in November 2016 ([Bitcoin v0.13.0](https://github.com/bitcoin/bitcoin/releases/tag/v0.13.0)) and is now widely adopted, to the extent that Bitcoin's public [Fast Internet Bitcoin Relay Engine (FIBRE)](https://bitcoin.stackexchange.com/questions/56485/can-someone-please-explain-fibre-to-me-like-im-5-and-why-is-it-useful) network [was shut down in 2022](https://bitcoin.stackexchange.com/questions/118059/is-fibre-still-in-use-in-2023).

The impact of CBR is evident in block propagation stats ([KIT](https://www.dsn.kastel.kit.edu/bitcoin/index.html#propagation)), which improved rapidly from 2015 to 2019 and later stabilized despite network bandwidth advancements.

This stability arises because, with CBR, good mempool synchronization, and flat block sizes, block propagation primarily depends on network latency, with bandwidth increases yielding diminishing returns.
Analysis by Chin et al. (2024) ([Springer](https://link.springer.com/article/10.1007/s11227-024-06468-0)) confirms that mempool synchronization in Bitcoin typically exceeds 99%.
Over 95% of requests involve 19 or fewer missing transactions (≤4 kB total), and over 59% of blocks propagate without requiring an additional round-trip to fetch missing transactions.

Bitcoin mining is geographically divided into two major clusters with nearly equal hash rates ([World Population Review, 2025-05-31](https://worldpopulationreview.com/country-rankings/bitcoin-mining-by-country)): North America (USA and Canada, 44.32%) and Asia (Russia, Kazakhstan, and China, 38.99%).
This means that some new miner's orphan rate will be mostly determined by how fast his block can reach those two clusters.

The KIT Institute, located in Germany, is conveniently roughly equidistant from both North America and Asia.
Based on this distance, ping times to German nodes should be under 150 ms, and a block originating from either region, propagating through an efficient route, is expected to reach some German nodes within 75 ms (0.5 * RTT) or 225 ms (1.5 * RTT), depending on mempool synchronization.
Recall that CBR limits "high-bandwidth" push announcements to the three best peers, while other peers require an additional round-trip, so only the fastest nodes receive the announcement this way.
Other nodes require an additional round-trip, resulting in 225 ms (1.5 * RTT) for synced mempools or 375 ms (2.5 * RTT) if transactions are missing.
Based on this, we expect the median propagation time to 50% of nodes to be 225 ms, as mempools are typically synchronized, and most nodes require the additional round-trip.

Current propagation stats ([KIT](https://www.dsn.kastel.kit.edu/bitcoin/index.html#propagation)) show that blocks propagate to 50% of peers faster than 109 ms in 20% of cases, faster than 250 ms in 50% of cases, faster than 507 ms in 80% of cases, faster than 786 ms in 90% of cases, and faster than 1322 ms in 95% of cases.
The median propagation time of 250 ms is close to our predicted 225 ms, suggesting a median round-trip time of 167 ms along propagation routes reaching 50% of nodes geographically near Germany.

Orphan rates depend solely on reaching other mining nodes, and we assume most mining pools are connected via "high-bandwidth" routes, yielding an average propagation time of 152 ms based on a 59:41 split between 0.5 * RTT and 1.5 * RTT cases.
This results in an expected average orphan rate of 0.025%.
This aligns closely with the 0.03% [reported by ViaBTC](https://www.viabtc.com/statistics), validating that our estimated RTT is reasonably accurate.
For Bitcoin's current 1 MB blocks, it indicates that internal relay delays must be small (under 90 ms even with poor mempool sync, per the relay delay analysis above) and hop count between pools must be low.
The picture changes for larger blocks, as the relay delay tables show.

#### Impact Assessment

With Bitcoin and Bitcoin Cash mining matured into a consolidated industry, a new entrant's orphan rate hinges on fast propagation to the top pools, which control most of the hash rate.

We will assume that a new pool can afford to set up one VPS node with a 1 Gbps link (median VPS offering) and be 4 hops away from other pool nodes of same or better capability.
With high-bandwidth relaying to 3 peers per hop, this fan-out reaches up to 3^4 = 81 nodes after 4 hops in the idealized no-overlap case.
In practice, peer-set overlap reduces this somewhat, but reaching the major pools' nodes is reliable because they maintain dense interconnection.

Recall that Bitcoin mining is geographically divided into two large clusters that are roughly equal in hash rate.
This conveniently makes orphan race outcomes between them even out on average, rather than give one side an advantage.
This is also convenient for small miners at any location.
A new miner closer to one of them could see 1st hop ping of 50 ms to one area and 250 ms to the other, or 150 ms to each if equidistant.
Because hashrates of both clusters are roughly equal, the average orphan rate would be about the same in either case, making orphan rates for small miners invariant of their location.
We model a 4-hop path from the new pool to the broader mining network.
The first hop is a long international link (150 ms, e.g., from a regional VPS to a node in a far cluster), followed by shorter intra-cluster hops (80, 50, 40 ms).
For the orphan rate formula, we will assume our new pool has ~0% hash rate.

**Table: Block Propagation (10 minutes, 32 MB)**

Missing Transactions Factor | Cumulative Link Latency, s | Propagation Time, s | Orphan Rate
-- | -- | -- | --
0% | 0.16 | 0.36 | 0.06%
1% | 0.48 | 1.22 | 0.20%
10% | 0.48 | 1.73 | 0.29%
20% | 0.48 | 2.29 | 0.38%
30% | 0.48 | 2.85 | 0.47%
40% | 0.48 | 3.41 | 0.57%
50% | 0.48 | 3.98 | 0.66%
60% | 0.48 | 4.54 | 0.75%
70% | 0.48 | 5.10 | 0.85%
80% | 0.48 | 5.66 | 0.94%
90% | 0.48 | 6.23 | 1.03%
100% | 0.48 | 6.79 | 1.13%

Changing the block time to 1 minute would have the following impact.

**Table: Block Propagation (1 minute, 3.2 MB)**

Missing Transactions Factor | Cumulative Link Latency, s | Propagation Time, s | Orphan Rate
-- | -- | -- | --
0% | 0.16 | 0.25 | 0.41%
1% | 0.48 | 0.62 | 1.03%
10% | 0.48 | 0.67 | 1.11%
20% | 0.48 | 0.73 | 1.21%
30% | 0.48 | 0.78 | 1.30%
40% | 0.48 | 0.84 | 1.39%
50% | 0.48 | 0.90 | 1.48%
60% | 0.48 | 0.95 | 1.58%
70% | 0.48 | 1.01 | 1.67%
80% | 0.48 | 1.07 | 1.76%
90% | 0.48 | 1.12 | 1.85%
100% | 0.48 | 1.18 | 1.94%

Because latency dominates when mempools are synced, a reduction of block time to 1 minute (10x) results in about 7x increase in orphan rates for the best case.
At the edge of full blocks, orphan rate will be below 2% even for the worst case of all mined transactions missing from public mempool.

### Censorship Resistance Risk

Beyond performance, block-time changes also affect privacy and censorship resistance for miners who wish to remain anonymous.
By design, Bitcoin miners cannot be identified from on-chain data.
Mining pools typically self-identify by voluntarily writing pool tags into the coinbase message, but they do not have to.
Even though tags are commonly used to identify miners and produce mining stats, it is not a reliable way to identify blocks because any miner can masquerade as another miner.
This is because miners can freely write anything into coinbase messages, and they don't have to be honest about their identity.
The other way to identify a miner by on-chain data is by tracing coinbase output addresses.
If the miner uses a new address for every block, he can stay anonymous indefinitely, provided he can announce the block privately.

However, being optimized for speed, block announcements are typically transparent.
We have seen above that most blocks can be traced to approximately 100 IP addresses.
What if a mining pool wants to announce a block privately?
He must announce it through a VPN or Tor network.
We consider Tor network the most private option, but it typically has lower bandwidth and higher latency.
This means a private announcement requires the miner to sacrifice some profits due to increased orphan risk.

Tor network has higher latency, but it still has RTT typically under 500 ms ([source](https://metrics.torproject.org/onionperf-latencies.html)).
It has very low throughput, typically about 10 Mbit/s ([source](https://metrics.torproject.org/onionperf-throughput.html)).
This means that miners announcing via Tor should pick 1 good clearnet node and maximize mempool sync with it, to avoid having to send a lot of data when block is found.
Case of 1% missing transactions adds about 850 ms to our considerations in above section's [block propagation analysis](#block-propagation), and case of 0% adds about 330 ms.
The impact of this extra delay is shown below.

**Table: Tor Announcement Block Propagation (1 minute, 3.2 MB)**

Missing Transactions Factor | Cumulative Link Latency, s | Propagation Time, s | Orphan Rate
-- | -- | -- | --
0% | 0.16 | 0.58 | 0.96%
1% | 0.48 | 1.47 | 2.42%
10% | 0.48 | 1.52 | 2.51%
20% | 0.48 | 1.58 | 2.60%
30% | 0.48 | 1.63 | 2.69%
40% | 0.48 | 1.69 | 2.78%
50% | 0.48 | 1.75 | 2.87%
60% | 0.48 | 1.80 | 2.96%
70% | 0.48 | 1.86 | 3.05%
80% | 0.48 | 1.92 | 3.14%
90% | 0.48 | 1.97 | 3.23%
100% | 0.48 | 2.03 | 3.32%

The Tor table shows the first case in this document where the 2% tolerable orphan rate is exceeded rather than merely approached: from the 1%-missing-transactions row upward, a Tor-announcing miner sits at 2.4–3.3%, versus the clearnet worst case just under 2%.
The premium is bounded — it exceeds the threshold only when mempool sync is imperfect and stays a single-digit percentage — so a privacy miner pays a modest, quantifiable cost rather than a prohibitive one.

### Viability of Space Mining

With 1-minute blocks, could space-based mining extend the network's reach?
Launching hardware into space is a non-starter, with costs far outstripping mining revenue.
But in a future with lunar colonization, on-Moon ASIC and solar panel production could make extraterrestrial mining viable.
This section probes how 1-minute blocks hold up under space latency, using orphan rates to gauge feasibility.

We build on the above expected propagation model (150 ms to 50 ms RTTs, reflecting 2025's typical pings as a future baseline), adding 0.5 * RTT for space-to-Earth latency.
Space miners sync mempools with an Earth node, mining only pre-overlapped transactions to guarantee 100% overlap on the first hop, capping it at 0.5 * RTT.
Earth-side overlap varies (0% to 100%), driving propagation differences.

#### Earth Orbits

Geostationary orbit (35,786 km) [is the furthest Earth orbit in use](https://en.wikipedia.org/wiki/List_of_orbits) and has an RTT of approximately 240 ms.

**Table: Earth Orbit Mining Expected Block Propagation (1 minute, 3.2 MB)**

overlap ratio |  cumulative latency, ms |  propagation time, s |  orphan rate
-- |  -- |  -- |  --
0% |  375 + 120 |  1.02 |  1.69%
90% |  375 + 120 |  0.55 |  0.91%
99% |  375 + 120 |  0.50 |  0.83%
100% |  125 + 120 |  0.25 |  0.41%

Placing solar miners in the furthest orbit will not only be viable but can still have tolerable orphan rates, likely between 0.41% and 0.83%.

#### Moon Mining

The Moon's max distance (406,700 km) yields an RTT of 2.71s (per [Lunar Distance](https://en.wikipedia.org/wiki/Lunar_distance)), so 1.35s one-way latency.

**Table: Moon Mining Expected Block Propagation (1 minute, 3.2 MB)**

overlap ratio |  cumulative latency, ms |  propagation time, s |  orphan rate
-- |  -- |  -- |  --
0% |  375 + 1350 |  2.25 |  3.69%
90% |  375 + 1350 |  1.78 |  2.92%
99% |  375 + 1350 |  1.73 |  2.84%
100% |  125 + 1350 |  1.48 |  2.43%

Placing miners on the Moon will still be viable but will have orphan rates slightly above the 2% tolerable threshold.

Considering the complexities of space, expected profit would have to be so high to justify the whole endeavor, and a few percentage points difference in expected revenue will not be an obstacle.

#### Implications

Earth orbit mining thrives with 1-minute blocks, with GEO rates mirroring terrestrial expectations.
Lunar mining caps at 2.43%, slightly above 2%, trimming margins.
In a future with near-zero lunar energy costs, this might not deter miners, as profit could still justify it.
For Bitcoin Cash with 1-minute blocks, space hash power integrates smoothly, with lunar orphans akin to a distant pool's lag.

If block times were reduced further, lunar latency (fixed at 1.35 seconds) could cap the minimum achievable block time.

### System Rigidity and Catastrophic Resilience

A recurring concern is that shorter block times reduce the system's safety margin: a fixed network-latency component that is a small fraction of a 10-minute interval becomes a 10× larger fraction of a 1-minute interval, so a severe degradation of the internet — undersea cable cuts, routing collapse, a Carrington-type event — would hurt a faster chain more than a slow one.
This is a real consideration and worth stating plainly, but it does not change the failure mode in the way the framing implies.

**Latency events are not hashpower events.** A degraded internet slows propagation; it does not split hashpower.
Blocks arrive slower and orphan rate rises, but the chain keeps producing, and when connectivity is restored the shorter branch is abandoned and the network heals.
This healing is a property of proof-of-work's *gradual* finality, not of block time: as [Jason Dreyzehner argues](https://x.com/bitjson/status/2000944904394920082), a chain that arbitrates over hours rather than seconds can reassemble consensus "even under extreme global conditions," where "even very sporadic, low-bandwidth connectivity heals the network."
Block time does not change that — the hour-scale finalization gate is what makes recovery possible, and this CHIP leaves it in place.
A *permanent* split into two coins requires a sustained hashpower split — a group deliberately continuing to mine a minority chain indefinitely — which latency alone does not produce.
The [Network Partitions](./security.md#network-partitions) analysis works through the timing: at 10:90 or 33:67 hashpower splits, the minority chain is abandoned automatically on reconnection; only near-even splits (49:51) risk escalation to manual intervention.
Parking and finalization are chainwork-scaled — 2,400 ticks and 6,000 ticks respectively, matching their 10-minute-block equivalents exactly — so the ~80-minute response window and ~120-minute finalization horizon are unchanged by block time.
A storm that doubles or quadruples latency degrades us; it does not fracture us.
More frequent blocks also spread confirmed throughput across 10× more points in time, which Jason notes would "meaningfully harden node security and tx censorship resistance" — resilience improves with this change rather than being traded away by it.

**The margin is quantifiable and stays within Satoshi's own anchor.** The worst-case orphan model (1.94% at 1-minute blocks) already includes the fixed terms at issue: full block download, 100% of transactions missing from the peer's mempool, the ~25 ms internal relay constant, and `getblocktxn` / `blocktxn` processing overhead.
Multiplying propagation times by 2–4× — a severe, sustained degradation — pushes the worst case to roughly 4–8%, still inside the ~10% Satoshi [reasoned with](https://bitcointalk.org/index.php?topic=134451.msg1432372#msg1432372) as acceptable when he justified the 10-minute choice.

**Base rates.** In the ~17 years since Bitcoin's launch, there has been no catastrophic global network outage, and peer chains running 1-minute or faster blocks — Dogecoin since 2013, and others — have operated continuously under the same class of latency events without fracturing.
A 1-minute interval also means a transient disruption resolves in minutes, not hours, so the exposure window per event is a fraction of what it would be at 10 minutes.
The realistic risk profile for 1-minute blocks is therefore low even before any mitigation is considered.

**Not the aggressive end of the field.** Relative to peer chains, 60 seconds is the conservative option: Zcash is moving to 25s, Nervos runs ~10s, and we would merely equal Dogecoin.
We are not the risky outlier among chains.

**The contingency plan.** If a sustained global degradation occurred, the options, roughly in order of preference:

1. **Ride it out** if transient.
2. **Improve relay infrastructure** — dedicated relay links, better topology, faster block propagation — and keep the same parameters, turning the crisis into an optimization opportunity.
3. **Produce smaller blocks.** Miners can do this at any time without a consensus change; ABLA then observes sub-limit blocks and lowers the limit on its own, trading throughput for faster propagation.
4. **Increase the target block time.** This one requires coordination — a release, miner adoption, exchange support — so it is not instant, but it is possible: with ticks, block time is a schedule entry, so slowing the chain to 2, 5, or 10 minutes is a parameter change, not the multi-year consensus-engineering effort this CHIP itself required.

Step 4 could be automated later, by a future CHIP: an algorithmic target time that reads observed orphan rates on-chain and adjusts the interval automatically within the `[60s, 600s]` range, with the floor still movable only by CHIP (see [Evaluation of Alternatives: Algorithmic Target Time](#algorithmic-target-time)).
The point is not to add complexity now, but to keep an emergency consensus change as a last resort rather than the only tool.
If the network can respond to degradation on its own, within bounded limits, then a crisis never forces a hard fork under time pressure.
An emergency consensus change would be needed only if the automated response failed to address the problem — for instance if the floor itself had to move, which is a CHIP matter by design.

This is why the automation is out of scope here: 1 minute is a conservative setting with a low base rate of catastrophic risk and multiple manual levers available, so it does not need an automated response to be safe.
It is only if we later become more aggressive — dropping the floor toward the 10-second range, where the latency terms become a large fraction of the interval — that automated adjustment stops being optional and starts being a prerequisite.

**This makes us less rigid, not more.** The rigidity framing gets the adaptation direction backwards.
A chain frozen at a 10-minute cadence has no lever under catastrophe — it cannot slow down when it needs to, nor speed up when it can.
A chain whose cadence is a live parameter can be adjusted to the situation, manually now and automatically later.
Ticks convert block time from a hardcoded constant into an adjustable parameter: more flexibility, available precisely when it matters most.

**The larger risk is the opposite one.** The most consequential threat to BCH is not a storm that degrades the network for a while; it is becoming irrelevant while other chains improve their user experience.
We recover from a slow week; we do not recover from users who never gave us a chance.
And the "hold 10-minute blocks as catastrophe insurance" strategy does not pay out, because if we lose the user base, no one is left to benefit from our robustness during the crisis.
The competitor that won those users has the resources and the dominance to adapt to the crisis themselves — they weather the storm from a position of strength, while we preserve a capability nobody is using.
A robust chain with no users does not save the day; it lingers in obsolescence.
Plan for the best, prepare for the worst — and the "worst" that would actually strand us is ossification, not latency.

## Evaluation of Alternatives

### Status Quo

**Risks of Change**

The case for maintaining 10-minute blocks is not without merit.
Changing a parameter as fundamental as block time carries risks, including potential disruption to the "Bitcoin" identity that some argue remains valuable for BCH's positioning.
These concerns are addressed in detail in the above [Risk Assessment](#risk-assessment) sections which covered:

- Bitcoin Cash Image Risks
- Explorer, Exchange, and Mining Pool Support
- Risk of Hampering 0-conf Adoption
- Mining Centralization Risk
- Censorship Resistance Risk
- Viability of Space Mining

In [Security Analysis](#security-analysis) section, we have shown how security fundamentals have been preserved, and in some cases even improved.
In [Ongoing Costs](#ongoing-costs) section, we have shown that the main burden on the ecosystem is in increased block headers size, where impact on nodes will be negligible and mitigations exists for SPV light wallet clients.
In [Technical Description](#technical-description) we have shown how there exist well-reasoned solutions to all technical challenges like adjusting emission and halving schedule, DAA, ABLA, locktime, etc.

We believe we have convincingly shown that the particular choice of 1-minute block time is not a risky push at technological limits, but is something that our network can comfortably achieve while staying as safe and decentralized as it was with 10-minute blocks, and that faster blocks are well aligned with the "peer-to-peer electronic cash system" mission.

**Risks of Not Changing**

Maintaining the current 10-minute block time carries its own risks, primarily the opportunity cost of losing potential users to faster alternatives, but also accumulated costs of existing users' experiences, and risk of 10-minute target time becoming an ossified parameter.

**User Experience Gap**

Cryptocurrency newcomers often make their first purchase on an exchange and attempt to transfer funds to a personal wallet or make an online purchase.
This initial experience shapes their perception of the technology.

Multi-coin wallets, which serve as a common entry point for newcomers, often do not display unconfirmed transactions.
For these users, a 10-minute average means half wait longer than 10 minutes, and ~5% wait over 30 minutes.
For users accustomed to instant digital payments, this delay feels broken.

Online merchants and payment providers typically require at least one confirmation before crediting a purchase.
A customer waiting 10+ minutes to complete checkout is likely to abandon the transaction or choose a different payment method next time.

Competing networks with faster block times capture these users at the critical first-impression stage.
Litecoin (2.5 minutes), Stellar (5 seconds), Solana (0.4 seconds), and numerous others offer near-instant feedback.
Users who experience fast confirmations elsewhere may never give Bitcoin Cash a serious try.

A common response is "they should use 0-conf."
This approach does not scale: we cannot intercept every newcomer to explain unconfirmed transaction security.
If a user's first experience is a 15-minute wait staring at an empty wallet, he has already formed his opinion and may never care to learn more.

**Network Effects and Market Position**

Cryptocurrency adoption exhibits strong network effects: users attract merchants, merchants attract users.
Losing newcomers to faster alternatives is not merely a one-time loss; it compounds over time as those users build habits, accumulate balances, and evangelize their chosen network.

Bitcoin Cash positions itself as peer-to-peer electronic cash, yet its confirmation time is slower than most competitors targeting the same use case.
This contradiction undermines the core value proposition.

**Ongoing Cost to Existing Users**

Experienced users trust 0-conf for everyday transactions and prefer services that accept it.
But confirmations remain unavoidable friction in several scenarios: spending at merchants or services requiring 1-conf, arbitrage trading between CEXs or DEXs, and cross-chain swaps where confirmations on each chain gate the next step.
In these cases, every minute of block time is a minute of opportunity cost or locked capital.

**Future Flexibility**

Changing the block time also provides an opportunity to introduce a "tick" abstraction in APIs and consensus rules.
A tick represents an idealized measure of blockchain progression (e.g. one second of target time), invariant of the actual target block time.
With this abstraction in place, future block time adjustments become straightforward parameter changes rather than breaking changes to downstream software.

The longer we wait, the more software will be built assuming a fixed 10-minute block time.
Introducing the tick abstraction now, alongside the block time change, minimizes disruption.
Doing it later, after another decade of ecosystem growth, may become impractical or impossible.

**The Cost of Inaction**

The status quo is not a neutral choice.
Every day that Bitcoin Cash maintains 10-minute blocks, potential users are forming first impressions with faster networks.
The opportunity cost accumulates silently but compounds relentlessly.

Faster block times would align Bitcoin Cash's user experience with its cash-focused mission, improving competitiveness at the crucial moment of first contact.

### Zero-confirmation Transactions

Zero-confirmation (0-conf) transactions are sometimes suggested as an alternative to faster blocks: if 0-conf is "good enough," why bother reducing block time?

This framing misunderstands the relationship between 0-conf and confirmations.
They are not alternatives; they are complementary.
0-conf serves low-value, low-risk transactions where the merchant accepts a small probability of transaction reversal.
Reversals can occur intentionally through double-spend attacks, or accidentally through failed DeFi interactions, invalidated parent transactions in an unconfirmed chain, or other edge cases.
Confirmations serve higher-value transactions, exchange deposits, cross-chain swaps, and any scenario where the recipient cannot absorb the loss.

Faster blocks improve both cases:

- For 0-conf users, faster blocks mean the window of vulnerability closes sooner.
  A transaction that might be reversed has less time to be attacked or invalidated before it gains a confirmation.
- For users requiring confirmations, faster blocks reduce wait times directly.

**Double-spend Proofs**

BCH has implemented double-spend proofs ([Zander T., imaginary_username, "Double Spend Proofs", 2020](https://gitlab.com/bitcoin-cash-node/bchn-sw/bitcoincash-upgrade-specifications/-/blob/master/spec/dsproof.md)), which allow merchants to detect double-spend attempts in real time.
When a node sees conflicting transactions, it generates a cryptographic proof that can be relayed to the merchant, who can then refuse to complete the sale.

Double-spend proofs improve 0-conf security but do not eliminate the need for confirmations.
They detect attacks; they do not prevent them.
A sophisticated attacker can still attempt timing attacks or collude with miners.
For high-value transactions, confirmations remain necessary.

**Zero-confirmation Forfeits**

Zero-confirmation forfeits ([awemany, "Solving the 0-conf problem using forfeits", 2018](https://gist.github.com/awemany/619a5722d129dec25abf5de211d971bd)) add a special forfeit output to an otherwise ordinary 0-conf payment.
Using OP_CHECKDATASIG, that output can be spent either by the payer's own key (recovering the funds once the payment settles) or by anyone who presents two distinct signatures signed by the same input public key — cryptographic proof that the payer attempted to double-spend one of the transaction's inputs.
The deterrent is therefore passive: the forfeit is never claimed unless the payer cheats, and apart from the temporarily locked collateral the payment behaves like any other.

Forfeits are a proof-of-concept with structural limits that distinguish them from escrows.
Every input must be a P2PKH output from a distinct address, so a payment funded by a DeFi or smart-contract output cannot be protected, and the scheme covers a single transaction only — there is no mechanism for chaining a forfeit-secured payment into a later unconfirmed one.
The payer must also hold the forfeit amount idle until settlement, a working-capital lock on top of the payment itself.
Per the author's status notes, the construction is proof-of-concept quality, was never deployed in a wallet, and would need dedicated mining rules before forfeits could be claimed in practice.

**Zero-confirmation Escrows**

Zero-confirmation escrows ([Dreyzehner J., Alcala M., "CHIP-2021-08-ZCE: Zero-Confirmation Escrows", 2021](https://github.com/bitjson/bch-zce)) build the same double-signature claim into a complete payment protocol.
The payer locks collateral in an escrow output and immediately broadcasts a companion reclaim transaction; if a double-spend is detected, a miner claims the escrow while simultaneously confirming the legitimate transaction, so the merchant is paid either way.
Unlike a forfeit, ZCE is a full specification: it defines the contract templates, a JSON Payment Protocol extension, and specialized relay and mining policies, with reference implementations.

ZCE shares forfeits' P2PKH-only input requirement, so it likewise cannot secure a payment funded by a DeFi or smart-contract output.
It differs on chaining: a ZCE-secured payment's change outputs may fund further ZCE-secured payments, and the protocol tracks parent ZCE-secured transactions, so payments can chain through an unconfirmed sequence (the escrowed collateral itself should not be immediately reused).
The cost is the same working-capital lock as a forfeit plus ~295 bytes of overhead for the escrow output and reclaim transaction.
ZCE has not shipped in a production wallet either; node-side support was still seeking contributors at the spec's last revision.

Both schemes share an observation worth surfacing: the payer posts their own funds as a bond that is forfeited only if they equivocate — that is, sign two conflicting versions of the same spend.
This is, in effect, a highly localized proof-of-stake.
In a proof-of-stake system, a validator posts a stake that is slashed for signing two conflicting attestations, and the slashing secures the whole ledger; here the stake is slashed for signing two conflicting transaction inputs, and it secures only the payer's own payment.
The machinery is the same — a posted stake plus an equivocation proof — but the scope shrinks from the network to a single transaction, and the only party who can be slashed is the party who would profit from the fraud.
Arguably the one context where proof-of-stake slashing aligns incentive with the party it is meant to constrain.

Together, forfeits and escrows target the use case one step faster than 1-minute confirmations: in-person finality where even a few seconds of network monitoring is too slow.
That positions them as competitors to Avalanche-style pre-consensus for instant acceptance, not competitors to faster blocks, which instead speed up the confirmation-fallback experience for everything these schemes do not cover.

**Conclusion**

Improvements to 0-conf security are valuable and should continue.
But they do not substitute for faster confirmations.
Faster blocks reduce the time window for 0-conf attacks, accelerate the transition from 0-conf to 1-conf, and directly improve the experience for all use cases requiring confirmed transactions.

0-conf and faster blocks are symbiotic, not competing alternatives.

### Other Target Times

This CHIP proposes a 1-minute target block time, but other values merit consideration.

**Why Not Shorter?**

Our research shows that with 1-minute blocks, orphan rates can stay under 2% even in the worst case (full block download), without optimizations such as removing the cs_main validation propagation bottleneck or improving relay technology.
With shorter block times, we would face greater risk of skewing pool profitability more significantly, which we want to avoid.

Networks like Nervos demonstrate that shorter times are possible (10-second blocks with ~3% orphan rate), but this comes with tighter operational margins.
If future improvements to our tech stack (validation propagation, relay technology) reduce propagation times further, we can adjust the target block time downward.
This upgrade introduces the "ticks" abstraction specifically to enable such future adjustments without disrupting downstream software.

Note that BCH's DeFi capabilities create potential for greater mempool divergence than simpler payment-focused chains like Dogecoin.
This is accounted for in our worst-case analysis, which assumes full block download rather than relying on compact block efficiency.

**Why Not 2 Minutes or Longer?**

A 2-minute target would be overly cautious given our analysis.
The research presented in this CHIP shows 1-minute blocks remain well within safe operational limits.
Furthermore, introducing the ticks abstraction means we can adjust again if 1 minute turns out to be problematic, though our analysis indicates it should not be.

There is little reason to leave user experience gains on the table when the risks are manageable.
Even if unforeseen issues emerge, our conservative margins mean they would manifest as gradual performance degradation rather than catastrophic failure, allowing adjustment through normal upgrade cycles.

**Competition**

Existing networks demonstrate that 60 seconds on a proof-of-work network is proven and not remarkable:

- Dogecoin has operated with 60-second blocks since 2014, with a measured orphan rate of ~0.62% in 2016 ([Gervais, et al., "On the Security and Performance of Proof of Work Blockchains", 2016](https://eprint.iacr.org/2016/555.pdf)), improving to ~0.15% after compact block relay ([Lovejoy, "An Empirical Analysis of Chain Reorganizations and Double-Spend Attacks on Proof-of-Work Cryptocurrencies", 2020](https://www.dci.mit.edu/projects/an-empirical-analysis-of-chain-reorganizations-and-double-spend-attacks-on-proof-of-work-cryptocurrencies)).
- Zcash reduced its block time from 150 seconds to 75 seconds in 2019.
- Litecoin continues with 150-second blocks.
- Nervos operates with 10-second blocks and ~3% orphan rate.
- Bitcoin (BTC) itself remains at 10 minutes, the slowest among major cryptocurrencies.

One minute positions Bitcoin Cash competitively among proof-of-work networks while maintaining conservative safety margins.

**Conclusion**

One minute is fast enough to deliver meaningful user experience improvements, slow enough to keep orphan rates within tolerable bounds, and adjustable via ticks if conditions change.

### Algorithmic Target Time

Nervos employs an interesting approach: automatically adjusting the target block time from on-chain orphan statistics (Nervos RFC-0020, ["Utilizing the Shortened Latency for Higher Throughput"](https://github.com/nervosnetwork/rfcs/blob/master/rfcs/0020-ckb-consensus-protocol/0020-ckb-consensus-protocol.md#utilizing-the-shortened-latency-for-higher-throughput)).
Blocks commit full uncle headers — 80 bytes, PoW-verifiable — so individual reports can be validated by any node, and the sensor is objective rather than trust-based.
It also restructures transaction confirmation into propose and commit zones, and incorporates uncles into difficulty adjustment so that the new difficulty is independent of the orphan rate.

The mechanism has a known limitation: the reported orphan count is a lower bound.
Nothing can prove that a reporter omitted orphans it saw, and inclusion is unpriced — committing someone else's orphan earns the proposer nothing — so non-inclusion is costless and unreported orphans are invisible.
Any resulting bias points toward shorter intervals, never longer.
Whether miners would withhold is an open behavioral question, and in a degradation the incentive plausibly reverses, since every miner is then losing orphans and stands to gain from a longer interval.
Combined with a second effect — a centralized network exhibits lower orphan rates, which signals that shorter intervals are safe, while shorter intervals raise orphan costs more for smaller pools — the mechanism can drift toward its lower bound.

That drift is usually framed as the problem: the algorithm cannot distinguish "low orphan rates because networking is excellent" from "low orphan rates because mining is centralized."
But it is bounded by a hard floor on the interval, and a floor is a simpler way to protect decentralization than a game-theoretic mechanism whose long-term dynamics are uncertain.
Maintaining decentralization is not this mechanism's job, and should not be.

For Bitcoin Cash, adopting NC-MAX wholesale would mean taking on the transaction-restructure and difficulty changes as well, and a stateful feedback loop in the base protocol — a much larger change than a target-time adjustment, and not one this CHIP is the right vehicle for.

There is nevertheless an angle worth preserving for a future CHIP.
Sitting near the floor is what we want in normal times, and the mechanism's real value would be as a safety valve in abnormal ones: a way to let the network respond to a sustained connectivity crisis without needing an emergency consensus change.
A future CHIP could reintroduce this idea on top of the tick abstraction, so that the interval becomes a parameter the network can adjust within bounded limits.
It is not needed now: 1 minute is a conservative choice, sitting five times inside the ~10% orphan rate Satoshi reasoned with, and this CHIP does not foreclose the option.

### Block-Time Change Without the Tick Abstraction

The minimal-looking alternative is to leave every consensus rule keyed to height and carry a conditional — "if `height > H_a`, use 60 seconds and divide sizes and rewards by 10" — wherever a 10-minute assumption appears, with no new tick concept or API.
Ticks are an internal engineering choice, not a consensus requirement: a node that computes the same quantities inline is equally consensus-compliant, so the comparison is about implementation cost, not validity.

The difference is concentrated in every rule evaluated against a block span:

- `nLocktime` — a user-set span from genesis;
- `nSequence` — a user-set span from coin creation;
- coinbase maturity — span of 100 from coin creation;
- halving interval — spans of 210,000;
- parking depth — span of 4 from common block;
- finalization depth — span of 10 from the block being finalized;
- ASERT — the span between anchor and tip.

With ticks, each span rule stays one expression that is already correct across the boundary — an input is mature in block `b` iff `T(b) - T(c) >= 600 * n`, where `T(x)` is a pure function of `x`'s height.
Without ticks, each span site re-derives the straddle arithmetic inline (a coin minted at `H_a - 50` needs 500 one-minute blocks, not 1,000), and each is a place to get the rounding direction wrong and fork.

Rules that scale a per-block quantity instead of a span — ABLA's limit and its rate parameters, and the per-block subsidy amount — handle the boundary by simple division; they still need to know the interval, but not the span arithmetic, so ticks help them less: the `height > H_a` conditional is replaced by simpler inlining of `* blockInterval(h) / 600`.

The tick mapper itself is small: `T(x)` or `blockInterval(h)` is evaluated against the tick schedule, which for this activation is a single row `{ H_a, 60 }`, so the boundary is data rather than code, and a future change appends a row instead of another code pass.
The counterargument stands — the machinery pays off fully only on a second target-time change — but its cost today is that small localized layer, while the alternative replaces it with scattered one-off conversions to revisit on every change: the same change with the abstraction re-derived N times, not the same change minus the abstraction.

### Hard-fork vs Soft-fork

There are two primary approaches to implementing faster block times: a soft-fork subchain method and a hard-fork direct method.

**Soft-fork Subchain Approach**

The subchain approach embeds a faster chain within the existing blockchain structure.
Between regular blocks, subblocks are mined at reduced difficulty (1/K for a K-times speedup).

Old nodes see only the original blocks and remain compatible, while upgraded nodes see and validate the full subchain for faster confirmations.
Sub-chain coinbase rewards and transaction hashes are rolled up into original blocks, and the soft-fork rule enforces correctness.
The accumulated PoW of the sub-chain would be treated as "aux PoW" by soft-fork rules for the original block.
For this to be a pure soft-fork, the difficulty of original blocks would have to be tapered to 1/K rather than hard-forking a step change, and CTOR ordering would have to remain.
We can give credit to Vitalik Buterin for [originally pondering the idea](https://old.reddit.com/r/btc/comments/428tjl/softforking_the_block_time_to_2_min_my_primarily/) of faster blocks as a soft fork.
However, this detail is less relevant here since BCH regularly upgrades via hard-forks.
Our focus is on downstream software impact, where data structure compatibility matters more than consensus compatibility.

**Hard-fork Direct Approach**

The direct approach simply adjusts the target block time and emission schedule by factor K.
All blocks are treated uniformly, each containing a standard coinbase transaction and mined at the new (lower) difficulty target.

**Figure: Comparison of Hard-fork Direct Approach and Soft-fork Subchain Approach (K=4)**

<p align="center"><img src="img/fig-sf-vs-hf.png"></img></p>

**Comparison**

| Effect | Hard-fork | Soft-fork |
| --- | --- | --- |
| Reduced target wait time variance (e.g. for 10 or 60 minutes target wait) | Yes | Yes |
| Increased transaction confirmation granularity | 1 minute | Opt-in, 1 minute |
| Requires services to increase confirmation requirements to maintain same security | Yes | No |
| Legacy SPV security | Full | 1/K |
| Breaks legacy SPV height estimation | Yes | No |
| Increases legacy SPV overheads (headers) | Yes | No |
| Selective opt-in "aux PoW" SPV security | No | Yes |
| Breaks header-first mining every Kth (sub)block | No | Yes |
| Additional merkle tree hashing | No | Yes<sup>1</sup> |
| Increased orphan rate | Yes | Yes<sup>2</sup> |

<sup>1</sup>Minimal if CTOR is broken for summary blocks.
<sup>2</sup>Apparent orphan rate would remain the same, because non-upgraded software would not see subchain "inner" orphans; but inner orphans would have the same pool centralizing effect.

**Analysis**

The soft-fork approach preserves backward compatibility for legacy SPV clients and does not require services to increase confirmation requirements.
However, it introduces significant complexity:

- Two-tier confirmation system with different security properties.
- Breaks header-first mining on summary blocks (every Kth subblock).
- Additional merkle tree overhead.
- Subchain orphans are hidden from legacy nodes but still affect miner economics.
- If they want increased granularity, wallet and infrastructure software must understand both block types.
- Future protocol upgrades must account for both layers.
- Legacy SPV clients retain only 1/K security; to restore full security they must upgrade to process "aux PoW" subchain headers, resulting in similar header overhead as the hard-fork approach.

The hard-fork approach is simpler and more uniform:

- All blocks are treated identically with consistent security properties.
- Clean fee market and reward distribution.
- Easier reasoning for wallet developers, exchanges, and infrastructure operators.
- Reduced long-term maintenance burden.

The tradeoffs are:

- All nodes and SPV clients must upgrade.
- Services must increase confirmation requirements to maintain equivalent security (e.g. 6 confirmations becomes 60 for a 10x speedup).
- SPV clients receive K times more headers, increasing bandwidth and storage overhead.
- Software with hardcoded height-to-time assumptions needs to account for the discontinuity in target block time.

**Recommendation**

The soft-fork approach preserves backward compatibility for legacy SPV clients, but at reduced security (1/K).
To restore full security, SPV clients must upgrade to recognize aux PoW headers, at which point they incur similar header overhead as the hard-fork approach.
The backward compatibility benefit is therefore limited to a transitional grace period with degraded security, but complexity cost would remain forever.

Bitcoin Cash has an established culture of coordinated hard-fork upgrades, with a regular upgrade schedule and ecosystem-wide participation.
The SPV header overhead is modest: 80 bytes per block, or ~42 MB per year at 1-minute blocks versus ~4.2 MB per year at 10-minute blocks.
Services already sometimes adjust confirmation requirements based on risk assessment, so adapting to the new block time is straightforward.

Given this context, the added complexity of the soft-fork subchain approach is not justified.
The hard-fork direct approach provides a cleaner, simpler implementation that is easier to reason about, maintain, and build upon.

This CHIP therefore proposes the hard-fork direct approach: reducing the target block time from 10 minutes to 1 minute by adjusting difficulty and emission parameters accordingly.

### Tailstorm

Note that Tailstorm ([Keller P., Glickenhaus B., Bissias G., Griffith G., "Tailstorm: A Secure and Fair Blockchain for Cash Transactions", 2023](https://arxiv.org/abs/2306.12206)) draws upon prior work on which it improves: Storm ([awemany, "Using weak proof-of-work for instant confirmations on Bitcoin Cash", 2019](https://github.com/awemany/storm-sim/tree/master/whitepaper)) and Bobtail ([Bissias G., Levine B.N., "Bobtail: A Proof-of-Work Target that Minimizes Blockchain Mining Variance", 2020](https://www.ndss-symposium.org/ndss-paper/bobtail-improved-blockchain-security-with-low-variance-mining/)).
For readers familiar with either of those prior proposals, this section should apply the same.
The summary here is based on [discussions held on Bitcoin Cash Research forum](https://bitcoincashresearch.org/t/tailstorm-a-secure-and-fair-blockchain-for-cash-transactions/1357).

Tailstorm is a parallel proof-of-work consensus mechanism that subdivides block intervals into multiple "subblocks" that form a tree structure, with periodic "summary blocks" consolidating them.
The mechanism merges would-be-orphan branches and their compatible transactions rather than discarding them.
To incentivize linear chain formation and discourage block withholding, it applies reward discounting based on the subblock tree's maximum depth.
When branching occurs, the tree's maximum depth decreases, reducing rewards for all included subblocks equally.

The proposal was evaluated and ultimately not pursued for the following reasons.

**Complexity Without Proportional Benefit**

The core innovation in Tailstorm (merging uncle branches with state conflict resolution) can be decomposed into two independent components: faster block times, and uncle merging with reward redistribution.
The subblock/summary structure is primarily an implementation wrapper designed to maintain backward compatibility with legacy SPV clients and blockchain parsers.
A straightforward block time reduction achieves the primary user-facing benefits (faster confirmations, reduced variance) without the additional complexity.
Additionally, Tailstorm's reward discounting assumes rewards are minted fresh.
Adapting it to a fixed emission schedule like BCH would require a coinbase redistribution mechanism to pay uncle miners and avoid under-minting when branches occur, adding further complexity.

**Socializing Orphan Losses Rather Than Reducing Them**

The rate of branching events is fundamentally determined by the ratio of propagation delay to block or subblock interval: a physical constraint that no consensus mechanism can circumvent.
Tailstorm does not reduce branching; it redistributes the consequences.
Miners who would have won orphan races outright are instead forced to share rewards with miners who would have lost, with both parties paying a penalty for the branching event.
This constitutes a protocol-enforced redistribution from better-positioned miners (higher hashrate, better propagation) to worse-positioned miners (lower hashrate, worse propagation), which is a policy choice rather than a technical improvement.

**Unclear Incentives in a Fee-dominated Regime**

The Tailstorm penalty mechanism was designed and analyzed primarily around block subsidy dynamics.
The original research explicitly excludes transaction fees from its simulations and attack modeling.
As block subsidy diminishes toward zero, fee-based incentives will dominate mining economics.
Whether Tailstorm's penalty scheme stabilizes or destabilizes mining incentives under fee-dominant conditions remains an open question.
Various fee distribution approaches (pooling fees equally, first-inclusion, splitting among duplicates) each introduce distinct incentive problems ranging from free-riding to intentional branch creation for fee capture.
The paper's authors acknowledge this limitation, noting in their discussion that "similar attacks are likely feasible against all PoW cryptocurrencies, including Tailstorm, however they also exceed the scope of this paper."

**Implementation Challenges**

Detailed analysis indicates that summary blocks cannot be mined header-first under the proposed structure, as the merkle root computation requires knowledge of all referenced subblock transactions.
This delays the start of mining for miners who use header-first techniques, putting them at a disadvantage at epoch boundaries.
However, header-first mining only works when block subsidy dominates rewards; as fees become the primary incentive, the technique will likely fall out of use regardless.

This mirrors the tradeoffs analyzed in the Hard-fork vs Soft-fork section: the subblock/summary structure is essentially a soft-fork subchain approach, inheriting its complexity costs while providing limited backward compatibility benefits.
Legacy SPV clients would see only summary blocks at reduced security (1/K), and must upgrade to process subblock headers for full security.

**Insufficient Real-world Validation**

While a testnet implementation exists, Tailstorm has not been deployed on any production network.
The mechanism introduces novel game-theoretic dynamics that may exhibit unexpected behavior under adversarial conditions or at scale.

**Future Compatibility**

Nothing in this proposal precludes a future Tailstorm-style upgrade if further research resolves the open questions around fee-regime incentives and BCH emission compatibility.
Tailstorm could be implemented as an "outer" layer on top of faster blocks: when an orphan race occurs, a minimum difficulty wrapper block could reference the would-be-orphaned block and insert it into the main chain, treating the orphaned block's proof-of-work as auxiliary PoW.
This would allow merging uncle branches without discarding their work or transactions.
Faster blocks thus represent a conservative first step that delivers immediate user experience benefits while preserving optionality for more complex consensus mechanisms in the future.

**Conclusion**

A simple block time reduction to 1 minute achieves the primary goals of faster confirmations and reduced variance while maintaining the well-understood Nakamoto consensus security model.
The tradeoff of modestly increased orphan rates is preferable to introducing a complex redistribution mechanism with incompletely analyzed incentive properties.

### Weak Blocks / Subchains

An earlier proposal by Rizun ([Rizun P.R., "Subchains: A Technique to Scale Bitcoin and Improve the User Experience", 2016](https://ledgerjournal.org/ojs/index.php/ledger/article/view/40)) describes using fractional-difficulty "weak blocks" to build subchains between regular blocks.
Unlike Tailstorm, this approach requires no consensus changes; miners simply coordinate to share weak blocks and build on the longest subchain.

Weak blocks provide a form of fractional confirmation: each weak block is proof that some hashpower saw and favored a transaction.
Ten weak blocks at 1/10 difficulty represent roughly the same PoW as one full block.
This is not an improvement to 0-conf security; it is a mechanism for accumulating fractional confirmations outside of consensus.

The primary limitation is that these fractional confirmations are not consensus-enforced:

- Any miner can ignore the subchain without producing invalid blocks.
- A miner can accept double-spend bribes by building from an earlier layer; no consensus rule prevents this.
- The scheme requires majority hashrate participation and could erode gradually.

Faster blocks achieve the same confirmation granularity with consensus enforcement.
A 1-minute block at 1/10 difficulty provides the same fractional PoW as a weak block, but ignoring it means building on a shorter chain, which loses by consensus rules.
No voluntary coordination is required; defection is not possible.

Weak blocks remain a potential future optimization for relay efficiency (pre-propagating transactions to reduce orphan risk for large blocks), but they do not substitute for consensus-enforced confirmations.

### Sunlight

Sunlight is a proposal presented by Jack at BLISS under the title ["Just a Bunch of Blocks"](https://www.youtube.com/watch?v=_fqheWNYUAc), with follow-up discussion on [Bitcoin Cash Research](https://bitcoincashresearch.org/t/sunlight-consensus-with-the-lights-on-and-its-natural-pairing-with-1-minute-blocks/2055).
It belongs to the weak-block family, but its emphasis differs from the earlier Subchains proposal: rather than reading fractional confirmations off a longest-subchain race, Sunlight publishes the signals the network already produces and makes the *published weight* of those signals part of how tips are judged.

The observation behind Sunlight is that Nakamoto consensus is a self-fulfilling prophecy: everyone converges on the tip they expect everyone else to converge on.
But between full blocks the network is largely blind.
Nodes silently set aside competing tips they did not see first, and near-miss proof-of-work is discarded because weak shares are shared only privately with mining pools.

Sunlight publishes three things the network already produces:

- **Relay all blocks.**
  Nodes forward competing and slightly-shorter tips, not only the first tip seen.
  Cheap, but a small benefit by itself.
- **Broadcast work-only weak shares.**
  Miners publish the headers and fractional-difficulty proof-of-work of near-blocks, without transactions.
  Shares are unordered, so they cannot split consensus the way a faster block chain would.
  They reveal within seconds which tip is accumulating the most hash.
- **Broadcast templates.**
  Miners publish the transaction set they are building on, exposing conflicts and synchronizing mempools ahead of a full block.

**The enforcement is the proposal, not a later stage.**

It is worth being blunt, because the presentation of Sunlight has repeatedly produced this confusion: information alone coordinates nobody, so there is no effective enforcement-free version of Sunlight.
A miner does not switch tips merely because he sees other people's shares unless the rules make it in his interest to do so.
"Reward publishing, punish hiding" is therefore sealed into tip selection as a consensus change in every form of the proposal.
The core mechanism:

- Weak work is piled on **non-conflicting templates, unordered** — a share has no position in a chain; it only adds weight to the template it commits to.
  As long as a template introduces no conflict, all shares land on the one growing pile.
  A conflicting template forks a pile of its own.
- A full block must clear the difficulty target as usual **and**, if its transaction set conflicts with a pile the network has already seen, overcome the work already piled on it.
  A block that cannot beat the pile it conflicts with is **rejected or parked**.

The consequence is that the **share-weighted tip wins, not merely the longest one**.
Ordering is supplied only by full blocks; the piles are the unordered in-between that decide which full block may legitimately follow.
Structurally this is the same split as Tailstorm — an ordered outer chain with a differently ordered inner structure (a DAG there, unordered here) between blocks that conditions the next one — except Sunlight stays simpler: shares and templates are ephemeral, never enter chain history, and there is no orphan-subsidy coinbase change.

"Hiding" is punished by the same rule that rewards publishing.
Hidden work produces no share-weight, so a tip extended only by hidden work earns no legitimacy and can be rejected even after it finds a block.
Because a miner cannot legitimize a contested tip without publishing the work on it, secret mining stops being a viable way to win a race — the "punish hiding" half, and a rule rather than a norm.

An information-only variant that gossips shares without coupling them to tip selection would offer at most a marginal relay optimization — a miner could pre-announce his template so it propagates faster once his full block is found, the DoS-resistant template-sync idea — but it would not affect which tip wins, and should not be mistaken for Sunlight itself.
Throughout this section, "Sunlight" means the consensus version with enforcement.

**Open design questions.**

Sunlight's principles are sound, and the enforcement layer looks workable once its rules are specified.
The parts not yet defined are the *parameters* of that enforcement rule, not whether enforcement exists:

- the share difficulty (the `1/K` subdivision of block difficulty),
- the weighting function applied to public share piles,
- the threshold of lead required before a competing tip or transaction may be rejected,
- how that rejection composes with ordinary proof-of-work chain selection and with the existing parking and finalization rules — which themselves already inhabit the same weakly-subjective design space, where a node's answer can depend on the order in which it saw valid candidates — and
- the formal analysis showing honest actors are never harmed under adversarial latency.

These are the same questions BCH's parking behavior already answers, generalized from a block-count heuristic to a continuous signal stream.
The framing point is worth keeping explicit, because it is where confusion tends to cluster: Sunlight, like parking and finalization, is not an absolute consensus rule of the Script opcode kind; it is a live-tip rule whose effect can depend on observation order.
Conflating those two categories is the root of the recurring "is this consensus or just information?" argument, and it should not be allowed to derail the same way the hard-fork/soft-fork label war once did.

**Bandwidth and validation cost.**

The heaviest part of the design is template broadcasting, and the clearest architectural concern is its interaction with block propagation.
Templates are also the component with the clearest set-reconciliation counterpart: announcing a template, the set of transactions a miner is building on, is the same problem [Graphene](#graphene) solves for blocks, so the announcement layer could adopt Graphene-style reconciliation without any consensus change.

Block relay today is synchronous with validation: an announced block waits for validation, and a single missing transaction can stall propagation until it is fetched and checked.
Templates add data to that path unless block relay is first decoupled from synchronous validation.
Work-only shares are far simpler: small and verifiable independently of mempool or transaction validation, so they can be processed off the critical path.

There is also a scaling concern analogous to the memory argument for faster blocks.
With a fixed share rate, outstanding share data scales roughly with `(block_time / share_time) × blocksize`.
At 10-minute blocks that is about ten times the share-related data of a 1-minute block, which is one reason the proposal is more practical alongside faster blocks than on its own.

**Synergies with 1-minute blocks.**

The relationship is not one-way.
Most of the synergies run **Sunlight → faster blocks** — Sunlight's tip visibility is what makes 60-second blocks safer — while one runs **faster blocks → Sunlight**, and it matters because it makes implementation tractable.

- **Memory coupling (faster blocks → Sunlight).**
  This is the main benefit running from faster blocks back to Sunlight, and it is stronger than linear: quadratic.
  Because this CHIP holds maximum TPS constant (the blocksize limit scales inversely with block time) and Sunlight targets a constant share interval, both the number of outstanding shares and each template's size scale with block time — so outstanding share data scales as approximately `TPS × block_interval² / share_interval`.
  At 1-second shares, a 600-second block implies roughly 100× the outstanding share data of a 60-second block (600 × 32 MB versus 60 × 3.2 MB), not 10×.
  Keeping even one block-interval of reserve is cheap at 60 seconds and ruinous at 600.
- **Orphan aftermath (Sunlight → faster blocks).**
  Work-only shares expose within seconds which competing tip is accumulating more hash.
  Doomed tips stop being extended sooner, so races cost less wasted work — though the race itself is not prevented; Sunlight does not lower orphan *rates*.
- **Work-per-confirmation (Sunlight → faster blocks).**
  A 1-minute block carries 1/10th the work, so "1 confirmation" is economically lighter.
  The usual response is to demand more confirmations, which eats the speed gain.
  Sunlight changes the answer: a competing chain is visible within seconds, and a public tip accumulates visible PoW on top of it, so 1-conf security grows continuously — even before the second confirmation — rather than only jumping at each block.
- **Pre-validation and mempool sync (Sunlight → faster blocks).**
  Templates pre-propagate the transactions that are actually being mined, reducing the missing-tx stalls that otherwise harm 1-minute block propagation.
  With mined transactions already synced, block propagation can approach half a round trip (0.5 RTT), which in turn supports reducing the base block time below 60 seconds in a future CHIP.
- **Withholding (Sunlight → faster blocks).**
  Hiding a block costs one block's worth of work, which is ten times cheaper at 60 seconds.
  The "punish hiding" pressure Sunlight relies on therefore becomes more important, and more effective, as block time drops: a miner who withholds while others publish is visibly absent from the public share stream.

**Conclusion.**

Sunlight is not a competing alternative to this CHIP; the two reinforce each other.
This CHIP proceeds independently and does not depend on Sunlight, and Sunlight in turn does not substitute for consensus-enforced confirmations — its role is to make the first confirmation, and the seconds leading up to it, far more informative.
The parts left unspecified are the parameters of its enforcement rule, not the existence of enforcement.
If anything, moving from 600-second to 60-second blocks makes Sunlight more practical to specify, because memory coupling shrinks its state by roughly 100×, and more valuable, because a short block interval is exactly where published visibility of competing work matters most.

### Avalanche Pre-consensus

Avalanche ([Team Rocket, "Snowflake to Avalanche: A Novel Metastable Consensus Protocol Family for Cryptocurrencies", 2018](https://ipfs.io/ipfs/QmUy4jh5mGNZvLkjies1RWM4YuvJh5o2FYopNPVYwrRVGV)) is a consensus protocol that achieves rapid finality through repeated random sampling of network participants.
It has been proposed as a pre-consensus mechanism for Bitcoin Cash to provide fast transaction finality while retaining proof-of-work as the base layer.

The proposal was evaluated and ultimately not pursued for the following reasons.

**Introduces a Second Consensus Mechanism**

Avalanche operates as a separate consensus layer alongside Nakamoto consensus.
Participants vote on transaction validity, and after sufficient sampling rounds, transactions are considered finalized.
This creates two interacting consensus systems with complex failure modes.
The interaction between Avalanche finality and PoW reorgs must be carefully specified: what happens when Avalanche finalizes a transaction that PoW later reorgs?
Either Avalanche overrides PoW (undermining the security model) or PoW overrides Avalanche (negating the finality guarantee).

**Past PoW Weighting is Vulnerable**

To prevent Sybil attacks, Avalanche participants must be weighted by some scarce resource.
The natural choice for a PoW chain is to weight by past proof-of-work, typically represented as staked coins or UTXO age.
This creates a vulnerability: an attacker who temporarily overpowers the network's hashrate can accumulate stake, then use that stake to influence Avalanche decisions long after his hashrate advantage is gone.

This is not a theoretical concern.
The November 2018 BCH/BSV split demonstrated that external hashrate can be brought in temporarily to influence chain outcomes.
If Avalanche with past-PoW weighting had been active, that temporary hashrate could have had lasting influence on the pre-consensus mechanism.

The Storm whitepaper, which evaluates Avalanche alongside other instant-finality approaches, reaches this conclusion about preconsensus schemes generally:

> "This hints at there being a fundamental problem with any preconsensus scheme that does not rely on the very same consensus mechanism as Bitcoin right now: Current POW."

**Complexity Without Necessity**

The primary benefit of Avalanche is fast transaction finality: roughly one second in the Avalanche whitepaper's large-scale experiments, and a few seconds even in a globally georeplicated setting.
A 1-minute block time does not match this — 95% of transactions confirm in under 3 minutes — so the honest framing is that faster blocks capture a part of what motivates Avalanche, not all of it.

The overlap is real: for confirmation-fallback use cases (exchange deposits, cross-chain swaps, payment gateways), faster blocks deliver rapid, consensus-enforced confirmation without introducing a second consensus layer, and the comparison is against the 10-minute status quo rather than against Avalanche-level latency.
The divergence is equally real: Avalanche's niche is in-store finality, where even a few seconds of network monitoring is too slow.
For that niche, the alternatives to Avalanche are not 1-minute blocks but the 0-conf mechanisms evaluated above ([zero-confirmation forfeits and escrows](#zero-confirmation-transactions)) and Sunlight-style weak-work visibility ([Sunlight](#sunlight)), which target second-scale confidence without a second consensus layer.

If sub-minute confirmations become necessary, improvements to propagation technology can push block times lower, but there is a floor.
Assuming the planet's diameter, the speed of light in fiber, and zero economic cost, a block must propagate across an antipodal span of roughly 64 ms one-way — about 130 ms round-trip once the announcement-and-request handshake is included.
Holding the orphan rate to 2% then implies a minimum block interval on the order of 3 seconds, with practical overheads raising this to roughly 6 seconds.
Nervos (CKB) already operates with 10-second blocks at about 3% orphan rate, consistent with that floor.
The ticks abstraction introduced by this CHIP makes a future 15–30 second target a parameter change rather than a rewrite, so the gap to Avalanche narrows but never fully closes.

Avalanche's complexity is justified only if finality faster than that physical limit is essential, and even then, the tradeoffs in security model and system complexity must be weighed carefully.

**Unclear Incentives**

Avalanche participation requires nodes to be online and responsive.
The incentive to run an Avalanche-participating node is unclear, especially for non-mining nodes.
If participation is optional, the security of the mechanism depends on sufficient honest participation, which cannot be guaranteed.
If participation is mandatory, it increases the operational burden on all node operators.

**Conclusion**

Faster blocks deliver part of what motivates Avalanche — rapid, consensus-enforced confirmation for the confirmation-fallback use cases — without introducing a second consensus mechanism, without relying on past-PoW weighting, and without the complexity of two interacting consensus systems.
They do not deliver Avalanche's ~1-second finality, and this CHIP does not claim they do: that niche remains contested by forfeits, escrows, and weak-work visibility rather than by block-time reduction.
The security model remains unchanged: Nakamoto consensus with current proof-of-work.

### BlockDAG

BlockDAG protocols generalize Nakamoto Consensus by allowing blocks to reference multiple predecessors, forming a directed acyclic graph rather than a linear chain.
This structure permits higher block creation rates with reduced orphan penalties compared to chain-based systems, as parallel blocks are merged rather than discarded.

Note that this family of protocols builds upon earlier work: GHOST ([Sompolinsky Y., Zohar A., "Secure High-Rate Transaction Processing in Bitcoin", 2015](https://eprint.iacr.org/2013/881)) introduced the Greedy Heaviest Observed Subtree chain selection rule, which Ethereum adopted along with uncle block rewards to compensate miners for orphaned blocks.
The DAG protocols discussed here extend these ideas further, moving from a tree structure with uncle references to a full DAG where all blocks contribute to consensus.

The DAG KNIGHT protocol ([Sutton M., Sompolinsky Y., "The DAG KNIGHT Protocol: A Parameterless Generalization of Nakamoto Consensus", 2023](https://eprint.iacr.org/2022/1494)) represents the current state of the art in this family.
KNIGHT is parameterless: it does not require an a priori bound on network latency, instead adapting dynamically to observed conditions.
The protocol selects a k-cluster (a well-connected subset of blocks) that covers at least 50% of the DAG, using the minimal k sufficient to achieve this coverage.
When network latency is low, k is small and confirmations are fast; when latency increases, k grows and confirmations slow proportionally.

KNIGHT builds on prior work including PHANTOM and GHOSTDAG, which established the k-cluster optimization framework, and SPECTRE, which introduced responsive confirmation times but solved only a weaker consensus problem (payments with commutative transactions).
Kaspa, a cryptocurrency based on the PHANTOM/GHOSTDAG family, operates with 1-second blocks and has demonstrated the viability of high-frequency DAG-based consensus in production.

**Why Not BlockDAG for BCH?**

While BlockDAG protocols offer compelling theoretical properties, several factors argue against adopting them for Bitcoin Cash at this time:

- Fundamental departure from Nakamoto Consensus: BlockDAG protocols use entirely different chain selection rules, block structures, and ordering algorithms.
  This is a wholesale replacement of the consensus mechanism rather than an incremental change.
- Implementation complexity: The KNIGHT algorithm involves recursive k-cluster selection, uniform majority coverage voting, tie-breaking procedures, and conflict hierarchy resolution.
  The specification spans multiple interacting algorithms with subtle correctness conditions.
- Unproven at scale: While Kaspa demonstrates feasibility, it operates at lower transaction volumes than BCH targets.
  The interaction between DAG consensus and large blocks remains unexplored in production.
- Coinbase and reward distribution: DAG protocols must specify how to handle coinbase transactions across parallel blocks.
  KNIGHT orders all blocks linearly for transaction conflict resolution, but the reward mechanism for parallel block producers requires careful design.
- Ecosystem disruption: Every piece of BCH infrastructure assumes a linear blockchain.
  Block explorers, indexers, wallets, SPV clients, and smart contracts would require fundamental redesign, not mere parameter adjustment.

A simple block time reduction achieves the primary user-facing goal (faster confirmations) while preserving the well-understood Nakamoto Consensus model.
BCH can observe the continued maturation of BlockDAG protocols in networks like Kaspa and consider adoption if and when the technology proves itself over a longer time horizon and the ecosystem benefits justify the transition costs.

**Future Compatibility**

Nothing in this proposal precludes future exploration of DAG-based consensus.
The ticks abstraction introduced here would ease any future transition by decoupling application-layer time assumptions from the underlying consensus mechanism.
If BlockDAG protocols demonstrate clear advantages in production over the coming years, BCH retains the option to adopt them.

### Nested Proof of Work

Nested Proof of Work ([Shadow Of Harbringer, "Nested Proof Of Work using an intermittent blockchain", 2024](https://gitlab.com/ShadowOfHarbringer/infrastructureblocks)) proposes mining "infrastructure blocks" at 1/60 difficulty between standard 10-minute blocks, creating a faster inner chain for transactions requiring quick finality.
The summary here is based on [discussions held on Bitcoin Cash Research forum](https://bitcoincashresearch.org/t/nested-proof-of-work-working-on-improving-the-design-request-for-comments/1378).

The scheme uses a "mirrored block" structure where each block contains two sub-containers: one for standard blocks and one for infrastructure blocks.
When a miner finds a solution, its difficulty determines which container is active: full difficulty activates the standard block, 1/60 difficulty activates the infrastructure block.
This allows miners to work on both block types simultaneously without wasting hashpower.

Infrastructure blocks would be rewarded with a separate token ("iBCH") minted via CashTokens, preserving the 21 million BCH supply while providing miner incentives for the faster chain.
Transactions seeking fast finality would pay extra fees to be included in infrastructure blocks.

The proposal was evaluated and ultimately not pursued for the following reasons.

**Orphan Rates Still Apply**

The infrastructure chain remains a chain structure, and 10-second infrastructure blocks would experience the same orphan rate dynamics as ordinary 10-second blocks.
While the proposal frames this as "infrastructure block orphans do not affect standard block orphans," the economic impact remains: if iBCH has value, then infrastructure block orphans create the same pool centralization pressure as reducing the main chain's block time would.
The orphan rate problem is not solved; it is moved to a different ledger.

**Two Currencies, Circular Dependencies**

The scheme introduces a second currency (iBCH) whose value depends on demand for fast finality.
This creates circular dependencies: the incentive mechanism relies on DEXs and other platforms existing to provide liquidity for iBCH, but those platforms depend on the consensus layer that iBCH is meant to enhance.
As noted in discussion: "Either the value of iBCH is low and the whole proposal falls apart, or iBCH actually has value and arguably alters the 21 million cap."

**Complexity Without Proportional Benefit**

The mirrored block structure, separate fee mechanisms, UTXO state merging between block types, and SPV compatibility schemes add significant implementation complexity.
The user-facing benefit (faster confirmations for those willing to pay extra fees in a separate token) could be achieved more simply by reducing the block time directly.

**Conclusion**

A simple block time reduction achieves the same user-facing goal (faster confirmations) without introducing a second currency, without circular economic dependencies, and without the complexity of maintaining two interleaved block types.
The orphan rate tradeoffs are the same either way; the nested approach merely obscures them behind a token abstraction.

### Industry Competitors

Bitcoin was launched with 10 minute block times, and the very first competitor Litecoin (LTC) included as its flagship change a reduced block time of 2.5 minutes.
Later Dogecoin (DOGE) launched with 1-minute block time.
This was all before 2014, when there was no compact block relay to bring orphan rates down and [global broadband Internet speeds were in 10-20 Mbit/s range](https://dazeinfo.com/2014/07/27/global-internet-average-connectivity-speed-india-china-japan-singapore-south-korea-q1-2014/).

Since then, blockchain projects have only shown ever decreasing block times.
In 2015, Ethereum (ETH) launched as a 15-second Proof-of-Work blockchain.
It [later moved to 12-second "slot" time](https://ethereum.stackexchange.com/questions/149349/why-are-ethereum-slots-12-seconds) with the Proof-of-Stake Merge in 2022, and there has even been [interest in reducing it further](https://vitalik.eth.limo/general/2024/06/30/epochslot.html).
The lower bound is set by competitors like Solana (SOL, 0.4 seconds) & Arbitrum (ARB, 0.25 seconds).
While these projects may not be directly comparable due to alternative consensus mechanisms and/or increased centralisation tolerance, these choices have driven a public perception of the importance of fast confirmations.

Among comparable cash-focused Proof-of-Work blockchain alternatives, Litecoin (LTC, 2.5 minutes), Dogecoin (DOGE, 1 minute) & Monero (XMR, 2 minutes) show a 1-minute BCH block time is relatively unremarkable.
Among other Proof-of-Work networks, Nervos (CKB, ~10 seconds) and Kaspa (KAS, ~1 second, blockDAG) have been pushing the limits of block times.

Interestingly, there are zero examples of notable blockchain projects with a longer block time than Bitcoin's 10 minutes.
While it is not conclusive of itself, it's certainly curious that no Bitcoin competitors ever felt slower blocks would be an advantage.

## Discussions

### 2015 (Gavin Andersen)

First discussions about changing Bitcoin's block time date back to 2015:

- https://old.reddit.com/r/Bitcoin/comments/35hpkt/please_remind_me_once_again_why_we_cant_decrease/

The opening post brought up the same relevant points discussed in this CHIP:

- Header overheads and impact on SPV wallets
- Increased stale block rate ("orphan rate")

Notably, [Gavin Andersen showed his support for 1-minute block time](https://old.reddit.com/r/Bitcoin/comments/35hpkt/please_remind_me_once_again_why_we_cant_decrease/cr4wk0g/), as well as ["ProHashing"](https://old.reddit.com/r/Bitcoin/comments/35hpkt/please_remind_me_once_again_why_we_cant_decrease/cr5h9hc/), a well-known miner.

>I think 1-minute blocks is a good idea. The best time to roll that out would be the next subsidy halving (makes the code much simpler).
>We still need a bigger max block size, though.

-- Gavin Andersen

### 2016 (Vitalik Buterin)

Vitalik Buterin suggested faster blocks as a soft-fork, primarily as an academic exercise to test the limits of soft-forking:

- https://old.reddit.com/r/btc/comments/428tjl/softforking_the_block_time_to_2_min_my_primarily/

### 2019 (Chinese Community)

Members of Chinese community voicing their preference for shorter block times:

- https://old.reddit.com/r/btc/comments/cfu99n/the_block_time_of_bch_should_be_shorten%E5%BB%BA%E8%AE%AE%E7%BC%A9%E7%9F%ADbch%E5%87%BA%E5%9D%97%E6%97%B6%E9%97%B4/
- https://old.reddit.com/r/btc/comments/chjwao/statement_on_the_discussion_of_shortening_block/

Also, there was a [blog post](https://medium.com/@ChangyongLiu/proposal-to-shorten-the-block-time-of-bch-1d7e8e897497) by professor Liu Changyong, saying Jihan Wu was in support and proposal gained traction among Chinese community, even after initial opposition:

>On November 30, 2017, Jihan Wu suggested in the Chinese community to shorten block time, and immediately met with opposition from most people. But after a year, most people turned to support him. The survey of Chinese core communities shows that more than 61% of the supporters of shortening block time were initially opposed and turned to the supporters afterwards.

Liu Changyong [later created](https://medium.com/21st-century-economist/the-transformation-of-currency-from-commodity-money-to-cryptocurrency-3489e8778cef) "FreeCash" (FCH), a [code-fork of BCH with 1-minute block time and some other changes](https://github.com/freecashorg/freecash/releases), proving viability of 1-minute block time.

### 2020 (Jonathan Toomim)

Reputable miner and researcher Jonathan Toomim showing his preference:

- https://bitcoincashresearch.org/t/2021-bch-upgrade-items-brainstorm/130/15

### 2021-2022 (Roger Ver, Sovereign Naan)

Discussions sparked by community member Max Hastings, and later Roger Ver suggesting a 1-minute block time.
[Sovereign Naan](https://www.youtube.com/@ogfoundation) posted a series of videos campaigning for 1-minute block time ("BCH10xF"), and Roger Ver showed his support for the idea in the comments.
Discussion continued into 2022 on Telegram.

- https://bitcoincashresearch.org/t/lets-talk-about-block-time/471
- https://old.reddit.com/r/btc/comments/osi9jj/bch_needs_to_make_0_conf_safe_enough_for/
- https://old.reddit.com/r/btc/comments/ospo6n/debunking_if_we_reduce_block_times_to_1_min_then/
- https://www.youtube.com/watch?v=k3Y1zm3oDeY
- https://bitcoincashresearch.org/t/why-some-services-can-not-adopt-0-confirmation-transactions/592
- https://t.me/bitcoincash/229375

### 2024 to Present (CHIP)

Recent discussions, leading into and discussing this CHIP:

- https://old.reddit.com/r/btc/comments/1efoq4d/lets_talk_about_block_time_for_1000th_time/
- https://old.reddit.com/r/btc/comments/1jzomlh/lets_talk_about_block_time_for_1001st_time/
- https://old.reddit.com/r/btc/comments/1eec98b/tailstorm_what_if_we_could_have_faster_block/
- https://bitcoincashresearch.org/t/spearheading-the-future-implementation-of-weak-blocks-intermediate-blocks-for-bch-proof-of-work/1333
- https://bitcoincashresearch.org/t/tailstorm-a-secure-and-fair-blockchain-for-cash-transactions/1357
- https://bitcoincashresearch.org/t/nested-proof-of-work-working-on-improving-the-design-request-for-comments/1378
- https://bitcoincashresearch.org/t/3-way-comparison-between-2minblock-infrablock-tailstorm-as-objective-as-humanly-possible-for-me/1527
- https://bitcoincashresearch.org/t/chip-2025-03-faster-blocks-for-bitcoin-cash/1513
- https://bitcoincashresearch.org/t/open-discussion-on-block-propagation-times/1552
- https://t.me/bitcoincash/394356
- https://t.me/bitcoincash/517900

**Spin-off research prompted by this CHIP**

- https://bitcoincashresearch.org/t/chip-2025-03-merkle-header-commitment-for-enhanced-spv-scalability/1518
- https://bitcoincashresearch.org/t/a-deterministic-tiebreaker-for-bitcoin-block-selection-enhancing-fairness-and-convergence/1532
- https://bitcoincashresearch.org/t/research-hash-keyed-pub-sub/1749
- https://bitcoincashresearch.org/t/chip-2026-02-simplified-header-verification-for-bitcoin-cash/1750

## Statements

See [stakeholders.md](./stakeholders.md).

## Acknowledgements

## Changelog

Changes are tracked using [git commits](https://gitlab.com/0353F40E/fablous/-/commits).

## Copyright

[MIT No Attribution](https://opensource.org/license/mit-0/).
