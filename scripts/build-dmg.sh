#!/usr/bin/env bash
set -e

VERSION="${1:-0.1.3}"
OUTPUT_DIR="${2:-release-assets}"
DMG_PATH="${OUTPUT_DIR}/ClipSync-macOS.dmg"

echo "==> Building ClipSync native macOS App & Drag-and-Drop DMG v${VERSION}..."

rm -rf /tmp/clipsync-dmg-source
mkdir -p /tmp/clipsync-dmg-source/ClipSync.app/Contents/MacOS
mkdir -p /tmp/clipsync-dmg-source/ClipSync.app/Contents/Resources
mkdir -p "${OUTPUT_DIR}"

# 1. Compile native Cocoa / AppKit menu bar application
if [ -f "apps/desktop/src-native/main.m" ]; then
  clang -framework Cocoa -O2 apps/desktop/src-native/main.m -o /tmp/clipsync-dmg-source/ClipSync.app/Contents/MacOS/ClipSync
else
  # Fallback to minimal launcher
  cat << 'EOF' > /tmp/fallback.m
#import <Cocoa/Cocoa.h>
int main(int argc, const char * argv[]) {
    @autoreleasepool {
        [[NSWorkspace sharedWorkspace] openURL:[NSURL URLWithString:@"https://rajanraj2.github.io/clipsync/"]];
    }
    return 0;
}
EOF
  clang -framework Cocoa -O2 /tmp/fallback.m -o /tmp/clipsync-dmg-source/ClipSync.app/Contents/MacOS/ClipSync
  rm -f /tmp/fallback.m
fi

chmod +x /tmp/clipsync-dmg-source/ClipSync.app/Contents/MacOS/ClipSync

# 2. Copy CLI javascript payload alongside the binary
if [ -f "packages/cli/bin/clipsync.js" ]; then
  cp packages/cli/bin/clipsync.js /tmp/clipsync-dmg-source/ClipSync.app/Contents/MacOS/clipsync.js
  chmod +x /tmp/clipsync-dmg-source/ClipSync.app/Contents/MacOS/clipsync.js
fi

# 3. Copy compiled dist modules into .app bundle
mkdir -p /tmp/clipsync-dmg-source/ClipSync.app/Contents/MacOS/dist
if [ -d "packages/cli/dist" ]; then
  cp -r packages/cli/dist/* /tmp/clipsync-dmg-source/ClipSync.app/Contents/MacOS/dist/
fi

# 4. Copy native AppIcon.icns
if [ -f "apps/desktop/resources/AppIcon.icns" ]; then
  cp apps/desktop/resources/AppIcon.icns /tmp/clipsync-dmg-source/ClipSync.app/Contents/Resources/AppIcon.icns
fi

# 5. Write valid Apple Info.plist
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

# 6. Ad-hoc codesign binary and whole .app bundle
codesign -s - --force --deep /tmp/clipsync-dmg-source/ClipSync.app/Contents/MacOS/ClipSync || true
codesign -s - --force --deep /tmp/clipsync-dmg-source/ClipSync.app || true

# 7. Create symbolic link to /Applications
ln -s /Applications /tmp/clipsync-dmg-source/Applications

# 8. Package DMG with UDZO compression
rm -f "${DMG_PATH}"
hdiutil create -volname "ClipSync" -srcfolder /tmp/clipsync-dmg-source -ov -format UDZO "${DMG_PATH}"

rm -rf /tmp/clipsync-dmg-source
echo "==> Successfully created ${DMG_PATH}"
