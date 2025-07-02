#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');

async function ensureDir(dirPath) {
  try {
    await fs.mkdir(dirPath, { recursive: true });
    console.log(`✅ Created directory: ${dirPath}`);
  } catch (error) {
    if (error.code !== 'EEXIST') {
      throw error;
    }
  }
}

async function createFile(filePath, content) {
  try {
    await fs.writeFile(filePath, content);
    console.log(`✅ Created file: ${filePath}`);
  } catch (error) {
    console.error(`❌ Failed to create ${filePath}:`, error.message);
  }
}

async function setupBuildResources() {
  console.log('🔧 Setting up build resources for Loadout...\n');

  // Create build directories
  const buildDir = path.join(rootDir, 'build');
  const iconsDir = path.join(buildDir, 'icons');
  
  await ensureDir(buildDir);
  await ensureDir(iconsDir);

  // Create macOS entitlements file
  const entitlementsContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.cs.allow-jit</key>
    <true/>
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
    <true/>
    <key>com.apple.security.cs.disable-library-validation</key>
    <true/>
    <key>com.apple.security.network.client</key>
    <true/>
    <key>com.apple.security.files.user-selected.read-write</key>
    <true/>
</dict>
</plist>`;

  await createFile(path.join(buildDir, 'entitlements.mac.plist'), entitlementsContent);

  // Create a placeholder icon generation script
  const iconGenScript = `# Icon Generation Guide for Loadout

## Required Icon Files

### macOS
- **icon.icns**: macOS icon file
  - Create from a 1024x1024 PNG using: \`iconutil -c icns icon.iconset\`
  - Or use online tools like cloudconvert.com

### Windows
- **icon.ico**: Windows icon file
  - Should contain multiple sizes: 16x16, 32x32, 48x48, 256x256
  - Can be created from PNG using online converters

### Linux
- **Multiple PNG files** in build/icons/:
  - 16x16.png
  - 32x32.png
  - 48x48.png
  - 64x64.png
  - 128x128.png
  - 256x256.png
  - 512x512.png
  - 1024x1024.png

## Design Recommendations

1. Use a simple, recognizable design
2. Ensure it looks good at small sizes
3. Use your brand colors
4. Consider using your app's first letter or a symbolic representation

## Quick Start

1. Create a 1024x1024 PNG icon
2. Use an online converter to generate .ico and .icns files
3. Use ImageMagick to generate Linux icons:
   \`\`\`bash
   for size in 16 32 48 64 128 256 512 1024; do
     convert icon.png -resize \${size}x\${size} \${size}x\${size}.png
   done
   \`\`\`

Place all generated files in the \`build/icons/\` directory.
`;

  await createFile(path.join(buildDir, 'ICON_GUIDE.md'), iconGenScript);

  // Create a simple placeholder SVG icon
  const placeholderIcon = `<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <rect width="1024" height="1024" rx="200" fill="#4F46E5"/>
  <text x="512" y="600" font-family="Arial, sans-serif" font-size="400" font-weight="bold" text-anchor="middle" fill="white">L</text>
</svg>`;

  await createFile(path.join(iconsDir, 'icon-placeholder.svg'), placeholderIcon);

  // Create GitHub Actions workflow
  const workflowDir = path.join(rootDir, '.github', 'workflows');
  await ensureDir(workflowDir);

  const releaseWorkflow = `name: Build and Release

on:
  push:
    tags:
      - 'v*'
  workflow_dispatch:

jobs:
  build:
    strategy:
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
        
    runs-on: \${{ matrix.os }}
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Build app
        env:
          GH_TOKEN: \${{ secrets.GITHUB_TOKEN }}
        run: npm run dist
        
      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: \${{ matrix.os }}-build
          path: release/*/
          
  release:
    needs: build
    runs-on: ubuntu-latest
    if: startsWith(github.ref, 'refs/tags/')
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        
      - name: Download all artifacts
        uses: actions/download-artifact@v4
        
      - name: Create Release
        uses: softprops/action-gh-release@v1
        with:
          files: |
            ubuntu-latest-build/**/*
            windows-latest-build/**/*
            macos-latest-build/**/*
          draft: true
          prerelease: false
        env:
          GITHUB_TOKEN: \${{ secrets.GITHUB_TOKEN }}
`;

  await createFile(path.join(workflowDir, 'release.yml'), releaseWorkflow);

  // Create release instructions
  const releaseInstructions = `# Loadout Release Guide

## Prerequisites

1. **Icons**: Place your app icons in \`build/icons/\`
   - See \`build/ICON_GUIDE.md\` for details
   
2. **Code Signing** (Optional but recommended):
   - **macOS**: Requires Apple Developer Certificate
   - **Windows**: Requires Code Signing Certificate
   
3. **GitHub Token**: Set \`GH_TOKEN\` environment variable
   - Create at: https://github.com/settings/tokens
   - Needs \`repo\` scope

## Local Build Commands

### Build for Current Platform
\`\`\`bash
npm run dist
\`\`\`

### Build for Specific Platform
\`\`\`bash
npm run dist:mac    # macOS (requires macOS)
npm run dist:win    # Windows
npm run dist:linux  # Linux
\`\`\`

### Build and Publish to GitHub
\`\`\`bash
GH_TOKEN=your_token npm run release
\`\`\`

## Automated Releases with GitHub Actions

1. Update version in \`package.json\`
2. Commit and push changes
3. Create and push a tag:
   \`\`\`bash
   git tag v2.2.0
   git push origin v2.2.0
   \`\`\`
4. GitHub Actions will automatically build and create a draft release

## Manual Release Steps

1. Build locally: \`npm run dist\`
2. Find installers in \`release/[version]/\`
3. Create GitHub release manually
4. Upload the installers

## Platform-Specific Notes

### macOS
- Unsigned apps will show security warning
- Users need to right-click and select "Open" first time
- Or go to System Preferences > Security & Privacy

### Windows
- Unsigned apps will show SmartScreen warning
- Users can click "More info" then "Run anyway"

### Linux
- AppImage: Make executable with \`chmod +x\`
- Deb: Install with \`sudo dpkg -i\`

## Troubleshooting

- **Missing icons**: Create placeholder icons or use icon generators
- **Build fails**: Check Node.js version (>=16 required)
- **GitHub publish fails**: Verify GH_TOKEN has correct permissions
`;

  await createFile(path.join(rootDir, 'RELEASE_GUIDE.md'), releaseInstructions);

  console.log('\n✨ Build setup complete!');
  console.log('\nNext steps:');
  console.log('1. Create your app icons and place them in build/icons/');
  console.log('2. Update YOUR_USERNAME in package.json and electron-builder.json');
  console.log('3. Run "npm run dist" to build for your current platform');
  console.log('4. See RELEASE_GUIDE.md for detailed instructions');
}

// Run the setup
setupBuildResources().catch(console.error); 