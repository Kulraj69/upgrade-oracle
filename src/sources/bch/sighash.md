# CHIP-2026-06: OP_SIGHASH

        Title: CHIP-2026-06 OP_SIGHASH for Bitcoin Cash
        First Submission Date: 2026-06-14
        Owners: bitcoincashautist (ac-A60AB5450353F40E)
        Type: Technical
        Layers: Script
        Status: Proposed
        Last Edit Date: 2026-09-08

## Summary

This proposal adds `OP_SIGHASH`, an opcode that computes the transaction's signature hash (sighash) and pushes it to the stack without verifying a signature.
It completes the "checksig unbundling": `OP_CHECKSIG` is functionally `OP_SIGHASH` plus `OP_CHECKDATASIG`, once the signature's trailing sighash-type byte is split off and used as the `OP_SIGHASH` selector.

The opcode pops a sighash-type byte from the stack and pushes the resulting 32-byte sighash digest.
It uses the same sighash preimage, type flags, and `scriptCode` conventions as `OP_CHECKSIG`.
The one difference is the final hash: a single SHA256 instead of sha256d, so the result drops straight into `OP_CHECKDATASIG`.

No new cryptography, sighash algorithms, or flag semantics are introduced.
The opcode exposes work the VM already does internally.

## Deployment

Deployment of this specification is proposed for the May 2027 upgrade.

- Activation is proposed for `1794744000` MTP, (`2026-11-15T12:00:00.000Z`) on `chipnet`.
- Activation is proposed for `1810382400` MTP, (`2027-05-15T12:00:00.000Z`) on the BCH network (`mainnet`), `testnet3`, `testnet4`, and `scalenet`.

## Motivation

### The Checksig Unbundling

`OP_CHECKSIG` does two things: (1) compute a sighash digest from the transaction, and (2) verify a signature over that digest against a public key.
`OP_CHECKDATASIG` does step (2) over an arbitrary user-supplied message.
But there is no way to efficiently do step (1) alone: the sighash algorithm part of `OP_CHECKSIG` is inaccessible to Script.

`OP_SIGHASH` unbundles step (1).
A standard checksig signature carries a trailing sighash-type byte, while `OP_CHECKDATASIG` expects a raw signature with no such byte.
With `OP_SIGHASH`, Script can split the two apart and rebuild checksig:

```
<sig_with_hashtype>                // e.g. DER || 0x41, or r||s||0x41
OP_SIZE OP_1SUB OP_SPLIT           // [rawsig, hashtype]
OP_SIGHASH                         // [rawsig, sighash]
<pubkey> OP_CHECKDATASIGVERIFY     // verify the signature
```

This enables new contract patterns where the sighash is combined with other data before verification, or where it is verified by other means than `OP_CHECKSIG`.

### Unlocking Script Malleability Protection

Say you stash a blob of data (say 1500 bytes) in the unlocking script and just drop it in the locking script. A signature can't sign itself, so those unlocking bytes are never covered by the sighash. Anyone relaying the tx can swap the data out and it still validates.

Today you'd patch that with a second signature via `OP_CHECKDATASIG` — one sig for the tx, one for the data. That's an extra ~64 bytes, and the data sig isn't tied to this tx unless you remember to commit to the outpoint yourself.

With `OP_SIGHASH` you glue the two together and check once. One signature covers both the transaction and the data, so swapped data fails verification:

Locking Bytecode:
```
<0x41> OP_SIGHASH OP_SWAP OP_CAT <pubkey> OP_CHECKDATASIGVERIFY
```

Unlocking Bytecode:
```
<signature>   // signs (sighash || data), ~64 bytes, that's it
<data>
```

### Script-Implemented Authentication Schemes

Several projects implement alternative signature schemes directly in Script: Quantumroot (post-quantum vaults), Lamport signatures, and secp256r1 verification.
All of them must construct a sighash manually using transaction introspection opcodes.
This is a big part of the cost: ~600 bytes of Script just to produce the 32-byte digest.

Sahid Miller, who implemented secp256k1 and secp256r1 verifiers in Script:

>In my custom secp256k1 and p256 signature verification scripts, I use ~600 bytes to create a sighash to verify against. OP_SIGHASH would make that unnecessary.

A manual sighash implementation using loops (post-May 2026) can be compressed to ~153 bytes.
`OP_SIGHASH` does the same work in **2 bytes** (sighash byte + opcode), using the same sighash code path the node already runs.

### Standardized Sighash for Novel Signers

Every Script-based signer that constructs its own sighash must reimplement the sighash algorithm, including edge cases around `SIGHASH_SINGLE`, `ANYONECANPAY`, `FORKID`, `UTXOS`, and the `scriptCode` substitution rules.
Errors in these reimplementations are consensus-compatible (the script simply fails to verify, or some unintentional malleability gap is left) but still represent wasted funds and debugging effort.

`OP_SIGHASH` gives every Script-based signer the same canonical sighash: the one computed by the node's own C++ codebase, which has been battle-tested for over a decade.
Implementations become simpler, auditable, and audited once.

### Covenants and Oracle Patterns

An oracle can authorize a specific state transition while being cryptographically bound to the exact transaction:

```
<oracle_sig>
<state_hash>
<0x41> OP_SIGHASH OP_SWAP OP_CAT // sighash || state_hash
<oracle_pubkey> OP_CHECKDATASIGVERIFY
```

Multiple parties can each sign off on shared data included in the same transaction, with all signatures covering the transaction itself plus the data.

## Benefits

### Completes the OP_CHECKSIG decomposition

`OP_CHECKSIG` ≈ `OP_SPLIT` + `OP_SIGHASH` + `OP_CHECKDATASIG`.
We have 2 of the 3 essential pieces today; `OP_SIGHASH` adds the missing one.
The decomposition is not merely aesthetic, it enables composability.
The sighash becomes a stack value that Script can inspect, hash, concatenate, compare, or verify against.

### Dramatic size reduction for Script-based signers

| Sighash construction method | Size |
|---|---|
| Pre-loops introspection | ~600 bytes |
| Post-loops manual construction | ~153 bytes |
| **OP_SIGHASH** | **2 bytes** |

For Quantumroot spends (~1.5 KB per UTXO), this is a ~10% reduction.
For schemes that chain many Script-based signature verifications, the savings multiply.

### Practically free implementation

`OP_SIGHASH` builds the same preimage as `OP_CHECKSIG`, only hashed once instead of twice.
No new hash functions, curves, or algorithms.
The implementation reuses the existing sighash code path and adds one new exit to push the result rather than verify against it.

### Enables future SIGHASH extensions to benefit Script signers automatically

If a future upgrade adds a new sighash flag (e.g., `SIGHASH_NOINPUT` / `SIGHASH_ANYPREVOUT`), both `OP_CHECKSIG` and `OP_SIGHASH` support it from day one.
Script-based signers that use `OP_SIGHASH` inherit the new capability without modifying their Script.
This keeps the flag handling unified across both opcodes: they should always agree on what flags are valid and what preimage they commit to. Only the final hash differs, once for `OP_SIGHASH` and twice for `OP_CHECKSIG`, and that's on purpose.

## Costs & Risk Mitigation

### Opcode budget

`OP_SIGHASH` consumes one opcode number from the available opcode space.
BCH has ample remaining opcodes.

### CPU cost

The opcode does the same preimage work as `OP_CHECKSIG` does internally, just hashed once at the end instead of twice.
Same serialized transaction, same sighash-type-dependent masking.
Because `OP_SIGHASH` requires `SIGHASH_FORKID`, it inherits the BIP143 precomputed hashes (`hashPrevouts`, `hashSequence`, `hashOutputs`) and the O(1)-per-input work they provide, avoiding the legacy quadratic-hashing DoS vector.
The opcode cost MUST be charged at the worst-case hashing cost of that preimage computation, even when a cached digest can be returned, so repeated `OP_SIGHASH` calls cannot be made effectively free.

### No new malleability vectors

`OP_SIGHASH` does not sign anything, it only computes a hash.
It introduces no new ways to mutate a transaction.
The sighash digest it produces is deterministic given the transaction and sighash type, exactly as `OP_CHECKSIG`'s internal digest is deterministic.

### Interaction with OP_CHECKDATASIG

The `OP_SIGHASH` + `OP_CHECKDATASIG` pattern is functionally equivalent to `OP_CHECKSIG`, but the sighash byte is a separate stack element rather than appended to the signature.
This does not create a malleability concern because the sighash byte is popped as a stack element rather than parsed out of the signature — either way, mutating it invalidates the spend.
Wallets that construct the `OP_SIGHASH` + `OP_CHECKDATASIG` pattern should apply the same sighash-type validation they apply to traditional spends.

### Scope creep risk: SIGHASH_NOINPUT / APO

The discussion raised `SIGHASH_NOINPUT` (or `SIGHASH_ANYPREVOUT`) as a natural extension.
This CHIP does **not** propose adding it.
APO changes the sighash to exclude the prevout, enabling rebindable signatures, a powerful primitive that deserves a separate CHIP.
The design of `OP_SIGHASH` is compatible with APO (a future upgrade would add the flag bit to both `OP_CHECKSIG` and `OP_SIGHASH` simultaneously), but this proposal is limited to exposing the existing sighash.

## Technical Specification

This section is normative. The key words MUST, MUST NOT, and MAY are used in the RFC 2119 sense.
All behavior is gated behind `SCRIPT_ENABLE_SIGHASH`.
When the flag is clear, `OP_SIGHASH` MUST leave the stack unchanged (NOP behavior) or, if the opcode number is assigned from previously-invalid space, immediately fail, producing byte-for-byte identical behavior to the pre-activation software.

### Opcode

A new opcode `OP_SIGHASH` is assigned at `0xbd` codepoint.

### Stack behavior

```
<sighash_type> OP_SIGHASH → <32-byte sighash digest>
```

1. Pop one byte from the stack as the **sighash type**.
2. Validate it as a legal sighash type.
Valid types are the same as for `OP_CHECKSIG`.
3. Compute the sighash preimage exactly as `OP_CHECKSIG` would, but finally hash it with a **single** sha256 (Single SHA256) instead of sha256d (Double SHA256) as `OP_CHECKSIG` would.
4. Push the resulting 32-byte digest to the stack.

### Error conditions

- **Empty stack:** if the stack has fewer than one element when `OP_SIGHASH` is executed, the script fails immediately (as with any opcode that pops from an empty stack).
- **Invalid sighash type:** the popped byte is interpreted as the single byte hash type field.
If it is not a valid hash type the script fails.
Because `SIGHASH_FORKID` is mandatory for `OP_CHECKSIG` at consensus, every valid type sets that bit; if `SIGHASH_FORKID` is not set then the executed `OP_SIGHASH` must fail the script immediately.

### Sighash algorithm

The sighash *preimage* computation is **identical** to the `SIGHASH_FORKID` (BIP143) preimage computed internally by `OP_CHECKSIG`.

The final digest is a single SHA256 of that preimage, not the double SHA256 (sha256d) that `OP_CHECKSIG` verifies against.
It helps to reframe slightly: `OP_SIGHASH` *is* the sighash, and `OP_CHECKSIG` is sighash-plus-one-more-hash.
That extra round is exactly the message hash `OP_CHECKDATASIG` performs itself before verifying, so `OP_SIGHASH` output drops straight into `OP_CHECKDATASIG`.

The checksig-equivalent composition requires splitting the sighash-type byte off the signature, because a checksig signature carries the byte while `OP_CHECKDATASIG` expects a raw signature:

```
<sig_with_hashtype>                // e.g. DER || 0x41, or r||s||0x41
OP_SIZE OP_1SUB OP_SPLIT           // [rawsig, hashtype]
OP_SIGHASH                         // [rawsig, sighash]
<pubkey> OP_CHECKDATASIG
```

`OP_CHECKDATASIG` hashes the message once before verifying, so the signature is checked over `sha256d(preimage)` — exactly what `OP_CHECKSIG` would have checked.
If `OP_SIGHASH` instead pushed the double hash, `OP_CHECKDATASIG` would hash a third time and the signer would have to produce a triple-hash signature that no standard wallet or hardware signer creates.

When the sighash is concatenated with other data before verification (the `OP_CAT` patterns), the signed message is `sha256(digest || data)` either way, which is bespoke regardless — no standard signature covers it.
Single versus double then only changes which 32 bytes get concatenated.

Any future change to `OP_CHECKSIG`'s sighash algorithm (e.g., adding a new flag) MUST apply identically to `OP_SIGHASH`.

## Evaluation of Alternatives

### Do nothing; use post-loops manual sighash construction

With the May 2026 VM Limits and loop opcodes, it becomes possible to construct the sighash manually in Script.
A reference implementation exists at ~153 bytes.
This is functional but:

- **Size:** 153 bytes vs. 2 bytes. For a single-spend script the difference is modest, but for scripts that verify multiple signatures (multiparty, multi-oracle, multi-scheme), the cost multiplies.
- **Auditability:** Every Script-based signer that rolls its own sighash reimplements the algorithm. Each implementation must be independently audited for correctness, including edge cases around unusual sighash-type combinations. `OP_SIGHASH` delegates to the single, audited implementation in the node codebase.
- **Future-proofing:** A manual sighash implementation encodes a specific sighash algorithm at UTXO creation time. If a future upgrade changes the sighash algorithm (e.g., TxV5's detached signatures, or a new flag), the Script-based implementation continues to compute the *old* sighash — a silent divergence. `OP_SIGHASH` always computes the current consensus sighash.

Also, there's a small gap in introspection opcodes: it is impossible to tell whether a fungible token UTXO also has an "empty" NFT attached to it ([details](https://github.com/cashtokens/cashtokens/issues/29)).

### Bundle SIGHASH_NOINPUT / APO with this CHIP

`SIGHASH_NOINPUT` (or `SIGHASH_ANYPREVOUT`) was raised as a natural companion.
It is **not included** in this proposal for two reasons:

1. APO is a significant semantic change as it makes signatures rebindable across UTXOs.
It warrants its own analysis, use-case exploration, and security review.
2. `OP_SIGHASH` is useful today without APO.
Decoupling them avoids delaying the simpler opcode on the more complex one.

The design is forward-compatible: if APO is added in a future upgrade, the flag bit works in both `OP_CHECKSIG` and `OP_SIGHASH` simultaneously.

### Use the name OP_TXHASH

The name `OP_TXHASH` was proposed in BTC circles (BIP 346) for a more general opcode with multi-byte field selectors.
The name `OP_SIGHASH` is preferred here because:

- It communicates exactly what the opcode does: produce a **sighash**.
- It aligns with the existing `OP_CHECKSIG` / `SIGHASH_` nomenclature familiar to every Bitcoin developer.
- The opcode described here is intentionally scoped to the existing sighash flags rather than a general TX hashing framework.

### Add OP_SIGHASHVERIFY

`OP_CHECKSIG` has a `VERIFY` variant.
`OP_SIGHASH` does not need one: its output is data, not a boolean.
To assert something about the sighash, use `OP_EQUALVERIFY` after `OP_SIGHASH`, which is explicit and auditable.

### Use a dedicated address type or output template

No new address type is needed.
The `OP_SIGHASH` + `OP_CHECKDATASIG` pattern is a Script construction, not a standard script like P2PKH.

## Security Considerations

### Sighash exposure

`OP_SIGHASH` exposes the sighash digest on the stack.
This is the single-SHA256 (Single SHA256) variant of what `OP_CHECKSIG` computes internally (Double SHA256): it is not secret, and its exposure creates no new attack surface.
A sighash is a hash of public transaction data; knowing it does not help an attacker forge a signature over it.

### No signature verification

`OP_SIGHASH` does not verify a signature.
It is the script author's responsibility to use the resulting digest in a verification context.
A script that calls `OP_SIGHASH` without subsequently verifying a commitment or signature over the digest is authorizing a spend without authentication: equivalent to a script that calls no check-sig opcode at all.
This is an existing class of script bug, not a new one.

### Determinism

The sighash is deterministic given the transaction and sighash type.
There is no nonce, no randomness, and no platform-dependent behavior.
The SHA256 used is bit-identical across all platforms.

### Malleability

The sighash type byte is a stack operand: it may be fixed in the locking script (no malleability surface) or chosen by the spender.
When the spender supplies it, a third-party relay could theoretically modify the byte, but the resulting sighash would differ and the signature verification (`OP_CHECKDATASIG`) would fail, so the mutation produces an invalid transaction.
This is identical to how modifying the sighash-type byte appended to a traditional checksig signature invalidates the spend.
No new malleability vector is introduced.

## Primary Stakeholders

- **Node developers** (BCHN, BCHD, Knuth, etc.): implement the opcode, wire it into the existing sighash code path.
- **Wallet & library developers** (Libauth, CashScript, etc.): support `OP_SIGHASH` in Script compilers and templates; document the `OP_SIGHASH` + `OP_CHECKDATASIG` pattern as the canonical checksig-equivalent.
- **Contract / dApp developers**: primary beneficiaries: simpler, smaller Script-based signing schemes; novel sighash-binding patterns.
- **SPV servers / indexers**: no protocol change; existing transaction parsing is unaffected.

## Statements

(To be collected from node implementations, wallets, and infrastructure operators during review.)

## Implementations

- **Bitcoin Cash Node**: [MR 2119](https://gitlab.com/bitcoin-cash-node/bitcoin-cash-node/-/merge_requests/2119)
- **LibAuth**: TODO

## Copyright

[MIT No Attribution](https://opensource.org/license/mit-0/).
