# Configura firma release en Windows (keystore CI de prueba, igual que ci-android-signing.sh).
$ErrorActionPreference = "Stop"
$ROOT = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$ANDROID_DIR = Join-Path $ROOT "android"
$KEYSTORE_PATH = "app/release.keystore"
$PROPS_STORE_FILE = "release.keystore"
$KEYSTORE_FILE = Join-Path $ANDROID_DIR $KEYSTORE_PATH
$PROPS_FILE = Join-Path $ANDROID_DIR "keystore.properties"

New-Item -ItemType Directory -Force -Path (Split-Path $KEYSTORE_FILE) | Out-Null

# PKCS12 (Java 21): store y key deben usar la misma contraseña.
$STORE_PASS = if ($env:ANDROID_CI_KEYSTORE_PASSWORD) { $env:ANDROID_CI_KEYSTORE_PASSWORD } else { "mrv-ci-store-2026" }
$KEY_PASS = $STORE_PASS

if (Test-Path $KEYSTORE_FILE) { Remove-Item -Force $KEYSTORE_FILE }
& keytool -genkeypair -v `
  -keystore $KEYSTORE_FILE `
  -alias mrv2026 `
  -keyalg RSA -keysize 2048 -validity 10000 `
  -storepass $STORE_PASS `
  -keypass $KEY_PASS `
  -dname "CN=MRV 2026,OU=Field,O=MSpbs,C=PY"

$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($PROPS_FILE, ($propsContent = @"
storeFile=$PROPS_STORE_FILE
storePassword=$STORE_PASS
keyAlias=mrv2026
keyPassword=$KEY_PASS
"@).TrimEnd() + "`n", $utf8NoBom)

Write-Host "Android signing configured at $PROPS_FILE"
