# Feature flags

Experimental features are controlled by environment variables and read through
the typed `FeatureFlagsService`.

| Typed flag | Environment variable | Default  |
| ---------- | -------------------- | -------- |
| `feeBump`  | `FEATURE_FEE_BUMP`   | disabled |
| `indexer`  | `FEATURE_INDEXER`    | disabled |

Only the case-insensitive value `true` enables a flag. Missing values and
all other values are disabled. Inject `FeatureFlagsService` and call
`isEnabled('feeBump')` or `isEnabled('indexer')`; invalid names are rejected
by TypeScript.

## `feeBump` (fee-bump sponsorship)

When `FEATURE_FEE_BUMP=true`, the attendee confirm paths (purchase, transfer,
list for resale, cancel resale, buy resale) wrap the wallet-signed envelope
in a fee bump paid by the platform account (`PLATFORM_SIGNER_SECRET`). The
platform account must hold enough XLM to cover sponsored fees.

The fee bump's declared fee is the spending cap per transaction, set by
`FEE_BUMP_MAX_FEE_STROOPS` (default `100000`, 0.01 XLM). A signed envelope
whose own fee already exceeds the cap is rejected before submission.
