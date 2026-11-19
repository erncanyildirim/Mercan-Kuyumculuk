#!/bin/sh
# Builds, signs and uploads the iOS app to App Store Connect.
#
# Why not plain Xcode "Distribute App": the account holder's name contains "Ç". Xcode writes the
# certificate name into the code signature's designated requirement in a different Unicode form,
# and App Store Connect rejects the upload as "Invalid Signature" (ITMS-90035). This script signs
# with a requirement based on the team ID instead of the certificate name.
#
# One-time setup on the release Mac (already done on Eren's Mac, 2026-10-13):
#   - "Apple Distribution: Vahdettin ARAÇ (K2MRSSMA4U)" identity in the login keychain
#     (private key backup: ~/.mercan-signing/dist.key)
#   - App Store profile at ~/.mercan-signing/appstore.mobileprovision
#   - API key at ~/.appstoreconnect/private_keys/AuthKey_$API_KEY.p8
#
# usage: tools/ios/release.sh            (bump CURRENT_PROJECT_VERSION in Config.xcconfig first)
set -eu

ROOT=$(cd "$(dirname "$0")/../.." && pwd)
TEAM=K2MRSSMA4U
BUNDLE=com.suer.mercankuyumculuk
APPLE_ID=6822007593
API_KEY=${API_KEY:-82WW6XPXG9}
API_ISSUER=${API_ISSUER:-7c7b3af6-5084-4531-8527-50acdcf97348}
PROFILE=$HOME/.mercan-signing/appstore.mobileprovision
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

IDENTITY=$(security find-identity -v -p codesigning | awk '/Apple Distribution: .*\('"$TEAM"'\)/ {print $2; exit}')
[ -n "$IDENTITY" ] || { echo "Apple Distribution identity for $TEAM not found in keychain" >&2; exit 1; }

printf '%s\n' "designated => anchor apple generic and identifier \"$BUNDLE\" and certificate leaf[subject.OU] = \"$TEAM\" and certificate 1[field.1.2.840.113635.100.6.2.1] exists" > "$WORK/dr.txt"

echo "Archiving…"
xcodebuild -project "$ROOT/iosApp/iosApp.xcodeproj" -scheme iosApp -configuration Release \
  -destination 'generic/platform=iOS' -archivePath "$WORK/App.xcarchive" -allowProvisioningUpdates \
  archive -quiet

APP="$WORK/App.xcarchive/Products/Applications/MercanKuyumculuk.app"
mkdir -p "$WORK/Payload"
cp -R "$APP" "$WORK/Payload/"
APP="$WORK/Payload/MercanKuyumculuk.app"

cat > "$WORK/ent.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>application-identifier</key><string>$TEAM.$BUNDLE</string>
  <key>beta-reports-active</key><true/>
  <key>com.apple.developer.team-identifier</key><string>$TEAM</string>
  <key>get-task-allow</key><false/>
</dict></plist>
EOF

echo "Signing…"
cp "$PROFILE" "$APP/embedded.mobileprovision"
codesign -f -s "$IDENTITY" --entitlements "$WORK/ent.plist" --requirements "$WORK/dr.txt" --timestamp "$APP"
codesign --verify --deep --strict "$APP"
(cd "$WORK" && zip -qry App.ipa Payload)

VERSION=$(/usr/libexec/PlistBuddy -c 'Print CFBundleShortVersionString' "$APP/Info.plist")
BUILD=$(/usr/libexec/PlistBuddy -c 'Print CFBundleVersion' "$APP/Info.plist")
echo "Uploading $VERSION ($BUILD)…"
xcrun altool --upload-package "$WORK/App.ipa" --type ios --apple-id "$APPLE_ID" --bundle-id "$BUNDLE" \
  --bundle-version "$BUILD" --bundle-short-version-string "$VERSION" \
  --apiKey "$API_KEY" --apiIssuer "$API_ISSUER"
