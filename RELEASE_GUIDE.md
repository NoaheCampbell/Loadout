# Loadout Release Guide

## Prerequisites

1. **Icons**: Place your app icons in `build/icons/`
   - See `build/ICON_GUIDE.md` for details
   
2. **Code Signing** (Optional but recommended):
   - **macOS**: Requires Apple Developer Certificate
   - **Windows**: Requires Code Signing Certificate
   
3. **GitHub Token**: Set `GH_TOKEN` environment variable
   - Create at: https://github.com/settings/tokens
   - Needs `repo` scope

## Local Build Commands

### Build for Current Platform
```bash
npm run dist
```

### Build for Specific Platform
```bash
npm run dist:mac    # macOS (requires macOS)
npm run dist:win    # Windows
npm run dist:linux  # Linux
```

### Build and Publish to GitHub
```bash
GH_TOKEN=your_token npm run release
```

## Automated Releases with GitHub Actions

1. Update version in `package.json`
2. Commit and push changes
3. Create and push a tag:
   ```bash
   git tag v2.2.0
   git push origin v2.2.0
   ```
4. GitHub Actions will automatically build and create a draft release

## Manual Release Steps

1. Build locally: `npm run dist`
2. Find installers in `release/[version]/`
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
- AppImage: Make executable with `chmod +x`
- Deb: Install with `sudo dpkg -i`

## Troubleshooting

- **Missing icons**: Create placeholder icons or use icon generators
- **Build fails**: Check Node.js version (>=16 required)
- **GitHub publish fails**: Verify GH_TOKEN has correct permissions
