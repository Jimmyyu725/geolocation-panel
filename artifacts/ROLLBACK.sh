#!/usr/bin/env bash
set -euo pipefail
base="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
target="${1:?Usage: ROLLBACK.sh EXTENSION_DIRECTORY}"
manifest="$target/manifest.json"
original="$base/original-manifest.json"
test -f "$manifest"
test -f "$original"
original_sha="$(sha256sum "$original" | cut -d ' ' -f1)"
test "$original_sha" = "2f0cc1571676b619cf5c963ed1a7dae1c3e07e80ef673f8d2c697c6c9e9588d5"
current_sha="$(sha256sum "$manifest" | cut -d ' ' -f1)"
if [[ "$current_sha" != "d39c3d2d7aeb80112067b943d8201fc93650a7cdf811df907cb4e4742fb8571a" ]]; then
  printf '%s\n' 'ROLLBACK_STOP: manifest differs from the verified modified version' >&2
  exit 2
fi
backup="$(mktemp "$target/manifest.pre-rollback.XXXXXX.json")"
cp -- "$manifest" "$backup"
cp -- "$original" "$manifest"
cmp -- "$original" "$manifest"
printf '%s\n' 'ROLLBACK_RESTORED: manifest preserved; capture disabled after extension and page reload'
