#!/usr/bin/env bash
# Capacitor sync en CI sin cargar capacitor.config.ts (solo JSON).
set -euo pipefail

PLATFORM="${1:?usage: ci-cap-sync.sh android|ios}"

if [[ -f capacitor.config.ts ]]; then
  mv capacitor.config.ts _capacitor.config.ts.bak
fi

cleanup() {
  if [[ -f _capacitor.config.ts.bak ]]; then
    mv _capacitor.config.ts.bak capacitor.config.ts
  fi
}
trap cleanup EXIT

npx cap copy "$PLATFORM"
npx cap update "$PLATFORM"

# En proyectos sin plugins Cordova, Gradle puede referenciar este archivo igualmente.
# Evita fallo en CI: "cordova.variables.gradle ... does not exist".
if [[ "$PLATFORM" == "android" ]]; then
  mkdir -p android/capacitor-cordova-android-plugins
  : > android/capacitor-cordova-android-plugins/cordova.variables.gradle
fi
