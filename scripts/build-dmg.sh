#!/usr/bin/env bash
set -e

VERSION="${1:-0.1.2}"
OUTPUT_DIR="${2:-release-assets}"
DMG_PATH="${OUTPUT_DIR}/ClipSync-macOS.dmg"

echo "==> Building ClipSync macOS Drag-and-Drop DMG v${VERSION}..."

rm -rf /tmp/clipsync-dmg-source
mkdir -p /tmp/clipsync-dmg-source/ClipSync.app/Contents/MacOS
mkdir -p /tmp/clipsync-dmg-source/ClipSync.app/Contents/Resources
mkdir -p "${OUTPUT_DIR}"

# Compile / copy CLI executable into the .app bundle
if [ -f "packages/cli/bin/clipsync.js" ]; then
  cp packages/cli/bin/clipsync.js /tmp/clipsync-dmg-source/ClipSync.app/Contents/MacOS/ClipSync
  chmod +x /tmp/clipsync-dmg-source/ClipSync.app/Contents/MacOS/ClipSync
fi

# Copy native ICNS and brand assets
if [ -f "apps/desktop/resources/AppIcon.icns" ]; then
  cp apps/desktop/resources/AppIcon.icns /tmp/clipsync-dmg-source/ClipSync.app/Contents/Resources/AppIcon.icns
fi

cat << EOF > /tmp/clipsync-dmg-source/ClipSync.app/Contents/Info.plist
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>ClipSync</string>
    <key>CFBundleIconFile</key>
    <string>AppIcon</string>
    <key>CFBundleIdentifier</key>
    <string>dev.clipsync.desktop</string>
    <key>CFBundleName</key>
    <string>ClipSync</string>
    <key>CFBundleDisplayName</key>
    <string>ClipSync</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleShortVersionString</key>
    <string>${VERSION}</string>
    <key>CFBundleVersion</key>
    <string>${VERSION}</string>
    <key>LSMinimumSystemVersion</key>
    <string>12.0</string>
    <key>LSUIElement</key>
    <true/>
</dict>
</plist>
EOF

# CRITICAL: Create symbolic link to /Applications inside the root of the DMG volume!
# This gives the classic macOS installer window: [ ClipSync.app ]  --->  [ Applications ]
ln -s /Applications /tmp/clipsync-dmg-source/Applications

# Package DMG with UDZO compression and volume name
rm -f "${DMG_PATH}"
hdiutil create -volname "ClipSync" -srcfolder /tmp/clipsync-dmg-source -ov -format UDZO "${DMG_PATH}"

rm -rf /tmp/clipsync-dmg-source
echo "==> Successfully created ${DMG_PATH}"
