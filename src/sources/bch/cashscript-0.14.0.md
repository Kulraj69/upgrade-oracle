
This release contains several breaking changes, please refer to the [migration notes](https://cashscript.org/docs/releases/migration-notes) for more information.

## cashc compiler
- :sparkles: Add support for user-defined reusable functions, including multiple return values.
- :sparkles: Add support for top-level global constants, including simple arithmetic / concatenation operations.
- :sparkles: Add support for `import` directives to share user-defined functions across files, including imports from `node_modules`.
- :sparkles: Add support for reassigning existing variables in tuple destructuring (e.g. `(a, b) = swap(a, b)`), optionally mixed with fresh declarations.
- :sparkles: Add `unused` modifier for parameters or variables that are intentionally unused.
- :hammer_and_wrench: Update `compileString` to take an optional `files` object for filesystem-free import resolution.
- :hammer_and_wrench: Unused variables that are not marked `unused` now produce a compiler warning instead of a compilation error.
- :hammer_and_wrench: Add a compiler warning for values assigned to a variable that are never read afterwards.
- :bug: Fix bug where date literals were parsed in the local time zone instead of UTC.
- :bug: **BREAKING**: Fix bug where `LockingBytecodeNullData` used incorrect push opcodes for empty chunks and chunks of 128-255 bytes, so it did not match the SDK's `addOpReturnOutput()`.
- :bug: **BREAKING**: Fix bug where hex literals with an odd number of digits (e.g. `0x123`) compiled to a different value (`0x1203`). They now cause a compile error.
- :bug: Fix bug where using the same variable in both arguments of `.slice()` could fail to compile.
- :bug: Fix bug where a variable reassigned in a `for` loop's init (e.g. `for (i = 0; ...)`) had an incorrect value after the loop.
- :bug: Fix bug where console.log showed an outdated value for a reassigned variable after its final use.
- :racehorse: Add new optimisations for loop counter updates, reassignments, scope cleanup, stack shuffles, and order-independent operations.
- :racehorse: Greatly improve compiler speed for very large contracts.

## CashScript SDK
- :sparkles: Add support for debugging user-defined functions, including stack traces for nested functions.
- :sparkles: Add a `validateTransactions` option (default: `true`) to the `MockNetworkProvider` to validate sent transactions against the BCH VM.
- :boom: **BREAKING**: Remove `generateLockingBytecode()` from the `Unlocker` interface.
- :hammer_and_wrench: **BREAKING**: The `TransactionBuilder` now requires UTXOs to include their `lockingBytecode`, and validates it against the provided unlocker.
- :hammer_and_wrench: **BREAKING**: Replace the `SignatureTemplate`'s `getHashType()`, `getPublicKey()` and `getSignatureAlgorithm()` methods with the `sighashType`, `publicKey` and `signatureAlgorithm` properties.
- :hammer_and_wrench: **BREAKING**: Remove the `bchForkId` parameter from `SignatureTemplate`'s `generateSignature()` method, since BCH consensus rules always require the fork ID flag.
- :hammer_and_wrench: **BREAKING**: Rename the `HashType` enum to `SighashType`.
- :hammer_and_wrench: Add `lockingBytecode` field to the `Utxo` interface, set automatically on all UTXOs returned by network providers.
- :hammer_and_wrench: `MockNetworkProvider` now logs a warning instead of throwing when the same transaction is sent twice.
- :hammer_and_wrench: `ElectrumNetworkProvider` now uses Electrum protocol 1.5.0 (was 1.4.1), and `getBlockHeight()` no longer subscribes to new headers. Custom electrum clients should negotiate 1.5.0 or later.
- :hammer_and_wrench: Update `@electrum-cash/network` to 4.4.0. In a browser, the `ElectrumNetworkProvider` now disconnects while the page is hidden and reconnects afterwards, restoring any subscriptions (see [Browser visibility and connectivity](/docs/sdk/electrum-network-provider#browser-visibility-and-connectivity)).
- :hammer_and_wrench: Make `cashscript/vitest` types compatible with Vitest 5.
- :bug: Fix bug where invalid hex string arguments were silently encoded to different bytes.
- :bug: Fix bug where `pubkey` arguments were not checked to be 33 or 65 bytes.
- :bug: Fix bug in `ElectrumNetworkProvider` automatic connection management.
- :bug: Fix bug where `send()` threw a `FailedTransactionError` when the transaction was broadcast but could not be retrieved afterwards.
- :bug: Fix bug where debugging reported a VM resource limit as a failed require statement.
- :bug: Fix minimum fee check rounding bug.
- :bug: Fix bug where `setLocktime()` accepted invalid values.
- :bug: Fix edge case bug where a failing final `require(variable)` statement was reported incorrectly in debugging.
