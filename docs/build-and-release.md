# Building and Releasing Loadout

This guide explains how to build Loadout for distribution and create releases for users to download.

## Quick Start

1. **Run the setup script** (first time only):
   ```bash
   npm run setup:build
   ```

2. **Build for your current platform**:
   ```bash
   npm run dist
   ```

3. **Find your installer** in `release/[version]/`

## Complete Setup

### 1. Prerequisites

- Node.js 16+ and npm
- Platform-specific requirements:
  - **macOS**: Xcode Command Line Tools
  - **Windows**: Visual Studio Build Tools
  - **Linux**: build-essential, rpm (for rpm packages)

### 2. Update Project Info

Replace `YOUR_USERNAME` with your GitHub username in:
- `package.json`
- `electron-builder.json`

### 3. Create App Icons

You need icons for each platform:

#### Option A: Quick Start with Online Tools
1. Create a 1024x1024 PNG of your logo
2. Use [cloudconvert.com](https://cloudconvert.com) to convert:
   - PNG → ICO (Windows)
   - PNG → ICNS (macOS)
3. Use an image editor to resize for Linux sizes

#### Option B: Professional Icons
```bash
# Install ImageMagick
brew install imagemagick  # macOS
# or
sudo apt-get install imagemagick  # Ubuntu

# Create all sizes from your 1024x1024 icon.png
for size in 16 32 48 64 128 256 512 1024; do
  convert icon.png -resize ${size}x${size} build/icons/${size}x${size}.png
done

# Create .ico file (Windows)
convert icon.png -define icon:auto-resize=256,128,64,48,32,16 build/icons/icon.ico

# Create .icns file (macOS)
# First create iconset
mkdir icon.iconset
for size in 16 32 64 128 256 512 1024; do
  convert icon.png -resize ${size}x${size} icon.iconset/icon_${size}x${size}.png
done
# Then convert to icns
iconutil -c icns icon.iconset -o build/icons/icon.icns
rm -rf icon.iconset
```

### 4. Build Commands

#### Build for Current Platform
```bash
npm run dist
```

#### Build for Specific Platform
```bash
npm run dist:mac    # macOS DMG and ZIP
npm run dist:win    # Windows NSIS installer
npm run dist:linux  # Linux AppImage and DEB
```

#### Build All Platforms (requires each platform)
```bash
npm run build:app
```

## GitHub Releases

### Automated Releases (Recommended)

1. **Push your code** to GitHub
2. **Update version** in `package.json`
3. **Create and push a tag**:
   ```bash
   git add .
   git commit -m "Release v2.2.0"
   git tag v2.2.0
   git push origin main --tags
   ```
4. **GitHub Actions** will automatically:
   - Build for all platforms
   - Create a draft release
   - Upload installers

### Manual Release

1. **Set GitHub Token**:
   ```bash
   export GH_TOKEN=your_github_token
   ```

2. **Build and publish**:
   ```bash
   npm run release
   ```

## Platform Notes

### macOS
- **Unsigned apps** will show a security warning
- Users must right-click → Open on first launch
- Or: System Preferences → Security & Privacy → Open Anyway

### Windows
- **SmartScreen** may block unsigned apps
- Users click "More info" → "Run anyway"
- Consider code signing for production

### Linux
- **AppImage**: Make executable with `chmod +x`
- **DEB**: Install with `sudo dpkg -i loadout.deb`

## Code Signing (Optional)

### macOS Code Signing
```bash
# Set environment variables
export CSC_LINK=path/to/certificate.p12
export CSC_KEY_PASSWORD=your_password

# Build with signing
npm run dist:mac
```

### Windows Code Signing
```bash
# Set environment variables
export CSC_LINK=path/to/certificate.pfx
export CSC_KEY_PASSWORD=your_password

# Build with signing
npm run dist:win
```

## Troubleshooting

### Build Fails
- Check Node.js version: `node --version` (needs 16+)
- Delete `node_modules` and reinstall: `rm -rf node_modules && npm install`
- Clear electron cache: `rm -rf ~/.electron`

### Icons Not Working
- Ensure icons are in `build/icons/`
- Check file names match exactly: `icon.ico`, `icon.icns`
- Verify icon format is correct

### GitHub Release Fails
- Verify `GH_TOKEN` has `repo` scope
- Check repository exists and you have write access
- Ensure version tag doesn't already exist

## Distribution Channels

### Direct Download
- Upload to GitHub Releases
- Host on your website
- Share download links

### App Stores (Future)
- **Mac App Store**: Requires Apple Developer account
- **Microsoft Store**: Requires developer account
- **Snap Store**: For Linux distribution

## Update System

Loadout includes auto-update functionality:
- Users are notified of new versions
- Updates download in background
- Simple one-click install

Just publish new releases to GitHub, and users will automatically get updates! 