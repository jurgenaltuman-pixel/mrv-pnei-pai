#!/usr/bin/env bash
# Configura firma release para GitHub Actions (secretos reales o keystore CI de prueba).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ANDROID_DIR="$ROOT/android"
KEYSTORE_PATH="app/release.keystore"
KEYSTORE_FILE="$ANDROID_DIR/$KEYSTORE_PATH"
PROPS_FILE="$ANDROID_DIR/keystore.properties"

mkdir -p "$(dirname "$KEYSTORE_FILE")"

if [[ -n "${ANDROID_KEYSTORE_BASE64:-}" ]]; then
  echo "Using Play Store keystore from GitHub Secrets..."
  echo "$ANDROID_KEYSTORE_BASE64" | base64 -d > "$KEYSTORE_FILE"
  cat > "$PROPS_FILE" <<EOF
storeFile=${KEYSTORE_PATH}
storePassword=${ANDROID_KEYSTORE_PASSWORD}
keyAlias=${ANDROID_KEY_ALIAS}
keyPassword=${ANDROID_KEY_PASSWORD}
EOF
else
  echo "No ANDROID_KEYSTORE_BASE64 — generating CI test keystore (sideload / QA, not Play Store)."
  STORE_PASS="${ANDROID_CI_KEYSTORE_PASSWORD:-mrv-ci-store-2026}"
  KEY_PASS="${ANDROID_CI_KEY_PASSWORD:-mrv-ci-key-2026}"
  keytool -genkeypair -v \
    -keystore "$KEYSTORE_FILE" \
    -alias mrv2026 \
    -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass "$STORE_PASS" \
    -keypass "$KEY_PASS" \
    -dname "CN=MRV 2026,OU=Field,O=MSpbs,C=PY"
  cat > "$PROPS_FILE" <<EOF
storeFile=${KEYSTORE_PATH}
storePassword=${STORE_PASS}
keyAlias=mrv2026
keyPassword=${KEY_PASS}
EOF
fi

echo "Android signing configured at $PROPS_FILE"
