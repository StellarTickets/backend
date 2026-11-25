#!/usr/bin/env bash
# Deploys a Soroban WASM to the local chain started by `docker compose up`
# (the `soroban` service, stellar/quickstart in --local mode).
#
# Usage: scripts/deploy-local-contract.sh path/to/contract.wasm
# Requires the `stellar` CLI on the host. Prints the deployed contract id.
#
# Note: the backend only accepts STELLAR_NETWORK=testnet|futurenet|mainnet, so
# it cannot sign against this standalone network without code changes.
set -euo pipefail

WASM="${1:?usage: $0 <path-to-contract.wasm>}"
NETWORK_NAME="local"
RPC_URL="${SOROBAN_LOCAL_RPC_URL:-http://localhost:8000/rpc}"
PASSPHRASE="Standalone Network ; February 2017"
IDENTITY="${STELLAR_LOCAL_DEPLOYER:-local-deployer}"

if ! command -v stellar >/dev/null 2>&1; then
  echo "The stellar CLI is required: https://developers.stellar.org/docs/tools/cli" >&2
  exit 1
fi

# Register the network; ignore the error if it already exists.
stellar network add "$NETWORK_NAME" \
  --rpc-url "$RPC_URL" \
  --network-passphrase "$PASSPHRASE" >/dev/null 2>&1 || true

# Create and fund the deployer through friendbot on first run only.
if ! stellar keys address "$IDENTITY" >/dev/null 2>&1; then
  stellar keys generate "$IDENTITY" --network "$NETWORK_NAME" --fund
fi

stellar contract deploy \
  --wasm "$WASM" \
  --source-account "$IDENTITY" \
  --network "$NETWORK_NAME"
