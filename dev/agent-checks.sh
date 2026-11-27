#!/bin/sh
# Hardened full-stack verification gate (E4-T2, ADR 0018, ADR 0073) for App Factory blueprint repositories.
# Intended to be invoked by coding agents via `run_checks` (and CI) from the root of a blueprint-derived repo.
# Fails non-zero immediately if required blueprint files or tools are missing or if any check fails.
set -eu

export CRATESTACK_REQUIRE_VERSION="${CRATESTACK_REQUIRE_VERSION:-0.20.4}"

for req in \
  schema/app.cstack \
  s.contracts.lock \
  apps/server/Cargo.toml \
  apps/mobile/pubspec.yaml \
  deploy/compose/compose.yaml
do
  if [ ! -f "$req" ]; then
    echo "FAIL: missing required blueprint file '$req' in $(pwd)" >&2
    exit 1
  fi
done

echo "==> Checking CrateStack schema, contract lock, diff, and Dart SDK drift"
cratestack check --schema schema/app.cstack
cratestack contract check --schema schema/app.cstack --lock s.contracts.lock
cratestack diff schema/app.cstack schema/app.cstack
cratestack generate-dart \
  --schema schema/app.cstack \
  --out apps/mobile/lib/generated \
  --library-name app_client \
  --preset fespalier \
  --fespalier-ref v0.26.0 \
  --check

echo "==> Checking Fespalier & Flutter mobile app (apps/mobile)"
(
  cd apps/mobile
  fsp check
  flutter test
)

echo "==> Checking Rust server (apps/server)"
(
  cd apps/server
  CARGO_BUILD_JOBS="${CARGO_BUILD_JOBS:-2}" \
  CARGO_INCREMENTAL="${CARGO_INCREMENTAL:-0}" \
  CARGO_PROFILE_DEV_DEBUG="${CARGO_PROFILE_DEV_DEBUG:-0}" \
    cargo fmt --check
  CARGO_BUILD_JOBS="${CARGO_BUILD_JOBS:-2}" \
  CARGO_INCREMENTAL="${CARGO_INCREMENTAL:-0}" \
  CARGO_PROFILE_DEV_DEBUG="${CARGO_PROFILE_DEV_DEBUG:-0}" \
    cargo clippy --all-targets -- -D warnings
  CARGO_BUILD_JOBS="${CARGO_BUILD_JOBS:-2}" \
  CARGO_INCREMENTAL="${CARGO_INCREMENTAL:-0}" \
  CARGO_PROFILE_DEV_DEBUG="${CARGO_PROFILE_DEV_DEBUG:-0}" \
    cargo test --locked
  cargo deny check
)

echo "==> Validating container Compose deployment (deploy/compose/compose.yaml)"
docker compose -f deploy/compose/compose.yaml config -q

echo "PASS: all App Factory full-stack checks succeeded."
