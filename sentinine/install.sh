#!/usr/bin/env bash
# Advanced scripted installation; the portal Docker command needs no Python host runtime.
set -euo pipefail
: "${SENTININE_INSTALL_PROFILE:?Descarga el perfil de instalación no secreto desde Sentinel.}"
: "${SENTININE_TOKEN_FILE:?Indica el archivo privado que guardaste al registrar o rotar.}"
installer="$(dirname -- "$0")/senti9-installer.pyz"
[[ -f "$installer" ]] || installer="$(dirname -- "$0")/install.py"
exec python3 "$installer" --profile "$SENTININE_INSTALL_PROFILE" --token-file "$SENTININE_TOKEN_FILE"
