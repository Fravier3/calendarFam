#!/usr/bin/env bash
set -euo pipefail
: "${ANDROID_PLATFORM_JAR:?Ruta al android.jar}"
: "${ANDROID_BUILD_TOOLS:?Ruta a las herramientas de Android}"
: "${CALENDAR_SIGNING_STORE:?Ruta al almacén de firma}"
: "${CALENDAR_SIGNING_PASSWORD:?Contraseña de firma}"
: "${CALENDAR_BACKGROUNDS:?Directorio de los fondos WebP}"
cd "$(dirname "$0")"
mkdir -p build/classes build/dex build/assets/web build/assets/tv-assets
cp -R ../dist/. build/assets/web/
cp "${CALENDAR_BACKGROUNDS}"/pr-*.webp build/assets/tv-assets/
"${ANDROID_BUILD_TOOLS}"/aapt2 compile --dir res -o build/resources.zip
"${ANDROID_BUILD_TOOLS}"/aapt2 link -I "${ANDROID_PLATFORM_JAR}" --manifest AndroidManifest.xml -o build/resources.apk -A build/assets build/resources.zip
javac --release 8 -classpath "${ANDROID_PLATFORM_JAR}" -d build/classes src/MainActivity.java
"${ANDROID_BUILD_TOOLS}"/d8 --lib "${ANDROID_PLATFORM_JAR}" --min-api 23 --output build/dex $(find build/classes -name '*.class')
cp build/resources.apk build/unsigned.apk
(cd build/dex && zip -q ../unsigned.apk classes.dex)
"${ANDROID_BUILD_TOOLS}"/zipalign -f 4 build/unsigned.apk build/aligned.apk
"${ANDROID_BUILD_TOOLS}"/apksigner sign --ks "${CALENDAR_SIGNING_STORE}" --ks-pass env:CALENDAR_SIGNING_PASSWORD --out build/centro-vazquez-santiago-tv.apk build/aligned.apk
"${ANDROID_BUILD_TOOLS}"/apksigner verify --verbose build/centro-vazquez-santiago-tv.apk
