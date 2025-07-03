# Icon Generation

All icon files in this directory are automatically generated from `public/Loadout.png`.

## Generating Icons

Run the following command to regenerate all icon files:

```bash
npm run generate-icons
```

This will create:
- `icon.icns` - macOS app icon
- `icon.ico` - Windows app icon (multi-size)
- Various PNG files - For Linux and general use
- Updated `public/favicon.ico` - Browser favicon

## Requirements

- Node.js and npm
- ImageMagick (for ICO generation)
  - macOS: `brew install imagemagick`
  - Windows: Download from imagemagick.org
  - Linux: `sudo apt-get install imagemagick`

## Source Image

The source image is `public/Loadout.png`. To change the app icon:
1. Replace `public/Loadout.png` with your new icon (preferably 1024x1024 or larger)
2. Run `npm run generate-icons`
3. The icons will be automatically generated when building with `npm run build`

## Notes

- Icons are automatically generated before building (via prebuild script)
- Generated files are ignored by git (see .gitignore)
- The script handles transparent backgrounds properly 