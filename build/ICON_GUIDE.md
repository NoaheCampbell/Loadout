# Icon Generation Guide for Loadout

## Required Icon Files

### macOS
- **icon.icns**: macOS icon file
  - Create from a 1024x1024 PNG using: `iconutil -c icns icon.iconset`
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
   ```bash
   for size in 16 32 48 64 128 256 512 1024; do
     convert icon.png -resize ${size}x${size} ${size}x${size}.png
   done
   ```

Place all generated files in the `build/icons/` directory.
